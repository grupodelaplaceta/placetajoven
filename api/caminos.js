'use strict';

const caminos = require('../lib/caminos');
const { setCors, json, handleOptions, requiereUsuario, readBody } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const u = await requiereUsuario(req, res);
  if (!u) return;
  const dip = String(u.registro.dip || '').trim().toUpperCase();
  try {
    if (req.method === 'GET') {
      return json(res, 200, { ok: true, caminos: caminos.catalogo(), estado: await caminos.estado(dip) });
    }
    let body = {};
    try { const raw = await readBody(req); if (raw) body = JSON.parse(raw); } catch (e) { return json(res, 400, { error: 'json_invalido' }); }
    const solicitud = await caminos.solicitarConvalidacion(dip, body);
    return json(res, 201, { ok: true, solicitud });
  } catch (error) {
    return json(res, error.status || 500, { error: error.code || 'internal' });
  }
};
