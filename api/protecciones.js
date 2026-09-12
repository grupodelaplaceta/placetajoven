'use strict';

const protecciones = require('../lib/protecciones');
const { setCors, json, handleOptions, requiereUsuario, readBody } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method === 'GET') return json(res, 200, { ok: true, protecciones: protecciones.listar() });
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const u = await requiereUsuario(req, res);
  if (!u) return;
  let body = {};
  try { const raw = await readBody(req); if (raw) body = JSON.parse(raw); } catch (e) { return json(res, 400, { error: 'json_invalido' }); }
  try {
    const dip = String(u.registro.dip || '').trim().toUpperCase();
    return json(res, 201, await protecciones.registrarInteres(dip, String(body.proteccionId || '')));
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || 'internal' });
  }
};
