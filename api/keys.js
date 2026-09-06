// POST /api/keys — acciones del socio sobre sus keys de juegos indie.
// body: { keyId, accion: 'canjear' }  (marca la key como canjeada/usada)
'use strict';

const store = require('../lib/store');
const { setCors, json, handleOptions, requiereUsuario, readBody } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const u = await requiereUsuario(req, res);
  if (!u) return;

  let body = {};
  try {
    const raw = await readBody(req);
    if (raw) body = JSON.parse(raw);
  } catch (e) { return json(res, 400, { error: 'json_invalido' }); }

  const keyId = String(body.keyId || '');
  const accion = String(body.accion || 'canjear').toLowerCase();
  if (!keyId) return json(res, 400, { error: 'key_requerida' });

  const dip = String(u.registro.dip || '').trim().toUpperCase();
  const doc = await store.get(dip);
  if (!doc || !Array.isArray(doc.keys)) return json(res, 404, { error: 'sin_keys' });

  const key = doc.keys.find((k) => String(k.id) === keyId);
  if (!key) return json(res, 404, { error: 'key_no_encontrada' });

  if (accion === 'canjear') {
    if (key.estado === 'usado') return json(res, 409, { error: 'ya_canjeada' });
    key.estado = 'usado';
    key.canjeada = new Date().toISOString();
    doc.updated_at = new Date().toISOString();
    await store.set(doc);
    return json(res, 200, { ok: true, keyId, estado: 'usado' });
  }

  if (accion === 'restaurar') {
    key.estado = 'disponible';
    key.canjeada = null;
    doc.updated_at = new Date().toISOString();
    await store.set(doc);
    return json(res, 200, { ok: true, keyId, estado: 'disponible' });
  }

  return json(res, 400, { error: 'accion_invalida' });
};
