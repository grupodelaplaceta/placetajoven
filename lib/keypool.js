// Placeta Joven — pool de keys por recompensa (códigos reales, solo servidor).
// Persistencia: Supabase (PostgREST REST) sobre la tabla KEYPOOL_TABLE.
// Robusto: si Supabase no está configurado o la tabla no existe, usa un pool de
// DEMO en memoria (códigos inventados) para poder probar el canje sin BBDD.
// La operación `tomarUna` es atómica: asigna la key a un socio (estado=asignada
// + placeta_id) de forma que nunca se entrega la misma key dos veces.

'use strict';

const crypto = require('crypto');

// Códigos de demostración (NO reales): permiten probar el flujo de extremo a
// extremo. vj-ejemplo-3 no tiene stock a propósito (estado "Próximamente").
const SEED = [
  { id: 'kp-demo-1', recompensa_id: 'vj-ejemplo-1', codigo: 'VJ1-EJEMPLO-0000-AAAA', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-2', recompensa_id: 'vj-ejemplo-1', codigo: 'VJ1-EJEMPLO-0000-BBBB', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-3', recompensa_id: 'vj-ejemplo-2', codigo: 'VJ2-EJEMPLO-1111-CCCC', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-4', recompensa_id: 'vj-ejemplo-2', codigo: 'VJ2-EJEMPLO-1111-DDDD', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-5', recompensa_id: 'vj-ejemplo-4', codigo: 'VJ4-EJEMPLO-2222-EEEE', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-6', recompensa_id: 'vj-ejemplo-4', codigo: 'VJ4-EJEMPLO-2222-FFFF', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-7', recompensa_id: 'vj-ejemplo-5', codigo: 'VJ5-EJEMPLO-3333-GGGG', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-8', recompensa_id: 'vj-ejemplo-5', codigo: 'VJ5-EJEMPLO-3333-HHHH', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-9', recompensa_id: 'vj-ejemplo-6', codigo: 'VJ6-EJEMPLO-4444-IIII', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null },
  { id: 'kp-demo-10', recompensa_id: 'vj-ejemplo-6', codigo: 'VJ6-EJEMPLO-4444-JJJJ', plataforma: 'steam', estado: 'disponible', placeta_id: null, asignada_en: null }
];

let memoria = SEED.map((k) => Object.assign({}, k));

function conf() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const tabla = (process.env.PLACETA_JOVEN_KEYPOOL_TABLE || 'placeta_joven_keypool').trim();
  const vista = (process.env.PLACETA_JOVEN_KEYPOOL_STOCK_VIEW || 'placeta_joven_keypool_stock').trim();
  return { on: url.startsWith('http') && key.length > 20, url, key, tabla, vista };
}

function headers(c) {
  return {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    'Content-Type': 'application/json'
  };
}

// id determinista por recompensa+código → reimportar el mismo código no duplica.
function keyIdPara(recompensaId, codigo) {
  return 'kp-' + crypto.createHash('sha1').update(String(recompensaId) + '|' + String(codigo).trim()).digest('hex').slice(0, 16);
}

function limpiarCodigos(lista) {
  const vistos = new Set();
  const out = [];
  (Array.isArray(lista) ? lista : []).forEach((c) => {
    const cod = String(c || '').trim();
    if (!cod || cod.startsWith('#')) return;
    if (vistos.has(cod)) return;
    vistos.add(cod);
    out.push(cod);
  });
  return out;
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

// ── Stock disponible ────────────────────────────────────────────────
function stockEnMemoria(recompensaId) {
  return memoria.reduce((n, k) => n + (k.recompensa_id === recompensaId && k.estado === 'disponible' ? 1 : 0), 0);
}

// Devuelve { recompensaId: nº disponible }. En Supabase lee la vista de stock;
// si la vista no existe devuelve {} (sin información). Sin Supabase cuenta en
// memoria.
async function stockPara(recompensaIds) {
  const ids = (Array.isArray(recompensaIds) ? recompensaIds : []).map((x) => String(x));
  if (!ids.length) return {};
  const c = conf();
  if (!c.on) {
    const out = {};
    ids.forEach((id) => { out[id] = stockEnMemoria(id); });
    return out;
  }
  try {
    const url = `${c.url}/rest/v1/${c.vista}?recompensa_id=in.(${ids.map((x) => encodeURIComponent(x)).join(',')})&select=recompensa_id,disponibles`;
    const res = await fetch(url, { method: 'GET', headers: headers(c) });
    if (res.status === 404) return {}; // vista aún no creada
    if (!res.ok) return {};
    const rows = await res.json().catch(() => []);
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach((r) => { out[r.recompensa_id] = Number(r.disponibles) || 0; });
    // ids sin fila en la vista = 0 disponibles
    ids.forEach((id) => { if (!(id in out)) out[id] = 0; });
    return out;
  } catch (e) {
    return {};
  }
}

// ── Importación masiva (para 500 keys de un solo uso por título) ────
function importarEnMemoria(recompensaId, codigos, plataforma) {
  const pl = String(plataforma || '').trim().toLowerCase();
  let insertadas = 0;
  const existentes = new Set(memoria.map((k) => k.id));
  codigos.forEach((cod) => {
    const id = keyIdPara(recompensaId, cod);
    if (existentes.has(id)) return;
    existentes.add(id);
    memoria.push({ id, recompensa_id: recompensaId, codigo: cod, plataforma: pl, estado: 'disponible', placeta_id: null, asignada_en: null });
    insertadas++;
  });
  return { insertadas, procesadas: codigos.length, almacenado: 'memoria' };
}

async function importarEnSupabase(c, recompensaId, codigos, plataforma) {
  const pl = String(plataforma || '').trim().toLowerCase();
  const rows = codigos.map((cod) => ({ id: keyIdPara(recompensaId, cod), recompensa_id: recompensaId, codigo: cod, plataforma: pl, estado: 'disponible' }));
  const url = `${c.url}/rest/v1/${c.tabla}?on_conflict=id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.assign(headers(c), { Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(rows)
  });
  if (res.status === 404) {
    const err = new Error('La tabla del keypool aún no existe. Ejecuta sql/placeta_joven.sql.');
    err.code = 'keypool_tabla_faltante';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`supabase_${res.status}`);
    err.code = `supabase_${res.status}`;
    throw err;
  }
  return { insertadas: rows.length, procesadas: codigos.length, almacenado: 'Supabase' };
}

// Carga en bloque los códigos de una recompensa (idempotente: reimportar un
// código ya presente no duplica). `codigos` puede traer duplicados/líneas vacías.
async function importar(recompensaId, codigos, plataforma) {
  const limpios = limpiarCodigos(codigos);
  if (!limpios.length) return { insertadas: 0, procesadas: 0, almacenado: '-' };
  const c = conf();
  if (!c.on) return importarEnMemoria(recompensaId, limpios, plataforma);
  return importarEnSupabase(c, recompensaId, limpios, plataforma);
}

module.exports = { tomarUna, resetDemo, SEED, stockPara, stockEnMemoria, importar, keyIdPara, limpiarCodigos };
