// GET /api/status — estado de Placeta Joven del usuario autenticado
'use strict';

const { edadOk, docVigente } = require('../lib/placetajoven');
const store = require('../lib/store');
const { setCors, json, handleOptions, requiereUsuario } = require('./_util');

module.exports = async (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const u = await requiereUsuario(req, res);
    if (!u) return; // ya respondió con el error adecuado

    const dip = String(u.registro.dip || '').trim().toUpperCase();
    const ok = edadOk(u.registro.edad);

    // Gate de edad
    if (!ok) {
      return json(res, 200, {
        permitido: false,
        bloqueado: true,
        motivo: 'edad_no_permitida',
        estado: null,
        plan: null,
        expiresAt: null,
        requiereAlta: false
      });
    }

    const doc = docVigente(await store.get(dip));
    if (!doc || !doc.status) {
      return json(res, 200, {
        permitido: true,
        bloqueado: false,
        estado: null,
        plan: null,
        expiresAt: null,
        requiereAlta: true
      });
    }

    return json(res, 200, {
      permitido: true,
      bloqueado: false,
      estado: doc.status,
      plan: doc.plan || null,
      expiresAt: doc.expires_at || null,
      requiereAlta: doc.status === 'CANCELADO' || doc.status === 'EXPIRADO'
    });
  } catch (e) {
    // Última red de seguridad: nunca devolver HTML crudo de Vercel
    return json(res, 500, { error: 'internal' });
  }
};
