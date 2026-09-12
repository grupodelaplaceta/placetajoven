'use strict';

const banco = require('../lib/banco');
const { setCors, json, handleOptions, requiereUsuario, readBody } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const u = await requiereUsuario(req, res);
  if (!u) return;
  let body = {};
  try { const raw = await readBody(req); if (raw) body = JSON.parse(raw); } catch (e) { return json(res, 400, { error: 'json_invalido' }); }
  try {
    const resultado = await banco.solicitarCuentaJoven({
      dip: String(u.registro.dip || '').trim().toUpperCase(),
      nombre: u.registro.nombreCompleto || u.registro.nombre || '',
      correo: u.registro.correo || '',
      origen: 'placeta-joven',
      aceptarCashback: body.aceptarCashback === true,
      retorno: process.env.SITE_URL ? `${process.env.SITE_URL}/espacio/miplaceta.html?cuenta=ok` : ''
    });
    return json(res, 200, { ok: true, solicitud: resultado });
  } catch (error) {
    return json(res, error.status || 502, { error: error.code || 'banco_no_disponible' });
  }
};
