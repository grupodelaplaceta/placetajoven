// Placeta Joven — pool de keys por recompensa (códigos reales, solo servidor).
// Persistencia: Supabase (PostgREST REST) sobre la tabla KEYPOOL_TABLE.
// Robusto: si Supabase no está configurado o la tabla no existe, usa un pool de
// DEMO en memoria (códigos inventados) para poder probar el canje sin BBDD.
// La operación `tomarUna` es atómica: asigna la key a un socio (estado=asignada
// + placeta_id) de forma que nunca se entrega la misma key dos veces.

'use strict';

// Códigos de demostración (NO reales): permiten probar el flujo de extremo a
// extremo. vj-ejemplo-3 no tiene stock a propósito (estado "Próximamente").
const SEED = [
  { id: 'kp-demo-1', recompensa_id: 'vj-ejemplo-1', codigo: 'VJ1-EJEMPLO-0000-AAAA', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-2', recompensa_id: 'vj-ejemplo-1', codigo: 'VJ1-EJEMPLO-0000-BBBB', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-3', recompensa_id: 'vj-ejemplo-2', codigo: 'VJ2-EJEMPLO-1111-CCCC', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-4', recompensa_id: 'vj-ejemplo-2', codigo: 'VJ2-EJEMPLO-1111-DDDD', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null }
];

let memoria = SEED.map((k) => Object.assign({}, k));

function conf() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const tabla = (process.env.PLACETA_JOVEN_KEYPOOL_TABLE || 'placeta_joven_keypool').trim();
  return { on: url.startsWith('http') && key.length > 20, url, key, tabla };
}

function headers(c) {
  return {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    'Content-Type': 'application/json'
  };
}

// ── Modo memoria (demo) ─────────────────────────────────────────────
function tomarEnMemoria(recompensaId, placetaId) {
  const k = memoria.find((x) => x.recompensa_id === recompensaId && x.estado === 'disponible');
  if (!k) return null;
  k.estado = 'asignada';
  k.placeta_id = placetaId;
  k.asignada_en = new Date().toISOString();
  return { id: k.id, codigo: k.codigo, plataforma: k.plataforma || '' };
}

// ── Modo Supabase ───────────────────────────────────────────────────
async function leerDisponible(c, recompensaId) {
  const url = `${c.url}/rest/v1/${c.tabla}?recompensa_id=eq.${encodeURIComponent(recompensaId)}&estado=eq.disponible&order=id.asc&limit=1&select=*`;
  const res = await fetch(url, { method: 'GET', headers: headers(c) });
  if (res.status === 404) return null; // tabla aún no creada
  if (!res.ok) {
    const err = new Error(`supabase_${res.status}`);
    err.code = `supabase_${res.status}`;
    throw err;
  }
  const rows = await res.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) || null;
}

async function asignarEnSupabase(c, row, placetaId) {
  const url = `${c.url}/rest/v1/${c.tabla}?id=eq.${encodeURIComponent(row.id)}&estado=eq.disponible`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: Object.assign(headers(c), { Prefer: 'return=representation' }),
    body: JSON.stringify({ estado: 'asignada', placeta_id: placetaId, asignada_en: new Date().toISOString() })
  });
  if (res.status === 404) return false; // perdimos la carrera: ya asignada
  if (!res.ok) {
    const err = new Error(`supabase_${res.status}`);
    err.code = `supabase_${res.status}`;
    throw err;
  }
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

// Toma (y asigna) una key disponible de una recompensa para un socio.
// Devuelve { id, codigo, plataforma } o null si no hay stock.
async function tomarUna(recompensaId, placetaId) {
  const c = conf();
  if (!c.on) return tomarEnMemoria(recompensaId, placetaId);

  for (let i = 0; i < 5; i++) {
    const row = await leerDisponible(c, recompensaId);
    if (!row) return null;
    const ok = await asignarEnSupabase(c, row, placetaId);
    if (ok) return { id: row.id, codigo: row.codigo, plataforma: row.plataforma || '' };
  }
  return null; // mucha contención: mejor no entregar dos veces
}

// Restaura el pool demo (solo memoria) — útil en tests.
function resetDemo() {
  memoria = SEED.map((k) => Object.assign({}, k));
}

module.exports = { tomarUna, resetDemo, SEED };
