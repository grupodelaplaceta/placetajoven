'use strict';

const store = require('./store');

const PROTECCIONES = [
  {
    id: 'digital',
    nombre: 'Proteccion digital',
    resumen: 'Orientada a accesos no autorizados y fraude digital.',
    icono: 'shield',
    estado: 'interes',
    nota: 'Producto pendiente de aseguradora y condiciones definitivas.'
  },
  {
    id: 'actividades',
    nombre: 'Accidentes en actividades',
    resumen: 'Para actividades y encuentros organizados por La Placeta.',
    icono: 'heart',
    estado: 'interes',
    nota: 'Se definira segun actividad, edad y entidad organizadora.'
  },
  {
    id: 'dispositivo',
    nombre: 'Dispositivo de estudio',
    resumen: 'Proteccion orientada a equipos usados para formarte.',
    icono: 'book',
    estado: 'interes',
    nota: 'No hay precio ni cobertura publicada todavía.'
  }
];

function listar() {
  return PROTECCIONES.map((item) => ({ ...item }));
}

async function registrarInteres(dip, proteccionId) {
  const producto = PROTECCIONES.find((item) => item.id === proteccionId);
  if (!producto) {
    const error = new Error('proteccion_no_encontrada');
    error.status = 404;
    throw error;
  }
  const doc = (await store.get(dip)) || { placeta_id: dip };
  doc.interesesProteccion = Array.isArray(doc.interesesProteccion) ? doc.interesesProteccion : [];
  if (!doc.interesesProteccion.some((item) => item.proteccionId === producto.id)) {
    doc.interesesProteccion.push({ proteccionId: producto.id, estado: 'PENDIENTE', creadaEn: new Date().toISOString() });
    doc.placeta_id = dip;
    await store.set(doc);
  }
  return { ok: true, proteccionId: producto.id, estado: 'PENDIENTE' };
}

module.exports = { listar, registrarInteres };
