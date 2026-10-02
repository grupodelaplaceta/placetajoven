'use strict';

const crypto = require('crypto');
const opiniones = require('../lib/opiniones');
const { edadOk, docVigente } = require('../lib/placetajoven');
const store = require('../lib/store');
const actividades = require('../lib/actividades');
const { setCors, json, handleOptions, requiereUsuario, readBody } = require('./_util');

const PREMIO_PZ = 40;
const ESPERA_OPINION_MS = 24 * 60 * 60 * 1000;

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method === 'GET') return listarOpiniones(req, res);
  if (req.method === 'POST') return publicarOpinion(req, res);
  return json(res, 405, { error: 'method_not_allowed' });
};

async function listarOpiniones(req, res) {
  const url = new URL(req.url, 'http://localhost');
  try {
    const lista = await opiniones.listar(url.searchParams.get('recompensaId') || '');
    return json(res, 200, { ok: true, opiniones: lista });
  } catch (error) {
    return json(res, error.status || 502, { error: error.code || 'opiniones_no_disponibles' });
  }
}

async function publicarOpinion(req, res) {
  const user = await requiereUsuario(req, res);
  if (!user) return;
  const dip = String(user.registro.dip || '').trim().toUpperCase();
  if (!edadOk(user.registro.edad)) return json(res, 403, { error: 'edad_no_permitida' });

  let body = {};
  try {
    const raw = await readBody(req);
    if (raw) body = JSON.parse(raw);
  } catch (error) {
    return json(res, 400, { error: 'json_invalido' });
  }
  const keyId = String(body.keyId || '').trim();
  const estrellas = Number(body.estrellas);
  const texto = opiniones.textoValido(body.texto);
  if (!keyId || !Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5 || !texto) {
    return json(res, 400, { error: 'opinion_invalida' });
  }

  const doc = docVigente(await store.get(dip));
  const vigente = !!(doc && doc.expires_at && new Date(doc.expires_at).getTime() > Date.now());
  const activa = doc && (doc.status === 'ACTIVO' || (doc.status === 'CANCELADO' && vigente));
  if (!activa && user.registro.test !== true) return json(res, 403, { error: 'no_activa' });

  const key = (doc && Array.isArray(doc.keys) ? doc.keys : []).find((item) => String(item.id) === keyId);
  if (!key) return json(res, 404, { error: 'key_no_encontrada' });
  if (key.opinionId) return json(res, 409, { error: 'opinion_duplicada' });
  if (!opiniones.puedeOpinar(key)) {
    const otorgada = Date.parse(String(key.otorgada || ''));
    return json(res, 409, {
      error: 'espera_24h',
      disponibleEn: Number.isFinite(otorgada) ? new Date(otorgada + ESPERA_OPINION_MS).toISOString() : null
    });
  }

  const creado = new Date().toISOString();
  let opinion;
  try {
    opinion = await opiniones.publicar({
      id: crypto.randomUUID(),
      recompensa_id: String(key.recompensaId || ''),
      juego: String(key.juego || 'Juego indie'),
      placeta_id: dip,
      key_id: keyId,
      estrellas,
      texto,
      publicada: true,
      created_at: creado
    });
  } catch (error) {
    return json(res, error.status || 502, { error: error.code || 'opinion_no_publicada' });
  }

  const limite = actividades.resumenMensual(doc);
  const obtienePremio = limite.restantesPz >= PREMIO_PZ;
  key.opinionId = opinion.id;
  key.opinionAt = opinion.fecha;
  if (obtienePremio) {
    doc.recompensasPendientes = Array.isArray(doc.recompensasPendientes) ? doc.recompensasPendientes : [];
    doc.recompensasPendientes.push({
      id: 'op-' + crypto.randomBytes(5).toString('hex'),
      origen: 'opinion',
      actividad: 'Opinión sobre ' + String(key.juego || 'Juego indie'),
      recompensaPz: PREMIO_PZ,
      bonusPz: 0,
      estado: 'PENDIENTE_BANCO',
      creadaEn: creado
    });
  }
  doc.placeta_id = dip;
  await store.set(doc);

  return json(res, 201, {
    ok: true,
    opinion,
    recompensaPendiente: obtienePremio ? PREMIO_PZ : 0,
    limiteMensualAlcanzado: !obtienePremio,
    limiteMensual: actividades.resumenMensual(doc)
  });
}