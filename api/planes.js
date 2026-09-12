// GET /api/planes - tarifas publicas de Placeta Joven
'use strict';

const cfg = require('../config/placetajoven.json');
const { setCors, json, handleOptions } = require('./_util');

const EURO = (n) => Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

module.exports = (req, res) => {
  setCors(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const planes = ['mensual', 'anual'].map((id) => {
    const plan = cfg.planes[id];
    return {
      id,
      etiqueta: id === 'anual' ? 'Plan anual' : 'Plan mensual',
      precio: plan.precio,
      precioLabel: EURO(plan.precio) + (id === 'anual' ? '/año' : '/mes'),
      periodoLabel: id === 'anual' ? 'al año' : 'al mes',
      destacado: id === 'anual',
      ahorroLabel: id === 'anual' ? 'Ahorra frente a pagar 12 meses' : ''
    };
  });

  return json(res, 200, { ok: true, planes });
};
