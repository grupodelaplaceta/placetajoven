'use strict';

const crypto = require('crypto');
const store = require('./store');

const CAMINOS_BASE = [
  {
    id: 'ciberseguridad',
    nombre: 'Introduccion a la ciberseguridad',
    descripcion: 'Desde los fundamentos hasta un proyecto practico de seguridad.',
    nivel: 'Inicial',
    recompensaFinal: 100,
    etapas: [
      { id: 'fundamentos', nombre: 'Fundamentos digitales', elementos: [{ id: 'ti-fund', titulo: 'Fundamentos de TI', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 70, bonus: 0, matricula: 280, gestion: 45, pmb: 50, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: [] }] },
      { id: 'redes', nombre: 'Introduccion a redes', elementos: [{ id: 'redes-basico', titulo: 'Fundamentos de redes', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 75, bonus: 0, matricula: 300, gestion: 50, pmb: 75, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: ['ti-fund'] }] },
      { id: 'seguridad', nombre: 'Seguridad de dispositivos', elementos: [{ id: 'ciber-intro', titulo: 'Introduccion a la ciberseguridad', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 75, bonus: 20, matricula: 300, gestion: 50, pmb: 75, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: ['redes-basico'] }] },
      { id: 'final', nombre: 'Proyecto y evaluacion final', elementos: [{ id: 'ciber-final', titulo: 'Proyecto practico de ciberseguridad', proveedor: 'Placeta Joven', tipo: 'proyecto', recompensa: 100, bonus: 0, matricula: 0, gestion: 0, pmb: 100, convalidable: false, url: '', requisitos: ['ciber-intro'] }] }
    ]
  },
  {
    id: 'tecnologia',
    nombre: 'Fundamentos de tecnologia',
    descripcion: 'Redes, dispositivos y seguridad para moverte con confianza.',
    nivel: 'Inicial',
    recompensaFinal: 120,
    etapas: [
      { id: 'base', nombre: 'Base tecnologica', elementos: [{ id: 'ti-fund', titulo: 'Fundamentos de TI', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 70, bonus: 0, matricula: 280, gestion: 45, pmb: 50, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: [] }] },
      { id: 'redes', nombre: 'Redes', elementos: [{ id: 'redes-basico', titulo: 'Fundamentos de redes', proveedor: 'PlacetaEDU / Cisco NetAcad', tipo: 'curso_externo', recompensa: 75, bonus: 0, matricula: 300, gestion: 50, pmb: 75, convalidable: true, url: 'https://www.laplaceta.org/proyectos/placetaedu', requisitos: ['ti-fund'] }] }
    ]
  }
];

function elementos(camino) {
  return (camino.etapas || []).flatMap((etapa) => (etapa.elementos || []).map((elemento) => ({ ...elemento, etapaId: etapa.id, etapa: etapa.nombre })));
}

function normalizar(caminos) {
  return (Array.isArray(caminos) ? caminos : []).map((camino) => ({
    ...camino,
    etapas: (camino.etapas || []).map((etapa) => ({ ...etapa, elementos: Array.isArray(etapa.elementos) ? etapa.elementos : [] }))
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
  const progreso = caminos.map((camino) => {
    const items = elementos(camino);
    const estados = items.map((item) => {
      const completo = completados.has(item.id) || convalidados.has(item.id);
      const disponible = !completo && (item.requisitos || []).every((req) => completados.has(req) || convalidados.has(req));
      return { id: item.id, estado: completo ? 'COMPLETADO' : (disponible ? 'DISPONIBLE' : 'BLOQUEADO') };
    });
    return { caminoId: camino.id, completados: estados.filter((item) => item.estado === 'COMPLETADO').length, total: estados.length, porcentaje: estados.length ? Math.round((estados.filter((item) => item.estado === 'COMPLETADO').length / estados.length) * 100) : 0, elementos: estados };
  });
  return {
    caminos: doc && doc.caminos ? doc.caminos : {},
    progreso,
    convalidaciones,
    recompensasPendientes: doc && Array.isArray(doc.recompensasPendientes) ? doc.recompensasPendientes : []
  };
}

async function solicitarConvalidacion(dip, body) {
  const camino = (await catalogo()).find((item) => item.id === String(body.caminoId || ''));
  const curso = camino && elementos(camino).find((item) => item.id === String(body.cursoId || ''));
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

module.exports = { catalogo, estado, solicitarConvalidacion, CAMINOS: CAMINOS_BASE, elementos };
