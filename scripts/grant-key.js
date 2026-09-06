// Entrega una key de un juego indie a un socio de Placeta Joven.
// Uso (desde la raíz del proyecto, con .env rellenado):
//   node scripts/grant-key.js <DIP> "<Nombre del juego>" <plataforma> <CODIGO>
// Ejemplo:
//   node scripts/grant-key.js 23749931M "Pixel Dungeon" steam ABCD-EFGH-IJKL
//
// La key queda guardada en el documento del socio (Supabase, tabla placeta_joven)
// y aparecerá en su "espacio joven" (mi.html -> Tus keys).
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Cargar .env a mano (sin dependencias) ──
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    let k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    // quitar comentario inline (p. ej. "KEY=valor # nota")
    const hash = v.indexOf(' #');
    if (hash >= 0) v = v.slice(0, hash).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && !process.env[k]) process.env[k] = v;
  }
}

loadEnv(path.join(__dirname, '..', '.env'));

const store = require('../lib/store');

function mask(code) {
  const c = String(code || '');
  if (c.length <= 4) return '••••';
  return c.slice(0, 4) + '…' + c.slice(-2);
}

async function main() {
  const [, , dip, juego, plataforma, codigo] = process.argv;
  if (!dip || !juego || !codigo) {
    console.error('Uso: node scripts/grant-key.js <DIP> "<Juego>" <plataforma> <CODIGO>');
    console.error('Ej:  node scripts/grant-key.js 23749931M "Pixel Dungeon" steam ABCD-EFGH-IJKL');
    process.exit(1);
  }
  const keyId = crypto.randomBytes(4).toString('hex');
  const key = {
    id: keyId,
    juego: String(juego),
    plataforma: String(plataforma || '').toLowerCase(),
    codigo: String(codigo).trim(),
    estado: 'disponible',
    otorgada: new Date().toISOString(),
    canjeada: null
  };

  const placetaId = String(dip).trim().toUpperCase();
  const doc = (await store.get(placetaId)) || {};
  doc.placeta_id = placetaId;
  doc.keys = Array.isArray(doc.keys) ? doc.keys : [];
  doc.keys.push(key);
  doc.updated_at = new Date().toISOString();
  if (!doc.created_at) doc.created_at = doc.updated_at;

  await store.set(doc);

  const usado = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Supabase' : 'memoria (sin SUPABASE_SERVICE_ROLE_KEY)';
  console.log('✔ Key entregada a ' + placetaId);
  console.log('  Juego     : ' + key.juego);
  console.log('  Plataforma: ' + (key.plataforma || '-'));
  console.log('  Código    : ' + mask(key.codigo) + ' (id ' + keyId + ')');
  console.log('  Almacenado: ' + usado);
  console.log('Total keys del socio: ' + doc.keys.length);
}

main().catch((e) => {
  console.error('Error:', e && e.message ? e.message : e);
  process.exit(1);
});
