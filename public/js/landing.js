/* Placeta Joven — joven.laplaceta.org · interacciones de la web pública
   ---------------------------------------------------------------------------
   · Sombra de la cabecera al hacer scroll
   · Menú lateral (drawer) en móvil, con foco y cierre accesibles
   · Animaciones de entrada suaves (respetando prefers-reduced-motion)
   · Aviso de sesión activa de PlacetaID
   No depende de ninguna librería externa. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Tema claro / oscuro ─────────────────────────────────
     El atributo data-tema ya lo fija un script en el <head> (antes de pintar).
     Aquí solo sincronizamos el icono del botón y atendemos el cambio. */
  function pintarIconoTema() {
    var t = document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
    Array.prototype.forEach.call(document.querySelectorAll('[data-tema-ico]'), function (u) {
      u.setAttribute('href', t === 'oscuro' ? '#i-sol' : '#i-luna');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-action="tema"]'), function (b) {
      b.setAttribute('aria-pressed', String(t === 'oscuro'));
      b.setAttribute('title', t === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    });
  }
  function alternarTema() {
    var nuevo = document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'claro' : 'oscuro';
    document.documentElement.setAttribute('data-tema', nuevo);
    try { localStorage.setItem('pjv_tema', nuevo); } catch (e) { /* ignore */ }
    pintarIconoTema();
  }
  pintarIconoTema();
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-action="tema"]')) alternarTema();
  });

  /* ── Cabecera ─────────────────────────────────────────── */
  var hdr = document.getElementById('top');
  if (hdr) {
    var onScroll = function () { hdr.classList.toggle('is-scrolled', window.scrollY > 12); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── Menú lateral ─────────────────────────────────────── */
  var burger = document.getElementById('burger');
  var drawer = document.getElementById('drawer');
  var backdrop = document.getElementById('drawerBackdrop');
  var closeBtn = document.getElementById('drawerClose');

  function setDrawer(open) {
    if (!drawer) return;
    drawer.classList.toggle('is-open', open);
    if (backdrop) backdrop.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    if (burger) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    }
    if (open && closeBtn) closeBtn.focus();
    else if (!open && burger && document.activeElement === closeBtn) burger.focus();
  }

  if (burger && drawer) {
    burger.addEventListener('click', function () {
      setDrawer(!drawer.classList.contains('is-open'));
    });
    if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
    if (backdrop) backdrop.addEventListener('click', function () { setDrawer(false); });
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) setDrawer(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) setDrawer(false);
    });
  }

  /* ── Animaciones de entrada ───────────────────────────── */
  var targets = Array.prototype.slice.call(document.querySelectorAll(
    '.card, .tile, .route, .step, .flow-node, .sec-item, .sec-head, .colab, .faq details'
  ));
  targets.forEach(function (n) { n.classList.add('reveal'); });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(function (n) { n.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var node = entry.target;
        var parent = node.parentElement;
        var idx = parent ? Array.prototype.indexOf.call(parent.children, node) : 0;
        node.style.animationDelay = (Math.min(idx % 5, 4) * 60) + 'ms';
        node.classList.add('in');
        obs.unobserve(node);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (n) { io.observe(n); });
  }

  /* ── Aviso de sesión PlacetaID (cookie de 7 días) ─────── */
  (function sessionBar() {
    var A = window.PlacetaJovenAuth;
    if (!A) return;
    var s;
    try { s = A.getSession(); } catch (e) { return; }
    if (!s || !s.token) return;

    var name = String(s.nombre || (s.user && (s.user.nombreCompleto || s.user.nombre)) || '').trim();

    var bar = document.createElement('div');
    bar.className = 'ses';
    bar.setAttribute('role', 'status');

    var txt = document.createElement('span');
    txt.className = 'ses-t';
    txt.textContent = 'Conectado con PlacetaID' + (name ? ' · ' + name : '');

    var mi = document.createElement('a');
    mi.className = 'ses-mi';
    mi.href = 'mi.html';
    mi.textContent = 'Mi espacio';

    var out = document.createElement('button');
    out.type = 'button';
    out.className = 'ses-out';
    out.textContent = 'Cerrar sesión';
    out.addEventListener('click', function () {
      try { A.clearSession(); } catch (e) { /* ignore */ }
      bar.remove();
    });

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ses-x';
    close.setAttribute('aria-label', 'Ocultar aviso');
    close.textContent = '✕';
    close.addEventListener('click', function () { bar.remove(); });

    bar.appendChild(txt);
    bar.appendChild(mi);
    bar.appendChild(out);
    bar.appendChild(close);
    document.body.appendChild(bar);
  })();
})();
