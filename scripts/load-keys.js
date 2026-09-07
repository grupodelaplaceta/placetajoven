// Carga masiva de keys de un solo uso para una recompensa (keypool).
// Pensado para títulos con cientos de keys (p. ej. 500 por juego).
//
// Uso (desde la raíz, con .env rellenado):
//   node scripts/load-keys.js <recompensaId> <archivo.txt> [plataforma]
//   node scripts/load-keys.js <recompensaId> "CODIGO1 CODIGO2 ..." [plataforma]
//
// El archivo lleva UNA key por línea; las líneas en blanco y las que empiezan
// por '#' se ignoran. La importación es idempotente: reintroducir un código
// que ya está en el pool no lo duplica.
//
// Ejemplo:
//   node scripts/load-keys.js vj-ejemplo-1 keys-videojuego-1.txt steam
'use strict';

const fs = require('fs');
const path = require('path');

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
    const hash = v.indexOf(' #');
    if (hash >= 0) v = v.slice(0, hash).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && !process.env[k]) process.env[k] = v;
  }
}

loadEnv(path.join(__dirname, '..', '.env'));

const keypool = require('../lib/keypool');

function leerCodigos(fuente) {
  // Si es un archivo existente: una key por línea. Si no, se interpreta como
  // una lista pegada (separada por espacios/saltos de línea).
  if (fs.existsSync(fuente)) {
    return fs.readFileSync(fuente, 'utf8').split(/\s+/);
  }
  return String(fuente || '').split(/\s+/);
}

function mask(code) {
  const c = String(code || '');
  if (c.length <= 6) return '••••••';
  return c.slice(0, 4) + '…' + c.slice(-2);
}

async function main() {
  const [, , recompensaId, fuente, plataforma] = process.argv;
  if (!recompensaId || !fuente) {
    console.error('Uso: node scripts/load-keys.js <recompensaId> <archivo.txt | "lista de keys"> [plataforma]');
    console.error('Ej:  node scripts/load-keys.js vj-ejemplo-1 keys.txt steam');
    process.exit(1);
  }

  const codigos = leerCodigos(fuente);
  if (!codigos.length) {
    console.error('No se han leído keys (archivo vacío o lista sin códigos).');
    process.exit(1);
  }

  const res = await keypool.importar(recompensaId, codigos, plataforma);
  const muestra = codigos.slice(0, 5).map(mask).join(', ');

  console.log('✔ Carga de keys para recompensa: ' + recompensaId);
  console.log('  Leídas      : ' + codigos.length);
  console.log('  Procesadas  : ' + res.procesadas + ' (idempotente: no duplica)');
  console.log('  Insertadas  : ' + res.insertadas);
  console.log('  Almacenado  : ' + res.almacenado);
  console.log('  Muestra     : ' + muestra + (codigos.length > 5 ? ', …' : ''));
}

main().catch((e) => {
  console.error('Error:', e && e.message ? e.message : e);
  process.exit(1);
});
