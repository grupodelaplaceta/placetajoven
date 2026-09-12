'use strict';

const crypto = require('crypto');
const store = require('./store');
const caminos = require('./caminos');

const BAREMO = [
  { min: 0, max: 24, porcentaje: 0, nivel: 'Sin beca' },
  { min: 25, max: 49, porcentaje: 25, nivel: 'Baja' },
  { min: 50, max: 69, porcentaje: 50, nivel: 'Media' },
  { min: 70, max: 84, porcentaje: 75, nivel: 'Alta' },
  { min: 85, max: 100, porcentaje: 100, nivel: 'Maxima' }
];

const INDICADORES = [
  ['renta', 40], ['laboral', 15], ['dependientes', 15],
  ['vulnerabilidad', 15], ['patrimonio', 10], ['gastos', 5]
];

function numero(value, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
}

function calcularINB(indicadores) {
  const detalle = {};
  let total = 0;
  INDICADORES.forEach(([id, max]) => {
    detalle[id] = { puntos: numero(indicadores && indicadores[id], max), max };
    total += detalle[id].puntos;
  });
  const baremo = BAREMO.find((item) => total >= item.min && total <= item.max) || BAREMO[0];
  return { total, detalle, nivel: baremo.nivel, porcentajeReconocido: baremo.porcentaje };
}

function idBeca() { return `beca-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`; }

async function elementoDe(body) {
  const lista = await caminos.catalogo();
  const camino = lista.find((item) => item.id === String(body.caminoId || ''));
  const elemento = camino && caminos.elementos(camino).find((item) => item.id === String(body.elementoId || body.cursoId || ''));
  if (!camino || !elemento) {
    const error = new Error('elemento_formativo_no_encontrado');
    error.status = 400;
    throw error;
  }
  return { camino, elemento };
}

async function historial(dip) {
  const doc = await store.get(dip);
  return doc && Array.isArray(doc.becas) ? doc.becas : [];
}

async function solicitar(dip, body) {
  const { camino, elemento } = await elementoDe(body);
  const indicadores = body.indicadores || {};
  const inb = calcularINB(indicadores);
  const elegible = Math.max(0, Number(elemento.matricula || 0) + Number(elemento.gestion || 0));
  const pmb = numero(elemento.pmb == null ? 100 : elemento.pmb, 100);
  const aplicado = Math.min(inb.porcentajeReconocido, pmb);
  const becaPz = Math.round(elegible * aplicado / 100);
  const solicitud = {
    id: idBeca(), estado: 'PENDIENTE', creadaEn: new Date().toISOString(), actualizadaEn: new Date().toISOString(),
    caminoId: camino.id, camino: camino.nombre, elementoId: elemento.id, elemento: elemento.titulo,
    proveedor: elemento.proveedor || 'PlacetaEDU', tipoElemento: elemento.tipo || 'curso',
    precio: { matricula: Number(elemento.matricula || 0), gestion: Number(elemento.gestion || 0), elegible, pmb, becaPz, aportacionPz: elegible - becaPz },
    recompensa: Number(elemento.recompensa || 0), bonus: Number(elemento.bonus || 0),
    indicadores: inb.detalle, inb: inb.total, nivel: inb.nivel,
    porcentajeReconocido: inb.porcentajeReconocido, porcentajeAplicado: aplicado,
    documentacion: Array.isArray(body.documentacion) ? body.documentacion.map((item) => String(item).slice(0, 240)) : [],
    motivo: '', historial: [{ estado: 'PENDIENTE', fecha: new Date().toISOString(), motivo: 'Solicitud registrada' }]
  };
  const doc = (await store.get(dip)) || { placeta_id: dip };
  doc.becas = Array.isArray(doc.becas) ? doc.becas : [];
  doc.becas.push(solicitud);
  doc.placeta_id = dip;
  await store.set(doc);
  return solicitud;
}

async function resolver(dip, solicitudId, decision, motivo) {
  const doc = await store.get(dip);
  const lista = doc && Array.isArray(doc.becas) ? doc.becas : [];
  const beca = lista.find((item) => item.id === solicitudId);
  if (!beca) { const error = new Error('beca_no_encontrada'); error.status = 404; throw error; }
  const estado = decision === 'aceptar' ? 'ACEPTADA' : decision === 'denegar' ? 'DENEGADA' : '';
  if (!estado) { const error = new Error('decision_invalida'); error.status = 400; throw error; }
  if (estado === 'DENEGADA' && !String(motivo || '').trim()) { const error = new Error('motivo_obligatorio'); error.status = 400; throw error; }
  beca.estado = estado;
  beca.motivo = String(motivo || '').trim();
  beca.actualizadaEn = new Date().toISOString();
  beca.historial = Array.isArray(beca.historial) ? beca.historial : [];
  beca.historial.push({ estado, fecha: beca.actualizadaEn, motivo: beca.motivo || 'Solicitud aceptada por la Junta' });
  doc.becas = lista;
  await store.set(doc);
  return beca;
}

module.exports = { BAREMO, INDICADORES, calcularINB, historial, solicitar, resolver };
