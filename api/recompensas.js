// GET /api/recompensas — catálogo de recompensas disponibles (Placeta Joven).
// Requiere usuario identificado con PlacetaID.
// Devuelve { ok, demo, recompensas } — `demo: true` si se sirve el catálogo de
// ejemplo (aún no hay recompensas confirmadas ni la tabla en Supabase).
'use strict';

const { listar } = require('../lib/recompensas');
const { setCors, json, handleOptions, requiereUsuario } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const u = await requiereUsuario(req, res);
  if (!u) return; // ya respondió con el error adecuado

  try {
    const { demo, recompensas } = await listar();
    return json(res, 200, { ok: true, demo, recompensas });
  } catch (e) {
    return json(res, 500, { error: 'internal' });
  }
};
