'use strict';

const { listar, paraEscaparate } = require('../lib/recompensas');
const { setCors, json, handleOptions } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const { recompensas } = await listar();
    return json(res, 200, { ok: true, juegos: paraEscaparate(recompensas) });
  } catch (error) {
    const code = error && (error.code === 'catalog_not_configured' || error.code === 'catalog_unavailable')
      ? error.code : 'internal';
    return json(res, code === 'catalog_not_configured' ? 503 : 502, { error: code });
  }
};