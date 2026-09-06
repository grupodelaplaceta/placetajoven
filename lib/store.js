// Placeta Joven — almacenamiento en Supabase (tabla placeta_joven)
// - Requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_ANON_KEY).
// - Si no hay configuración, usa memoria (válido para desarrollo/tests).
'use strict';

const TABLE = process.env.PLACETA_JOVEN_TABLE || 'placeta_joven';
const memoria = new Map();

function conf() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  return { url, key, on: !!(url && key) };
}

async function request(method, query, body, prefer) {
  const c = conf();
  const headers = {
    apikey: c.key,
    Authorization: 'Bearer ' + c.key,
    Accept: 'application/json'
  };
  if (body) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(c.url + '/rest/v1/' + TABLE + (query || ''), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error('supabase_' + res.status);
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

function newDoc(dip) {
  const now = new Date().toISOString();
  return {
    placeta_id: String(dip).trim().toUpperCase(),
    status: 'PENDIENTE',
    plan: null,
    started_at: null,
    expires_at: null,
    payment_provider: 'lemonsqueezy',
    subscription_id: null,
    created_at: now,
    updated_at: now
  };
}

module.exports = {
  newDoc,

  async get(dip) {
    const key = String(dip).trim().toUpperCase();
    const c = conf();
    if (c.on) {
      const rows = await request('GET', '?placeta_id=eq.' + encodeURIComponent(key) + '&select=data');
      return rows && rows.length ? rows[0].data || null : null;
    }
    return memoria.get(key) || null;
  },

  async set(doc) {
    if (!doc || !doc.placeta_id) return;
    const c = conf();
    if (c.on) {
      await request(
        'POST',
        '?on_conflict=placeta_id',
        { placeta_id: doc.placeta_id, data: doc, updated_at: new Date().toISOString() },
        'resolution=merge-duplicates'
      );
    } else {
      memoria.set(String(doc.placeta_id).trim().toUpperCase(), Object.assign({}, doc));
    }
  },

  async del(dip) {
    const key = String(dip).trim().toUpperCase();
    const c = conf();
    if (c.on) {
      await request('DELETE', '?placeta_id=eq.' + encodeURIComponent(key));
    } else {
      memoria.delete(key);
    }
  }
};
