'use strict';

const WAIT_MS = 24 * 60 * 60 * 1000;

function puedeOpinar(key, ahora) {
  const otorgada = Date.parse(String((key && key.otorgada) || ''));
  const instante = ahora == null ? Date.now() : Number(ahora);
  return Number.isFinite(otorgada) && instante >= otorgada + WAIT_MS;
}

function textoValido(value) {
  const texto = String(value || '').trim();
  return texto.length >= 80 && texto.length <= 2000 ? texto : '';
}

function publica(row) {
  return {
    id: String(row.id || ''),
    recompensaId: String(row.recompensa_id || ''),
    juego: String(row.juego || ''),
    estrellas: Number(row.estrellas) || 0,
    texto: String(row.texto || ''),
    fecha: row.created_at || null
  };
}

function conf() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const tabla = String(process.env.PLACETA_JOVEN_OPINIONES_TABLE || 'placeta_joven_opiniones').trim();
  return { on: url.startsWith('http') && key.length > 20, url, key, tabla };
}

function catalogoError(code) {
  const error = new Error(code);
  error.code = code;
  error.status = 503;
  return error;
}

async function listar(recompensaId) {
  const c = conf();
  if (!c.on) throw catalogoError('opiniones_no_configuradas');
  const filtro = recompensaId ? '&recompensa_id=eq.' + encodeURIComponent(recompensaId) : '';
  const url = `${c.url}/rest/v1/${c.tabla}?publicada=eq.true${filtro}&order=created_at.desc&limit=50&select=id,recompensa_id,juego,estrellas,texto,created_at`;
  const res = await fetch(url, { headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, Accept: 'application/json' } });
  if (!res.ok) throw catalogoError(res.status === 404 ? 'opiniones_no_configuradas' : 'opiniones_no_disponibles');
  const rows = await res.json().catch(() => []);
  return (Array.isArray(rows) ? rows : []).map(publica);
}

async function publicar(row) {
  const c = conf();
  if (!c.on) throw catalogoError('opiniones_no_configuradas');
  const url = `${c.url}/rest/v1/${c.tabla}?on_conflict=placeta_id,key_id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation'
    },
    body: JSON.stringify(row)
  });
  if (!res.ok) throw catalogoError(res.status === 409 ? 'opinion_duplicada' : 'opiniones_no_disponibles');
  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) {
    const error = new Error('opinion_duplicada');
    error.code = 'opinion_duplicada';
    error.status = 409;
    throw error;
  }
  return publica(rows[0]);
}

module.exports = { WAIT_MS, puedeOpinar, textoValido, publica, listar, publicar };