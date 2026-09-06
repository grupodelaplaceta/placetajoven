// GET /api/status — estado de Placeta Joven del usuario (con control de edad)
'use strict';

const { edadOk, docVigente } = require('../lib/placetajoven');
const store = require('../lib/store');
const { setCors, json, handleOptions, requiereUsuario } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const u = await requiereUsuario(req, res);
  if (!u) return;

  const registro = u.registro;
  const permitido = edadOk(registro.edad);
  const base = { ok: true, dip: registro.dip, edad: registro.edad != null ? Number(registro.edad) : null, permitido };

  if (!permitido) {
    return json(res, 200, { ...base, estado: null, bloqueado: true });
  }

  const doc = docVigente(await store.get(registro.dip)) || null;
  if (doc && doc.status !== 'ACTIVO' && doc.expires_at) {
    await store.set(doc); // persistir posible paso a EXPIRADO
  }

  return json(res, 200, {
    ...base,
    bloqueado: false,
    estado: doc ? doc.status : null,
    plan: doc ? doc.plan : null,
    startedAt: doc ? doc.started_at : null,
    expiresAt: doc ? doc.expires_at : null,
    requiereAlta: !doc || doc.status === 'EXPIRADO' || doc.status === 'CANCELADO'
  });
};
