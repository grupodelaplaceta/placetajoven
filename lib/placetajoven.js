// Placeta Joven — lógica pura (edad, planes, estados, webhook Lemon Squeezy)
// Sin dependencias externas: se puede probar con `node --test tests/`.
'use strict';

const crypto = require('crypto');

const AGE_MIN = 16;
const AGE_MAX = 30;

// Planes y productos Lemon Squeezy (config real en config/placetajoven.json)
const PLANES = {
  mensual: { id: 'mensual', productoId: 1342686, etiqueta: 'Plan mensual', meses: 1 },
  anual: { id: 'anual', productoId: 1343043, etiqueta: "Drop Joven '26 (anual)", meses: 12 }
};

const ESTADOS = ['PENDIENTE', 'ACTIVO', 'SUSPENDIDO', 'CANCELADO', 'EXPIRADO'];

function edadOk(edad) {
  const e = Number(edad);
  return Number.isFinite(e) && e >= AGE_MIN && e <= AGE_MAX;
}

function planValido(plan) {
  return plan === 'mensual' || plan === 'anual';
}

function duracionMs(plan) {
  const p = PLANES[plan] || PLANES.mensual;
  return p.meses * 30 * 24 * 60 * 60 * 1000;
}

function calcExpira(plan, desde) {
  const base = desde instanceof Date ? desde.getTime() : Number(desde) || Date.now();
  return new Date(base + duracionMs(plan)).toISOString();
}

function docVigente(doc) {
  if (!doc) return null;
  if (doc.status === 'ACTIVO' && doc.expires_at && new Date(doc.expires_at).getTime() <= Date.now()) {
    doc.status = 'EXPIRADO';
  }
  return doc;
}

// ── Firma del webhook de Lemon Squeezy (X-Signature, HMAC-SHA256) ──
function firma(secret, raw) {
  return crypto.createHmac('sha256', String(secret || '')).update(raw, 'utf8').digest('hex');
}

function verifyWebhook(secret, raw, xSignature) {
  try {
    const a = Buffer.from(String(xSignature || '').trim(), 'hex');
    const b = Buffer.from(firma(secret, raw), 'hex');
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

// ── Mapeo de estados de Lemon Squeezy → Placeta Joven ──
function estadoDesdeLs(lsStatus) {
  switch (String(lsStatus || '').toLowerCase()) {
    case 'active':
    case 'on_trial':
      return 'ACTIVO';
    case 'cancelled':
      return 'CANCELADO';
    case 'expired':
      return 'EXPIRADO';
    case 'paused':
    case 'unpaid':
      return 'SUSPENDIDO';
    default:
      return 'PENDIENTE';
  }
}

// variant de LS (id de variante) → plan nuestro (según env)
function variantToPlan(variantId, actualPlan) {
  const v = String(variantId || '');
  const m = String(process.env.LS_VARIANT_MENSUAL || '');
  const a = String(process.env.LS_VARIANT_ANUAL || '');
  if (m && v === m) return 'mensual';
  if (a && v === a) return 'anual';
  return planValido(actualPlan) ? actualPlan : null;
}

// Evento de Lemon Squeezy → mutación sobre el documento de suscripción
function aplicarEvento(doc, eventName, data) {
  const attrs = (data && data.attributes) || {};
  const subId = String((data && data.id) || attrs.id || doc.subscription_id || '');
  const plan = variantToPlan(attrs.variant_id, doc && doc.plan);
  const renews = attrs.renews_at || attrs.ends_at || null;

  const out = Object.assign({}, doc || {});
  if (subId) out.subscription_id = subId;
  if (plan) out.plan = plan;
  out.payment_provider = 'lemonsqueezy';
  out.updated_at = new Date().toISOString();

  switch (String(eventName || '')) {
    case 'order_created':
    case 'subscription_created':
    case 'subscription_payment_success':
    case 'subscription_resumed':
      out.status = 'ACTIVO';
      out.started_at = out.started_at || new Date().toISOString();
      out.expires_at = renews || calcExpira(plan || out.plan, Date.now());
      break;
    case 'subscription_updated':
      out.status = estadoDesdeLs(attrs.status) === 'ACTIVO' ? (out.status === 'ACTIVO' ? 'ACTIVO' : estadoDesdeLs(attrs.status)) : estadoDesdeLs(attrs.status);
      if (renews) out.expires_at = renews;
      break;
    case 'subscription_paused':
    case 'subscription_payment_failed':
      out.status = 'SUSPENDIDO';
      break;
    case 'subscription_cancelled':
      out.status = 'CANCELADO';
      if (renews) out.expires_at = renews; // sigue activo hasta el fin del período pagado
      break;
    case 'subscription_expired':
      out.status = 'EXPIRADO';
      if (renews) out.expires_at = renews;
      break;
    default:
      out.status = estadoDesdeLs(attrs.status) || out.status || 'PENDIENTE';
  }
  return out;
}

module.exports = {
  AGE_MIN,
  AGE_MAX,
  PLANES,
  ESTADOS,
  edadOk,
  planValido,
  calcExpira,
  docVigente,
  firma,
  verifyWebhook,
  estadoDesdeLs,
  variantToPlan,
  aplicarEvento
};
