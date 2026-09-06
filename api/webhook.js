// POST /api/webhook — Lemon Squeezy (verificación de firma + aplicación)
'use strict';

const { verifyWebhook, aplicarEvento } = require('../lib/placetajoven');
const store = require('../lib/store');
const { setCors, json, handleOptions, readBody } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const secret = process.env.LS_WEBHOOK_SECRET || '';
  if (!secret) return json(res, 503, { error: 'no_config' });

  const raw = await readBody(req).catch(() => '');
  const signature = String(req.headers['x-signature'] || '');
  if (!verifyWebhook(secret, raw, signature)) return json(res, 401, { error: 'firma_invalida' });

  let ev;
  try { ev = JSON.parse(raw); } catch (e) { return json(res, 400, { error: 'json_invalido' }); }

  const meta = (ev && ev.meta) || {};
  const data = (ev && ev.data) || {};
  const eventName = meta.event_name || '';
  const custom = meta.custom_data || {};
  const placetaId = String(custom.placeta_id || data.custom_data && data.custom_data.placeta_id || '').trim().toUpperCase();

  if (!placetaId) return json(res, 400, { error: 'sin_placeta_id' });

  const actual = await store.get(placetaId);
  const doc = aplicarEvento(actual, eventName, data);
  doc.placeta_id = placetaId;
  doc.updated_at = new Date().toISOString();
  if (!actual) doc.created_at = doc.created_at || new Date().toISOString();

  await store.set(doc);
  return json(res, 200, { ok: true, evento: eventName, estado: doc.status, placeta_id: placetaId });
};
