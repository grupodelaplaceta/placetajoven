// GET /api/status — estado de Placeta Joven del usuario autenticado
'use strict';

const { edadOk, docVigente, pendienteCaducada } = require('../lib/placetajoven');
const cfg = require('../config/placetajoven.json');
const store = require('../lib/store');
const { setCors, json, handleOptions, requiereUsuario } = require('./_util');

const EURO = (n) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

function planInfo(plan) {
  if (plan === 'anual') {
    const p = cfg.planes.anual;
    return { id: 'anual', etiqueta: 'Plan anual', precio: p.precio, precioLabel: EURO(p.precio) + '/año', periodoLabel: 'al año', oferta: true };
  }
  if (plan === 'mensual') {
    const p = cfg.planes.mensual;
    return { id: 'mensual', etiqueta: 'Plan mensual', precio: p.precio, precioLabel: EURO(p.precio) + '/mes', periodoLabel: 'al mes', oferta: false };
  }
  return null;
}

function planesPublicos() {
  return ['mensual', 'anual'].map((id) => {
    const info = planInfo(id);
    return Object.assign(info, {
      destacado: id === 'anual',
      ahorroLabel: id === 'anual' ? 'Ahorra frente a pagar 12 meses' : ''
    });
  });
}

// Devuelve solo las keys del socio.
function keysPublicas(doc) {
  if (!doc || !Array.isArray(doc.keys)) return [];
  return doc.keys.map((k) => ({
    id: k.id,
    juego: k.juego,
    plataforma: k.plataforma || '',
    codigo: k.codigo || '',
    estado: k.estado === 'usado' ? 'usado' : 'disponible',
    otorgada: k.otorgada || null,
    canjeada: k.canjeada || null,
    recompensaId: k.recompensaId || null,
    pz: k.pz || null
  }));
}

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
        edad: u.registro.edad,
        estado: null,
        plan: null,
        planInfo: null,
        planes: planesPublicos(),
        expiresAt: null,
        requiereAlta: false,
        keys: []
      });
    }

    const doc = docVigente(await store.get(dip));

    if (!doc || !doc.status) {
      return json(res, 200, {
        permitido: true,
        bloqueado: false,
        edad: u.registro.edad,
        estado: null,
        plan: null,
        planInfo: null,
        planes: planesPublicos(),
        expiresAt: null,
        requiereAlta: true,
        pendienteCaducada: false,
        keys: []
      });
    }

    const vigente = !!(doc.expires_at && new Date(doc.expires_at).getTime() > Date.now());
    // Un pago PENDIENTE abandonado (> 2 h sin confirmar) no debe bloquear al
    // usuario: se le deja elegir plan de nuevo (requiereAlta = true).
    const pendienteMuerta = doc.status === 'PENDIENTE' && pendienteCaducada(doc);
    const requiereAlta = pendienteMuerta || doc.status === 'EXPIRADO' || (doc.status === 'CANCELADO' && !vigente);

    return json(res, 200, {
      permitido: true,
      bloqueado: false,
      edad: u.registro.edad,
      estado: doc.status,
      plan: doc.plan || null,
      planInfo: planInfo(doc.plan),
      planes: planesPublicos(),
      expiresAt: doc.expires_at || null,
      sigueVigente: vigente,
      requiereAlta: requiereAlta,
      pendienteCaducada: !!pendienteMuerta,
      keys: keysPublicas(doc)
    });
  } catch (e) {
    // Última red de seguridad: nunca devolver HTML crudo de Vercel
    return json(res, 500, { error: 'internal' });
  }
};
