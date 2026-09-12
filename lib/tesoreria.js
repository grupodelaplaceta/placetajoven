'use strict';

/* Tesorería de Placeta Joven.

   Regla económica del programa:
   - Las ventas de la plataforma se ingresan en la cuenta BUSINESS de Placeta
     Joven en Banco de La Placeta.
   - Las recompensas (actividades, caminos, claves) salen de esa cuenta.
   - Las becas las paga la Administración de La Placeta a Placeta Joven: son un
     ingreso, no un gasto de la cuenta business.

   Placeta Joven NO ejecuta movimientos: registra órdenes y las envía al Banco,
   que es quien mueve las Placetas. Sin la cuenta configurada, solo se informa
   del estado. */

const store = require('./store');

function configuracion() {
  const cuenta = String(process.env.PLACETA_JOVEN_CUENTA_BUSINESS || '').trim();
  const administracion = String(process.env.PLACETA_ADMIN_CUENTA || '').trim();
  return {
    cuentaBusiness: cuenta || null,
    cuentaAdministracion: administracion || null,
    lista: Boolean(cuenta)
  };
}

const FLUJOS = [
  { id: 'ventas', nombre: 'Ventas de la plataforma', direccion: 'entrada', destino: 'cuentaBusiness' },
  { id: 'recompensas', nombre: 'Recompensas a participantes', direccion: 'salida', origen: 'cuentaBusiness' },
  { id: 'becas', nombre: 'Becas de la Administración', direccion: 'entrada', origen: 'cuentaAdministracion', destino: 'cuentaBusiness' },
  { id: 'claves', nombre: 'Claves de juego', direccion: 'salida', origen: 'cuentaBusiness' }
];

async function estado(dip, docDado) {
  const doc = docDado || await store.get(dip);
  const pendientes = (doc && doc.recompensasPendientes) || [];
  const cfg = configuracion();
  return {
    cuenta: cfg,
    flujos: FLUJOS.map((f) => ({ ...f })),
    ordenesPendientes: pendientes.filter((o) => o.estado === 'PENDIENTE_BANCO'),
    totalPendientePz: pendientes
      .filter((o) => o.estado === 'PENDIENTE_BANCO')
      .reduce((s, o) => s + Number(o.recompensaPz || 0) + Number(o.bonusPz || 0), 0),
    aviso: cfg.lista
      ? null
      : 'La cuenta business de Placeta Joven aún no está configurada en el Banco; las órdenes quedan registradas y pendientes.'
  };
}

module.exports = { configuracion, FLUJOS, estado };
