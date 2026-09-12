'use strict';

const actividades = require('../lib/actividades');
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
      return json(res, 200, { ok: true, actividades: actividades.catalogoPublico(), estado: await actividades.estado(dip) });
    }
    let body = {};
    try { const raw = await readBody(req); if (raw) body = JSON.parse(raw); } catch (e) { return json(res, 400, { error: 'json_invalido' }); }

    // Comprobar un ejercicio suelto: respuesta inmediata sin revelar la solución.
    if (String(body.accion || '') === 'comprobar') {
      return json(res, 200, { ok: true, comprobacion: actividades.comprobarEjercicio(body.actividadId, body.ejercicioId, body.respuesta) });
    }

    const salida = await actividades.enviarIntento(dip, body.actividadId, body.respuestas || {});
    return json(res, 200, { ok: true, ...salida });
  } catch (error) {
    return json(res, error.status || 500, { error: error.code || error.message || 'internal', detalle: error.detalle || null });
  }
};
