(function () {
  'use strict';

  var auth = window.PlacetaJovenAuth;
  var nav = document.getElementById('main-nav');
  var toggle = document.querySelector('.menu-toggle');
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function session() {
    try { return auth && auth.getSession ? auth.getSession() : null; }
    catch (error) { return null; }
  }

  function loginUrl() {
    if (isLocal) return 'test-login.html';
    try { return auth ? auth.buildLoginUrl() : 'https://id.laplaceta.org/'; }
    catch (error) { return 'https://id.laplaceta.org/'; }
  }

  document.querySelectorAll('[data-login]').forEach(function (link) {
    link.href = loginUrl();
  });

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar navegación' : 'Abrir navegación');
      nav.classList.toggle('is-open', open);
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir navegación');
      }
    });
  }

  function renderPlans(plans) {
    var target = document.getElementById('plans');
    if (!target || !Array.isArray(plans) || !plans.length) return;
    var monthly = plans.find(function (plan) { return plan.id === 'mensual'; });
    var annual = plans.find(function (plan) { return plan.id === 'anual'; });
    var saving = monthly && annual ? Math.max(0, monthly.precio * 12 - annual.precio) : 0;
    target.innerHTML = plans.map(function (plan) {
      var annual = plan.id === 'anual';
      var detail = annual && saving
        ? 'Ahorra ' + saving.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) + ' al año frente a 12 mensualidades.'
        : (plan.ahorroLabel || (annual ? 'Tarifa anual del programa' : 'Pago mes a mes'));
      return '<article class="plan' + (annual ? ' plan-featured' : '') + '">'
        + '<p class="plan-label">' + escapeHtml(plan.etiqueta || (annual ? 'Plan anual' : 'Plan mensual'))
        + (annual ? ' <span class="best-value">MEJOR PRECIO</span>' : '') + '</p>'
        + '<p class="plan-price">' + escapeHtml(plan.precioLabel || 'Consultar') + '</p>'
        + '<span>' + escapeHtml(detail) + '</span>'
        + '<a class="button ' + (annual ? 'button-bright' : 'button-outline') + '" href="' + loginUrl() + '">Elegir plan <span aria-hidden="true">↗</span></a>'
        + '</article>';
    }).join('');
  }

  fetch('/api/planes').then(function (response) {
    if (!response.ok) throw new Error('planes_no_disponibles');
    return response.json();
  }).then(function (data) {
    renderPlans(data.planes);
  }).catch(function () {
    var target = document.getElementById('plans');
    if (target) target.innerHTML = '<p class="plan-error">No hemos podido cargar las tarifas. Vuelve a intentarlo más tarde.</p>';
  });

  function renderGames(games) {
    var target = document.getElementById('featured-games');
    if (!target) return;
    if (!Array.isArray(games) || !games.length) {
      target.innerHTML = '<p class="showcase-state">Todavía no hay juegos disponibles para destacar. Publicaremos aquí nuevas colaboraciones y promociones gratuitas cuando estén confirmadas.</p>';
      return;
    }
    target.innerHTML = games.map(function (game) {
      var free = game.gratis === true;
      var image = '';
      try {
        var imageUrl = new URL(game.imagen, window.location.href);
        if (imageUrl.protocol === 'https:' || imageUrl.protocol === 'http:') {
          image = '<img src="' + escapeHtml(imageUrl.href) + '" alt="" loading="lazy">';
        }
      } catch (error) { image = ''; }
      var action = free && game.url
        ? '<a class="game-action" href="' + escapeHtml(game.url) + '" target="_blank" rel="noopener">Visitar juego <span aria-hidden="true">↗</span></a>'
        : '<a class="game-action" href="mi.html">Ver condiciones <span aria-hidden="true">→</span></a>';
      return '<article class="game-card">'
        + '<div class="game-art' + (image ? ' has-image' : '') + '">' + image + (image ? '' : '<span aria-hidden="true">✳</span>') + '</div>'
        + '<div class="game-card-body"><p class="game-kind">' + (free ? 'GRATUITO · SELECCIÓN PJ' : 'COLABORACIÓN · STOCK DISPONIBLE') + '</p>'
        + '<h3>' + escapeHtml(game.nombre || 'Juego') + '</h3>'
        + '<p class="game-developer">' + escapeHtml(game.desarrolladora || 'Estudio independiente') + '</p>'
        + '<p class="game-description">' + escapeHtml(game.descripcion || '') + '</p>'
        + '<div class="game-card-foot">' + (free ? '<span>Gratis</span>' : '<span>' + Number(game.pz || 0).toLocaleString('es-ES') + ' Pz</span>') + action + '</div></div>'
        + '</article>';
    }).join('');
  }

  var showcase = document.getElementById('featured-games');
  if (showcase) {
    fetch('/api/escaparate').then(function (response) {
      if (!response.ok) throw new Error('escaparate_no_disponible');
      return response.json();
    }).then(function (data) {
      renderGames(data.juegos);
    }).catch(function () {
      renderGames([]);
    });
  }

  var current = session();
  if (current && current.token) {
    var accountLink = document.querySelector('.header-actions .text-link');
    var accountStatus = document.createElement('span');
    accountStatus.className = 'account-status';
    accountStatus.setAttribute('role', 'status');
    accountStatus.textContent = 'Comprobando tu cuenta…';
    var actions = document.querySelector('.header-actions');
    if (actions) actions.insertBefore(accountStatus, actions.firstChild);
    fetch('/api/status', { headers: { Authorization: 'Bearer ' + current.token } }).then(function (response) {
      if (!response.ok) throw new Error('sesion_no_verificada');
      return response.json();
    }).then(function (status) {
      accountStatus.textContent = status.estado === 'ACTIVO'
        ? 'Placeta Joven activa'
        : (status.requiereAlta ? 'Completa tu alta en Mi espacio' : 'Revisa tu estado en Mi espacio');
      if (accountLink) accountLink.textContent = 'Mi espacio';
    }).catch(function () {
      accountStatus.textContent = 'Sesión detectada';
    });
  }
})();