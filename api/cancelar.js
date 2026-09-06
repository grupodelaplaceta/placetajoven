// POST /api/cancelar — cancela la suscripción (mantiene el acceso hasta fin de período)
'use strict';

const { edadOk } = require('../lib/placetajoven');
const { cancelarSuscripcion } = require('../lib/checkout');
const store = require('../lib/store');
const { setCors, json, handleOptions, requiereUsuario } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const u = await requiereUsuario(req, res);
  if (!u) return;
  if (!edadOk(u.registro.edad)) return json(res, 403, { error: 'edad_no_permitida' });

  const doc = await store.get(u.registro.dip);
  if (!doc || doc.status !== 'ACTIVO') return json(res, 400, { error: 'no_activa' });

  if (doc.subscription_id) await cancelarSuscripcion(doc.subscription_id);

  doc.status = 'CANCELADO';
  doc.updated_at = new Date().toISOString();
  await store.set(doc);

  return json(res, 200, {
    ok: true,
    estado: doc.status,
    plan: doc.plan,
    expiresAt: doc.expires_at,
    nota: 'Seguirá activo hasta el final del período ya pagado.'
  });
};
