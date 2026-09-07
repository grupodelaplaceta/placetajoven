// Tests de la lógica pura de Placeta Joven: `node --test tests/`
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  edadOk, calcExpira, verifyWebhook, estadoDesdeLs, variantToPlan, aplicarEvento, docVigente, planValido
} = require('../lib/placetajoven');

test('edadOk: 16 y 30 incluidos; fuera se bloquea', () => {
  assert.strictEqual(edadOk(16), true);
  assert.strictEqual(edadOk(30), true);
  assert.strictEqual(edadOk(15), false);
  assert.strictEqual(edadOk(31), false);
  assert.strictEqual(edadOk(null), false);
  assert.strictEqual(edadOk('22'), true);
});

test('planValido', () => {
  assert.strictEqual(planValido('mensual'), true);
  assert.strictEqual(planValido('anual'), true);
  assert.strictEqual(planValido('trimestral'), false);
});

test('calcExpira: anual ~12 meses después, mensual ~30 días', () => {
  const desde = new Date('2026-01-01T00:00:00Z').getTime();
  const anual = new Date(calcExpira('anual', desde)).getTime();
  const mensual = new Date(calcExpira('mensual', desde)).getTime();
  assert.ok(Math.abs(anual - desde - 360 * 86400000) < 86400000); // 12 meses x 30 días
  assert.ok(Math.abs(mensual - desde - 30 * 86400000) < 86400000);
});

test('verifyWebhook: firma correcta/incorrecta', () => {
  const secret = 'secreto';
  const raw = '{"hola":1}';
  const crypto = require('crypto');
  const buena = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const alterada = buena.slice(0, 20) + (buena[20] === 'a' ? 'b' : 'a') + buena.slice(21);
  assert.strictEqual(verifyWebhook(secret, raw, buena), true);
  assert.strictEqual(verifyWebhook(secret, raw, alterada), false);
  assert.strictEqual(verifyWebhook(secret, raw, ''), false);
});

test('estadoDesdeLs', () => {
  assert.strictEqual(estadoDesdeLs('active'), 'ACTIVO');
  assert.strictEqual(estadoDesdeLs('cancelled'), 'CANCELADO');
  assert.strictEqual(estadoDesdeLs('expired'), 'EXPIRADO');
  assert.strictEqual(estadoDesdeLs('paused'), 'SUSPENDIDO');
  assert.strictEqual(estadoDesdeLs('otro'), 'PENDIENTE');
});

test('variantToPlan por env', () => {
  process.env.LS_VARIANT_MENSUAL = 'vm';
  process.env.LS_VARIANT_ANUAL = 'va';
  assert.strictEqual(variantToPlan('vm'), 'mensual');
  assert.strictEqual(variantToPlan('va'), 'anual');
  assert.strictEqual(variantToPlan('zz', 'anual'), 'anual');
  assert.strictEqual(variantToPlan('zz'), null);
});

test('aplicarEvento: subscription_created activa con expiración', () => {
  const doc = { placeta_id: '12345678X', status: 'PENDIENTE', plan: 'anual' };
  const out = aplicarEvento(doc, 'subscription_created', {
    id: 'sub-1',
    attributes: { variant_id: 'va', renews_at: '2027-09-06T00:00:00Z' }
  });
  assert.strictEqual(out.status, 'ACTIVO');
  assert.strictEqual(out.plan, 'anual');
  assert.strictEqual(out.subscription_id, 'sub-1');
  assert.ok(out.expires_at);
});

test('aplicarEvento: subscription_cancelled -> CANCELADO con fin de período', () => {
  const doc = { placeta_id: '12345678X', status: 'ACTIVO', plan: 'mensual', expires_at: '2026-10-01T00:00:00Z' };
  const out = aplicarEvento(doc, 'subscription_cancelled', { id: 'sub-2', attributes: { renews_at: '2026-10-01T00:00:00Z' } });
  assert.strictEqual(out.status, 'CANCELADO');
  assert.strictEqual(out.expires_at, '2026-10-01T00:00:00Z');
});

test('docVigente: ACTIVO con expires_at pasado pasa a EXPIRADO', () => {
  const doc = { status: 'ACTIVO', expires_at: new Date(Date.now() - 1000).toISOString() };
  assert.strictEqual(docVigente(doc).status, 'EXPIRADO');
});

// ── Recompensas disponibles (catálogo) ────────────────────────────────
const { CATEGORIAS, DEMO, publica, categoriaValida } = require('../lib/recompensas');

test('recompensas: categorías esperadas', () => {
  const ids = CATEGORIAS.map((c) => c.id).sort();
  assert.deepStrictEqual(ids, ['experiencias', 'formacion', 'otros', 'videojuegos']);
});

test('recompensas: el catálogo demo no usa nombres de juegos reales', () => {
  assert.strictEqual(DEMO.length, 3);
  DEMO.forEach((r, i) => {
    assert.match(r.id, /^vj-ejemplo-/);
    assert.match(r.nombre, /^Videojuego Ejemplo \d/);
    assert.match(r.desarrolladora, /^Estudio Ejemplo /);
    assert.strictEqual(r.categoria, 'videojuegos');
    assert.ok(r.pz > 0);
    assert.strictEqual(r.imagen, null);
    assert.ok(r.condiciones.length > 0);
  });
});

test('recompensas: publica expone solo campos públicos', () => {
  const p = publica({
    id: 'x-1',
    categoria: 'videojuegos',
    data: {
      id: 'x-1', nombre: 'Demo', desarrolladora: 'Estudio', descripcion: 'D',
      plataforma: 'Steam', edadRecomendada: '16+', pz: '500',
      imagen: null, disponibilidad: 'Disponible', condiciones: 'C'
    }
  });
  assert.deepStrictEqual(p, {
    id: 'x-1', categoria: 'videojuegos', nombre: 'Demo', desarrolladora: 'Estudio',
    descripcion: 'D', plataforma: 'Steam', edadRecomendada: '16+', pz: 500,
    imagen: null, disponibilidad: 'Disponible', canjeable: false, condiciones: 'C'
  });
  // No filtra columnas internas: nunca expone `data` cruda ni `orden`.
  assert.ok(!('orden' in p));
  assert.ok(!('data' in p));
});

test('recompensas: publica con campos incompletos nunca rompe', () => {
  const p = publica({ id: 'z', data: {} });
  assert.strictEqual(p.nombre, 'Recompensa');
  assert.strictEqual(p.pz, 0);
  assert.strictEqual(p.disponibilidad, 'Disponible');
  assert.strictEqual(p.categoria, 'otros');
});

test('recompensas: categoriaValida cae a otros si no es conocida', () => {
  assert.strictEqual(categoriaValida('videojuegos'), 'videojuegos');
  assert.strictEqual(categoriaValida('formacion'), 'formacion');
  assert.strictEqual(categoriaValida('raro'), 'otros');
});

// ── Canje de recompensas (keypool + entrega al socio) ────────────────
const { yaConseguida, anadirKey } = require('../lib/recompensas');
const keypool = require('../lib/keypool');

function sinSupabase() {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

test('canje: publica marca canjeable solo si disponible', () => {
  const r1 = DEMO.find((x) => x.id === 'vj-ejemplo-1');
  const p1 = publica({ data: r1 });
  assert.strictEqual(p1.canjeable, true);
  const r3 = DEMO.find((x) => x.id === 'vj-ejemplo-3');
  const p3 = publica({ data: r3 });
  assert.strictEqual(p3.canjeable, false); // «Próximamente»
});

test('canje: yaConseguida se detecta por ledger o por key existente', () => {
  const docLedger = { recompensas: { 'vj-ejemplo-1': { obtenida: 'x', pz: 500 } } };
  assert.strictEqual(yaConseguida(docLedger, 'vj-ejemplo-1'), true);
  const docKey = { keys: [{ recompensaId: 'vj-ejemplo-2' }] };
  assert.strictEqual(yaConseguida(docKey, 'vj-ejemplo-2'), true);
  assert.strictEqual(yaConseguida({}, 'vj-ejemplo-3'), false);
  assert.strictEqual(yaConseguida(null, 'vj-ejemplo-1'), false);
});

test('canje: anadirKey guarda la key en doc.keys y registra el coste en Pz', () => {
  const r = DEMO.find((x) => x.id === 'vj-ejemplo-1');
  const { doc, key } = anadirKey({ placeta_id: '12345678A' }, r, { id: 'kp-1', codigo: 'VJ1-TEST', plataforma: 'steam' });
  assert.strictEqual(doc.keys.length, 1);
  assert.strictEqual(doc.keys[0].juego, 'Videojuego Ejemplo 1');
  assert.strictEqual(doc.keys[0].codigo, 'VJ1-TEST');
  assert.strictEqual(doc.keys[0].estado, 'disponible');
  assert.strictEqual(doc.keys[0].recompensaId, 'vj-ejemplo-1');
  assert.strictEqual(doc.recompensas['vj-ejemplo-1'].pz, 500);
  assert.strictEqual(key.recompensaId, 'vj-ejemplo-1');
  assert.strictEqual(yaConseguida(doc, 'vj-ejemplo-1'), true);
});

test('canje: keypool demo asigna sin repetir y agota el stock', async () => {
  sinSupabase();
  keypool.resetDemo();
  const a = await keypool.tomarUna('vj-ejemplo-1', 'DIP-A');
  const b = await keypool.tomarUna('vj-ejemplo-1', 'DIP-B');
  assert.ok(a && b, 'debería haber 2 keys demo');
  assert.notStrictEqual(a.codigo, b.codigo, 'nunca entrega dos veces la misma key');
  const c = await keypool.tomarUna('vj-ejemplo-1', 'DIP-C');
  assert.strictEqual(c, null, 'stock agotado');
});

test('canje: recompensa sin stock (Próximamente) no entrega key', async () => {
  sinSupabase();
  keypool.resetDemo();
  const x = await keypool.tomarUna('vj-ejemplo-3', 'DIP-A');
  assert.strictEqual(x, null);
});

test('keypool: stockPara cuenta solo las keys disponibles', async () => {
  sinSupabase();
  keypool.resetDemo();
  const s = await keypool.stockPara(['vj-ejemplo-1', 'vj-ejemplo-2', 'vj-ejemplo-3']);
  assert.deepStrictEqual(s, { 'vj-ejemplo-1': 2, 'vj-ejemplo-2': 2, 'vj-ejemplo-3': 0 });
  await keypool.tomarUna('vj-ejemplo-1', 'DIP-X'); // una asignada → baja el stock
  const s2 = await keypool.stockPara(['vj-ejemplo-1']);
  assert.strictEqual(s2['vj-ejemplo-1'], 1);
});

test('keypool: importar en bloque es idempotente y no duplica códigos', async () => {
  sinSupabase();
  keypool.resetDemo();
  // incluye duplicado, línea vacía y comentario → solo 3 únicos
  const r1 = await keypool.importar('recompensa-x', ['AAA-1', 'AAA-2', 'AAA-2', '', '# nota', 'AAA-3'], 'steam');
  assert.strictEqual(r1.insertadas, 3);
  let stock = await keypool.stockPara(['recompensa-x']);
  assert.strictEqual(stock['recompensa-x'], 3);

  // reimportar lo mismo no añade nada
  const r2 = await keypool.importar('recompensa-x', ['AAA-1', 'AAA-2', 'AAA-3'], 'steam');
  assert.strictEqual(r2.insertadas, 0);
  stock = await keypool.stockPara(['recompensa-x']);
  assert.strictEqual(stock['recompensa-x'], 3);

  // esas keys se pueden entregar (una a cada usuario)
  const t = await keypool.tomarUna('recompensa-x', 'DIP-Y');
  assert.ok(t);
});
