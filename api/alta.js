// POST /api/alta — checkout de Lemon Squeezy para darse de alta
'use strict';

const { edadOk, planValido } = require('../lib/placetajoven');
const { crearCheckout } = require('../lib/checkout');
const store = require('../lib/store');
const { setCors, json, handleOptions, requiereUsuario, readBody, origenPermitido } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const u = await requiereUsuario(req, res);
  if (!u) return;
  if (!edadOk(u.registro.edad)) return json(res, 403, { error: 'edad_no_permitida' });

  let plan = 'anual';
  try {
    const raw = await readBody(req);
    if (raw) { const b = JSON.parse(raw); plan = b.plan || plan; }
  } catch (e) { return json(res, 400, { error: 'json_invalido' }); }

  if (!planValido(plan)) return json(res, 400, { error: 'plan_invalido' });

  const doc = await store.get(u.registro.dip);
  if (doc && doc.status === 'ACTIVO') return json(res, 409, { error: 'ya_activo' });

  try {
    const redirectUrl = (origenPermitido(req) || process.env.SITE_URL) + '/mi.html?pago=ok';
    const url = await crearCheckout(plan, { dip: u.registro.dip, email: u.registro.correo, redirectUrl });
    // Marcamos un placeholder PENDIENTE para que el usuario vea el flujo
    if (!doc) {
      await store.set({
        placeta_id: String(u.registro.dip).trim().toUpperCase(),
        status: 'PENDIENTE',
        plan,
        started_at: null,
        expires_at: null,
        payment_provider: 'lemonsqueezy',
        subscription_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    return json(res, 200, { ok: true, checkoutUrl: url, plan });
  } catch (e) {
    const code = e && e.code ? e.code : 'error';
    return json(res, code === 'NO_CONFIG' ? 503 : 502, { error: code });
  }
};
