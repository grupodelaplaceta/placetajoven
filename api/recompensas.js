// /api/recompensas — catálogo de recompensas disponibles (Placeta Joven).
//
//   GET  /api/recompensas                  → { ok, demo, recompensas }
//   POST /api/recompensas { recompensaId } → canjea la recompensa y entrega la
//                                            key al socio (la guarda en su doc).
//
// El canje está DESACTIVADO por defecto: hay que poner RECOMPENSAS_CANJEO=1
// cuando existan colaboraciones reales (y códigos reales en el pool). Mientras
// tanto devuelve 403 { error: 'canjeo_desactivado' }.
// Requiere usuario identificado con PlacetaID y suscripción activa/vigente.
'use strict';

const { listar, yaConseguida, anadirKey } = require('../lib/recompensas');
const { tomarUna } = require('../lib/keypool');
const { edadOk, docVigente } = require('../lib/placetajoven');
const store = require('../lib/store');
const { setCors, json, handleOptions, requiereUsuario, readBody } = require('./_util');

const CANJEO_ACTIVO = String(process.env.RECOMPENSAS_CANJEO || '0') === '1';

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method === 'GET') return listarCatalogo(req, res);
  if (req.method === 'POST') return canjearRecompensa(req, res);

  return json(res, 405, { error: 'method_not_allowed' });
};

async function listarCatalogo(req, res) {
  const u = await requiereUsuario(req, res);
  if (!u) return; // ya respondió con el error adecuado
  try {
    const { demo, recompensas } = await listar();
    return json(res, 200, { ok: true, demo, recompensas });
  } catch (e) {
    return json(res, 500, { error: 'internal' });
  }
}

async function canjearRecompensa(req, res) {
  const u = await requiereUsuario(req, res);
  if (!u) return;

  // 1) El canje debe estar activado (colaboraciones reales).
  if (!CANJEO_ACTIVO) {
    return json(res, 403, { error: 'canjeo_desactivado', motivo: 'El canje se activará cuando haya recompensas confirmadas.' });
  }

  let body = {};
  try {
    const raw = await readBody(req);
    if (raw) body = JSON.parse(raw);
  } catch (e) {
    return json(res, 400, { error: 'json_invalido' });
  }
  const recompensaId = String(body.recompensaId || '').trim();
  if (!recompensaId) return json(res, 400, { error: 'recompensa_requerida' });

  const dip = String(u.registro.dip || '').trim().toUpperCase();

  // 2) Edad 16–30.
  if (!edadOk(u.registro.edad)) {
    return json(res, 403, { error: 'edad_no_permitida' });
  }

  // 3) Suscripción activa o cancelada con vigencia.
  const doc = docVigente(await store.get(dip));
  const vigente = !!(doc && doc.expires_at && new Date(doc.expires_at).getTime() > Date.now());
  const activo = doc && (doc.status === 'ACTIVO' || (doc.status === 'CANCELADO' && vigente));
  if (!activo) return json(res, 403, { error: 'no_activa' });

  // 4) La recompensa existe, está activa y es canjeable.
  const { demo, recompensas } = await listar();
  const r = recompensas.find((x) => x.id === recompensaId);
  if (!r) return json(res, 404, { error: 'recompensa_no_encontrada' });
  if (!r.canjeable) return json(res, 409, { error: 'no_disponible' });

  // 5) Una key por usuario y título.
  if (yaConseguida(doc, recompensaId)) {
    return json(res, 409, { error: 'ya_conseguida' });
  }

  // 6) Tomar una key del pool (asignación atómica) y guardarla en el doc.
  const key = await tomarUna(recompensaId, dip);
  if (!key) return json(res, 409, { error: 'sin_stock' });

  const { doc: nuevo, key: keyPublica } = anadirKey(doc, r, key);
  nuevo.placeta_id = dip;
  await store.set(nuevo);

  return json(res, 200, {
    ok: true,
    demo,
    recompensaId,
    pz: keyPublica.pz,
    key: {
      id: keyPublica.id,
      juego: keyPublica.juego,
      plataforma: keyPublica.plataforma,
      codigo: keyPublica.codigo,
      estado: keyPublica.estado
    }
  });
}

