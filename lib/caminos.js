'use strict';

const crypto = require('crypto');
const store = require('./store');

const CAMINOS = [
  {
    id: 'programacion',
    nombre: 'Primeros pasos en programacion',
    descripcion: 'Construye una base practica para empezar a programar.',
    nivel: 'Inicial',
    recompensaFinal: 150,
    cursos: [
      { id: 'ciber-intro', titulo: 'Introduccion a la ciberseguridad', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'externo', recompensa: 75, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu' },
      { id: 'prog', titulo: 'Programacion: primeros pasos', proveedor: 'Placeta Joven', tipo: 'interno', recompensa: 75, convalidable: true, url: '' }
    ]
  },
  {
    id: 'tecnologia',
    nombre: 'Fundamentos de tecnologia',
    descripcion: 'Redes, dispositivos y seguridad para moverte con confianza.',
    nivel: 'Inicial',
    recompensaFinal: 120,
    cursos: [
      { id: 'ti-fund', titulo: 'Fundamentos de TI', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'externo', recompensa: 70, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu' },
      { id: 'redes-basico', titulo: 'Fundamentos de redes', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'externo', recompensa: 75, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu' }
    ]
  },
  {
    id: 'ciberseguridad',
    nombre: 'Base de ciberseguridad',
    descripcion: 'Protege tus cuentas, dispositivos y proyectos.',
    nivel: 'Inicial',
    recompensaFinal: 100,
    cursos: [
      { id: 'ciber-intro', titulo: 'Introduccion a la ciberseguridad', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'externo', recompensa: 75, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu' }
    ]
  }
];

function catalogo() {
  return CAMINOS.map((camino) => ({ ...camino, cursos: camino.cursos.map((curso) => ({ ...curso })) }));
}

function idSolicitud() {
  return `cv-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

async function estado(dip) {
  const doc = await store.get(dip);
  return {
    caminos: doc && doc.caminos ? doc.caminos : {},
    convalidaciones: doc && Array.isArray(doc.convalidaciones) ? doc.convalidaciones : [],
    recompensasPendientes: doc && Array.isArray(doc.recompensasPendientes) ? doc.recompensasPendientes : []
  };
}

async function solicitarConvalidacion(dip, body) {
  const camino = CAMINOS.find((item) => item.id === String(body.caminoId || ''));
  const curso = camino && camino.cursos.find((item) => item.id === String(body.cursoId || ''));
  if (!camino || !curso || !curso.convalidable) {
    const error = new Error('curso_no_convalidable');
    error.status = 400;
    throw error;
  }
  const doc = (await store.get(dip)) || { placeta_id: dip };
  const solicitud = {
    id: idSolicitud(),
    caminoId: camino.id,
    cursoId: curso.id,
    curso: curso.titulo,
    proveedor: String(body.proveedor || curso.proveedor),
    referencia: String(body.referencia || '').trim(),
    evidenciaUrl: String(body.evidenciaUrl || '').trim(),
    completadoEn: body.completadoEn || null,
    estado: 'PENDIENTE',
    recompensa: curso.recompensa,
    creadaEn: new Date().toISOString()
  };
  doc.convalidaciones = Array.isArray(doc.convalidaciones) ? doc.convalidaciones : [];
  doc.convalidaciones.push(solicitud);
  doc.placeta_id = dip;
  await store.set(doc);
  return solicitud;
}

module.exports = { catalogo, estado, solicitarConvalidacion, CAMINOS };
