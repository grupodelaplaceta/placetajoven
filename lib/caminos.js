'use strict';

const crypto = require('crypto');
const store = require('./store');
const actividades = require('./actividades');

/* Un camino es una meta con etapas ordenadas. Cada elemento es un paso real:
   un curso externo (PlacetaEDU), una actividad del motor propio o un proyecto.
   Los elementos de tipo 'actividad' NO duplican contenido: apuntan a una
   actividad del motor y se completan cuando esa actividad se aprueba. */
const CAMINOS_BASE = [
  {
    id: 'carnet-b',
    nombre: 'Carnet B: prepara la teórica',
    descripcion: 'Los cinco bloques de la teórica del turismo y un examen final mezclado.',
    nivel: 'Inicial',
    recompensaFinal: 150,
    etapas: [
      { id: 'senales', nombre: 'Señales y marcas viales', elementos: [elementoActividad('carnet-senales')] },
      { id: 'normas', nombre: 'Normas y velocidad', elementos: [elementoActividad('carnet-normas')] },
      { id: 'prioridad', nombre: 'Prioridad y maniobras', elementos: [elementoActividad('carnet-prioridad', ['act-carnet-normas'])] },
      { id: 'seguridad', nombre: 'Seguridad vial', elementos: [elementoActividad('carnet-seguridad', ['act-carnet-normas'])] },
      { id: 'documentacion', nombre: 'Documentación y sanciones', elementos: [elementoActividad('carnet-documentacion', ['act-carnet-senales'])] },
      {
        id: 'examen',
        nombre: 'Examen final',
        elementos: [
          elementoActividad('carnet-examen', ['act-carnet-senales', 'act-carnet-normas', 'act-carnet-prioridad', 'act-carnet-seguridad', 'act-carnet-documentacion']),
          {
            id: 'dgt-test-oficial',
            titulo: 'Test oficiales de la DGT',
            proveedor: 'DGT',
            tipo: 'recurso',
            descripcion: 'Practica con los test oficiales en la web de la Dirección General de Tráfico.',
            recompensa: 0,
            bonus: 0,
            matricula: 0,
            gestion: 0,
            pmb: null,
            convalidable: false,
            url: 'https://www.dgt.es/',
            requisitos: []
          }
        ]
      }
    ]
  },
  {
    id: 'carnet-moto',
    nombre: 'Moto y ciclomotor',
    descripcion: 'Lo que cambia respecto al turismo: estabilidad, equipo y maniobras propias.',
    nivel: 'Inicial',
    recompensaFinal: 120,
    etapas: [
      {
        id: 'equipo',
        nombre: 'Equipo y casco',
        elementos: [
          {
            id: 'moto-casco',
            titulo: 'Casco homologado y equipo obligatorio',
            proveedor: 'Placeta Joven',
            tipo: 'recurso',
            descripcion: 'Guía del casco, protección ocular, guantes y ropa reflectante.',
            recompensa: 0,
            bonus: 0,
            matricula: 0,
            gestion: 0,
            pmb: null,
            convalidable: false,
            url: 'https://www.dgt.es/',
            requisitos: []
          },
          elementoActividad('carnet-seguridad', [])
        ]
      },
      { id: 'via', nombre: 'Circular en moto', elementos: [elementoActividad('carnet-normas', []), elementoActividad('carnet-prioridad', ['act-carnet-normas'])] },
      { id: 'examen', nombre: 'Examen tipo', elementos: [elementoActividad('carnet-examen', ['act-carnet-normas'])] }
    ]
  },
  {
    id: 'ciberseguridad',
    nombre: 'Introduccion a la ciberseguridad',
    descripcion: 'Desde los fundamentos hasta un proyecto practico de seguridad.',
    nivel: 'Inicial',
    recompensaFinal: 100,
    etapas: [
      { id: 'fundamentos', nombre: 'Fundamentos digitales', elementos: [
        { id: 'ti-fund', titulo: 'Fundamentos de TI', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 70, bonus: 0, matricula: 280, gestion: 45, pmb: 50, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: [] },
        elementoActividad('ciber-fundamentos')
      ] },
      { id: 'redes', nombre: 'Introduccion a redes', elementos: [
        { id: 'redes-basico', titulo: 'Fundamentos de redes', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 75, bonus: 0, matricula: 300, gestion: 50, pmb: 75, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: ['ti-fund'] },
        elementoActividad('redes-conceptos')
      ] },
      { id: 'seguridad', nombre: 'Seguridad de dispositivos', elementos: [
        { id: 'ciber-intro', titulo: 'Introduccion a la ciberseguridad', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 75, bonus: 20, matricula: 300, gestion: 50, pmb: 75, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: ['redes-basico'] },
        elementoActividad('ciber-practicas', ['act-ciber-fundamentos'])
      ] },
      { id: 'final', nombre: 'Proyecto y evaluacion final', elementos: [{ id: 'ciber-final', titulo: 'Proyecto practico de ciberseguridad', proveedor: 'Placeta Joven', tipo: 'proyecto', recompensa: 100, bonus: 0, matricula: 0, gestion: 0, pmb: 100, convalidable: false, url: '', requisitos: ['ciber-intro', 'ciber-practicas'] }] }
    ]
  },
  {
    id: 'tecnologia',
    nombre: 'Fundamentos de tecnologia',
    descripcion: 'Redes, dispositivos y ofimatica para moverte con confianza.',
    nivel: 'Inicial',
    recompensaFinal: 120,
    etapas: [
      { id: 'base', nombre: 'Base tecnologica', elementos: [
        { id: 'ti-fund', titulo: 'Fundamentos de TI', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 70, bonus: 0, matricula: 280, gestion: 45, pmb: 50, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: [] }
      ] },
      { id: 'redes', nombre: 'Redes', elementos: [
        { id: 'redes-basico', titulo: 'Fundamentos de redes', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 75, bonus: 0, matricula: 300, gestion: 50, pmb: 75, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: ['ti-fund'] },
        elementoActividad('redes-conceptos')
      ] },
      { id: 'ofimatica', nombre: 'Ofimatica y datos', elementos: [
        elementoActividad('excel-basico'),
        elementoActividad('sql-basico', ['act-excel-basico'])
      ] }
    ]
  }
];

/* Crea un elemento de camino a partir de una actividad del motor común:
   el titulo, la recompensa y los requisitos salen de la propia actividad,
   así no hay dos sitios que puedan contradecirse.
   Las actividades son la capa de práctica: no dependen de cursos externos ni
   de trámites, así que cualquiera puede empezar a hacer cosas el primer día. */
function elementoActividad(actividadId, requisitos) {
  const a = actividades.actividad(actividadId);
  if (!a) return null;
  return {
    id: `act-${a.id}`,
    titulo: a.titulo,
    proveedor: 'Placeta Joven',
    tipo: 'actividad',
    actividadId: a.id,
    descripcion: a.descripcion,
    minutos: a.minutos,
    ejercicios: a.ejercicios.length,
    recompensa: 0,                       // la recompensa la paga la actividad, no el camino
    recompensaActividad: Number(a.economia.recompensaPz || 0),
    bonusActividad: Number(a.economia.bonusPz || 0),
    matricula: 0,
    gestion: 0,
    pmb: null,
    convalidable: false,
    url: '',
    requisitos: requisitos || []
  };
}

/* Un elemento de tipo «recurso» es un enlace de apoyo (por ejemplo, los test
   oficiales de la DGT): se muestra en el camino, pero no es un paso que se
   complete, así que no cuenta para el progreso ni puede bloquear nada. */
function esPaso(elemento) {
  return Boolean(elemento) && elemento.tipo !== 'recurso';
}

function elementosDe(camino) {
  return (camino.etapas || []).flatMap((etapa) => (etapa.elementos || []).filter(Boolean).map((elemento) => ({ ...elemento, etapaId: etapa.id, etapa: etapa.nombre })));
}

function normalizar(caminos) {
  return (Array.isArray(caminos) ? caminos : []).map((camino) => ({
    ...camino,
    etapas: (camino.etapas || []).map((etapa) => ({ ...etapa, elementos: (Array.isArray(etapa.elementos) ? etapa.elementos : []).filter(Boolean) }))
  }));
}

async function catalogo() {
  const base = normalizar(CAMINOS_BASE);
  const url = String(process.env.PLACETAEDU_API_URL || '').replace(/\/+$/, '');
  if (!url) return base;
  try {
    const response = await fetch(`${url}/pathways`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return base;
    const data = await response.json();
    return normalizar(data.caminos || data.pathways || data).length ? normalizar(data.caminos || data.pathways || data) : base;
  } catch (error) {
    return base;
  }
}

function idSolicitud() {
  return `cv-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

async function estado(dip) {
  const doc = await store.get(dip);
  const caminos = await catalogo();
  const completados = new Set(Object.entries((doc && doc.progresoCaminos) || {}).filter(([, value]) => value && value.estado === 'COMPLETADO').map(([id]) => id));
  const convalidaciones = doc && Array.isArray(doc.convalidaciones) ? doc.convalidaciones : [];
  const convalidados = new Set(convalidaciones.filter((item) => item.estado === 'APROBADA').map((item) => item.cursoId));
  // Las actividades se completan en su propio motor: aquí solo se leen, no se duplican.
  const intentos = (doc && doc.actividades) || {};
  const hecho = (item) => completados.has(item.id) || convalidados.has(item.id) || Boolean(item.actividadId && intentos[item.actividadId] && intentos[item.actividadId].completada);
  const progreso = caminos.map((camino) => {
    const items = elementosDe(camino).filter(esPaso);
    const completoPorId = new Map(items.map((item) => [item.id, hecho(item)]));
    const cumple = (req) => Boolean(completoPorId.get(req) || completados.has(req) || convalidados.has(req));
    const estados = items.map((item) => {
      const completo = Boolean(completoPorId.get(item.id));
      const disponible = !completo && (item.requisitos || []).every(cumple);
      return { id: item.id, actividadId: item.actividadId || null, estado: completo ? 'COMPLETADO' : (disponible ? 'DISPONIBLE' : 'BLOQUEADO') };
    });
    return { caminoId: camino.id, completados: estados.filter((item) => item.estado === 'COMPLETADO').length, total: estados.length, porcentaje: estados.length ? Math.round((estados.filter((item) => item.estado === 'COMPLETADO').length / estados.length) * 100) : 0, elementos: estados };
  });
  return {
    caminos: doc && doc.caminos ? doc.caminos : {},
    progreso,
    convalidaciones,
    actividades: Object.keys(intentos).map((id) => ({ actividadId: id, ...intentos[id] })),
    recompensasPendientes: doc && Array.isArray(doc.recompensasPendientes) ? doc.recompensasPendientes : []
  };
}

async function solicitarConvalidacion(dip, body) {
  const camino = (await catalogo()).find((item) => item.id === String(body.caminoId || ''));
  const curso = camino && elementosDe(camino).find((item) => item.id === String(body.cursoId || ''));
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

module.exports = { catalogo, estado, solicitarConvalidacion, CAMINOS: CAMINOS_BASE, elementos: elementosDe, elementosDe };
