// Almacenamiento de suscripciones Placeta Joven.
// Persistencia: Supabase (PostgREST REST) sobre la tabla PLACETA_JOVEN_TABLE.
// Robusto: si Supabase no está configurado, la tabla no existe o falla la
// consulta, se DEGRADA automáticamente a un Map en memoria para que la API
// nunca devuelva un 500 por culpa del almacenamiento.

const MEMORY = typeof process !== 'undefined' && process.env.MEMORY_ONLY === '1';

const memoria = new Map();
let degradado = false;

function conf() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const tabla = (process.env.PLACETA_JOVEN_TABLE || 'placeta_joven').trim();
  return { on: !MEMORY && url.startsWith('http') && key.length > 20, url, key, tabla };
}

function usarMemoria() {
  const c = conf();
  return !c.on || degradado;
}

async function request(method, query, body, prefer) {
  const c = conf();
  if (!c.on || degradado) return { off: true };

  const url = `${c.url}/rest/v1/${c.tabla}${query || ''}`;
  const headers = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    // 404 en GET normalmente significa que la tabla/relación no existe aún
    // (PostgREST devuelve 200 + [] cuando no hay filas). Degradamos a memoria.
    if (method === 'GET' && res.status === 404) {
      degradado = true;
      return null;
    }
    const err = new Error(`supabase_${res.status}`);
    err.code = `supabase_${res.status}`;
    throw err;
  }

  if (res.status === 204) return {};
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function get(dip) {
  const key = String(dip || '');
  if (usarMemoria()) return memoria.get(key) || null;
  try {
    const rows = await request(
      'GET',
      `?placeta_id=eq.${encodeURIComponent(key)}&select=data`
    );
    if (rows === null) {
      // Tabla inexistente: usa lo que haya en memoria
      degradado = true;
      return memoria.get(key) || null;
    }
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0].data || null;
  } catch (e) {
    degradado = true;
    return memoria.get(key) || null;
  }
}

async function set(doc) {
  if (!doc || !doc.placeta_id) return;
  const key = String(doc.placeta_id);
  if (usarMemoria()) {
    memoria.set(key, doc);
    return;
  }
  try {
    await request(
      'POST',
      `?on_conflict=placeta_id`,
      { placeta_id: key, data: doc },
      'resolution=merge-duplicates'
    );
  } catch (e) {
    degradado = true;
    memoria.set(key, doc);
  }
}

async function del(dip) {
  const key = String(dip || '');
  memoria.delete(key);
  if (usarMemoria()) return;
  try {
    await request('DELETE', `?placeta_id=eq.${encodeURIComponent(key)}`);
  } catch (e) {
    degradado = true;
  }
}

module.exports = { get, set, del };
