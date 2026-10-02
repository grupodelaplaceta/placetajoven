'use strict';

const crypto = require('crypto');
const { resolverPanel } = require('../lib/panel-access');
const { listarAdministracion, guardarAdministracion, activarAdministracion } = require('../lib/recompensas');
const keypool = require('../lib/keypool');
const actividades = require('../lib/actividades');
const { setCors, json, handleOptions, requiereUsuario, readBody } = require('./_util');

const CANJEO_ACTIVO = String(process.env.RECOMPENSAS_CANJEO || '0') === '1';

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const user = await requiereUsuario(req, res);
  if (!user) return;
  const access = resolverPanel(user.registro);

  if (req.method === 'GET') return leerPanel(res, access);
  return accionPanel(req, res, access);
};

async function leerPanel(res, access) {
  if (access.role === 'socio') return json(res, 200, { ok: true, role: 'socio' });
  try {
    const all = await listarAdministracion();
    const juegos = access.role === 'admin'
      ? all
      : all.filter((game) => game.studioId === access.studioId);
    return json(res, 200, {
      ok: true,
      role: access.role,
      studioId: access.role === 'studio' ? access.studioId : null,
      juegos,
      canjeoActivo: CANJEO_ACTIVO,
      limiteMensualPz: actividades.resumenMensual(null).limitePz
    });
  } catch (error) {
    const code = error && (error.code === 'catalog_not_configured' || error.code === 'catalog_unavailable')
      ? error.code : 'internal';
    return json(res, 200, {
      ok: false,
      role: access.role,
      studioId: access.role === 'studio' ? access.studioId : null,
      juegos: [],
      error: code,
      canjeoActivo: CANJEO_ACTIVO,
      limiteMensualPz: actividades.resumenMensual(null).limitePz
    });
  }
}

async function accionPanel(req, res, access) {
  let body = {};
  try {
    const raw = await readBody(req);
    if (raw) body = JSON.parse(raw);
  } catch (error) {
    return json(res, 400, { error: 'json_invalido' });
  }

  const action = String(body.accion || '');
  if (access.role === 'admin') {
    if (action === 'activar' || action === 'pausar') {
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { error: 'recompensa_requerida' });
      try {
        await activarAdministracion(id, action === 'activar');
        return json(res, 200, { ok: true });
      } catch (error) {
        const code = error && error.code || 'internal';
        return json(res, error.status || 502, { error: code });
      }
    }
    if (action === 'crear') return crearJuego(res, body);
    return json(res, 400, { error: 'accion_invalida' });
  }

  if (access.role === 'studio' && action === 'anadir_claves') return anadirClaves(res, access, body);
  return json(res, 403, { error: 'panel_no_autorizado' });
}

function urlHttp(valor) {
  if (!valor) return '';
  try {
    const parsed = new URL(String(valor));
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
  } catch (error) {
    return '';
  }
}

function slug(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
    + '-' + crypto.randomBytes(3).toString('hex');
}

async function crearJuego(res, body) {
  const nombre = String(body.nombre || '').trim().slice(0, 140);
  const desarrolladora = String(body.desarrolladora || '').trim().slice(0, 140);
  const descripcion = String(body.descripcion || '').trim().slice(0, 2400);
  const gratis = body.gratis === true;
  const url = urlHttp(body.url);
  const imagen = urlHttp(body.imagen);
  const pz = Number(body.pz);
  if (!nombre || !desarrolladora || !descripcion || !url) return json(res, 400, { error: 'ficha_incompleta' });
  if (!gratis && (!Number.isInteger(pz) || pz < 100 || pz > 1000)) return json(res, 400, { error: 'precio_pz_invalido' });

  try {
    const existentes = await listarAdministracion();
    const orden = existentes.reduce((maximo, item) => Math.max(maximo, item.orden), 0) + 1;
    const id = slug(nombre);
    const data = {
      id,
      nombre,
      desarrolladora,
      descripcion,
      categoria: 'videojuegos',
      plataforma: String(body.plataforma || 'Steam').trim().slice(0, 60),
      tipoJuego: gratis ? 'recomendado' : 'clave',
      gratis,
      promocionada: gratis,
      url,
      steamUrl: url,
      imagen: imagen || null,
      edadRecomendada: String(body.edadRecomendada || '').trim().slice(0, 20),
      pz: gratis ? 0 : pz,
      disponibilidad: 'Disponible',
      canjeable: !gratis,
      condiciones: String(body.condiciones || '').trim().slice(0, 1600),
      studioId: String(body.studioId || '').trim().slice(0, 80)
    };
    await guardarAdministracion({ id, categoria: 'videojuegos', orden, activa: true, data });
    return json(res, 201, { ok: true, id });
  } catch (error) {
    const code = error && error.code || 'internal';
    return json(res, error.status || 502, { error: code });
  }
}

async function anadirClaves(res, access, body) {
  const recompensaId = String(body.recompensaId || '').trim();
  const codigos = String(body.codigos || '').split(/\r?\n/).map((code) => code.trim()).filter(Boolean);
  if (!recompensaId || !codigos.length || codigos.length > 500) return json(res, 400, { error: 'claves_invalidas' });

  try {
    const juegos = await listarAdministracion();
    const game = juegos.find((item) => item.id === recompensaId && item.studioId === access.studioId);
    if (!game || game.gratis || game.tipoJuego !== 'clave') return json(res, 404, { error: 'juego_no_autorizado' });
    const result = await keypool.importar(recompensaId, codigos, game.plataforma || '');
    return json(res, 200, { ok: true, insertadas: result.insertadas, procesadas: result.procesadas });
  } catch (error) {
    const code = error && error.code || 'internal';
    return json(res, error.status || 502, { error: code });
  }
}