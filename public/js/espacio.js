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

  // ── Iconos SVG (estilo consistente, sin emojis) ──
  var SVG = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
    grad: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-3.5"/><path d="M22 10v6"/>',
    gamepad: '<path d="M6 11h4M8 9v4"/><path d="M15.5 12h.01M17.5 10.5h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4a2 2 0 0 1 1.4-.6h4.3a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.4A4 4 0 0 0 17.32 5Z"/>',
    ticket: '<path d="M3 10V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 1 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 1 0 0-4Z"/><path d="M15 5v2M15 11v2M15 17v2"/>',
    gift: '<rect x="3" y="8" width="18" height="4"/><path d="M5 12v8h14v-8"/><path d="M12 8v12"/><path d="M12 8c-2.2 0-4.6-1.6-4.6-3.4C7.4 2.7 9 2 9.8 3 11 4.4 12 8 12 8Z"/><path d="M12 8c2.2 0 4.6-1.6 4.6-3.4C16.6 2.7 15 2 14.2 3 13 4.4 12 8 12 8Z"/>',
    spark: '<path d="M12 3l2.2 4.8 5.3.8-3.9 3.8.9 5.2-4.5-2.4-4.5 2.4.9-5.2L4.5 8.6l5.3-.8L12 3Z"/>',
    news: '<circle cx="6" cy="18" r="2"/><path d="M6 11a7 7 0 0 1 7 7"/><path d="M6 4a14 14 0 0 1 14 14"/>',
    pkg: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V5a2 2 0 0 1 2-2h8l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.5"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    back: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    cake: '<path d="M4 21h16"/><path d="M5 21V10a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v11"/><path d="M9 9V6.5M12 9V5M15 9V6.5"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    pz: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9"/><path d="M15 9.3c-.8-1-2-1.5-3.2-1.5-1.5 0-2.8 1-2.8 2.4S10.5 12.4 12 12.9c1.5.5 3 1.1 3 2.5s-1.3 2.6-3 2.6c-1.3 0-2.5-.6-3.2-1.7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  };
  function ic(name, cls) {
    return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (SVG[name] || '') + '</svg>';
  }
  function icoNode(name, cls) { return htmlToNode(ic(name, cls)); }

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
      '<span class="mi-ico">' + ic('lock') + '</span><h2>Identifícate con PlacetaID</h2>' +
      '<p>Entra para ver tu estado. Si tienes entre 16 y 30 años podrás contratar Placeta Joven; si no, el acceso se bloqueará.</p>' +
      '<a class="mi-btn primary" href="' + esc(url) + '">' + ic('arrow') + ' Acceder con PlacetaID</a>' +
      '<p class="fine">Placeta Joven es opcional. Puedes usar La Placeta sin contratarlo.</p>'));
  }
  function pintarError(e) {
    setHTML(APP, cardCentrada(
      '<span class="mi-ico err">' + ic('alert') + '</span><h2>No hemos podido comprobar tu estado</h2>' +
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
      '<span class="mi-ico">' + ic('cake') + '</span><h2>Todavía no es tu momento</h2>' +
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
      '<span class="mi-ico ok">' + ic('spark') + '</span><h2>Elige tu plan</h2>' +
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
      det = 'Estamos esperando la confirmación del pago. Si ya pagaste, verifícalo abajo y activaremos tu Placeta Joven (no se te cobra dos veces).';
      botones = '<button type="button" class="mi-btn primary" data-accion="reintentar">Comprobar de nuevo</button>' +
        '<button type="button" class="mi-btn ghost" data-accion="verificar">Ya he pagado · Verificar pago</button>' +
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
    var vf = APP.querySelector('[data-accion="verificar"]');
    if (vf) vf.addEventListener('click', function () { verificarPago(vf); });
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
  // Verifica si el pago ya se hizo en Lemon Squeezy y activa la suscripción.
  function verificarPago(b) {
    if (b) { b.disabled = true; b.textContent = 'Comprobando pago…'; }
    api('verificar', { method: 'POST', body: '{}' })
      .then(function (r) { if (r && r.ok && r.estado === 'ACTIVO') { boot(); return; } throw Object.assign(new Error('sin_suscripcion'), { code: 'sin_suscripcion' }); })
      .catch(function (e) {
        var card = APP && APP.querySelector('.mi-card');
        if (card) {
          var av = card.querySelector('.mi-aviso');
          if (!av) { av = document.createElement('p'); av.className = 'mi-aviso'; card.appendChild(av); }
          av.textContent = (e && e.code === 'sin_suscripcion')
            ? 'Todavía no vemos tu pago. A veces tarda unos minutos: si acabas de pagar, espera un momento y vuelve a verificar (no te cobramos dos veces).'
            : mensajeError(e);
        }
        if (b) { b.disabled = false; b.textContent = 'Ya he pagado · Verificar pago'; }
      });
  }
  function maybeAutoVerificar() {
    if (new URLSearchParams(window.location.search).get('pago') === 'ok') {
      setTimeout(function () { verificarPago(null); }, 1500);
    }
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
    { id: 'inicio', label: 'Inicio', ico: 'home', href: 'inicio.html' },
    { id: 'academia', label: 'Academia Joven', ico: 'grad', href: 'academia.html' },
    { id: 'apoyo', label: 'Apoyo Indie', ico: 'gamepad', href: 'apoyo.html' }
  ];
  function navHtml() {
    var items = PAGINAS.map(function (p) {
      var on = p.id === PAGE ? ' is-on' : '';
      return '<a class="mi-tab' + on + '" href="' + p.href + '"' + (p.id === PAGE ? ' aria-current="page"' : '') + '>' + ic(p.ico) + '<span>' + p.label + '</span></a>';
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
    { ico: 'spark', tipo: 'Novedad', titulo: 'Tu espacio joven se renueva', texto: 'Ahora son páginas reales: Inicio, Academia Joven y Apoyo Indie.' },
    { ico: 'pkg', tipo: 'Drop Joven \'26', titulo: 'Tu oferta anual de beneficios', texto: 'Formación Cisco, descuentos en Pz, cashback y keys indie, incluida con tu plan.' },
    { ico: 'grad', tipo: 'Academia Joven', titulo: '+20 puntos de acceso a plazas', texto: 'Matricúlate en los cursos de Cisco NetAcad desde Placeta Joven y consigue tu plaza.' },
    { ico: 'gamepad', tipo: 'Apoyo Indie', titulo: 'Cuando un estudio colabore…', texto: 'sus juegos aparecerán en Apoyo Indie: 1 key por usuario y título, con las condiciones de cada juego.' }
  ];
  function renderNews() {
    var c = $id('mi-news-list');
    if (!c) return;
    c.innerHTML = '';
    MI_NEWS.forEach(function (n) {
      var item = el('article', 'mi-news-item');
      var isp = el('span', 'mi-news-ico');
      isp.appendChild(icoNode(n.ico));
      item.appendChild(isp);
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
        var isp = el('span', 'mi-destac-ico');
        isp.appendChild(icoNode('gamepad'));
        a.appendChild(isp);
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
      var psp = el('span', 'mi-destac-ico');
      psp.appendChild(icoNode('gamepad'));
      p.appendChild(psp);
      var pt = el('span', 'mi-destac-txt');
      pt.appendChild(el('b', '', 'Juegos indie próximamente'));
      pt.appendChild(el('small', '', 'Cuando un estudio colabore, verás aquí sus juegos.'));
      p.appendChild(pt);
      p.appendChild(el('span', 'mi-destac-go', 'Ir →'));
      c.appendChild(p);
    }
    var a2 = el('a', 'mi-destac-item mi-destac-course', null);
    a2.href = 'academia.html';
    var csp = el('span', 'mi-destac-ico');
    csp.appendChild(icoNode('grad'));
    a2.appendChild(csp);
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
  var RW_UI = {
    videojuegos: { etiqueta: 'Videojuegos', icono: 'gamepad' },
    formacion: { etiqueta: 'Formación', icono: 'grad' },
    experiencias: { etiqueta: 'Experiencias', icono: 'ticket' },
    otros: { etiqueta: 'Otros', icono: 'gift' }
  };
  var tiendaBusqueda = '';
  function rwMarcarConseguidas(keys) {
    rwConseguidas = {};
    (keys || []).forEach(function (k) { if (k && k.recompensaId) rwConseguidas[String(k.recompensaId)] = true; });
  }
  function rwCatIco(cat) { return (RW_UI[cat] && RW_UI[cat].icono) || 'gift'; }
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
    var g = el('span', 'mi-rw-ph-glyph');
    g.appendChild(icoNode(rwCatIco(r.categoria)));
    ph.appendChild(g);
    ph.appendChild(el('span', 'mi-rw-ph-badge', rwCatLabel(r.categoria)));
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
    if (r.genero) meta.appendChild(el('span', 'mi-rw-gen', r.genero));
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
    var q = (tiendaBusqueda || '').trim().toLowerCase();
    var list = rw.lista.filter(function (r) {
      if (rw.filtro !== 'todos' && r.categoria !== rw.filtro) return false;
      if (q) {
        var hay = String((r.nombre || '') + ' ' + (r.desarrolladora || '') + ' ' + (r.genero || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    if (!list.length) {
      rwEstado(q
        ? 'No hay juegos que coincidan con «' + q + '». Prueba con otro término.'
        : (rw.filtro !== 'todos'
          ? 'Todavía no hay recompensas en «' + rwCatLabel(rw.filtro) + '». Vuelve pronto: iremos añadiendo más.'
          : 'Aún no hay recompensas disponibles. Cuando haya colaboraciones confirmadas aparecerán aquí.'), 'empty');
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
      storeMeta();
    } catch (e) {
      rw.lista = []; renderRwFiltros();
      rwEstado('No se han podido cargar las recompensas ahora mismo. Inténtalo en unos minutos.', 'error');
      renderDestacados();
      storeMeta();
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
      '<li><span class="mi-v-ico">' + ic('grad') + '</span><div><b>Formación Cisco NetAcad</b><span>Cursos oficiales a través de PlacetaEDU, con tu PlacetaID.</span></div></li>' +
      '<li><span class="mi-v-ico">' + ic('tag') + '</span><div><b>Cursos con descuento</b><span>Cursos propios de La Placeta con precio reducido pagando en Placetas (Pz).</span></div></li>' +
      '<li><span class="mi-v-ico">' + ic('percent') + '</span><div><b>Cashback · Cuenta Joven</b><span>Convierte tu cuenta de Banco de La Placeta en Cuenta Joven: 12&nbsp;% de cashback (impuestos excluidos).</span></div></li>' +
      '<li><span class="mi-v-ico">' + ic('gamepad') + '</span><div><b>Keys de juegos indie</b><span>Claves de estudios colaboradores en Apoyo Indie.</span></div></li>' +
      '</ul></article>' +
      '<article class="mi-card mi-news"><div class="mi-card-ic"><span class="mi-v-ico mi-v-ico-lg">' + ic('news') + '</span>' +
      '<div><h3 class="mi-card-title">Noticias y anuncios</h3><p class="mi-card-sub">Lo último de Placeta Joven.</p></div></div>' +
      '<div id="mi-news-list" class="mi-news-list"></div></article>' +
      '<article class="mi-card mi-destac"><div class="mi-card-ic"><span class="mi-v-ico mi-v-ico-lg">' + ic('spark') + '</span>' +
      '<div><h3 class="mi-card-title">Destacados para ti</h3><p class="mi-card-sub">Juegos y cursos que puedes aprovechar ahora mismo.</p></div></div>' +
      '<div id="mi-destac-list" class="mi-destac-list"></div></article>' +
      '</div></div>';
  }
  function setTxt(id, val) { var n = $id(id); if (n) n.textContent = val; }

  /* ── Apoyo Indie · tienda ── */
  function storeMeta() {
    var total = rw.lista.filter(function (r) { return r.categoria === 'videojuegos'; }).length;
    var ok = 0, got = 0;
    rw.lista.forEach(function (r) {
      if (r.categoria !== 'videojuegos') return;
      if (rwConseguidas[r.id]) got++; else if (r.canjeable) ok++;
    });
    setTxt('mi-store-total', total);
    setTxt('mi-store-ok', ok);
    setTxt('mi-store-got', got);
  }
  function bindTienda() {
    var inp = $id('mi-rw-search');
    if (inp) inp.addEventListener('input', function () { tiendaBusqueda = inp.value; renderRwGrilla(); });
  }

  /* ── Academia Joven · formaciones ── */
  var FORMS = [
    { area: 'Redes', nombre: 'Fundamentos de redes', nivel: 'Inicial', horas: '~14 h', plazas: 120, color: 'red', desc: 'Conceptos básicos de redes, direccionamiento y conectividad.' },
    { area: 'Ciberseguridad', nombre: 'Ciberseguridad · introducción', nivel: 'Inicial', horas: '~12 h', plazas: 80, color: 'ciber', desc: 'Amenazas comunes, buenas prácticas y cómo protegerte.' },
    { area: 'Redes', nombre: 'Redes · nivel medio', nivel: 'Medio', horas: '~20 h', plazas: 60, color: 'red2', desc: 'Routing, switching y prácticas con equipos.' },
    { area: 'IoT', nombre: 'Internet de las Cosas', nivel: 'Medio', horas: '~18 h', plazas: 55, color: 'iot', desc: 'Sensores, dispositivos conectados y datos.' },
    { area: 'Fundamentos', nombre: 'Fundamentos de TI', nivel: 'Inicial', horas: '~15 h', plazas: 100, color: 'fund', desc: 'Hardware, sistemas y seguridad básica.' },
    { area: 'Programación', nombre: 'Programación · primeros pasos', nivel: 'Inicial', horas: '~16 h', plazas: 90, color: 'prog', desc: 'Lógica de programación y Python para empezar.' }
  ];
  var FORMS_FILTRO = 'todas';
  function formCard(f) {
    var c = el('article', 'mi-form-card');
    var cover = el('div', 'mi-form-cover mi-form-cover--' + f.color);
    var g = el('span', 'mi-form-cover-ic');
    g.appendChild(icoNode('grad'));
    cover.appendChild(g);
    cover.appendChild(el('span', 'mi-form-area', f.area));
    c.appendChild(cover);
    var b = el('div', 'mi-form-body');
    b.appendChild(el('h4', 'mi-form-nombre', f.nombre));
    b.appendChild(el('p', 'mi-form-prov', 'Cisco NetAcad · PlacetaEDU'));
    b.appendChild(el('p', 'mi-form-desc', f.desc));
    var meta = el('div', 'mi-form-meta');
    meta.appendChild(el('span', 'mi-rw-gen', f.nivel));
    var h = el('span', 'mi-form-meta-item', null);
    h.appendChild(icoNode('clock')); h.appendChild(document.createTextNode(' ' + f.horas));
    meta.appendChild(h);
    var u = el('span', 'mi-form-meta-item', null);
    u.appendChild(icoNode('users')); u.appendChild(document.createTextNode(' ' + f.plazas + ' plazas'));
    meta.appendChild(u);
    b.appendChild(meta);
    var foot = el('div', 'mi-form-foot');
    foot.appendChild(el('span', 'mi-form-pz', '+20 puntos'));
    var go = el('a', 'mi-btn outline sm mi-form-go', null);
    go.href = 'https://www.laplaceta.org/proyectos/placetaedu';
    go.target = '_blank';
    go.rel = 'noopener';
    go.textContent = 'Ver en PlacetaEDU';
    foot.appendChild(go);
    b.appendChild(foot);
    c.appendChild(b);
    return c;
  }
  function renderFormaciones() {
    var grid = $id('mi-forms-grid');
    if (!grid) return;
    var bar = $id('mi-forms-filtros');
    if (bar) {
      bar.innerHTML = '';
      var areas = ['todas'];
      FORMS.forEach(function (f) { if (areas.indexOf(f.area) < 0) areas.push(f.area); });
      areas.forEach(function (a) {
        var b = el('button', 'mi-rw-filtro' + (a === FORMS_FILTRO ? ' on' : ''), a === 'todas' ? 'Todas' : a);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(a === FORMS_FILTRO));
        b.addEventListener('click', function () { FORMS_FILTRO = a; renderFormaciones(); });
        bar.appendChild(b);
      });
    }
    grid.innerHTML = '';
    FORMS.filter(function (f) { return FORMS_FILTRO === 'todas' || f.area === FORMS_FILTRO; })
      .forEach(function (f) { grid.appendChild(formCard(f)); });
  }

  function htmlAcademia() {
    return '<div class="mi-view"><div class="mi-acad">' +
      '<article class="mi-card mi-acad-hero"><span class="mi-acad-ico">' + ic('grad') + '</span><div>' +
      '<p class="mi-kicker-inline">Academia Joven</p><h3 class="mi-card-title">Formaciones Cisco NetAcad</h3>' +
      '<p>Inscríbete en cursos de <b>Cisco Networking Academy</b> a través de <b>PlacetaEDU</b>, con tu PlacetaID. Al completarlos consigues Placetas (Pz) y puntos de acceso a plazas.</p>' +
      '</div></article>' +
      '<div class="mi-acad-plus"><span class="mi-acad-plus-num">+20</span>' +
      '<p><b>Placeta Joven</b> te suma <b>20 puntos de acceso</b> para conseguir tu <b>plaza</b> en cada formación de PlacetaEDU.</p></div>' +
      '<article class="mi-card mi-forms"><div class="mi-card-ic"><span class="mi-v-ico mi-v-ico-lg">' + ic('book') + '</span>' +
      '<div><h3 class="mi-card-title">Formaciones disponibles</h3>' +
      '<p class="mi-card-sub">Catálogo de ejemplo. La matrícula se gestiona desde Placeta Joven: elige la formación y sigue los pasos en PlacetaEDU.</p></div></div>' +
      '<div class="mi-rw-filtros" id="mi-forms-filtros" role="group" aria-label="Filtrar formaciones"></div>' +
      '<div class="mi-forms-grid" id="mi-forms-grid"></div></article>' +
      '<div class="mi-acad-cta">' +
      '<a class="mi-btn primary" href="https://www.laplaceta.org/proyectos/placetaedu" target="_blank" rel="noopener">Ir a mis formaciones</a>' +
      '<p class="fine">Próximamente podrás matricularte y seguir tu progreso directamente aquí.</p>' +
      '</div></div></div>';
  }
  function htmlApoyo() {
    return '<div class="mi-view">' +
      '<section class="store-mast">' +
      '  <div class="store-mast-in">' +
      '    <div class="store-mast-copy">' +
      '      <span class="store-badge">Apoyo Indie · La Placeta</span>' +
      '      <h2>Juegos indie que pagas con Placetas</h2>' +
      '      <p>Estudios independientes publican aquí sus juegos digitales. Los consigues con tus Placetas (Pz) y, si hay stock, recibes la key al instante: <b>1 copia por usuario y título</b>.</p>' +
      '      <div class="store-stats">' +
      '        <div class="store-stat"><b id="mi-store-total">0</b><span>Títulos</span></div>' +
      '        <div class="store-stat"><b id="mi-store-ok">0</b><span>Disponibles</span></div>' +
      '        <div class="store-stat"><b id="mi-store-got">0</b><span>En tu colección</span></div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="store-mast-art">' + ic('gamepad') + '</div>' +
      '  </div>' +
      '</section>' +
      '<div class="mi-dash">' +
      '<article class="mi-card mi-rw" id="mi-recompensas">' +
      '<div class="mi-rw-head"><div><h3 class="mi-card-title">Catálogo de juegos</h3>' +
      '<p class="mi-card-sub">Busca por nombre, estudio o género, y filtra por categoría.</p></div></div>' +
      '<div class="mi-store-tools">' +
      '  <div class="mi-rw-filtros" id="mi-rw-filtros" role="group" aria-label="Filtrar por categoría"></div>' +
      '  <label class="mi-search"><span class="mi-search-ic">' + ic('search') + '</span>' +
      '    <input id="mi-rw-search" type="search" placeholder="Buscar juego…" autocomplete="off" /></label>' +
      '</div>' +
      '<p class="mi-rw-estado" id="mi-rw-estado" hidden></p>' +
      '<div class="mi-rw-grid" id="mi-rw-grid" hidden></div>' +
      '<div class="mi-rw-detalle" id="mi-rw-detalle" hidden></div></article>' +
      '<article class="mi-card mi-keys"><h3 class="mi-card-title">Tus keys y juegos</h3>' +
      '<p class="mi-card-sub">Los juegos que has conseguido. Cópialas y actívalas en la plataforma del juego.</p>' +
      '<div id="mi-keys-list"></div></article>' +
      '</div></div>';
  }

  function pintarEspacio(st) {
    document.body.classList.add('mi-is-active');
    var contenido = PAGE === 'academia' ? htmlAcademia() : (PAGE === 'apoyo' ? htmlApoyo() : htmlInicio());
    setHTML(APP, cabeceraHtml(st) + contenido);
    document.title = 'Placeta Joven · ' + (PAGE === 'academia' ? 'Academia Joven' : PAGE === 'apoyo' ? 'Apoyo Indie' : 'Mi espacio');
    if (PAGE === 'academia') renderFormaciones();
    if (PAGE === 'inicio' || PAGE === 'apoyo') renderKeys(st.keys || []);
    if (PAGE === 'inicio') { renderSuscripcion(st); renderNews(); }
    if (PAGE === 'apoyo') { bindTienda(); cargarRecompensas(st.keys || []); }
    if (PAGE === 'inicio') { cargarRecompensas(st.keys || []); renderDestacados(); }
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
      if (st.requiereAlta || !st.estado) { pintarSin(st); maybeAutoVerificar(); return; }
      pintarInactivo(st); maybeAutoVerificar();
    } catch (e) {
      pintarError(e);
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
