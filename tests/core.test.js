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

test('pendienteCaducada: pago PENDIENTE abandonado caduca; con sub no; otros no', () => {
  const { pendienteCaducada, PENDIENTE_CADUCA_MS } = require('../lib/placetajoven');
  const viejo = { status: 'PENDIENTE', created_at: new Date(Date.now() - PENDIENTE_CADUCA_MS - 60000).toISOString() };
  assert.strictEqual(pendienteCaducada(viejo), true, 'abandonado > 2 h caduca');
  const reciente = { status: 'PENDIENTE', created_at: new Date().toISOString() };
  assert.strictEqual(pendienteCaducada(reciente), false, 'pendiente reciente no caduca');
  const conSub = { status: 'PENDIENTE', subscription_id: 'sub-9', created_at: new Date(Date.now() - PENDIENTE_CADUCA_MS * 5).toISOString() };
  assert.strictEqual(pendienteCaducada(conSub), false, 'con subscription_id el webhook lo gestiona');
  assert.strictEqual(pendienteCaducada({ status: 'ACTIVO' }), false);
  assert.strictEqual(pendienteCaducada(null), false);
});

test('activarDoc: activa desde suscripción activa de LS (mismo plan/vigencia)', () => {
  const { activarDoc } = require('../lib/placetajoven');
  process.env.LS_VARIANT_MENSUAL = 'vm';
  process.env.LS_VARIANT_ANUAL = 'va';
  const out = activarDoc(
    { status: 'PENDIENTE', plan: 'mensual', created_at: '2026-01-01T00:00:00Z' },
    { subscriptionId: 'sub-ls-9', variantId: 'va', renewsAt: '2027-09-06T00:00:00Z' }
  );
  assert.strictEqual(out.status, 'ACTIVO');
  assert.strictEqual(out.plan, 'anual', 'variante LS anual manda');
  assert.strictEqual(out.subscription_id, 'sub-ls-9');
  assert.strictEqual(out.expires_at, '2027-09-06T00:00:00Z');
  assert.ok(out.updated_at);
  assert.strictEqual(out.created_at, '2026-01-01T00:00:00Z', 'no pierde created_at');
});

test('activarDoc: variante desconocida conserva el plan del documento', () => {
  const { activarDoc } = require('../lib/placetajoven');
  delete process.env.LS_VARIANT_MENSUAL;
  delete process.env.LS_VARIANT_ANUAL;
  const out = activarDoc({ status: 'PENDIENTE', plan: 'mensual' }, { subscriptionId: 'x', variantId: 'zz' });
  assert.strictEqual(out.status, 'ACTIVO');
  assert.strictEqual(out.plan, 'mensual');
  assert.ok(out.expires_at);
});

// ── Recompensas disponibles (catálogo) ────────────────────────────────
const { CATEGORIAS, DEMO, publica, categoriaValida } = require('../lib/recompensas');

test('recompensas: categorías esperadas', () => {
  const ids = CATEGORIAS.map((c) => c.id).sort();
  assert.deepStrictEqual(ids, ['experiencias', 'formacion', 'otros', 'videojuegos']);
});

test('recompensas: el catálogo demo no usa nombres de juegos reales', () => {
  assert.strictEqual(DEMO.length, 6);
  DEMO.forEach((r, i) => {
    assert.match(r.id, /^vj-ejemplo-/);
    assert.match(r.nombre, /^Videojuego Ejemplo \d/);
    assert.match(r.desarrolladora, /^Estudio Ejemplo /);
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
    descripcion: 'D', plataforma: 'Steam', tipoJuego: 'clave', gratis: false, url: '', genero: '', editor: '', fechaLanzamiento: '',
    edadRecomendada: '16+', pz: 500, imagen: null, galeria: [], video: '', steamUrl: '',
    disponibilidad: 'Disponible', canjeable: false, condiciones: 'C'
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

// ── Motor de actividades ─────────────────────────────────────────────
const actividades = require('../lib/actividades');

test('actividades: corrección por tipo', () => {
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'test', puntos: 10, correcta: 0 }, 0).ok, true);
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'test', puntos: 10, correcta: 0 }, 2).ok, false);
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'verdadero_falso', puntos: 5, correcta: true }, true).ok, true);
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'escrita', puntos: 5, respuestas: ['order by'] }, ' ORDER BY ').ok, true);
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'ordenar', puntos: 5, correcta: [0, 1, 2] }, [0, 1, 2]).ok, true);
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'ordenar', puntos: 5, correcta: [0, 1, 2] }, [1, 0, 2]).ok, false);
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'relacionar', puntos: 5, pares: [['SELECT', 'columnas']] }, { SELECT: 'columnas' }).ok, true);
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'sql', puntos: 20, esperado: 'select * from usuarios' }, 'SELECT * FROM usuarios;').ok, true);
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'excel', puntos: 20, esperado: '=b2*c2' }, '=B2*C2').ok, true);
});

test('actividades: el catálogo público no filtra soluciones', () => {
  const publico = actividades.catalogoPublico();
  assert.ok(publico.length > 0);
  const serializado = JSON.stringify(publico);
  assert.ok(!/solucion/.test(serializado));
  assert.ok(!/esperado/.test(serializado));

  publico.forEach((pub) => {
    const original = actividades.actividad(pub.id);
    pub.ejercicios.forEach((e) => {
      const fuente = original.ejercicios.find((x) => x.id === e.id);
      if (e.tipo === 'ordenar') {
        // si el orden mostrado fuese el correcto, el ejercicio se resolvería solo
        assert.notDeepStrictEqual(e.elementos.map((_, i) => i), fuente.correcta, 'ordenar debe salir desordenado');
        assert.strictEqual(e.elementos.length, fuente.elementos.length);
      }
      if (e.tipo === 'relacionar') {
        assert.ok(e.izquierda.length > 0 && e.izquierda.length === e.derecha.length, 'relacionar publica las dos columnas');
        assert.strictEqual(e.pares, undefined, 'nunca se envía el emparejamiento');
      }
      if (e.tipo === 'test') assert.strictEqual(e.correcta, undefined, 'no se envía la opción correcta');
      if (e.tipo === 'verdadero_falso') assert.strictEqual(e.correcta, undefined);
      if (e.tipo === 'escrita') assert.strictEqual(e.respuestas, undefined);
    });
  });
});

test('actividades: la nota y el bonus se calculan, no se regalan Pz', () => {
  const sql = actividades.actividad('sql-basico');
  const respuestas = {};
  sql.ejercicios.forEach((e) => {
    if (e.tipo === 'test') respuestas[e.id] = e.correcta;
    if (e.tipo === 'verdadero_falso') respuestas[e.id] = e.correcta;
    if (e.tipo === 'escrita') respuestas[e.id] = (e.respuestas || [])[0];
    if (e.tipo === 'sql') respuestas[e.id] = e.esperado;
    if (e.tipo === 'ordenar') respuestas[e.id] = e.correcta;
    if (e.tipo === 'relacionar') respuestas[e.id] = Object.fromEntries(e.pares);
  });
  const r = actividades.puntuar(sql, respuestas);
  assert.strictEqual(r.porcentaje, 100);
  assert.strictEqual(r.aprobado, true);
});

// Responde correctamente cualquier actividad del catálogo, sin hardcodear tipos.
function respuestasCorrectas(a) {
  const out = {};
  a.ejercicios.forEach((e) => {
    if (e.tipo === 'test') out[e.id] = e.correcta;
    if (e.tipo === 'verdadero_falso') out[e.id] = e.correcta;
    if (e.tipo === 'escrita') out[e.id] = (e.respuestas || [])[0];
    if (e.tipo === 'sql' || e.tipo === 'excel') out[e.id] = e.esperado;
    if (e.tipo === 'ordenar') out[e.id] = e.correcta;
    if (e.tipo === 'relacionar') out[e.id] = Object.fromEntries(e.pares);
  });
  return out;
}

test('actividades: las respuestas abiertas se corrigen con criterio, no literal', () => {
  const escrita = { tipo: 'escrita', puntos: 10, respuestas: ['gestor de contraseñas'] };
  const sql = { tipo: 'sql', puntos: 10, esperado: 'select nombre from usuarios where edad > 18' };
  const excel = { tipo: 'excel', puntos: 10, esperado: '=b2*c2', alternativas: ['=c2*b2'] };

  // tolera acentos, mayúsculas, puntuación y espacios de más
  assert.strictEqual(actividades.corregirEjercicio(escrita, '  Gestor de Contraseñas ').ok, true);
  assert.strictEqual(actividades.corregirEjercicio(escrita, 'gestor de contrasenas').ok, true, 'la ñ sin tilde no puede penalizar');
  assert.strictEqual(actividades.corregirEjercicio(escrita, 'gestor de claves').ok, false, 'una respuesta distinta no cuela');
  // tolera una errata leve cuando la respuesta tiene cuerpo
  assert.strictEqual(actividades.corregirEjercicio(escrita, 'gestor de contraseñs').ok, true);
  // pero nunca en siglas cortas
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'escrita', puntos: 10, respuestas: ['dns'] }, 'dms').ok, false);
  assert.strictEqual(actividades.corregirEjercicio({ tipo: 'escrita', puntos: 10, respuestas: ['ip'] }, 'la IP').ok, true);

  // SQL: mismo enunciado escrito de otra forma
  assert.strictEqual(actividades.corregirEjercicio(sql, 'SELECT nombre FROM usuarios WHERE edad>18;').ok, true);
  assert.strictEqual(actividades.corregirEjercicio(sql, 'select * from usuarios').ok, false);
  // Excel: las alternativas declaradas también valen
  assert.strictEqual(actividades.corregirEjercicio(excel, '=C2*B2').ok, true);
  assert.strictEqual(actividades.corregirEjercicio(excel, '=B2+C2').ok, false);

  // respuesta vacía nunca aprueba
  assert.strictEqual(actividades.corregirEjercicio(escrita, '').ok, false);
  assert.strictEqual(actividades.corregirEjercicio(escrita, '   ').ok, false);
});

test('actividades: el repaso incluye la respuesta del usuario', async () => {
  sinSupabase();
  const dip = 'DIP-TEST-REPASO';
  const a = actividades.actividad('redes-conceptos');
  const respuestas = respuestasCorrectas(a);
  respuestas.e1 = 2;                    // fallada a propósito
  respuestas.e4 = 'la IP';              // acertada con artículo y mayúsculas
  const salida = await actividades.enviarIntento(dip, a.id, respuestas);

  const fallada = salida.revision.find((e) => e.id === 'e1');
  assert.strictEqual(fallada.ok, false);
  assert.strictEqual(fallada.dada, 2, 'el repaso puede explicar qué contestó el usuario');
  assert.ok(textoLegible(fallada));
  const acertada = salida.revision.find((e) => e.id === 'e4');
  assert.strictEqual(acertada.ok, true);
});

// Traduce la respuesta guardada a texto, igual que hace la interfaz.
function textoLegible(e) {
  if (e.tipo === 'test') return (e.opciones || [])[Number(e.dada)] || '';
  return String(e.dada);
}

test('carnet: los caminos de conducir exigen el nivel de un examen real', async () => {
  sinSupabase();
  const caminos = require('../lib/caminos');
  const lista = await caminos.catalogo();
  const b = lista.find((c) => c.id === 'carnet-b');
  assert.ok(b, 'existe el camino del permiso B');
  const etapas = (b.etapas || []).map((e) => e.id);
  assert.deepStrictEqual(etapas, ['senales', 'normas', 'prioridad', 'seguridad', 'documentacion', 'examen']);

  const elementos = caminos.elementosDe(b);
  const examen = elementos.find((e) => e.actividadId === 'carnet-examen');
  assert.ok(examen, 'el camino termina con un examen tipo');

  const act = actividades.actividad('carnet-examen');
  assert.strictEqual(act.evaluacion.minimo, 90, 'un 10 % de fallos es el margen del examen');
  assert.strictEqual(act.ejercicios.length, 20);
  assert.strictEqual(act.evaluacion.penalizacion, 0, 'repetir no resta: se practica hasta salir');

  // los test propios no copian bancos oficiales: solo enlazamos a la DGT
  const recurso = elementos.find((e) => e.tipo === 'recurso' && /dgt/i.test(e.proveedor || ''));
  assert.ok(recurso && /^https:\/\/www\.dgt\.es/.test(recurso.url));

  // ningún enunciado del catálogo de carnet menciona una fuente oficial
  const prohibido = /dgt|autoescuela|examen oficial/i;
  actividades.CATALOGO.filter((a) => a.categoria === 'Carnet de conducir').forEach((a) => {
    a.ejercicios.forEach((e) => {
      assert.ok(!prohibido.test(e.enunciado), 'enunciado propio, no copiado: ' + e.enunciado);
    });
  });
});

test('carnet: se puede suspender y volver a intentarlo', async () => {
  sinSupabase();
  const dip = 'DIP-TEST-CARNET';
  const a = actividades.actividad('carnet-examen');
  const regular = respuestasCorrectas(a);
  // 2 fallos de 20 = 90 % → aprueba justo en el límite
  regular.e1 = 3;
  regular.e2 = 3;
  const justo = await actividades.enviarIntento(dip, a.id, regular);
  assert.strictEqual(justo.resultado.aprobado, true);
  assert.strictEqual(justo.resultado.porcentaje, 90);

  // 3 fallos = 85 % → suspende y puede repetir
  const dip2 = 'DIP-TEST-CARNET-2';
  const peor = respuestasCorrectas(a);
  peor.e1 = 3; peor.e2 = 3; peor.e3 = 3;
  const suspenso = await actividades.enviarIntento(dip2, a.id, peor);
  assert.strictEqual(suspenso.resultado.porcentaje, 85);
  assert.strictEqual(suspenso.resultado.aprobado, false);
  assert.strictEqual(suspenso.recompensaPendiente, 0, 'suspender no genera recompensa');
  const estado = await actividades.estado(dip2);
  assert.strictEqual(estado[0].intentos, 1);
  assert.strictEqual(estado[0].completada, false);
});

test('actividades: comprobar un ejercicio no revela la solución', () => {  const mal = actividades.comprobarEjercicio('sql-basico', 'e4', 'select nombre from usuarios');
  assert.strictEqual(mal.ok, false);
  assert.strictEqual(mal.obtenidos, 0);
  assert.strictEqual(mal.maximo, 20);
  assert.ok(!JSON.stringify(mal).includes('usuarios'), 'no filtra la respuesta esperada');

  const bien = actividades.comprobarEjercicio('sql-basico', 'e4', 'SELECT * FROM usuarios;');
  assert.strictEqual(bien.ok, true);
  assert.strictEqual(bien.obtenidos, 20);

  assert.throws(() => actividades.comprobarEjercicio('no-existe', 'e1', 0), /actividad_no_encontrada/);
  assert.throws(() => actividades.comprobarEjercicio('sql-basico', 'no-existe', 0), /ejercicio_no_encontrado/);
});

test('actividades: la revisión completa solo llega al cerrar el intento', async () => {
  sinSupabase();
  const dip = 'DIP-TEST-REVISION';
  const a = actividades.actividad('ciber-fundamentos');
  const salida = await actividades.enviarIntento(dip, a.id, respuestasCorrectas(a));

  assert.strictEqual(salida.resultado.aprobado, true);
  assert.strictEqual(salida.revision.length, a.ejercicios.length);
  assert.ok(salida.revision.some((e) => e.solucion), 'la revisión explica la respuesta correcta');

  // el estado guardado no puede contener soluciones: se consulta por GET
  const guardado = JSON.stringify(await actividades.estado(dip));
  assert.ok(!/solucion/.test(guardado), 'el estado no filtra soluciones');
  assert.ok(!/esperado/.test(guardado), 'el estado no filtra la respuesta esperada');

  // la recompensa no se paga sola: queda como orden pendiente para el Banco
  assert.strictEqual(salida.recompensaPendiente, 35);
  assert.strictEqual(salida.bonusPendiente, 15);
});

test('tesoreria: las recompensas quedan como órdenes pendientes del Banco', async () => {
  sinSupabase();
  delete process.env.PLACETA_JOVEN_CUENTA_BUSINESS;
  const tesoreria = require('../lib/tesoreria');
  const dip = 'DIP-TEST-TESORERIA';
  const a = actividades.actividad('ciber-fundamentos');
  await actividades.enviarIntento(dip, a.id, respuestasCorrectas(a));

  const t = await tesoreria.estado(dip);
  assert.strictEqual(t.ordenesPendientes.length, 1);
  assert.strictEqual(t.ordenesPendientes[0].estado, 'PENDIENTE_BANCO');
  assert.strictEqual(t.ordenesPendientes[0].origen, 'actividad');
  assert.strictEqual(t.totalPendientePz, 50);
  // sin cuenta configurada no se inventa ningún saldo, solo se avisa
  assert.strictEqual(t.cuenta.lista, false);
  assert.ok(t.aviso);
  assert.strictEqual(t.flujos.find((f) => f.id === 'becas').direccion, 'entrada', 'las becas las paga la Administración');

  process.env.PLACETA_JOVEN_CUENTA_BUSINESS = 'PJ-BUSINESS-1';
  const conCuenta = await tesoreria.estado(dip);
  assert.strictEqual(conCuenta.cuenta.lista, true);
  assert.strictEqual(conCuenta.cuenta.cuentaBusiness, 'PJ-BUSINESS-1');
  assert.strictEqual(conCuenta.aviso, null);
  delete process.env.PLACETA_JOVEN_CUENTA_BUSINESS;
});

test('caminos: las actividades son pasos del camino y se completan al aprobarlas', async () => {
  sinSupabase();
  const caminos = require('../lib/caminos');
  const lista = await caminos.catalogo();
  const ciber = lista.find((c) => c.id === 'ciberseguridad');
  const planos = caminos.elementosDe(ciber);
  const act = planos.find((e) => e.tipo === 'actividad');
  assert.ok(act, 'el camino incluye actividades');
  assert.strictEqual(act.id, 'act-' + act.actividadId);
  assert.strictEqual(act.recompensa, 0, 'la recompensa la paga la actividad, no el camino');
  assert.deepStrictEqual(act.requisitos, [], 'la práctica no depende de trámites externos');

  const dip = 'DIP-TEST-CAMINOS';
  const elemento = async (id) => (await caminos.estado(dip)).progreso
    .find((p) => p.caminoId === 'ciberseguridad').elementos.find((e) => e.id === id);

  assert.strictEqual((await elemento(act.id)).estado, 'DISPONIBLE', 'se puede empezar el primer día');
  // una actividad encadenada a otra sí espera a la anterior
  const encadenada = planos.find((e) => e.tipo === 'actividad' && (e.requisitos || []).length);
  assert.ok(encadenada);
  assert.strictEqual((await elemento(encadenada.id)).estado, 'BLOQUEADO');

  const a = actividades.actividad(act.actividadId);
  const salida = await actividades.enviarIntento(dip, a.id, respuestasCorrectas(a));
  assert.strictEqual(salida.resultado.aprobado, true);

  assert.strictEqual((await elemento(act.id)).estado, 'COMPLETADO', 'aprobar la actividad avanza el camino');
  assert.strictEqual((await elemento(encadenada.id)).estado, 'DISPONIBLE', 'desbloquea el siguiente paso');
});
