// Placeta Joven — catálogo de recompensas («Recompensas disponibles»).
// Persistencia: Supabase (PostgREST REST) sobre la tabla RECOMPENSAS_TABLE.
// Robusto: si Supabase no está configurado o la tabla no existe, devuelve un
// catálogo DEMO (nombres inventados, nada confirmado) para poder maquetar la
// interfaz sin depender de la base de datos.

'use strict';

const crypto = require('crypto');

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
    edadRecomendada: String(d.edadRecomendada || ''),
    pz: Number(d.pz) || 0,
    imagen: d.imagen || null,
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

// Lista el catálogo. Devuelve { demo: bool, recompensas: [...] }.
// Si Supabase no está disponible devuelve el catálogo de ejemplo (demo: true).
async function listar() {
  const c = conf();
  if (!c.on) return { demo: true, recompensas: DEMO.map(demoPublica) };

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
    return { demo: true, recompensas: DEMO.map(demoPublica) };
  }

  if (!res.ok) {
    // 404 = tabla aún no creada → catálogo de ejemplo para no romper la UI.
    if (res.status === 404) return { demo: true, recompensas: DEMO.map(demoPublica) };
    const err = new Error(`supabase_${res.status}`);
    err.code = `supabase_${res.status}`;
    throw err;
  }

  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows)) return { demo: false, recompensas: [] };

  const recompensas = rows
    .filter((r) => r && r.data)
    .map((r) => {
      const p = publica(r);
      p.categoria = categoriaValida(p.categoria);
      return p;
    });
  return { demo: false, recompensas };
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
