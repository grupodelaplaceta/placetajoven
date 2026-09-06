// Placeta Joven — utilidades comunes de la API (CORS + token)
'use strict';

const { GatewayError, sesion } = require('../lib/gateway');

const ORIGENES_OK = [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^https:\/\/joven\.laplaceta\.org$/, /^https:\/\/placetajoven\.vercel\.app$/];

function corsOk(origin) {
  if (!origin) return false;
  return ORIGENES_OK.some((re) => re.test(origin));
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (corsOk(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Signature');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function bearerToken(req) {
  const a = req.headers.authorization || '';
  return a.startsWith('Bearer ') ? a.slice(7).trim() : '';
}

async function requiereUsuario(req, res) {
  const token = bearerToken(req);
  try {
    const registro = await sesion(token);
    return { token, registro };
  } catch (err) {
    const code = err instanceof GatewayError ? err.code : 'error';
    json(res, err.status || 500, { error: code });
    return null;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) { reject(new Error('body_too_large')); req.destroy(); } });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

module.exports = { setCors, json, handleOptions, bearerToken, requiereUsuario, readBody };
