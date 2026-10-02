// POST /api/test-login - sesión sintética solo para entornos de prueba
'use strict';

const { json, handleOptions, readBody } = require('./_util');

const DEFAULT_TEST_KEY = 'demo-placeta-joven';
const DEFAULT_TEST_DIP = 'TEST-PLACETA-JOVEN';
const DEFAULT_TEST_EDAD = 25;

function habilitado() {
  const mode = String(process.env.PLACETAJOVEN_TEST_MODE || '1');
  return mode === '1'
    && process.env.VERCEL_ENV !== 'production'
    && process.env.NODE_ENV !== 'production';
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!habilitado()) return json(res, 404, { error: 'not_found' });
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  let body = {};
  try {
    const raw = await readBody(req);
    if (raw) body = JSON.parse(raw);
  } catch (e) {
    return json(res, 400, { error: 'json_invalido' });
  }

  const key = String(process.env.PLACETAJOVEN_TEST_KEY || DEFAULT_TEST_KEY);
  if (!key || body.key !== key) return json(res, 401, { error: 'test_key_invalida' });
  return json(res, 200, {
    ok: true,
    token: `test:${key}`,
    user: {
      dip: String(process.env.PLACETAJOVEN_TEST_DIP || DEFAULT_TEST_DIP),
      edad: Number(process.env.PLACETAJOVEN_TEST_EDAD || DEFAULT_TEST_EDAD),
      nombreCompleto: 'Usuario de pruebas',
      test: true
    }
  });
};