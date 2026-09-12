'use strict';

const becas = require('../lib/becas');
const { setCors, json, handleOptions, requiereUsuario, readBody } = require('./_util');

function juntaAutorizada(req) {
  const expected = String(process.env.JUNTA_API_KEY || '');
  return expected.length > 10 && req.headers['x-junta-api-key'] === expected;
}

// No dependemos del parser del framework: funciona igual en Vercel y en el
// servidor local (req.query no existe en Node puro).
function query(req) {
  try {
    return new URL(req.url || '/', 'http://localhost').searchParams;
  } catch (e) {
    return new URLSearchParams();
  }
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const params = query(req);
  let body = {};
  if (req.method === 'POST') {
    try { const raw = await readBody(req); if (raw) body = JSON.parse(raw); } catch (e) { return json(res, 400, { error: 'json_invalido' }); }
  }
  if (req.method === 'POST' && body.accion === 'resolver') {
    if (!juntaAutorizada(req)) return json(res, 401, { error: 'junta_no_autorizada' });
    try {
      const dip = String(body.dip || '').trim().toUpperCase();
      return json(res, 200, { ok: true, beca: await becas.resolver(dip, String(body.becaId || ''), body.decision, body.motivo) });
    } catch (error) { return json(res, error.status || 500, { error: error.message || 'internal' }); }
  }
  const u = await requiereUsuario(req, res);
  if (!u) return;
  const dip = String(u.registro.dip || '').trim().toUpperCase();
  try {
    if (req.method === 'GET') {
      if (params.get('accion') === 'calcular') {
        return json(res, 200, { ok: true, resultado: await becas.previsualizar(dip, { caminoId: params.get('caminoId'), elementoId: params.get('elementoId') }) });
      }
      return json(res, 200, { ok: true, becas: await becas.historial(dip) });
    }
    return json(res, 201, { ok: true, beca: await becas.solicitar(dip, body) });
  } catch (error) { return json(res, error.status || 500, { error: error.code || error.message || 'internal' }); }
};
