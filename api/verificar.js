// POST /api/verificar — reconcilia el pago con Lemon Squeezy.
// Para el caso «ya pagué pero sigue en PENDIENTE» (el webhook no llegó):
// busca una suscripción activa del usuario por email y, si existe, activa su
// Placeta Joven (nunca se le hace pagar dos veces).
'use strict';

const { edadOk, docVigente, activarDoc } = require('../lib/placetajoven');
const { buscarActivaPorEmail } = require('../lib/checkout');
const store = require('../lib/store');
const { setCors, json, handleOptions, requiereUsuario } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const u = await requiereUsuario(req, res);
  if (!u) return;
  if (!edadOk(u.registro.edad)) return json(res, 403, { error: 'edad_no_permitida' });

  const dip = String(u.registro.dip || '').trim().toUpperCase();

  try {
    const doc = docVigente(await store.get(dip));
    if (doc && doc.status === 'ACTIVO') {
      return json(res, 200, { ok: true, estado: 'ACTIVO', plan: doc.plan || null });
    }

    const email = String(u.registro.correo || u.registro.email || '').trim();
    let ls;
    try {
      ls = await buscarActivaPorEmail(email);
    } catch (e) {
      // Sin configuración de LS o error de Lemon Squeezy
      const code = e && e.code ? e.code : 'LS_ERROR';
      return json(res, code === 'NO_CONFIG' ? 503 : 502, { error: code });
    }

    if (!ls) {
      return json(res, 200, { ok: false, estado: doc ? doc.status : null, motivo: 'sin_suscripcion' });
    }

    const nuevo = activarDoc(doc, ls);
    nuevo.placeta_id = dip;
    await store.set(nuevo);
    return json(res, 200, { ok: true, estado: 'ACTIVO', plan: nuevo.plan, subscriptionId: nuevo.subscription_id });
  } catch (e) {
    return json(res, 500, { error: 'internal' });
  }
};
