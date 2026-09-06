/* Placeta Joven — joven.laplaceta.org · interacciones de la página */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Barra superior: sombra al hacer scroll ─────────────── */
  const topbar = document.getElementById('top');
  const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Sesión PlacetaID: aviso persistente (cookie 7 días) ── */
  (function sessionUI() {
    var A = window.PlacetaJovenAuth;
    if (!A) return;
    var s = A.getSession();
    if (!s || !s.token) return;

    var bar = document.createElement('div');
    bar.className = 'pjv-ses';

    var name = String(s.nombre || (s.user && (s.user.nombreCompleto || s.user.nombre)) || '').trim();
    var txt = document.createElement('span');
    txt.className = 'pjv-ses-t';
    txt.textContent = 'Conectado con PlacetaID' + (name ? ' · ' + name : '');

    var out = document.createElement('button');
    out.type = 'button';
    out.className = 'pjv-ses-out';
    out.textContent = 'Cerrar sesión';
    out.addEventListener('click', function () {
      A.clearSession();
      bar.remove();
    });

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'pjv-ses-x';
    close.setAttribute('aria-label', 'Ocultar aviso');
    close.textContent = '✕';
    close.addEventListener('click', function () { bar.remove(); });

    bar.appendChild(txt);
    bar.appendChild(out);
    bar.appendChild(close);
    document.body.appendChild(bar);
  })();

  /* ── Menú móvil ─────────────────────────────────────────── */
  const navBtn = document.getElementById('pjv-nav-btn');
  const nav = document.getElementById('pjv-nav');
  const navClose = document.getElementById('pjv-nav-close');
  const backdrop = document.getElementById('pjv-backdrop');
  if (navBtn && nav) {
    const isOpen = () => nav.classList.contains('is-open');
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      if (backdrop) backdrop.classList.toggle('is-open', open);
      navBtn.setAttribute('aria-expanded', String(open));
      navBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      document.body.classList.toggle('pjv-lock', open);
    };
    navBtn.addEventListener('click', () => setOpen(!isOpen()));
    if (navClose) navClose.addEventListener('click', () => setOpen(false));
    if (backdrop) backdrop.addEventListener('click', () => setOpen(false));

    // Cerrar al navegar a una sección
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) setOpen(false);
    });
  }

  /* ── Animaciones de entrada (solo si no hay preferencia reducida) ── */
  const revealTargets = Array.from(document.querySelectorAll(
    '.pjv-card, .pjv-plan, .pjv-step, .pjv-faq-item, .pjv-sec-head, .pjv-colab'
  ));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    // Sin animación: todo visible
    return;
  }

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const i = Array.from(el.parentElement ? el.parentElement.children : []).indexOf(el);
      el.style.transitionDelay = (Math.min(i % 4, 3) * 70) + 'ms';
      el.classList.add('is-in');
      obs.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

  revealTargets.forEach((el) => {
    // No ocultar elementos que ya están en pantalla al cargar (p. ej. cards muy arriba)
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.85) {
      el.classList.add('is-in');
      return;
    }
    el.classList.add('pjv-reveal');
    io.observe(el);
  });
})();
