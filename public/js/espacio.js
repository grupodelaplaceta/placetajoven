/* Placeta Joven · Espacio joven multipágina (Inicio / Academia Joven / Apoyo Indie)
   Motor compartido: cada página (espacio/*.html) indica su vista con
   <body data-page="inicio|academia|apoyo"> y este script se encarga de:
   - comprobar sesión/estado y mostrar la puerta correcta (identifícate,
     elige plan, pago en proceso, bloqueado por edad, error…);
   - si el socio está activo, pintar la cabecera, el menú entre páginas y el
     contenido de la página actual (Inicio/Academia/Apoyo). */
(function () {
  'use strict';

  var A = window.PlacetaJovenAuth;
  var PAGE = String(document.body.getAttribute('data-page') || 'inicio').trim();
  var APP = document.getElementById('app');
  var rw = { lista: [], filtro: 'todos', demo: false, activa: false };
  var rwConseguidas = {};
  var CANJEO = true; // el botón Conseguir siempre pide aceptar condiciones

  function $id(x) { return document.getElementById(x); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ((A && A.getSession() && A.getSession().token) || '')
    }, opts.headers || {});
    return fetch('/api/' + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(j.error || ('http_' + r.status));
          e.code = j.error || ('http_' + r.status);
          e.status = r.status;
          throw e;
        }
        return j;
      });
    });
  }

  function fmt(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch (e) { return iso; }
  }

  /* ── Utilidades de DOM ── */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function htmlToNode(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }
  function setHTML(container, html) { container.innerHTML = (html == null ? '' : html); }
  function btn(label, cls, onClick) {
    var b = el('button', 'mi-btn ' + cls, label);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  /* ── Errores legibles ── */
  function mensajeError(e) {
    var code = (e && (e.code || String(e.status || ''))) || '';
    if (!code) return 'No se ha podido conectar con la API de Placeta Joven. Reintenta en un momento.';
    if (code === 'SESION_INVALIDA' || code === 'token_requerido' || code === '401') return 'Tu sesión de PlacetaID ha caducado. Vuelve a identificarte para continuar.';
    if (code === 'NO_CONFIG') return 'El pago aún no está configurado en el servidor (falta configurar Lemon Squeezy).';
    if (code === 'LS_ERROR' || code === 'ls_502') return 'Lemon Squeezy ha rechazado el pago. Reintenta en un momento.';
    if (code === 'http_404' || code === '404' || code === 'TypeError' || code === 'FetchError' || code === 'network') return 'No se ha podido conectar con la API de Placeta Joven. Reinténtalo en un momento.';
    if (code === 'gateway_no_disponible') return 'La pasarela PlacetaID no responde ahora mismo. Inténtalo en unos minutos.';
    return 'Ha ocurrido un error inesperado. Reintenta o escribe a joven@laplaceta.org.';
  }

  /* ═══════════ PUERTAS (estados sin suscripción activa) ═══════════ */
  function cardCentrada(html) {
    return '<section class="mi-card center">' + html + '</section>';
  }
  function pintarLoading() {
    setHTML(APP, cardCentrada('<span class="mi-load"></span><p>Comprobando tu estado…</p>'));
  }
  function pintarNosession() {
    var url = A ? A.buildLoginUrl() : '#';
    setHTML(APP, cardCentrada(
      '<span class="mi-ico">🔐</span><h2>Identifícate con PlacetaID</h2>' +
      '<p>Entra para ver tu estado. Si tienes entre 16 y 30 años podrás contratar Placeta Joven; si no, el acceso se bloqueará.</p>' +
      '<a class="mi-btn primary" href="' + esc(url) + '">Acceder con PlacetaID</a>' +
      '<p class="fine">Placeta Joven es opcional. Puedes usar La Placeta sin contratarlo.</p>'));
  }
  function pintarError(e) {
    setHTML(APP, cardCentrada(
      '<span class="mi-ico err">⚠️</span><h2>No hemos podido comprobar tu estado</h2>' +
      '<p class="mi-err-txt">' + esc(mensajeError(e)) + '</p>' +
      '<div class="mi-actions">' +
      '  <button type="button" class="mi-btn primary" data-accion="reintentar">Reintentar</button>' +
      '  <a class="mi-btn ghost" href="../index.html">Volver a Placeta Joven</a>' +
      '</div><p class="fine">¿Sigues con problemas? Escríbenos a <a href="mailto:joven@laplaceta.org">joven@laplaceta.org</a></p>'));
    var r = APP.querySelector('[data-accion="reintentar"]');
    if (r) r.addEventListener('click', boot);
  }
  function pintarBloqueado(st) {
    setHTML(APP, cardCentrada(
      '<span class="mi-ico">🎂</span><h2>Todavía no es tu momento</h2>' +
      '<p class="mi-det">Placeta Joven está pensado para jóvenes de 16 a 30 años y tu edad (' + esc(st.edad || '?') + ') no cumple el requisito.</p>' +
      '<a class="mi-btn ghost" href="../index.html">Volver a Placeta Joven</a>' +
      '<p class="fine">La Placeta sigue siendo para todos.</p>'));
  }
  function pintarSin(st) {
    var aviso = '';
    if (st && st.pendienteCaducada) aviso = 'No hemos recibido la confirmación de tu pago. Puedes elegir de nuevo tu plan para reintentarlo.';
    else if (st && st.estado === 'CANCELADO') aviso = 'Tu suscripción terminó. Puedes darte de alta de nuevo cuando quieras.';
    else if (st && st.estado) aviso = 'Tu suscripción expiró. Vuelve a elegir un plan para reactivar tu espacio joven.';
    setHTML(APP, cardCentrada(
      '<span class="mi-ico ok">✨</span><h2>Elige tu plan</h2>' +
      '<p>Contrata Placeta Joven y desbloquea tu espacio: formación Cisco, descuentos, cashback y keys de juegos indie. Pago seguro con Lemon Squeezy. Ambos planes incluyen la oferta anual de beneficios «Drop Joven \'26».</p>' +
      '<div class="mi-plans">' +
      '  <article class="mi-plan"><h3>Plan mensual</h3><p class="price"><b>1,95&nbsp;€</b><span>/mes</span></p>' +
      '    <p class="equiv">Mes a mes son 23,40&nbsp;€ al año</p>' +
      '    <button type="button" class="mi-btn outline" data-plan="mensual">Contratar mensual</button></article>' +
      '  <article class="mi-plan feat"><span class="tag">La más rentable</span><h3>Plan anual</h3><p class="price"><b>10&nbsp;€</b><span>/año</span></p>' +
      '    <p class="equiv">Ahorras un <b>57&nbsp;%</b> (−13,40&nbsp;€)</p>' +
      '    <button type="button" class="mi-btn primary" data-plan="anual">Quiero el plan anual</button></article>' +
      '</div>' +
      (aviso ? '<p class="mi-aviso">' + esc(aviso) + '</p>' : '') +
      '<p class="fine">Puedes cancelar cuando quieras; las ventajas se mantienen hasta el final del período pagado.</p>'));
    Array.prototype.forEach.call(APP.querySelectorAll('[data-plan]'), function (b) {
      b.addEventListener('click', function () { alta(b.getAttribute('data-plan'), b); });
    });
  }
  function pintarInactivo(st) {
    var badge = st.estado;
    var badgeCls = 'neutral';
    var titulo = 'Suscripción ' + String(st.estado || '').toLowerCase();
    var det = 'Estado inesperado. Si crees que es un error, escríbenos a joven@laplaceta.org.';
    var botones = '<button type="button" class="mi-btn primary" data-accion="reintentar">Reintentar</button>';
    if (st.estado === 'PENDIENTE') {
      badgeCls = 'warn'; titulo = 'Pago en proceso';
      det = 'Estamos esperando la confirmación del pago. Si acabas de pagar, comprueba en unos segundos.';
      botones = '<button type="button" class="mi-btn primary" data-accion="reintentar">Comprobar de nuevo</button>' +
        '<button type="button" class="mi-btn outline" data-accion="pagar">Pagar de nuevo</button>';
    } else if (st.estado === 'SUSPENDIDO') {
      badgeCls = 'neutral'; titulo = 'Suscripción suspendida';
      det = 'Hubo un problema con un pago reciente. Regularízalo para seguir disfrutando de tus ventajas.';
      botones = '<button type="button" class="mi-btn primary" data-accion="pagar">Regularizar pago</button>';
    }
    setHTML(APP, cardCentrada(
      '<span class="mi-badge ' + badgeCls + '">' + esc(badge) + '</span><h2>' + esc(titulo) + '</h2>' +
      '<p class="mi-det">' + esc(det) + '</p>' +
      '<div class="mi-actions">' + botones + '</div>' +
      '<a class="mi-btn ghost" href="../index.html">Volver a Placeta Joven</a>'));
    var rt = APP.querySelector('[data-accion="reintentar"]');
    if (rt) rt.addEventListener('click', boot);
    var pg = APP.querySelector('[data-accion="pagar"]');
    if (pg) pg.addEventListener('click', function () { renovar(pg); });
  }

  /* ═══════════ ACCIONES (pago / renovar / canjear key) ═══════════ */
  function accion(fn, b, txtOk) {
    if (b) { b.disabled = true; b._orig = b.textContent; b.textContent = txtOk || 'Procesando…'; }
    return fn().catch(function (e) { pintarError(e); }).finally(function () {
      if (b) { b.disabled = false; b.textContent = b._orig; }
    });
  }
  function alta(plan, b) {
    return accion(function () {
      return api('alta', { method: 'POST', body: JSON.stringify({ plan: plan }) })
        .then(function (r) { if (r && r.checkoutUrl) window.location.href = r.checkoutUrl; });
    }, b, 'Abriendo pago…');
  }
  function renovar(b) {
    return accion(function () {
      return api('renovar', { method: 'POST', body: '{}' })
        .then(function (r) { if (r && r.checkoutUrl) window.location.href = r.checkoutUrl; });
    }, b, 'Abriendo pago…');
  }
  function cancelar(b) {
    if (!window.confirm('¿Seguro que quieres cancelar Placeta Joven? Mantendrás las ventajas hasta el final del período pagado.')) return;
    return accion(function () {
      return api('cancelar', { method: 'POST', body: '{}' }).then(function () { boot(); });
    }, b, 'Cancelando…');
  }
  function canjearKey(keyId, b) {
    return accion(function () {
      return api('keys', { method: 'POST', body: JSON.stringify({ keyId: keyId, accion: 'canjear' }) })
        .then(function () { return api('status').then(function (st) { renderKeys(st.keys || []); }); });
    }, b, 'Guardando…');
  }

  /* ═══════════ CABECERA + MENÚ (entre páginas reales) ═══════════ */
  var PAGINAS = [
    { id: 'inicio', label: 'Inicio', ico: '🏠', href: 'inicio.html' },
    { id: 'academia', label: 'Academia Joven', ico: '🎓', href: 'academia.html' },
    { id: 'apoyo', label: 'Apoyo Indie', ico: '🎮', href: 'apoyo.html' }
  ];
  function navHtml() {
    var items = PAGINAS.map(function (p) {
      var on = p.id === PAGE ? ' is-on' : '';
      return '<a class="mi-tab' + on + '" href="' + p.href + '"' + (p.id === PAGE ? ' aria-current="page"' : '') + '>' + p.ico + ' ' + p.label + '</a>';
    }).join('');
    return '<nav class="mi-tabs" aria-label="Secciones de tu espacio">' + items + '</nav>';
  }
  function nombreSesion() {
    var s = A ? A.getSession() : null;
    return String((s && s.user && (s.user.nombreCompleto || s.user.nombre)) || (s && s.nombre) || '').trim();
  }
  function cabeceraHtml(st) {
    var nombre = nombreSesion();
    var prim = nombre.split(/\s+/)[0] || '';
    var ini = (nombre ? nombre.split(/\s+/).map(function (w) { return (w && w[0]) || ''; }).join('') : 'PJ').slice(0, 2).toUpperCase() || 'PJ';
    var pi = (st && st.planInfo) || {};
    var pill = pi.etiqueta || (st && st.plan === 'anual' ? 'Plan anual' : (st && st.plan === 'mensual' ? 'Plan mensual' : 'Placeta Joven'));
    return '<div class="mi-space-head">' +
      '<div class="mi-who"><span class="mi-who-ava">' + esc(ini) + '</span>' +
      '<div class="mi-who-txt"><p class="mi-who-kicker">Tu espacio joven</p>' +
      '<h1>' + esc(prim ? 'Hola, ' + prim : 'Hola, Joven') + '</h1></div></div>' +
      '<div class="mi-head-meta"><span class="mi-plan-pill">' + esc(pill) + '</span>' +
      '<a class="mi-btn ghost sm" href="../index.html">Salir</a></div></div>' + navHtml();
  }

  /* ═══════════ SUSCRIPCIÓN ═══════════ */
  function tarjetaSuscripcionHtml() {
    return '<article class="mi-card mi-sub">' +
      '<div class="mi-sub-head"><div><span class="mi-badge" id="mi-sub-badge">✓ Activa</span>' +
      '<h2 id="mi-sub-title">Tienes Placeta Joven</h2></div>' +
      '<span class="mi-sub-tag" id="mi-sub-plan-tag">Plan anual</span></div>' +
      '<div class="mi-sub-rows">' +
      '<div class="mi-sub-row"><span>Estado</span><b id="mi-sub-estado">—</b></div>' +
      '<div class="mi-sub-row"><span>Plan</span><b id="mi-sub-plan">—</b></div>' +
      '<div class="mi-sub-row"><span>Precio</span><b id="mi-sub-precio">—</b></div>' +
      '<div class="mi-sub-row"><span>Válido hasta</span><b id="mi-sub-hasta">—</b></div></div>' +
      '<p class="mi-sub-note" id="mi-sub-note"></p>' +
      '<div class="mi-actions" id="mi-sub-btns"></div></article>';
  }
  function renderSuscripcion(st) {
    var activa = st.estado === 'ACTIVO';
    $id('mi-sub-badge').textContent = activa ? '✓ Activa' : 'Cancelada';
    $id('mi-sub-badge').className = 'mi-badge ' + (activa ? 'ok' : 'warn');
    $id('mi-sub-title').textContent = activa ? 'Tienes Placeta Joven' : 'Placeta Joven cancelada';
    var pi = st.planInfo || {};
    $id('mi-sub-plan-tag').textContent = pi.etiqueta || (st.plan === 'anual' ? 'Plan anual' : 'Plan mensual');
    $id('mi-sub-estado').textContent = activa ? 'Activa' : 'Cancelada (hasta fin de período)';
    $id('mi-sub-plan').textContent = st.plan === 'anual' ? 'Anual' : 'Mensual';
    $id('mi-sub-precio').innerHTML = pi.precioLabel || (st.plan === 'anual' ? '10&nbsp;€/año' : '1,95&nbsp;€/mes');
    $id('mi-sub-hasta').textContent = fmt(st.expiresAt) || '—';
    $id('mi-sub-note').textContent = activa
      ? 'Tu suscripción se renueva automáticamente. Puedes cancelarla cuando quieras.'
      : 'Cancelaste la suscripción. Mantienes todas las ventajas hasta el final del período pagado y puedes reactivarla cuando quieras.';
    var btns = $id('mi-sub-btns');
    btns.innerHTML = '';
    if (activa) {
      btns.appendChild(btn('Renovar / pagar ahora', 'outline', function () { renovar(this); }));
      btns.appendChild(btn('Cancelar suscripción', 'danger', function () { cancelar(this); }));
    } else {
      btns.appendChild(btn('Reactivar suscripción', 'primary', function () { renovar(this); }));
    }
  }

  /* ═══════════ NOTICIAS + DESTACADOS (Inicio) ═══════════ */
  var MI_NEWS = [
    { ico: '✨', tipo: 'Novedad', titulo: 'Tu espacio joven se renueva', texto: 'Ahora son páginas reales: Inicio, Academia Joven y Apoyo Indie.' },
    { ico: '📦', tipo: 'Drop Joven \'26', titulo: 'Tu oferta anual de beneficios', texto: 'Formación Cisco, descuentos en Pz, cashback y keys indie, incluida con tu plan.' },
    { ico: '🎓', tipo: 'Academia Joven', titulo: '+20 puntos de acceso a plazas', texto: 'Matricúlate en los cursos de Cisco NetAcad desde Placeta Joven y consigue tu plaza.' },
    { ico: '🎮', tipo: 'Apoyo Indie', titulo: 'Cuando un estudio colabore…', texto: 'sus juegos aparecerán en Apoyo Indie: 1 key por usuario y título, con las condiciones de cada juego.' }
  ];
  function renderNews() {
    var c = $id('mi-news-list');
    if (!c) return;
    c.innerHTML = '';
    MI_NEWS.forEach(function (n) {
      var item = el('article', 'mi-news-item');
      item.appendChild(el('span', 'mi-news-ico', n.ico));
      var txt = el('div', 'mi-news-txt');
      txt.appendChild(el('span', 'mi-news-tipo', n.tipo));
      txt.appendChild(el('b', 'mi-news-t', n.titulo));
      txt.appendChild(el('p', '', n.texto));
      item.appendChild(txt);
      c.appendChild(item);
    });
  }
  function renderDestacados() {
    var c = $id('mi-destac-list');
    if (!c) return;
    c.innerHTML = '';
    var juego = null;
    for (var i = 0; i < rw.lista.length; i++) {
      var x = rw.lista[i];
      if (x.categoria === 'videojuegos' && x.canjeable && !rwConseguidas[x.id]) { juego = x; break; }
    }
    if (juego) {
      (function (j) {
        var a = el('a', 'mi-destac-item', null);
        a.href = 'apoyo.html?recompensa=' + encodeURIComponent(j.id);
        a.appendChild(el('span', 'mi-destac-ico', '🎮'));
        var t = el('span', 'mi-destac-txt');
        t.appendChild(el('b', '', j.nombre));
        t.appendChild(el('small', '', (j.desarrolladora || 'Estudio indie') + ' · ' + j.pz + ' Pz' + (j.stock != null ? ' · Quedan ' + j.stock : '')));
        a.appendChild(t);
        a.appendChild(el('span', 'mi-destac-go', 'Ver →'));
        c.appendChild(a);
      })(juego);
    } else {
      var p = el('a', 'mi-destac-item', null);
      p.href = 'apoyo.html';
      p.appendChild(el('span', 'mi-destac-ico', '🎮'));
      var pt = el('span', 'mi-destac-txt');
      pt.appendChild(el('b', '', 'Juegos indie próximamente'));
      pt.appendChild(el('small', '', 'Cuando un estudio colabore, verás aquí sus juegos.'));
      p.appendChild(pt);
      p.appendChild(el('span', 'mi-destac-go', 'Ir →'));
      c.appendChild(p);
    }
    var a2 = el('a', 'mi-destac-item mi-destac-course', null);
    a2.href = 'academia.html';
    a2.appendChild(el('span', 'mi-destac-ico', '🎓'));
    var t2 = el('span', 'mi-destac-txt');
    t2.appendChild(el('b', '', 'Academia Joven · +20 puntos a plazas'));
    t2.appendChild(el('small', '', 'Matricúlate en los cursos de Cisco NetAcad y gana puntos de acceso a plazas.'));
    a2.appendChild(t2);
    a2.appendChild(el('span', 'mi-destac-go', 'Ver →'));
    c.appendChild(a2);
  }

  /* ═══════════ CATÁLOGO (Apoyo Indie) ═══════════ */
  var RW_CATS = [
    { id: 'todos', etiqueta: 'Todos' }, { id: 'videojuegos', etiqueta: 'Videojuegos' },
    { id: 'formacion', etiqueta: 'Formación' }, { id: 'experiencias', etiqueta: 'Experiencias' }, { id: 'otros', etiqueta: 'Otros' }
  ];
  var RW_UI = { videojuegos: { etiqueta: 'Videojuegos', icono: '🎮' }, formacion: { etiqueta: 'Formación', icono: '🎓' }, experiencias: { etiqueta: 'Experiencias', icono: '🎟️' }, otros: { etiqueta: 'Otros', icono: '🎁' } };
  function rwMarcarConseguidas(keys) {
    rwConseguidas = {};
    (keys || []).forEach(function (k) { if (k && k.recompensaId) rwConseguidas[String(k.recompensaId)] = true; });
  }
  function rwIcono(cat) { return (RW_UI[cat] && RW_UI[cat].icono) || '🎁'; }
  function rwCatLabel(cat) { return (RW_UI[cat] && RW_UI[cat].etiqueta) || cat; }
  function rwDisponible(r) { return /^disponible$/i.test(String(r.disponibilidad || '')); }
  function rwEstado(txt, tipo) {
    var e = $id('mi-rw-estado');
    if (!e) return;
    e.hidden = !txt;
    e.textContent = txt || '';
    e.className = 'mi-rw-estado' + (tipo ? ' ' + tipo : '');
  }
  function rwCover(r, cls) {
    var wrap = el('div', cls || 'mi-rw-cover');
    if (r.imagen) { wrap.appendChild(Object.assign(el('img', '', null), { src: r.imagen, alt: r.nombre, loading: 'lazy' })); return wrap; }
    var ph = el('div', 'mi-rw-ph mi-rw-ph--' + r.categoria);
    ph.appendChild(el('span', 'mi-rw-ph-ico', rwIcono(r.categoria)));
    ph.appendChild(el('span', 'mi-rw-ph-cap', 'Imagen de ejemplo'));
    wrap.appendChild(ph);
    return wrap;
  }
  function rwCard(r) {
    var conseguida = !!rwConseguidas[r.id];
    var puede = r.canjeable && !conseguida;
    var card = el('article', 'mi-rw-card' + (rwDisponible(r) ? '' : ' soon') + (conseguida ? ' got' : ''));
    card.setAttribute('data-cat', r.categoria);
    var coverBtn = el('button', 'mi-rw-coverbtn', null);
    coverBtn.type = 'button';
    coverBtn.setAttribute('aria-label', 'Ver ficha de ' + r.nombre);
    coverBtn.appendChild(rwCover(r));
    coverBtn.addEventListener('click', function () { abrirRw(r.id); });
    card.appendChild(coverBtn);
    var body = el('div', 'mi-rw-body');
    var tagRow = el('div', 'mi-rw-tags');
    tagRow.appendChild(el('span', 'mi-rw-cat', rwCatLabel(r.categoria)));
    if (conseguida) tagRow.appendChild(el('span', 'mi-rw-est ok', 'Conseguida'));
    else if (!rwDisponible(r)) {
      var estTxt = r.disponibilidad || 'Próximamente';
      tagRow.appendChild(el('span', 'mi-rw-est' + (estTxt === 'Agotado' ? ' agot' : ''), estTxt));
    }
    body.appendChild(tagRow);
    body.appendChild(el('h4', 'mi-rw-nombre', r.nombre));
    if (r.desarrolladora) body.appendChild(el('p', 'mi-rw-dev', r.desarrolladora));
    var meta = el('div', 'mi-rw-meta');
    if (r.plataforma) meta.appendChild(el('span', 'mi-rw-plat', r.plataforma));
    if (r.edadRecomendada) meta.appendChild(el('span', 'mi-rw-edad', r.edadRecomendada));
    if (!conseguida && r.canjeable && r.stock != null) meta.appendChild(el('span', 'mi-rw-stock', 'Quedan ' + r.stock));
    body.appendChild(meta);
    var foot = el('div', 'mi-rw-foot');
    foot.appendChild(el('span', 'mi-rw-pz', (Number(r.pz) || 0) + ' Pz'));
    var got = el('button', 'mi-btn primary sm' + (puede ? '' : ' off'),
      conseguida ? 'Conseguida ✓' : (r.canjeable ? 'Conseguir' : (r.disponibilidad || 'Próximamente')));
    got.type = 'button';
    if (puede) got.addEventListener('click', function () { abrirRw(r.id); }); else got.disabled = true;
    foot.appendChild(got);
    body.appendChild(foot);
    card.appendChild(body);
    return card;
  }
  function renderRwGrilla() {
    var grid = $id('mi-rw-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var list = rw.lista.filter(function (r) { return rw.filtro === 'todos' || r.categoria === rw.filtro; });
    if (!list.length) {
      rwEstado(rw.filtro !== 'todos'
        ? 'Todavía no hay recompensas en «' + rwCatLabel(rw.filtro) + '». Vuelve pronto: iremos añadiendo más.'
        : 'Aún no hay recompensas disponibles. Cuando haya colaboraciones confirmadas aparecerán aquí.', 'empty');
      grid.hidden = true;
      return;
    }
    rwEstado('');
    grid.hidden = false;
    list.forEach(function (r) { grid.appendChild(rwCard(r)); });
  }
  function renderRwFiltros() {
    var bar = $id('mi-rw-filtros');
    if (!bar) return;
    bar.innerHTML = '';
    RW_CATS.forEach(function (c) {
      var b = el('button', 'mi-rw-filtro' + (c.id === rw.filtro ? ' on' : ''), c.etiqueta);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(c.id === rw.filtro));
      b.addEventListener('click', function () { rw.filtro = c.id; renderRwFiltros(); renderRwGrilla(); });
      bar.appendChild(b);
    });
  }
  function rwRow(k, v) {
    var wrap = el('div', 'mi-rw-spec-row');
    wrap.appendChild(el('dt', 'mi-rw-spec-k', k));
    wrap.appendChild(el('dd', 'mi-rw-spec-v', v));
    return wrap;
  }
  function abrirRw(id) {
    var r = null;
    for (var i = 0; i < rw.lista.length; i++) { if (rw.lista[i].id === id) { r = rw.lista[i]; break; } }
    if (!r) return;
    var det = $id('mi-rw-detalle');
    if (!det) return;
    det.innerHTML = '';
    var back = el('button', 'mi-btn ghost sm mi-rw-back', '← Todas las recompensas');
    back.type = 'button';
    back.addEventListener('click', cerrarRw);
    det.appendChild(back);
    var layout = el('div', 'mi-rw-det-layout');
    layout.appendChild(rwCover(r, 'mi-rw-det-cover'));
    var info = el('div', 'mi-rw-det-info');
    var conseguida = !!rwConseguidas[r.id];
    var estDisp = r.disponibilidad || 'Próximamente';
    var tagRow = el('div', 'mi-rw-tags');
    tagRow.appendChild(el('span', 'mi-rw-cat', rwCatLabel(r.categoria)));
    if (conseguida) tagRow.appendChild(el('span', 'mi-rw-est ok', 'Conseguida'));
    else tagRow.appendChild(el('span', 'mi-rw-est ' + (estDisp === 'Agotado' ? 'agot' : (rwDisponible(r) ? 'ok' : 'soon')), estDisp));
    info.appendChild(tagRow);
    info.appendChild(el('h3', 'mi-rw-det-nombre', r.nombre));
    if (r.desarrolladora) info.appendChild(el('p', 'mi-rw-dev', 'por ' + r.desarrolladora));
    if (r.descripcion) info.appendChild(el('p', 'mi-rw-desc', r.descripcion));
    var spec = el('dl', 'mi-rw-spec');
    if (r.plataforma) spec.appendChild(rwRow('Plataforma', r.plataforma));
    if (r.edadRecomendada) spec.appendChild(rwRow('Edad recomendada', r.edadRecomendada));
    var dispTxt = estDisp;
    if (rwDisponible(r) && r.stock != null) dispTxt = 'Disponible · Quedan ' + r.stock + ' keys';
    spec.appendChild(rwRow('Disponibilidad', dispTxt));
    info.appendChild(spec);
    info.appendChild(htmlToNode('<div class="mi-rw-det-price">Necesitas <b class="mi-rw-pz">' + (Number(r.pz) || 0) + ' Pz</b> <span class="mi-rw-pz-txt">(Placetas)</span></div>'));
    if (r.condiciones) {
      var cond = el('div', 'mi-rw-cond');
      cond.appendChild(el('b', 'mi-rw-cond-t', 'Condiciones de compra'));
      cond.appendChild(el('p', '', r.condiciones));
      info.appendChild(cond);
    }
    var acc = el('div', 'mi-rw-det-acc');
    var puede = r.canjeable && !conseguida;
    if (conseguida) {
      acc.appendChild(el('p', 'mi-rw-ya', 'Ya conseguiste esta recompensa. Tu key está en «Keys de juegos indie» (límite: una por usuario y título).'));
    } else if (puede) {
      var acept = el('label', 'mi-rw-acept');
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      var got = el('button', 'mi-btn primary', 'Conseguir recompensa');
      got.type = 'button';
      got.disabled = true;
      chk.addEventListener('change', function () { got.disabled = !chk.checked; });
      var txtA = el('span', '', 'He leído y acepto las condiciones de este juego.');
      acept.appendChild(chk); acept.appendChild(txtA);
      acc.appendChild(acept);
      got.addEventListener('click', function () { conseguirRw(r, got); });
      acc.appendChild(got);
    } else {
      var got2 = el('button', 'mi-btn primary off', estDisp === 'Agotado' ? 'Agotado' : 'No disponible todavía');
      got2.type = 'button'; got2.disabled = true;
      acc.appendChild(got2);
    }
    info.appendChild(acc);
    info.appendChild(el('p', 'fine mi-rw-nota',
      r.canjeable && !conseguida
        ? 'Al conseguirla, la key se guarda en tu espacio (aparece en «Keys de juegos indie») y solo podrás conseguirla una vez.'
        : (estDisp === 'Agotado' ? 'Se han agotado las keys de esta recompensa. Vuelve pronto.' : 'Todavía no se puede conseguir esta recompensa.')));
    layout.appendChild(info);
    det.appendChild(layout);
    var fl = $id('mi-rw-filtros'), gr = $id('mi-rw-grid'), es = $id('mi-rw-estado');
    if (fl) fl.hidden = true; if (gr) gr.hidden = true; if (es) es.hidden = true;
    det.hidden = false;
    rw.activa = true;
    det.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function cerrarRw() {
    rw.activa = false;
    var det = $id('mi-rw-detalle');
    if (det) { det.hidden = true; det.innerHTML = ''; }
    var fl = $id('mi-rw-filtros'), gr = $id('mi-rw-grid');
    if (fl) fl.hidden = false;
    if (gr) gr.hidden = false;
    renderRwGrilla();
  }
  function rwMsgCanje(code) {
    switch (code) {
      case 'canjeo_desactivado': return 'El canje con Placetas (Pz) se activará cuando haya recompensas confirmadas. De momento no se puede conseguir.';
      case 'ya_conseguida': return 'Ya conseguiste esta recompensa. Solo se puede conseguir una vez por usuario y título.';
      case 'no_disponible': return 'Esta recompensa todavía no está disponible para conseguir.';
      case 'sin_stock': return 'Acabamos de quedarnos sin keys de esta recompensa. Vuelve pronto.';
      case 'no_activa': return 'Necesitas tener Placeta Joven activa para conseguir recompensas.';
      case 'recompensa_no_encontrada': return 'No hemos encontrado esa recompensa. Recarga la página.';
      case 'edad_no_permitida': return 'Este programa es para jóvenes de 16 a 30 años.';
      default: return null;
    }
  }
  function conseguirRw(r, btn) {
    if (btn.disabled) return;
    btn.disabled = true; var orig = btn.textContent; btn.textContent = 'Procesando…';
    api('recompensas', { method: 'POST', body: JSON.stringify({ recompensaId: r.id }) })
      .then(function () {
        return api('status').then(function (st) {
          renderKeys(st.keys || []);
          rwMarcarConseguidas(st.keys || []);
        });
      })
      .then(function () {
        rw.lista.forEach(function (x) {
          if (x.id === r.id && x.stock != null) {
            x.stock = Math.max(0, Number(x.stock) - 1);
            if (x.stock === 0 && /^disponible$/i.test(String(x.disponibilidad || ''))) { x.disponibilidad = 'Agotado'; x.canjeable = false; }
          }
        });
        cerrarRw();
        rwEstado('¡Recompensa conseguida! Tu key ya está en «Keys de juegos indie». Solo puedes conseguirla una vez.', 'ok');
      })
      .catch(function (e) {
        rwEstado(rwMsgCanje(e && e.code) || 'No se ha podido conseguir la recompensa. Reintenta en un momento.', 'error');
        btn.disabled = false; btn.textContent = orig;
      });
  }
  async function cargarRecompensas(keys) {
    rwMarcarConseguidas(keys);
    var es = $id('mi-rw-estado'); if (es) rwEstado('Cargando recompensas…');
    var gr = $id('mi-rw-grid'); if (gr) gr.hidden = true;
    try {
      var res = await api('recompensas');
      rw.demo = !!(res && res.demo);
      rw.lista = (res && Array.isArray(res.recompensas)) ? res.recompensas : [];
      rw.filtro = 'todos';
      renderRwFiltros();
      renderRwGrilla();
      renderDestacados();
    } catch (e) {
      rw.lista = []; renderRwFiltros();
      rwEstado('No se han podido cargar las recompensas ahora mismo. Inténtalo en unos minutos.', 'error');
      renderDestacados();
    }
    // Abrir una recompensa concreta si llegamos desde Inicio (?recompensa=id)
    var qr = new URLSearchParams(window.location.search).get('recompensa');
    if (qr) { var f = rw.lista.find(function (x) { return x.id === qr; }); if (f) abrirRw(qr); }
  }

  /* ═══════════ KEYS (Apoyo Indie) ═══════════ */
  function renderKeys(keys) {
    var cont = $id('mi-keys-list');
    if (!cont) return;
    cont.innerHTML = '';
    if (!keys || !keys.length) {
      cont.appendChild(el('p', 'mi-keys-empty', 'Aún no tienes keys. Cuando un estudio colaborador ceda claves aparecerán aquí.'));
      return;
    }
    keys.forEach(function (k) {
      var card = el('div', 'mi-key' + (k.estado === 'usado' ? ' used' : ''));
      var head = el('div', 'mi-key-head');
      var t = el('div', '', null);
      var b = el('b', '', k.juego || 'Juego indie');
      var pl = el('span', '', k.plataforma ? k.plataforma.toUpperCase() : '');
      t.appendChild(b); t.appendChild(pl);
      if (k.recompensaId && k.pz) {
        var or = el('span', 'mi-key-origen', 'Recompensa · ' + k.pz + ' Pz');
        t.appendChild(or);
      }
      var st = el('span', 'mi-key-estado ' + (k.estado === 'usado' ? 'used' : 'ok'),
        k.estado === 'usado' ? (k.canjeada ? 'Canjeada · ' + fmt(k.canjeada) : 'Canjeada') : 'Disponible');
      head.appendChild(t); head.appendChild(st);
      card.appendChild(head);
      var code = el('div', 'mi-key-code');
      var cd = el('code', '', k.codigo || '—');
      var cop = btn('Copiar', 'tiny', function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(k.codigo || '').then(function () { cop.textContent = '¡Copiada!'; setTimeout(function () { cop.textContent = 'Copiar'; }, 1600); });
        }
      });
      code.appendChild(cd); code.appendChild(cop);
      card.appendChild(code);
      if (k.estado === 'disponible') {
        card.appendChild(btn('Marcar como canjeada', 'ghost sm', function () { canjearKey(k.id, this); }));
      }
      cont.appendChild(card);
    });
  }

  /* ═══════════ CONTENIDO POR PÁGINA ═══════════ */
  function htmlInicio() {
    return '<div class="mi-view">' +
      '<div class="mi-dash">' +
      tarjetaSuscripcionHtml() +
      '<article class="mi-card mi-vents"><h3 class="mi-card-title">Drop Joven \'26 · tus beneficios</h3>' +
      '<p class="mi-card-sub">La oferta anual de beneficios del programa, incluida con tu suscripción (mensual o anual).</p>' +
      '<ul class="mi-vents-list">' +
      '<li><span class="mi-v-ico">🎓</span><div><b>Formación Cisco NetAcad</b><span>Cursos oficiales a través de PlacetaEDU, con tu PlacetaID.</span></div></li>' +
      '<li><span class="mi-v-ico">💠</span><div><b>Cursos con descuento</b><span>Cursos propios de La Placeta con precio reducido pagando en Placetas (Pz).</span></div></li>' +
      '<li><span class="mi-v-ico">💳</span><div><b>Cashback · Cuenta Joven</b><span>Convierte tu cuenta de Banco de La Placeta en Cuenta Joven: 12&nbsp;% de cashback (impuestos excluidos).</span></div></li>' +
      '<li><span class="mi-v-ico">🎮</span><div><b>Keys de juegos indie</b><span>Claves de estudios colaboradores en Apoyo Indie.</span></div></li>' +
      '</ul></article>' +
      '<article class="mi-card mi-news"><div class="mi-card-ic"><span class="mi-v-ico mi-v-ico-lg">📣</span>' +
      '<div><h3 class="mi-card-title">Noticias y anuncios</h3><p class="mi-card-sub">Lo último de Placeta Joven.</p></div></div>' +
      '<div id="mi-news-list" class="mi-news-list"></div></article>' +
      '<article class="mi-card mi-destac"><div class="mi-card-ic"><span class="mi-v-ico mi-v-ico-lg">✨</span>' +
      '<div><h3 class="mi-card-title">Destacados para ti</h3><p class="mi-card-sub">Juegos y cursos que puedes aprovechar ahora mismo.</p></div></div>' +
      '<div id="mi-destac-list" class="mi-destac-list"></div></article>' +
      '</div></div>';
  }
  function htmlAcademia() {
    return '<div class="mi-view"><div class="mi-acad">' +
      '<article class="mi-card mi-acad-hero"><span class="mi-acad-ico">🎓</span><div>' +
      '<p class="mi-kicker-inline">Academia Joven</p><h3 class="mi-card-title">Cursos Cisco NetAcad</h3>' +
      '<p>Los cursos disponibles son los de <b>Cisco Networking Academy</b> a través de <b>PlacetaEDU</b>. La matrícula se gestiona desde Placeta Joven, con tu PlacetaID.</p>' +
      '</div></article>' +
      '<div class="mi-acad-plus"><span class="mi-acad-plus-num">+20</span>' +
      '<p><b>Placeta Joven</b> te suma <b>20 puntos de acceso</b> para conseguir tu <b>plaza</b> en los cursos de PlacetaEDU.</p></div>' +
      '<div class="mi-acad-steps">' +
      '<div class="mi-acad-step"><span class="mi-acad-step-n">1</span><p><b>Elige un curso</b><br />de Cisco NetAcad disponible.</p></div>' +
      '<div class="mi-acad-step"><span class="mi-acad-step-n">2</span><p><b>Matricúlate</b><br />desde Placeta Joven.</p></div>' +
      '<div class="mi-acad-step"><span class="mi-acad-step-n">3</span><p><b>Consigue tu plaza</b><br />con tus puntos de acceso.</p></div>' +
      '<div class="mi-acad-step"><span class="mi-acad-step-n mi-acad-step-pz">+20</span><p><b>Como Placeta Joven</b><br />sumas 20 puntos extra.</p></div>' +
      '</div>' +
      '<div class="mi-acad-cta">' +
      '<a class="mi-btn primary" href="https://www.laplaceta.org/proyectos/placetaedu" target="_blank" rel="noopener">Ver cursos y matricularme</a>' +
      '<p class="fine">Próximamente: catálogo de cursos y tu matrícula directamente aquí.</p>' +
      '</div></div></div>';
  }
  function htmlApoyo() {
    return '<div class="mi-view"><div class="mi-dash">' +
      '<article class="mi-card mi-apoyo-intro"><div class="mi-card-ic"><span class="mi-v-ico mi-v-ico-lg">🎮</span>' +
      '<div><h3 class="mi-card-title">Apoyo Indie</h3>' +
      '<p class="mi-card-sub">Estudios independientes ceden keys a la comunidad. Cada juego tiene sus propias condiciones: 1 key por usuario y título.</p></div></div></article>' +
      '<article class="mi-card mi-rw" id="mi-recompensas">' +
      '<div class="mi-rw-head"><div><h3 class="mi-card-title">Juegos disponibles</h3>' +
      '<p class="mi-card-sub">Canjea tus Placetas (Pz). Cada juego tiene sus condiciones de compra, que tendrás que aceptar antes de conseguirlo.</p></div></div>' +
      '<div class="mi-rw-filtros" id="mi-rw-filtros" role="group" aria-label="Filtrar recompensas"></div>' +
      '<p class="mi-rw-estado" id="mi-rw-estado" hidden></p>' +
      '<div class="mi-rw-grid" id="mi-rw-grid" hidden></div>' +
      '<div class="mi-rw-detalle" id="mi-rw-detalle" hidden></div></article>' +
      '<article class="mi-card mi-keys"><h3 class="mi-card-title">Tus keys</h3>' +
      '<p class="mi-card-sub">Las keys que has conseguido. Cópialas y actívalas en la plataforma del juego.</p>' +
      '<div id="mi-keys-list"></div></article>' +
      '</div></div>';
  }

  function pintarEspacio(st) {
    document.body.classList.add('mi-is-active');
    var contenido = PAGE === 'academia' ? htmlAcademia() : (PAGE === 'apoyo' ? htmlApoyo() : htmlInicio());
    setHTML(APP, cabeceraHtml(st) + contenido);
    document.title = 'Placeta Joven · ' + (PAGE === 'academia' ? 'Academia Joven' : PAGE === 'apoyo' ? 'Apoyo Indie' : 'Mi espacio');
    if (PAGE === 'inicio' || PAGE === 'apoyo') renderKeys(st.keys || []);
    if (PAGE === 'inicio') { renderSuscripcion(st); renderNews(); }
    if (PAGE === 'apoyo') cargarRecompensas(st.keys || []);
    if (PAGE === 'inicio') cargarRecompensas(st.keys || []); // para los destacados
    if (PAGE === 'inicio') renderDestacados();
  }

  /* ═══════════ BOOT ═══════════ */
  async function boot() {
    pintarLoading();
    var s = A ? A.getSession() : null;
    if (!s || !s.token) { pintarNosession(); return; }
    try {
      var st = await api('status');
      if (!st.permitido) { pintarBloqueado(st); return; }
      if (st.estado === 'ACTIVO' || (st.estado === 'CANCELADO' && st.sigueVigente)) { pintarEspacio(st); return; }
      if (st.requiereAlta || !st.estado) { pintarSin(st); return; }
      pintarInactivo(st);
    } catch (e) {
      pintarError(e);
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
