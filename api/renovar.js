// POST /api/renovar — checkout para renovar la suscripción (mismo o nuevo plan)
'use strict';

const { edadOk, planValido } = require('../lib/placetajoven');
const { crearCheckout } = require('../lib/checkout');
const store = require('../lib/store');
const { setCors, json, handleOptions, requiereUsuario, readBody } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const u = await requiereUsuario(req, res);
  if (!u) return;
  if (!edadOk(u.registro.edad)) return json(res, 403, { error: 'edad_no_permitida' });

  const doc = await store.get(u.registro.dip);
  let plan = doc && doc.plan ? doc.plan : 'anual';
  try {
    const raw = await readBody(req);
    if (raw) { const b = JSON.parse(raw); if (b.plan) plan = b.plan; }
  } catch (e) { return json(res, 400, { error: 'json_invalido' }); }
  if (!planValido(plan)) return json(res, 400, { error: 'plan_invalido' });

  try {
    const url = await crearCheckout(plan, { dip: u.registro.dip, email: u.registro.correo });
    return json(res, 200, { ok: true, checkoutUrl: url, plan });
  } catch (e) {
    const code = e && e.code ? e.code : 'error';
    return json(res, code === 'NO_CONFIG' ? 503 : 502, { error: code });
  }
};
