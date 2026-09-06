/* Placeta Joven — configuración del cliente PlacetaID (solicitante en plid26) */
(function () {
  'use strict';

  // Solicitante registrado en plid26 (ver plid26: BUILTIN_SOLICITANTES)
  var BASE = 'https://id.laplaceta.org';
  var CLIENT_ID = 'placetajoven-web'; // apiKey / client_id del solicitante

  function callbackUrl() {
    return window.location.origin + '/auth/callback.html';
  }

  function buildLoginUrl(state) {
    var url = new URL(BASE + '/');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', callbackUrl());
    url.searchParams.set('platform', 'web');
    url.searchParams.set('state', state || ('pjv-' + Date.now().toString(36)));
    return url.toString();
  }

  function storeSession(token, user) {
    try {
      if (token) sessionStorage.setItem('pjv_token', token);
      if (user) {
        sessionStorage.setItem('pjv_user', JSON.stringify(user));
        if (user.dip) sessionStorage.setItem('pjv_dip', String(user.dip).trim().toUpperCase());
        if (user.nombreCompleto || user.nombre) sessionStorage.setItem('pjv_nombre', user.nombreCompleto || user.nombre);
      }
      return true;
    } catch (e) { return false; }
  }

  function getSession() {
    try {
      var token = sessionStorage.getItem('pjv_token');
      var raw = sessionStorage.getItem('pjv_user');
      return { token: token, user: raw ? JSON.parse(raw) : null };
    } catch (e) { return { token: null, user: null }; }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem('pjv_token');
      sessionStorage.removeItem('pjv_user');
      sessionStorage.removeItem('pjv_dip');
      sessionStorage.removeItem('pjv_nombre');
    } catch (e) { /* ignore */ }
  }

  window.PlacetaJovenAuth = {
    BASE: BASE,
    CLIENT_ID: CLIENT_ID,
    buildLoginUrl: buildLoginUrl,
    storeSession: storeSession,
    getSession: getSession,
    clearSession: clearSession
  };

  // Convierte todos los enlaces "Acceder/Quiero Placeta Joven" en el login real
  // de la pasarela con client_id + redirect_uri (solo en http/https).
  function bindLoginLinks() {
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
    var links = document.querySelectorAll('a[href^="https://id.laplaceta.org"]');
    var url = buildLoginUrl();
    for (var i = 0; i < links.length; i++) links[i].setAttribute('href', url);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLoginLinks);
  } else {
    bindLoginLinks();
  }
})();
