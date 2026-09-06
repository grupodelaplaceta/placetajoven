/* Placeta Joven — cliente PlacetaID (solicitante en plid26) con sesión por cookies */
(function () {
  'use strict';

  var BASE = 'https://id.laplaceta.org';
  var CLIENT_ID = 'placetajoven-web'; // client_id / apiKey del solicitante
  var COOKIE_DAYS = 7;                // sesión de una semana
  var COOKIE_KEYS = ['pjv_token', 'pjv_dip', 'pjv_nombre'];

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

  /* ── Cookies (7 días) ─────────────────────────────────── */
  function setCookie(name, value, days) {
    try {
      var enc = encodeURIComponent(value || '');
      var secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = name + '=' + enc + '; Path=/; Max-Age=' + (days * 86400) + '; SameSite=Lax' + secure;
    } catch (e) { /* ignore */ }
  }

  function getCookie(name) {
    try {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : '';
    } catch (e) { return ''; }
  }

  function eraseCookie(name) {
    document.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax';
  }

  /* Guarda la sesión: token/dip/nombre en cookie 7 días + user completo en
     sessionStorage (los datos que no caben en una cookie no se pierden). */
  function storeSession(token, user) {
    var ok = false;
    try {
      if (token) {
        setCookie('pjv_token', token, COOKIE_DAYS);
        if (user) {
          if (user.dip) setCookie('pjv_dip', String(user.dip).trim().toUpperCase(), COOKIE_DAYS);
          if (user.nombreCompleto || user.nombre) setCookie('pjv_nombre', user.nombreCompleto || user.nombre, COOKIE_DAYS);
        }
        sessionStorage.setItem('pjv_token', token);
      }
      if (user) sessionStorage.setItem('pjv_user', JSON.stringify(user));
      ok = !!getCookie('pjv_token');
    } catch (e) { ok = false; }
    return ok;
  }

  function getSession() {
    var token = getCookie('pjv_token') || sessionStorage.getItem('pjv_token') || '';
    var dip = getCookie('pjv_dip') || '';
    var nombre = getCookie('pjv_nombre') || '';
    var user = null;
    try {
      var raw = sessionStorage.getItem('pjv_user');
      if (raw) user = JSON.parse(raw);
    } catch (e) { user = null; }
    if (!user && (dip || nombre)) user = { dip: dip, nombreCompleto: nombre, nombre: nombre };
    return { token: token, dip: dip, nombre: nombre, user: user };
  }

  function clearSession() {
    COOKIE_KEYS.forEach(eraseCookie);
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
    COOKIE_DAYS: COOKIE_DAYS,
    buildLoginUrl: buildLoginUrl,
    storeSession: storeSession,
    getSession: getSession,
    clearSession: clearSession
  };

  // Convierte los enlaces "Acceder/Quiero Placeta Joven" en el login real de la
  // pasarela con client_id + redirect_uri (solo en http/https).
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
