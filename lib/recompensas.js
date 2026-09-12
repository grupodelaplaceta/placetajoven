// Placeta Joven — catálogo de recompensas («Recompensas disponibles»).
// Persistencia: Supabase (PostgREST REST) sobre la tabla RECOMPENSAS_TABLE.
// Robusto: si Supabase no está configurado o la tabla no existe, devuelve un
// catálogo DEMO (nombres inventados, nada confirmado) para poder maquetar la
// interfaz sin depender de la base de datos.

'use strict';

const crypto = require('crypto');
const keypool = require('./keypool');

const CATEGORIAS = [
  { id: 'videojuegos', etiqueta: 'Videojuegos' },
  { id: 'formacion', etiqueta: 'Formación' },
  { id: 'experiencias', etiqueta: 'Experiencias' },
  { id: 'otros', etiqueta: 'Otros' }
];

// ── Catálogo de demostración (SOLO ejemplos, sin juegos reales) ─────────
const DEMO = [
  {
    id: 'vj-ejemplo-1',
    categoria: 'videojuegos',
    nombre: 'Videojuego Ejemplo 1',
    desarrolladora: 'Estudio Ejemplo Uno',
    descripcion: 'Una aventura de puzles ambientada en un mundo luminoso. Ejemplo de '
      + 'ficha para la maqueta: este título no existe todavía y no representa ninguna '
      + 'colaboración confirmada.',
    plataforma: 'Steam',
    edadRecomendada: '7+',
    pz: 500,
    imagen: null,
    disponibilidad: 'Disponible',
    canjeable: true,
    condiciones: 'Una key por usuario y título. No se pueden revender las claves.'
  },
  {
    id: 'vj-ejemplo-2',
    categoria: 'videojuegos',
    nombre: 'Videojuego Ejemplo 2 — Playtest',
    desarrolladora: 'Estudio Ejemplo Dos',
    descripcion: 'Demo jugable (playtest) de un plataformas en desarrollo. Ejemplo de '
      + 'ficha para la maqueta: el acceso anticipado no está confirmado todavía.',
    plataforma: 'Steam',
    edadRecomendada: '16+',
    pz: 250,
    imagen: null,
    disponibilidad: 'Disponible',
    canjeable: true,
    condiciones: 'Una key por usuario y título. Solo para probar el juego durante la fase de test.'
  },
  {
    id: 'vj-ejemplo-3',
    categoria: 'videojuegos',
    nombre: 'Videojuego Ejemplo 3',
    desarrolladora: 'Estudio Ejemplo Tres',
    descripcion: 'Un simulador cooperativo para jugar en grupo. Ejemplo de ficha para '
      + 'la maqueta: la incorporación al programa está en estudio.',
    plataforma: 'Steam',
    edadRecomendada: '12+',
    pz: 350,
    imagen: null,
    disponibilidad: 'Próximamente',
    canjeable: false,
    condiciones: 'Una key por usuario y título. Se informará de la fecha de disponibilidad.'
  },
  {
    id: 'vj-ejemplo-4',
    categoria: 'videojuegos',
    nombre: 'Videojuego Ejemplo 4',
    desarrolladora: 'Estudio Ejemplo Cuatro',
    genero: 'Aventura',
    descripcion: 'Una aventura roguelite con un mundo generado. Ejemplo de ficha para la maqueta: este título no existe todavía.',
    plataforma: 'Steam',
    edadRecomendada: '10+',
    pz: 400,
    imagen: null,
    disponibilidad: 'Disponible',
    canjeable: true,
    condiciones: 'Una key por usuario y título. No se pueden revender las claves.'
  },
  {
    id: 'vj-ejemplo-5',
    categoria: 'videojuegos',
    nombre: 'Videojuego Ejemplo 5',
    desarrolladora: 'Estudio Ejemplo Cinco',
    genero: 'Carreras',
    descripcion: 'Un arcade de carreras para partidas cortas. Ejemplo de ficha para la maqueta: este título no existe todavía.',
    plataforma: 'Steam',
    edadRecomendada: '7+',
    pz: 300,
    imagen: null,
    disponibilidad: 'Disponible',
    canjeable: true,
    condiciones: 'Una key por usuario y título. No se pueden revender las claves.'
  },
  {
    id: 'vj-ejemplo-6',
    categoria: 'videojuegos',
    nombre: 'Videojuego Ejemplo 6',
    desarrolladora: 'Estudio Ejemplo Seis',
    genero: 'Estrategia',
    descripcion: 'Un juego de estrategia por turnos. Ejemplo de ficha para la maqueta: este título no existe todavía.',
    plataforma: 'Steam',
    edadRecomendada: '12+',
    pz: 600,
    imagen: null,
    disponibilidad: 'Disponible',
    canjeable: true,
    condiciones: 'Una key por usuario y título. No se pueden revender las claves.'
  }
];

function conf() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const tabla = (process.env.PLACETA_JOVEN_RECOMPENSAS_TABLE || 'placeta_joven_recompensas').trim();
  return { on: url.startsWith('http') && key.length > 20, url, key, tabla };
}

// Devuelve SOLO los campos públicos de una fila (nunca columnas internas).
function publica(fila) {
  const d = (fila && fila.data) || {};
  return {
    id: String(d.id || fila.id || ''),
    categoria: String(d.categoria || fila.categoria || 'otros'),
    nombre: String(d.nombre || 'Recompensa'),
    desarrolladora: String(d.desarrolladora || ''),
    descripcion: String(d.descripcion || ''),
    plataforma: String(d.plataforma || ''),
    genero: String(d.genero || ''),
    editor: String(d.editor || ''),
    fechaLanzamiento: String(d.fechaLanzamiento || ''),
    edadRecomendada: String(d.edadRecomendada || ''),
    pz: Number(d.pz) || 0,
    imagen: d.imagen || null,
    galeria: Array.isArray(d.galeria) ? d.galeria.filter((x) => typeof x === 'string' && x.trim()) : [],
    video: typeof d.video === 'string' ? d.video : '',
    steamUrl: typeof d.steamUrl === 'string' ? d.steamUrl : '',
    disponibilidad: String(d.disponibilidad || 'Disponible'),
    // Solo se pueden conseguir recompensas marcadas como canjeables y que estén
    // marcadas como «Disponible» (no «Próximamente»/agotadas).
    canjeable: !!(d.canjeable) && /^disponible$/i.test(String(d.disponibilidad || '')),
    condiciones: String(d.condiciones || '')
  };
}

function demoPublica(r) {
  return Object.assign({}, publica({ data: r }), { id: r.id, categoria: r.categoria });
}

function categoriaValida(c) {
  return CATEGORIAS.some((x) => x.id === c) ? c : 'otros';
}

// Aplica el stock disponible real a una recompensa pública. Si el stock es 0 y
// la recompensa estaba «Disponible», pasa a «Agotado» y deja de ser canjeable.
function aplicarStock(p, s) {
  if (s == null) { p.stock = null; return p; }
  p.stock = s;
  if (s === 0) {
    if (/^disponible$/i.test(String(p.disponibilidad || ''))) p.disponibilidad = 'Agotado';
    p.canjeable = false;
  }
  return p;
}

// Lista solo colaboraciones publicadas. No se devuelven datos inventados si la
// integración no está configurada o el proveedor falla.
async function listar() {
  const c = conf();
  if (!c.on) {
    const err = new Error('catalog_not_configured');
    err.code = 'catalog_not_configured';
    throw err;
  }
  const recompensas = await listarSupabase(c);

  // Stock disponible real por recompensa (solo los «Disponibles» pueden agotarse).
  const stock = await keypool.stockPara(recompensas.map((r) => r.id));
  recompensas.forEach((p) => aplicarStock(p, stock[p.id]));
  return { demo: false, recompensas };
}

async function listarSupabase(c) {
  const url = `${c.url}/rest/v1/${c.tabla}?activa=eq.true&order=orden.asc&select=*`;
  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: c.key,
        Authorization: `Bearer ${c.key}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    const err = new Error('catalog_unavailable');
    err.code = 'catalog_unavailable';
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`catalog_http_${res.status}`);
    err.code = res.status === 404 ? 'catalog_not_configured' : 'catalog_unavailable';
    throw err;
  }

  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && r.data)
    .map((r) => {
      const p = publica(r);
      p.categoria = categoriaValida(p.categoria);
      return p;
    });
}

// ── Canje (una key por usuario y título) ─────────────────────────────

function keyId() {
  return crypto.randomBytes(4).toString('hex');
}

// ¿Este socio ya consiguió esta recompensa? Se mira el ledger `recompensas`
// del documento o, por robustez, si ya tiene una key con ese recompensaId.
function yaConseguida(doc, recompensaId) {
  const d = doc || {};
  const id = String(recompensaId || '');
  if (!id) return false;
  if (d.recompensas && d.recompensas[id]) return true;
  if (Array.isArray(d.keys)) return d.keys.some((k) => String(k.recompensaId) === id);
  return false;
}

// Añade la key conseguida al documento del socio (doc.keys) y registra el
// canje en el ledger (doc.recompensas) con el coste en Pz. Devuelve la key
// pública para mostrarla al usuario. NO descuenta saldo: aún no hay wallet Pz.
function anadirKey(doc, recompensa, key) {
  const out = Object.assign({}, doc || {});
  out.keys = Array.isArray(out.keys) ? out.keys.slice() : [];
  out.recompensas = Object.assign({}, out.recompensas || {});

  const otorgada = new Date().toISOString();
  const nueva = {
    id: keyId(),
    recompensaId: String(recompensa.id || ''),
    juego: String(recompensa.nombre || 'Recompensa'),
    plataforma: String(key.plataforma || recompensa.plataforma || '').toLowerCase(),
    pz: Number(recompensa.pz) || 0,
    codigo: String(key.codigo || ''),
    estado: 'disponible',
    otorgada: otorgada,
    canjeada: null
  };

  out.keys.push(nueva);
  out.recompensas[recompensa.id] = {
    obtenida: otorgada,
    pz: nueva.pz,
    titulo: nueva.juego,
    plataforma: nueva.plataforma
  };
  out.updated_at = otorgada;
  if (!out.created_at) out.created_at = otorgada;

  return { doc: out, key: nueva };
}

module.exports = { CATEGORIAS, DEMO, publica, categoriaValida, listar, keyId, yaConseguida, anadirKey };
