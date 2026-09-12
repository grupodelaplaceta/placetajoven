/* ═══════════════════════════════════════════════════════════════════════
   PLACETA JOVEN — Área privada · motor de la aplicación
   ---------------------------------------------------------------------------
   Cada página de /espacio declara su vista con <body data-page="…"> y este
   script se encarga de todo:

     1. Comprobar la sesión de PlacetaID y el estado del programa (16–30 años).
     2. Mostrar la puerta correcta si aún no hay suscripción activa
        (identifícate · elige plan · pago en proceso · bloqueado por edad · error).
     3. Pintar el shell (barra lateral + cabecera) y el contenido de la página.
     4. Gestionar acciones: alta, renovar, cancelar, verificar pago y canje de keys.

   Contrato con la API (ver /api):
     GET  /api/status      → estado del usuario + keys
     POST /api/alta        → checkout de pago { plan }
     POST /api/renovar     → checkout de renovación
     POST /api/cancelar    → cancelar suscripción
     POST /api/verificar   → reconciliar un pago ya realizado
     GET  /api/recompensas → catálogo de recompensas
     POST /api/recompensas → canjear una recompensa { recompensaId }
     POST /api/keys        → marcar una key como canjeada { keyId, accion }
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Contexto ─────────────────────────────────────────────────────── */
  var AUTH = window.PlacetaJovenAuth;
  var PAGE = String(document.body.getAttribute('data-page') || 'inicio').trim();
  var ROOT = document.getElementById('root');
  var BOOT = document.getElementById('boot');

  var App = {
    st: null,            // respuesta de /api/status
    planes: [],          // tarifas públicas
    recompensas: [],     // catálogo
    caminos: [],         // caminos formativos
    caminosEstado: { caminos: {}, convalidaciones: [], recompensasPendientes: [] },
    protecciones: [],
    becas: [],
    demo: false,         // el catálogo viene de ejemplo (sin Supabase)
    filtro: 'todos',
    busqueda: '',
    vista: null          // recompensa abierta en ficha
  };

  /* ── Iconos ───────────────────────────────────────────────────────── */
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
    grad: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-3.5"/><path d="M22 10v6"/>',
    brief: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M2 13h20"/>',
    pad: '<path d="M6 11h4M8 9v4"/><path d="M15.5 12h.01M17.5 10.5h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4a2 2 0 0 1 1.4-.6h4.3a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.4A4 4 0 0 0 17.32 5Z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M15.2 9.4c-.7-.9-1.9-1.4-3.1-1.4-1.5 0-2.8.9-2.8 2.3s1.3 2.2 2.8 2.6c1.5.5 3 1 3 2.5s-1.3 2.5-3 2.5c-1.3 0-2.5-.6-3.2-1.6"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19h6a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7h5.5"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9"/><path d="m17 4 3 3"/><path d="m14 7 3 3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    id: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 17c.6-1.6 2-2.4 3.5-2.4S12 15.4 12.5 17"/><path d="M15 9h4M15 13h4"/>',
    spark: '<path d="M12 3l2.2 4.8 5.3.8-3.9 3.8.9 5.2-4.5-2.4-4.5 2.4.9-5.2L4.5 8.6l5.3-.8L12 3Z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 11h18"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    ticket: '<path d="M3 10V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 1 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 1 0 0-4Z"/><path d="M15 5v2M15 11v2M15 17v2"/>',
    heart: '<path d="M20.8 6.6a5 5 0 0 0-7.1 0L12 8.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 22l8.8-8.3a5 5 0 0 0 0-7.1Z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
    file: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 14h6M9 18h4"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    gift: '<rect x="3" y="8" width="18" height="4"/><path d="M5 12v8h14v-8"/><path d="M12 8v12"/><path d="M12 8c-2.2 0-4.6-1.6-4.6-3.4C7.4 2.7 9 2 9.8 3 11 4.4 12 8 12 8Z"/><path d="M12 8c2.2 0 4.6-1.6 4.6-3.4C16.6 2.7 15 2 14.2 3 13 4.4 12 8 12 8Z"/>',
    star: '<path d="M12 3l2.8 5.9 6.2.9-4.5 4.4 1.1 6.3L12 17.6 6.4 20.5l1.1-6.3L3 9.8l6.2-.9L12 3Z"/>',
    cake: '<path d="M4 21h16"/><path d="M5 21V10a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v11"/><path d="M9 9V6.5M12 9V5M15 9V6.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    down: '<path d="M12 3v14"/><path d="m6 12 6 6 6-6"/><path d="M4 21h16"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 17h12v4H6z"/>',
    luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    sol: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>'
  };
  function ico(name, cls) {
    return '<svg class="' + (cls || 'ico') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + (ICONS[name] || '') + '</svg>';
  }

  /* ── Utilidades ───────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) { return Number(n || 0).toLocaleString('es-ES'); }
  function eur(n) { return Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }
  function fecha(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return String(iso); }
  }
  function nombreUsuario() {
    var s = null;
    try { s = AUTH ? AUTH.getSession() : null; } catch (e) { s = null; }
    return String((s && s.user && (s.user.nombreCompleto || s.user.nombre)) || (s && s.nombre) || '').trim();
  }
  function iniciales(nombre) {
    var partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return 'PJ';
    return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
  }

  /* ── API ──────────────────────────────────────────────────────────── */
  function api(path, opts) {
    opts = opts || {};
    var ses = null;
    try { ses = AUTH ? AUTH.getSession() : null; } catch (e) { ses = null; }
    opts.headers = Object.assign({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ((ses && ses.token) || '')
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

  function mensajeError(e) {
    var c = (e && (e.code || e.status)) || '';
    if (c === 'SESION_INVALIDA' || c === 'token_requerido' || c === '401')
      return 'Tu sesión de PlacetaID ha caducado. Vuelve a identificarte para continuar.';
    if (c === 'gateway_no_disponible')
      return 'La pasarela PlacetaID no responde ahora mismo. Inténtalo en unos minutos.';
    if (c === 'NO_CONFIG')
      return 'El pago todavía no está configurado en el servidor. Escríbenos a joven@laplaceta.org.';
    if (c === 'LS_ERROR' || c === 'ls_502')
      return 'La pasarela de pago ha rechazado la operación. Reinténtalo en unos minutos.';
    if (c === 'sin_suscripcion')
      return 'Todavía no vemos tu pago. A veces tarda unos minutos: espera un momento y vuelve a verificar (no se te cobra dos veces).';
    return 'No hemos podido conectar con la API de Placeta Joven. Reinténtalo en un momento.';
  }

  /* ── Navegación ───────────────────────────────────────────────────── */
  var NAV = [
    { id: 'inicio', label: 'Inicio', icon: 'home', href: 'inicio.html', grupo: 'Tu espacio' },
    { id: 'formacion', label: 'Formación', icon: 'grad', href: 'formacion.html' },
    { id: 'empleo', label: 'Empleo y futuro', icon: 'brief', href: 'empleo.html', soon: true },
    { id: 'beneficios', label: 'Beneficios', icon: 'pad', href: 'beneficios.html' },
    { id: 'protecciones', label: 'Protecciones', icon: 'shield', href: 'protecciones.html' },
    { id: 'becas', label: 'Becas', icon: 'gift', href: 'becas.html' },
    { id: 'miplaceta', label: 'Mi Placeta', icon: 'coin', href: 'miplaceta.html' },
    { id: 'rutas', label: 'Rutas', icon: 'route', href: 'rutas.html', soon: true, grupo: 'Crece' },
    { id: 'comunidad', label: 'Comunidad', icon: 'users', href: 'comunidad.html', soon: true }
  ];
  var TITULOS = {
    inicio: 'Inicio', formacion: 'Formación', empleo: 'Empleo y futuro',
    beneficios: 'Beneficios', protecciones: 'Protecciones', becas: 'Becas', miplaceta: 'Mi Placeta', rutas: 'Rutas', comunidad: 'Comunidad'
  };

  /* ── Datos de contenido (catálogos propios de la interfaz) ────────── */

  // Formaciones de Cisco Networking Academy vía PlacetaEDU.
  var FORMACIONES = [
    { id: 'ciber-intro', area: 'Ciberseguridad', nombre: 'Introducción a la ciberseguridad',
      nivel: 'Inicial', horas: '~12 h', icon: 'shield',
      desc: 'Amenazas más comunes, buenas prácticas y cómo proteger tus dispositivos y cuentas.',
      matricula: 300, gestion: 50, recompensa: 75, bonus: 20, beca: 50 },
    { id: 'redes-basico', area: 'Redes', nombre: 'Fundamentos de redes',
      nivel: 'Inicial', horas: '~14 h', icon: 'route',
      desc: 'Conceptos básicos de redes, direccionamiento y conectividad.',
      matricula: 300, gestion: 50, recompensa: 75, bonus: 20, beca: 50 },
    { id: 'redes-medio', area: 'Redes', nombre: 'Redes · nivel medio',
      nivel: 'Medio', horas: '~20 h', icon: 'chart',
      desc: 'Routing, switching y prácticas con equipos.',
      matricula: 450, gestion: 60, recompensa: 110, bonus: 25, beca: 40 },
    { id: 'iot', area: 'IoT', nombre: 'Internet de las Cosas',
      nivel: 'Medio', horas: '~18 h', icon: 'spark',
      desc: 'Sensores, dispositivos conectados y tratamiento de datos.',
      matricula: 420, gestion: 60, recompensa: 100, bonus: 25, beca: 40 },
    { id: 'ti-fund', area: 'Fundamentos', nombre: 'Fundamentos de TI',
      nivel: 'Inicial', horas: '~15 h', icon: 'book',
      desc: 'Hardware, sistemas operativos y seguridad básica.',
      matricula: 280, gestion: 45, recompensa: 70, bonus: 20, beca: 50 },
    { id: 'prog', area: 'Programación', nombre: 'Programación · primeros pasos',
      nivel: 'Inicial', horas: '~16 h', icon: 'file',
      desc: 'Lógica de programación y Python para empezar desde cero.',
      matricula: 320, gestion: 50, recompensa: 80, bonus: 20, beca: 50 }
  ];

  // Objetivos que organizan el contenido del programa.
  var RUTAS = [
    { id: 'proyecto', ico: '🚀', nombre: 'Empezar mi primer proyecto', desc: 'De la idea al primer resultado', pasos: ['Elegir el problema', 'Definir el alcance', 'Primer prototipo', 'Presentarlo a la comunidad'] },
    { id: 'tecnologia', ico: '💻', nombre: 'Aprender tecnología', desc: 'Fundamentos y bases sólidas', pasos: ['Fundamentos de TI', 'Fundamentos de redes', 'Programación inicial', 'Proyecto propio'] },
    { id: 'digital', ico: '🌐', nombre: 'Entrar en el mundo digital', desc: 'Competencias digitales básicas', pasos: ['Herramientas esenciales', 'Comunicación digital', 'Seguridad básica', 'Trámites en línea'] },
    { id: 'cv', ico: '📄', nombre: 'Preparar mi primer CV', desc: 'Empleo y búsqueda de trabajo', pasos: ['Inventario de lo que sabes', 'Redactar el CV', 'Perfil profesional', 'Preparar la entrevista'] },
    { id: 'formacion', ico: '🎓', nombre: 'Mejorar mi formación', desc: 'Itinerarios y certificaciones', pasos: ['Diagnóstico inicial', 'Elegir itinerario', 'Certificarte', 'Seguir avanzando'] },
    { id: 'gamedev', ico: '🎮', nombre: 'Crear videojuegos', desc: 'Diseño y desarrollo', pasos: ['Fundamentos de programación', 'Motor de juego', 'Diseño de niveles', 'Publicar el juego'] },
    { id: 'ia', ico: '🤖', nombre: 'Aprender IA', desc: 'Fundamentos y aplicaciones', pasos: ['Datos y lógica', 'Modelos básicos', 'Herramientas de IA', 'Proyecto aplicado'] },
    { id: 'ciber', ico: '🔐', nombre: 'Aprender ciberseguridad', desc: 'Protección y buenas prácticas', pasos: ['Introducción a la ciberseguridad', 'Redes', 'Análisis de amenazas', 'Retos prácticos'] },
    { id: 'gestion', ico: '📊', nombre: 'Gestión y emprendimiento', desc: 'Proyectos y organización', pasos: ['Organizar una idea', 'Presupuesto básico', 'Trabajo en equipo', 'Puesta en marcha'] }
  ];

  // Próximas iniciativas del programa (nada de esto está activo todavía).
  var COMUNIDAD = [
    { icon: 'cal', titulo: 'Actividades y eventos', texto: 'Agenda de actividades de La Placeta, con inscripción desde tu espacio.', estado: 'En preparación' },
    { icon: 'spark', titulo: 'Proyectos', texto: 'Iniciativas abiertas en las que puedes participar o proponer las tuyas.', estado: 'En preparación' },
    { icon: 'users', titulo: 'Encuestas y participación', texto: 'Tu opinión decide qué se construye después en el programa.', estado: 'En preparación' },
    { icon: 'book', titulo: 'Noticias', texto: 'Novedades del programa, colaboraciones nuevas y convocatorias.', estado: 'En preparación' }
  ];

  /* ── Shell (barra lateral + cabecera) ─────────────────────────────── */
  function sideHtml() {
    var nombre = nombreUsuario();
    var items = '';
    NAV.forEach(function (n) {
      if (n.grupo) items += '<p class="side-group">' + esc(n.grupo) + '</p>';
      items += '<a class="side-item' + (n.id === PAGE ? ' is-on' : '') + '" href="' + n.href + '"'
        + (n.id === PAGE ? ' aria-current="page"' : '') + '>' + ico(n.icon)
        + '<span>' + esc(n.label) + '</span>'
        + (n.soon ? '<span class="soon">En preparación</span>' : '') + '</a>';
    });
    return '<aside class="side" id="side" aria-label="Secciones">'
      + '<a class="side-brand" href="../index.html">'
      + '<img src="../img/jovenlogo.png" alt="" />'
      + '<span><b>Placeta Joven</b><span>Mi espacio</span></span></a>'
      + '<nav class="side-nav">' + items + '</nav>'
      + '<div class="side-foot">'
      + '<a href="../index.html">← Web pública</a>'
      + '<a href="mailto:joven@laplaceta.org">joven@laplaceta.org</a>'
      + '<span class="fine">' + esc(nombre || 'Sesión PlacetaID') + '</span>'
      + '</div></aside>'
      + '<div class="side-backdrop" id="sideBackdrop"></div>';
  }

  function topHtml() {
    var nombre = nombreUsuario();
    var saldo = saldoPz();
    var plan = (App.st && App.st.planInfo && App.st.planInfo.etiqueta) || 'Placeta Joven';
    return '<header class="app-top">'
      + '<div class="app-top-l">'
      + '<button class="icon-btn" id="sideToggle" type="button" aria-label="Abrir menú" aria-controls="side">' + ico('menu') + '</button>'
      + '<p class="crumb">Mi espacio · <b>' + esc(TITULOS[PAGE] || 'Inicio') + '</b></p>'
      + '</div>'
      + '<div class="app-top-r">'
      + '<span class="pz-pill" title="' + (saldo === null ? 'Tu Cuenta Joven de Banco de La Placeta es la que guarda el saldo en Placetas' : 'Saldo de tu Cuenta Joven · Banco de La Placeta') + '">'
      + ico('coin') + (saldo === null ? '— Pz' : num(saldo) + ' Pz') + '<small>PZ</small></span>'
      + '<span class="user" title="' + esc(plan) + '">'
      + '<span class="user-ava">' + esc(iniciales(nombre)) + '</span>'
      + '<span class="user-txt"><b>' + esc((nombre || 'Joven').split(/\s+/)[0]) + '</b><span>' + esc(plan) + '</span></span>'
      + '</span>'
      + '<button class="icon-btn danger" type="button" data-action="logout" aria-label="Cerrar sesión PlacetaID">' + ico('out') + '</button>'
      + '</div></header>';
  }

  /* Saldo de Placetas. Vive en la Cuenta Joven del titular en Banco de La
     Placeta. La API todavía no lo expone: si llega en /api/status (st.saldo),
     se muestra automáticamente. Nunca inventamos cifras. */
  function saldoPz() {
    if (!App.st) return null;
    var v = App.st.saldo != null ? App.st.saldo : (App.st.pz != null ? App.st.pz : null);
    return v == null ? null : Number(v);
  }
  function movimientos() {
    if (!App.st) return null;
    if (Array.isArray(App.st.movimientos)) return App.st.movimientos;
    return null;
  }

  function shellHtml(contenido) {
    return '<div class="shell">' + sideHtml()
      + '<div class="app-main">' + topHtml()
      + '<main class="app-body" id="main">' + contenido + '</main>'
      + '</div></div>';
  }

  /* ── Puertas (estados sin suscripción activa) ─────────────────────── */
  function gate(html) { return '<div class="gate"><div class="gate-card">' + html + '</div></div>'; }

  function pintarCargando() {
    ROOT.innerHTML = gate('<span class="spinner" aria-hidden="true"></span><h1>Comprobando tu sesión…</h1>'
      + '<p>Estamos consultando tu PlacetaID y tu estado en el programa.</p>');
  }

  function pintarSinSesion() {
    var url = '#';
    try { url = AUTH ? AUTH.buildLoginUrl() : '#'; } catch (e) { url = '#'; }
    ROOT.innerHTML = gate(
      '<span class="gate-ico">' + ico('lock') + '</span>'
      + '<h1>Identifícate con PlacetaID</h1>'
      + '<p>Entra para ver tu espacio. Si tienes entre 16 y 30 años podrás participar en Placeta Joven; si no, el acceso al programa queda bloqueado.</p>'
      + '<div class="gate-act"><a class="btn btn-primary btn-lg" href="' + esc(url) + '">'
      + 'Acceder con PlacetaID' + ico('arrow') + '</a></div>'
      + '<p class="fine" style="margin-top:1.2rem">Placeta Joven es opcional.</p>');
  }

  function planesHtml(source) {
    var planes = (Array.isArray(source) ? source : []).filter(function (p) { return p && p.id; });
    if (!planes.length) return '';
    return '<h2 style="margin-top:1.8rem">Tarifas</h2><div class="plan-cards">' + planes.map(function (p) {
      var anual = p.id === 'anual';
      return '<article class="plan-card' + (p.destacado ? ' feat' : '') + '">'
        + '<h3>' + esc(p.etiqueta) + (p.destacado ? ' <span class="tag tag-mint">Oferta</span>' : '') + '</h3>'
        + '<p class="p">' + esc(p.precioLabel || 'Consultar') + '</p>'
        + '<span>' + esc(p.ahorroLabel || (anual ? 'Tarifa anual del programa.' : 'Tarifa mensual del programa.')) + '</span>'
        + '</article>';
    }).join('') + '</div>';
  }

  function pintarBloqueado(st) {
    ROOT.innerHTML = gate(
      '<span class="gate-ico">' + ico('cake') + '</span>'
      + '<h1>Todavía no es tu momento</h1>'
      + '<p>Placeta Joven está pensado para jóvenes de 16 a 30 años y tu edad registrada'
      + (st && st.edad ? ' (' + esc(st.edad) + ')' : '') + ' no cumple el requisito.</p>'
      + '<div class="gate-act">'
      + '<a class="btn btn-ghost" href="../index.html">Volver a la web</a>'
      + '<a class="btn btn-ghost" href="https://www.laplaceta.org/" target="_blank" rel="noopener">Ir a La Placeta</a>'
      + '</div>'
      + '<p class="fine" style="margin-top:1.2rem">La Placeta sigue siendo para todos: conservas el acceso general y tus Placetas.</p>');
  }

  function pintarError(e) {
    ROOT.innerHTML = gate(
      '<span class="gate-ico">' + ico('alert') + '</span>'
      + '<h1>No hemos podido cargar tu espacio</h1>'
      + '<p class="alert err" style="text-align:left">' + ico('alert') + '<span>' + esc(mensajeError(e)) + '</span></p>'
      + '<div class="gate-act">'
      + '<button class="btn btn-primary" type="button" data-action="reload">Reintentar</button>'
      + '<a class="btn btn-ghost" href="mailto:joven@laplaceta.org">Escribir a soporte</a>'
      + '</div>');
  }

  function pintarSinSuscripcion(st) {
    var aviso = '';
    if (st && st.pendienteCaducada) aviso = 'No recibimos la confirmación de tu pago anterior, así que puedes elegir plan de nuevo.';
    else if (st && st.estado === 'CANCELADO') aviso = 'Tu suscripción terminó. Puedes volver a darte de alta cuando quieras.';
    else if (st && st.estado === 'EXPIRADO') aviso = 'Tu suscripción expiró. Elige un plan para reactivar tu espacio.';
    var planes = (st && Array.isArray(st.planes) ? st.planes : []).filter(function (p) { return p && p.id; });
    if (!planes.length) {
      planes = [
        { id: 'mensual', etiqueta: 'Plan mensual', precioLabel: '1,95 €/mes', destacado: false },
        { id: 'anual', etiqueta: 'Plan anual', precioLabel: '10 €/año', destacado: true }
      ];
    }

    ROOT.innerHTML = gate(
      '<span class="gate-ico">' + ico('spark') + '</span>'
      + '<h1>Elige tu plan</h1>'
      + '<p>Un paso más y ya tienes acceso a tu espacio joven.</p>'
      + '<div class="plan-cards">' + planes.map(function (p) {
        var anual = p.id === 'anual';
        return '<article class="plan-card' + (p.destacado ? ' feat' : '') + '" data-plan-card="' + esc(p.id) + '">'
          + '<h3>' + esc(p.id === 'anual' ? 'Anual' : 'Mensual') + (p.destacado ? ' <span class="tag tag-mint" style="margin-left:.3rem">Mejor precio</span>' : '') + '</h3>'
          + '<p class="p">' + esc(p.precioLabel || 'Consultar') + '</p>'
          + '<span>' + esc(p.ahorroLabel || (anual ? 'Ahorra frente a 12 mensualidades.' : 'Flexibilidad mes a mes.')) + '</span>'
          + '<button class="btn ' + (p.destacado ? 'btn-primary' : 'btn-ghost') + ' btn-block" type="button" data-action="alta" data-plan="' + esc(p.id) + '">' + (anual ? 'Elegir anual' : 'Empezar') + '</button>'
          + '</article>';
      }).join('') + '</div>'
      + (aviso ? '<p class="alert" style="text-align:left">' + ico('alert') + '<span>' + esc(aviso) + '</span></p>' : '')
      + '<p class="fine">Coste simbólico destinado a mantener el programa: los ingresos se reinvierten en la entidad y en sus proyectos. Puedes cancelar cuando quieras y mantienes las ventajas hasta el final del período pagado.</p>');
  }

  function pintarEstadoPendiente(st) {
    var esPendiente = st.estado === 'PENDIENTE';
    var esSuspendido = st.estado === 'SUSPENDIDO';
    var titulo = esPendiente ? 'Pago en proceso' : (esSuspendido ? 'Suscripción suspendida' : 'Suscripción no activa');
    var det = esPendiente
      ? 'Estamos esperando la confirmación del pago. Si ya pagaste, verifícalo: si lo encontramos, activamos tu Placeta Joven sin cobrarte dos veces.'
      : (esSuspendido
        ? 'Hubo un problema con un pago reciente. Regularízalo para seguir disfrutando de tus ventajas.'
        : 'Tu suscripción necesita una acción para seguir activa.');

    ROOT.innerHTML = gate(
      '<span class="gate-ico">' + ico('clock') + '</span>'
      + '<h1>' + esc(titulo) + '</h1>'
      + '<p>' + esc(det) + '</p>'
      + '<div class="gate-act">'
      + (esPendiente ? '<button class="btn btn-primary" type="button" data-action="verificar">Ya he pagado · Verificar</button>' : '')
      + '<button class="btn ' + (esPendiente ? 'btn-ghost' : 'btn-primary') + '" type="button" data-action="renovar">'
      + (esPendiente ? 'Pagar de nuevo' : 'Regularizar pago') + '</button>'
      + '<a class="btn btn-ghost" href="../index.html">Volver a la web</a>'
      + '</div>'
      + '<p class="fine" style="margin-top:1.2rem">¿Sigues con problemas? Escríbenos a <a href="mailto:joven@laplaceta.org" style="color:var(--violet-3)">joven@laplaceta.org</a></p>');
  }

  /* ═══════════════════ CONTENIDO DE CADA PÁGINA ═══════════════════ */

  /* ── Inicio ───────────────────────────────────────────────────────── */
  function pageInicio() {
    var st = App.st || {};
    var nombre = nombreUsuario();
    var prim = (nombre || 'Joven').split(/\s+/)[0];
    var saldo = saldoPz();
    var keys = st.keys || [];
    var activa = st.estado === 'ACTIVO';

    var progreso = FORMACIONES[0];   // curso destacado de la maqueta

    var html = ''
      + '<div class="page">'
      + '<div class="page-head"><div class="page-head-txt">'
      + '<h1>Hola, ' + esc(prim) + ' 👋</h1>'
      + '<p>Este es tu espacio dentro de Placeta Joven. Aquí ves tu formación, tus recompensas y lo que tienes disponible ahora mismo.</p>'
      + '</div><div class="page-head-act">'
      + (activa ? '<span class="chip"><i></i> Programa activo</span>' : '<span class="chip"><i style="background:var(--amber);box-shadow:0 0 10px var(--amber)"></i> Programa inactivo</span>')
      + '</div></div>';

    /* Métricas */
    html += '<div class="grid g-4">'
      + '<div class="stat is-accent">'
      + '<span class="stat-k">Saldo disponible</span>'
      + '<span class="stat-v">' + (saldo === null ? '— <small>Pz</small>' : num(saldo) + ' <small>Pz</small>') + '</span>'
      + '<span class="stat-sub">' + (saldo === null ? 'Cuenta Joven · pendiente de conexión' : 'Cuenta Joven · Banco de La Placeta') + '</span>'
      + '</div>'
      + '<div class="stat"><span class="stat-k">Keys en tu colección</span>'
      + '<span class="stat-v">' + keys.length + '</span>'
      + '<span class="stat-sub">' + (keys.length ? 'Consúltalas en Beneficios' : 'Todavía no tienes ninguna') + '</span></div>'
      + '<div class="stat"><span class="stat-k">Formaciones</span>'
      + '<span class="stat-v">' + FORMACIONES.length + '</span>'
      + '<span class="stat-sub">Cisco NetAcad vía PlacetaEDU</span></div>'
      + '<div class="stat"><span class="stat-k">Membresía</span>'
      + '<span class="stat-v" style="font-size:1.15rem">' + esc((st.planInfo && st.planInfo.etiqueta) || '—') + '</span>'
      + '<span class="stat-sub">' + (st.expiresAt ? 'Válida hasta ' + esc(fecha(st.expiresAt)) : 'Sin período activo') + '</span></div>'
      + '</div>';

    /* Continúa donde lo dejaste + para ti */
    html += '<div class="grid g-side">'
      + '<div class="grid" style="gap:1rem">'
      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('grad') + '</span>'
      + '<div><h2>Continúa donde lo dejaste</h2><p>Formación en curso dentro de PlacetaEDU.</p></div>'
      + '<a class="btn btn-ghost btn-sm pnl-act" href="formacion.html">Ver todas</a></div>'
      + '<div class="row"><span class="row-ico">' + ico(progreso.icon) + '</span>'
      + '<div class="row-txt"><b>' + esc(progreso.nombre) + '</b>'
      + '<span>PlacetaEDU · Cisco Networking Academy · ' + esc(progreso.horas) + '</span>'
      + '<div class="pbar" style="margin-top:.5rem"><i style="width:35%"></i></div>'
      + '<div class="pbar-meta"><span>En curso</span><span>+' + progreso.recompensa + ' Pz al completar</span></div>'
      + '</div></div>'
      + '<div class="empty" style="margin-top:1rem;padding:1.6rem 1.2rem">'
      + '<span class="empty-ico">' + ico('clock') + '</span>'
      + '<b>El seguimiento de tu progreso llegará pronto</b>'
      + '<p>De momento el avance de cada formación se consulta en PlacetaEDU. Cuando conectemos el progreso, aparecerá aquí automáticamente.</p>'
      + '<div class="gate-act"><a class="btn btn-ghost btn-sm" href="https://www.laplaceta.org/proyectos/placetaedu" target="_blank" rel="noopener">Ir a PlacetaEDU</a></div>'
      + '</div>'
      + '</section>'

      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('spark') + '</span>'
      + '<div><h2>Para ti</h2><p>Atajos a lo que puedes aprovechar ahora.</p></div></div>'
      + '<a class="row" href="formacion.html"><span class="row-ico">' + ico('grad') + '</span>'
      + '<div class="row-txt"><b>Introducción a la ciberseguridad</b><span>Cisco NetAcad · beca de hasta el 50 %</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '<a class="row" href="beneficios.html"><span class="row-ico cyan">' + ico('pad') + '</span>'
      + '<div class="row-txt"><b>Recompensas disponibles</b><span>' + (App.recompensas.length ? App.recompensas.length + ' títulos en el catálogo' : 'Catálogo de juegos indie') + '</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '<a class="row" href="empleo.html"><span class="row-ico warn">' + ico('brief') + '</span>'
      + '<div class="row-txt"><b>Mi primer currículum</b><span>En preparación</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '<a class="row" href="rutas.html"><span class="row-ico">' + ico('route') + '</span>'
      + '<div class="row-txt"><b>Explora las rutas</b><span>9 objetivos con sus pasos</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '</section>'
      + '</div>'

      + '<div class="grid" style="gap:1rem">'
      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('shield') + '</span>'
      + '<div><h2>Tu membresía</h2><p>Estado del programa.</p></div></div>'
      + '<table class="tbl"><tbody>'
      + '<tr><td>Estado</td><td class="num">' + esc(st.estado || '—') + '</td></tr>'
      + '<tr><td>Plan</td><td class="num">' + esc((st.planInfo && st.planInfo.etiqueta) || '—') + '</td></tr>'
      + '<tr><td>Precio</td><td class="num">' + esc((st.planInfo && st.planInfo.precioLabel) || '—') + '</td></tr>'
      + '<tr><td>Válida hasta</td><td class="num">' + (st.expiresAt ? esc(fecha(st.expiresAt)) : '—') + '</td></tr>'
      + '</tbody></table>'
      + '<div class="gate-act" style="justify-content:flex-start;margin-top:1rem">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-action="renovar">Renovar ahora</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-action="cancelar">Cancelar</button>'
      + '</div></section>'

      + noticiasHtml()
      + '</div>'
      + '</div>';
    return html;
  }

  function noticiasHtml() {
    var items = [
      { icon: 'spark', tipo: 'Novedad', titulo: 'Tu espacio se renueva', texto: 'Ahora con Formación, Beneficios, Mi Placeta, Rutas y Comunidad en un mismo sitio.' },
      { icon: 'grad', tipo: 'Formación', titulo: 'Cisco NetAcad vía PlacetaEDU', texto: 'Cursos oficiales con recompensa en Pz al completarlos y becas sobre la matrícula.' },
      { icon: 'pad', tipo: 'Beneficios', titulo: 'Estudios independientes', texto: 'Cuando un estudio colabore, sus juegos aparecerán en el catálogo: una key por usuario y título.' }
    ];
    var html = '<section class="pnl"><div class="pnl-head"><span class="card-ico">' + ico('book') + '</span>'
      + '<div><h2>Noticias de Placeta Joven</h2><p>Lo último del programa.</p></div></div>';
    items.forEach(function (n) {
      html += '<div class="row"><span class="row-ico">' + ico(n.icon) + '</span>'
        + '<div class="row-txt"><b>' + esc(n.titulo) + '</b><span>' + esc(n.tipo) + ' · ' + esc(n.texto) + '</span></div></div>';
    });
    return html + '</section>';
  }

  /* ── Formación ────────────────────────────────────────────────────── */
  function pageFormacion() {
    var areas = ['todas'];
    FORMACIONES.forEach(function (f) { if (areas.indexOf(f.area) < 0) areas.push(f.area); });

    var html = '<div class="page">'
      + pageHead('Formación',
        'Cursos de <b>Cisco Networking Academy</b> a través de <b>PlacetaEDU</b>, actividades propias de La Placeta y rutas formativas. Matrícula y recompensa van separadas: primero te formas y, al completar, recibes tus Pz.',
        '<a class="btn btn-ghost btn-sm" href="https://www.laplaceta.org/proyectos/placetaedu" target="_blank" rel="noopener">Ir a PlacetaEDU</a>');

    /* Cómo funciona la ficha de un curso */
    html += '<div class="banner">' + ico('spark','ico')
      + '<div class="banner-txt"><b>Precio y recompensa, separados</b>'
      + '<span>Cada formación muestra su matrícula, sus gastos de gestión, la recompensa que obtienes al completarla, el bonus y la beca máxima que puede cubrirla.</span></div>'
      + '</div>';

    /* Catálogo */
    html += '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('book') + '</span>'
      + '<div><h2>Catálogo de formaciones</h2><p>Áreas de Cisco NetAcad disponibles a través de PlacetaEDU.</p></div></div>'
      + '<div class="tabs" id="filtrosFormacion" role="group" aria-label="Filtrar por área">'
      + areas.map(function (a) {
          return '<button class="tab' + (a === 'todas' ? ' is-on' : '') + '" type="button" data-action="filtrar-formacion" data-area="' + esc(a) + '">'
            + esc(a === 'todas' ? 'Todas' : a) + '</button>';
        }).join('')
      + '</div>'
      + '<div class="grid g-3" id="gridFormacion" style="margin-top:1.1rem">' + formacionCards('todas') + '</div>'
      + '</section>';

    /* Becas + historial */
    html += '<div class="grid g-2">'
      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico mint">' + ico('gift') + '</span>'
      + '<div><h2>Becas PlacetaEDU</h2><p>Una beca reduce el precio, nunca añade Pz.</p></div></div>'
      + '<p style="color:var(--txt-2);font-size:.9rem">La beca se aplica a la <b>matrícula más los gastos de gestión</b>. La diferencia la asume la Junta del Grupo de La Placeta. La recompensa por completar se mantiene intacta: si te formas con beca, sigues ganando tus Pz.</p>'
      + '<table class="tbl" style="margin-top:.9rem"><tbody>'
      + '<tr><td>Precio del curso</td><td class="num">500 Pz</td></tr>'
      + '<tr><td>Beca concedida (40 %)</td><td class="num minus">−200 Pz</td></tr>'
      + '<tr><td>Lo que pagas</td><td class="num">300 Pz</td></tr>'
      + '<tr><td>Al completar recibes</td><td class="num plus">+120 Pz</td></tr>'
      + '</tbody></table>'
      + '<p class="fine" style="margin-top:.8rem">Ejemplo ilustrativo del funcionamiento. Los porcentajes, convocatorias, plazas y presupuesto disponible se configuran en cada convocatoria de becas.</p>'
      + '</section>'

      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('chart') + '</span>'
      + '<div><h2>Mi historial de formación</h2><p>Evaluaciones, certificados y cursos completados.</p></div></div>'
      + '<div class="empty">'
      + '<span class="empty-ico">' + ico('grad') + '</span>'
      + '<b>Todavía no hay formaciones registradas</b>'
      + '<p>Cuando completes una formación en PlacetaEDU, aparecerá aquí con su certificado, la recompensa obtenida y el bonus aplicado.</p>'
      + '<div class="gate-act"><a class="btn btn-ghost btn-sm" href="https://www.laplaceta.org/proyectos/placetaedu" target="_blank" rel="noopener">Ver formaciones en PlacetaEDU</a></div>'
      + '</div></section>'
      + '</div>'
      + '</div>';
    return html;
  }

  function formacionCards(area) {
    return FORMACIONES.filter(function (f) { return area === 'todas' || f.area === area; })
      .map(function (f) {
        var total = f.matricula + f.gestion;
        return '<article class="item">'
          + '<div class="item-top"><span class="item-cover">' + ico(f.icon) + '</span>'
          + '<div class="item-h"><h3>' + esc(f.nombre) + '</h3>'
          + '<p>' + esc(f.area) + ' · ' + esc(f.nivel) + ' · ' + esc(f.horas) + '</p></div></div>'
          + '<p>' + esc(f.desc) + '</p>'
          + '<div class="item-meta"><span class="tag">Cisco NetAcad</span><span class="tag tag-cyan">PlacetaEDU</span></div>'
          + '<div class="tile-rows">'
          + '<div><span>Matrícula + gestión</span><b>' + num(f.matricula) + ' + ' + num(f.gestion) + ' Pz</b></div>'
          + '<div class="ok"><span>Recompensa al completar</span><b>+' + num(f.recompensa) + ' Pz</b></div>'
          + '<div class="ok"><span>Bonus</span><b>+' + num(f.bonus) + ' Pz</b></div>'
          + '<div class="cut"><span>Beca máxima</span><b>' + num(f.beca) + ' %</b></div>'
          + '</div>'
          + '<div class="item-foot"><span class="item-price">' + num(total) + ' <small>Pz totales</small></span>'
          + '<a class="btn btn-ghost btn-sm" href="https://www.laplaceta.org/proyectos/placetaedu" target="_blank" rel="noopener">Ver en PlacetaEDU</a></div>'
          + '</article>';
      }).join('');
  }

  /* ── Empleo y futuro ──────────────────────────────────────────────── */
  function pageEmpleo() {
    var bloques = [
      { icon: 'file', titulo: 'Mi primer currículum', texto: 'Generador y gestor de CV: construye tu currículum desde cero y mantenlo actualizado con lo que vas consiguiendo.' },
      { icon: 'brief', titulo: 'Recursos para buscar trabajo', texto: 'Dónde buscar, cómo filtrar ofertas y qué evitar en una oferta sospechosa.' },
      { icon: 'users', titulo: 'Preparación de entrevistas', texto: 'Preguntas habituales, cómo contar tu experiencia y qué preguntar tú.' },
      { icon: 'spark', titulo: 'Orientación profesional', texto: 'Decidir por dónde seguir: qué formación encaja con lo que quieres hacer.' },
      { icon: 'route', titulo: 'Proyectos y oportunidades', texto: 'Espacio para tus ideas y proyectos dentro de La Placeta, con acompañamiento.' },
      { icon: 'heart', titulo: 'Voluntariado', texto: 'Participa en las iniciativas de La Placeta y suma experiencia real.' },
      { icon: 'cal', titulo: 'Prácticas', texto: 'Cuando existan colaboraciones con empresas y estudios, las publicaremos aquí con sus condiciones.' }
    ];

    var html = '<div class="page">'
      + pageHead('Empleo y futuro',
        'El itinerario que queremos cubrir para pasar de lo que aprendes a lo que puedes hacer. Esta área está <b>en preparación</b>: no anunciamos nada que todavía no funcione.',
        '<span class="tag tag-amber">En preparación</span>');

    /* CV en local: funciona de verdad y no promete sincronización */
    html += '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('file') + '</span>'
      + '<div><h2>Mi primer currículum</h2><p>Borrador de CV que se guarda únicamente en este navegador.</p></div></div>'
      + '<div class="alert">' + ico('alert')
      + '<p><b>Esto ya funciona</b>, pero todavía no se sincroniza con tu cuenta: el borrador se guarda solo en este dispositivo. Cuando conectemos el gestor completo, podrás guardarlo en tu PlacetaID.</p></div>'
      + '<div class="grid g-2" style="margin-top:1rem">'
      + '  <div>'
      + '    <div class="field"><label for="cv-nombre">Nombre y apellidos</label><input id="cv-nombre" type="text" autocomplete="name" placeholder="Ej.: Mikel G." /></div>'
      + '    <div class="field"><label for="cv-email">Email de contacto</label><input id="cv-email" type="email" autocomplete="email" placeholder="tu@email.com" /></div>'
      + '    <div class="field"><label for="cv-titulo">Titular profesional</label><input id="cv-titulo" type="text" placeholder="Ej.: Estudiante de informática" /></div>'
      + '    <div class="field"><label for="cv-sobre">Sobre mí</label><textarea id="cv-sobre" placeholder="Qué te interesa, qué sabes hacer y qué buscas."></textarea></div>'
      + '    <div class="field"><label for="cv-formacion">Formación</label><textarea id="cv-formacion" placeholder="Estudios, cursos y certificados."></textarea></div>'
      + '    <div class="field"><label for="cv-experiencia">Experiencia y proyectos</label><textarea id="cv-experiencia" placeholder="Trabajos, voluntariado, proyectos propios."></textarea></div>'
      + '    <div class="field"><label for="cv-habilidades">Habilidades</label><input id="cv-habilidades" type="text" placeholder="Ej.: redes, Python, trabajo en equipo" /></div>'
      + '    <div class="gate-act" style="justify-content:flex-start">'
      + '      <button class="btn btn-primary btn-sm" type="button" data-action="cv-guardar">' + ico('check') + ' Guardar borrador</button>'
      + '      <button class="btn btn-ghost btn-sm" type="button" data-action="cv-imprimir">' + ico('print') + ' Imprimir / PDF</button>'
      + '      <button class="btn btn-ghost btn-sm" type="button" data-action="cv-limpiar">Vaciar</button>'
      + '    </div>'
      + '    <p class="fine" id="cv-estado" style="margin-top:.6rem"></p>'
      + '  </div>'
      + '  <div>'
      + '    <p class="stat-k" style="margin-bottom:.5rem">Vista previa</p>'
      + '    <div class="pnl" id="cv-preview" style="background:#fff;color:#1d1a26;border-color:#e4e0ee"></div>'
      + '  </div>'
      + '</div></section>';

    /* Roadmap */
    html += '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico amber">' + ico('brief') + '</span>'
      + '<div><h2>Lo que viene en esta área</h2><p>Orden aproximado de trabajo.</p></div></div>'
      + '<div class="grid g-3">'
      + bloques.map(function (b) {
          return '<article class="item">'
            + '<div class="item-top"><span class="item-cover amber">' + ico(b.icon) + '</span>'
            + '<div class="item-h"><h3>' + esc(b.titulo) + '</h3></div></div>'
            + '<p>' + esc(b.texto) + '</p>'
            + '<div class="item-meta"><span class="tag tag-amber">En preparación</span></div>'
            + '</article>';
        }).join('')
      + '</div>'
      + '<p class="fine" style="margin-top:1rem">¿Tienes una oferta de prácticas, un proyecto o una idea para esta área? Escríbenos a '
      + '<a href="mailto:joven@laplaceta.org" style="color:var(--violet-3)">joven@laplaceta.org</a>.</p>'
      + '</section>'
      + '</div>';
    return html;
  }

  /* ── Beneficios ───────────────────────────────────────────────────── */
  function pageBeneficios() {
    var keys = (App.st && App.st.keys) || [];
    var cats = [
      { id: 'todos', label: 'Todos' },
      { id: 'videojuegos', label: 'Videojuegos' },
      { id: 'formacion', label: 'Formación' },
      { id: 'experiencias', label: 'Experiencias' },
      { id: 'otros', label: 'Otros' }
    ];

    var html = '<div class="page">'
      + pageHead('Beneficios',
        'Recompensas reales: keys de juegos de estudios independientes, cursos con precio reducido en Placetas y actividades concretas. Sin promesas infladas.',
        '<span class="chip"><i></i> ' + App.recompensas.length + ' en el catálogo</span>');

    /* Tus keys */
    html += '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico cyan">' + ico('key') + '</span>'
      + '<div><h2>Tus keys</h2><p>Los juegos que has conseguido. Cada key es única y solo puede canjearse una vez.</p></div></div>'
      + '<div id="listaKeys">' + keysHtml(keys) + '</div>'
      + '</section>';

    /* Catálogo */
    html += '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('pad') + '</span>'
      + '<div><h2>Catálogo de recompensas</h2><p>Consigue juegos y otros beneficios con tus Placetas (Pz).</p></div>'
      + '<div class="search pnl-act">' + ico('search')
      + '<input id="buscarRecompensa" type="search" placeholder="Buscar juego o estudio…" autocomplete="off" /></div>'
      + '</div>'
      + '<div class="tabs" id="filtrosRecompensa" role="group" aria-label="Filtrar recompensas">'
      + cats.map(function (c) {
          return '<button class="tab' + (c.id === App.filtro ? ' is-on' : '') + '" type="button" data-action="filtrar-recompensa" data-cat="' + esc(c.id) + '">' + esc(c.label) + '</button>';
        }).join('')
      + '</div>'
      + '<div id="detalleRecompensa"></div>'
      + '<div class="grid g-3" id="gridRecompensas" style="margin-top:1.1rem">' + recompensasHtml() + '</div>'
      + '</section>';

    html += '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico cyan">' + ico('heart') + '</span>'
      + '<div><h2>Otros juegos recomendados</h2><p>Juegos gratuitos o de acceso libre. No se pagan con Placetas.</p></div></div>'
      + '<div class="grid g-3">' + recomendacionesHtml() + '</div>'
      + '</section>';

    /* Estado del flujo de una key */
    html += '<div class="grid g-2">'
      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('shield') + '</span>'
      + '<div><h2>Cómo protegemos las recompensas</h2><p>Cada key sigue un recorrido controlado.</p></div></div>'
      + '<div class="tl">'
      + ['DISPONIBLE|Está en el inventario y puede canjearse.',
         'RESERVADA|Queda apartada mientras se confirma la operación.',
         'ASIGNADA|Ya tiene dueño: vinculada a una operación concreta.',
         'ENTREGADA|Está en tu espacio y no vuelve al inventario.']
        .map(function (t, i) {
          var p = t.split('|');
          return '<div class="tl-item"><span class="tl-dot' + (i === 3 ? ' done' : '') + '">' + (i + 1) + '</span>'
            + '<div class="tl-txt"><b>' + esc(p[0]) + '</b><span>' + esc(p[1]) + '</span></div></div>';
        }).join('')
      + '</div>'
      + '<p class="fine" style="margin-top:.6rem">Una key entregada no puede entregarse a otra persona ni volver al inventario. Cada usuario puede obtener una única key de cada título.</p>'
      + '</section>'

      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('coin') + '</span>'
      + '<div><h2>Cómo se calcula el precio en Pz</h2><p>Los índices y tasas del programa, no una conversión directa.</p></div></div>'
      + '<ul class="card-list">'
      + '<li>Precio de referencia del juego y antigüedad.</li>'
      + '<li>Si es un lanzamiento reciente, una beta o un playtest.</li>'
      + '<li>Categoría, edad recomendada y disponibilidad.</li>'
      + '<li>Valor educativo y campañas especiales activas.</li>'
      + '</ul>'
      + '<p class="fine" style="margin-top:.8rem">Por eso dos juegos con el mismo precio de referencia pueden costar Pz distintos. El precio se publica según los índices del programa: no lo cambia un administrador para cada usuario.</p>'
      + '</section>'
      + '</div>'
      + '</div>';
    return html;
  }

  function keysHtml(keys) {
    if (!keys || !keys.length) {
      return '<div class="empty">'
        + '<span class="empty-ico">' + ico('key') + '</span>'
        + '<b>Aún no tienes keys</b>'
        + '<p>Cuando consigas una recompensa con Placetas, tu key aparecerá aquí con su código y podrás canjearla en la plataforma del juego.</p>'
        + '<div class="gate-act"><a class="btn btn-ghost btn-sm" href="beneficios.html#catalogo">Ver el catálogo</a></div>'
        + '</div>';
    }
    return keys.map(function (k) {
      var usada = k.estado === 'usado';
      return '<div class="row" style="align-items:flex-start">'
        + '<span class="row-ico ' + (usada ? 'ok' : 'cyan') + '">' + ico(usada ? 'check' : 'key') + '</span>'
        + '<div class="row-txt" style="min-width:0">'
        + '<b>' + esc(k.juego || 'Juego indie') + (k.plataforma ? ' <span class="tag" style="margin-left:.4rem">' + esc(k.plataforma) + '</span>' : '') + '</b>'
        + '<span>' + (usada ? 'Canjeada' + (k.canjeada ? ' · ' + esc(fecha(k.canjeada)) : '') : 'Disponible') + (k.pz ? ' · conseguida con ' + num(k.pz) + ' Pz' : '') + '</span>'
        + '<div class="keybox" style="margin-top:.6rem"><span aria-hidden="true">' + ico('key') + '</span>'
        + '<code>' + esc(k.codigo || '—') + '</code>'
        + '<button class="btn btn-ghost btn-sm" type="button" data-action="copiar-key" data-code="' + esc(k.codigo || '') + '">' + ico('copy') + ' Copiar</button>'
        + (usada ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-action="usar-key" data-key="' + esc(k.id) + '">Marcar como canjeada</button>')
        + '</div></div></div>';
    }).join('');
  }

  function recompensasHtml() {
    if (!App.recompensas.length) {
      return '<div class="empty" style="grid-column:1/-1">'
        + '<span class="empty-ico">' + ico('pad') + '</span>'
        + '<b>Todavía no hay recompensas publicadas</b>'
        + '<p>Estamos dando los primeros pasos del programa. Cuando un estudio independiente confirme su colaboración, sus juegos aparecerán aquí con sus condiciones.</p>'
        + '<div class="gate-act"><a class="btn btn-ghost btn-sm" href="mailto:joven@laplaceta.org?subject=Colaboraci%C3%B3n%20con%20Placeta%20Joven">Proponer una colaboración</a></div>'
        + '</div>';
    }
    var q = App.busqueda.trim().toLowerCase();
    var lista = App.recompensas.filter(function (r) {
      if (r.tipoJuego === 'recomendado' || r.gratis) return false;
      if (App.filtro !== 'todos' && r.categoria !== App.filtro) return false;
      if (!q) return true;
      return String((r.nombre || '') + ' ' + (r.desarrolladora || '') + ' ' + (r.genero || '')).toLowerCase().indexOf(q) >= 0;
    });
    if (!lista.length) {
      return '<div class="empty" style="grid-column:1/-1">'
        + '<span class="empty-ico">' + ico('search') + '</span>'
        + '<b>Sin resultados</b><p>No hay recompensas que coincidan con tu búsqueda. Prueba con otro término o cambia de categoría.</p></div>';
    }
    return lista.map(function (r) {
      var conseguida = tieneConseguida(r.id);
      var disponible = /^disponible$/i.test(String(r.disponibilidad || ''));
      var puede = r.canjeable && !conseguida;
      var cats = { videojuegos: 'Videojuegos', formacion: 'Formación', experiencias: 'Experiencias', otros: 'Otros' };
      return '<article class="item">'
        + '<div class="item-top">' + (r.imagen ? '<img class="item-image" src="' + esc(r.imagen) + '" alt="" loading="lazy" />' : '<span class="item-cover ' + (conseguida ? 'mint' : '') + '">' + ico(r.categoria === 'videojuegos' ? 'pad' : (r.categoria === 'formacion' ? 'grad' : 'gift')) + '</span>')
        + '<div class="item-h"><h3>' + esc(r.nombre) + '</h3>'
        + '<p>' + esc(r.desarrolladora || 'Estudio colaborador') + (r.genero ? ' · ' + esc(r.genero) : '') + '</p></div></div>'
        + '<p>' + esc(r.descripcion || '') + '</p>'
        + '<div class="item-meta">'
        + '<span class="tag">' + esc(cats[r.categoria] || 'Recompensa') + '</span>'
        + (r.plataforma ? '<span class="tag tag-cyan">' + esc(r.plataforma) + '</span>' : '')
        + (r.edadRecomendada ? '<span class="tag">' + esc(r.edadRecomendada) + '</span>' : '')
        + (conseguida ? '<span class="tag tag-mint">Conseguida</span>' : '')
        + (!conseguida && r.canjeable && r.stock != null ? '<span class="tag tag-amber">Quedan ' + num(r.stock) + '</span>' : '')
        + '</div>'
        + '<div class="item-foot"><span class="item-price">' + num(r.pz) + ' <small>Pz</small></span>'
        + '<button class="btn ' + (puede ? 'btn-primary' : 'btn-ghost') + ' btn-sm" type="button" '
        + (puede ? 'data-action="abrir-recompensa" data-id="' + esc(r.id) + '"' : 'disabled')
        + '>' + (conseguida ? 'Conseguida' : (puede ? 'Ver y conseguir' : esc(r.disponibilidad || 'Próximamente'))) + '</button>'
        + '</div></article>';
    }).join('');
  }

  function recomendacionesHtml() {
    var lista = App.recompensas.filter(function (r) { return r.tipoJuego === 'recomendado' || r.gratis; });
    if (!lista.length) return '<div class="empty" style="grid-column:1/-1"><b>Aún no hay recomendaciones publicadas</b><p>Cuando un estudio comparta un juego gratuito, aparecerá aquí con su enlace oficial.</p></div>';
    return lista.map(function (r) {
      return '<article class="item"><div class="item-top">' + (r.imagen ? '<img class="item-image" src="' + esc(r.imagen) + '" alt="" loading="lazy" />' : '<span class="item-cover mint">' + ico('heart') + '</span>')
        + '<div class="item-h"><h3>' + esc(r.nombre) + '</h3><p>' + esc(r.desarrolladora || 'Estudio colaborador') + '</p></div></div>'
        + '<p>' + esc(r.descripcion || '') + '</p><div class="item-meta"><span class="tag tag-mint">Gratis</span>' + (r.plataforma ? '<span class="tag tag-cyan">' + esc(r.plataforma) + '</span>' : '') + '</div>'
        + '<div class="item-foot"><a class="btn btn-ghost btn-sm" href="' + esc(r.url || r.steamUrl || '#') + '" target="_blank" rel="noopener"' + (!r.url && !r.steamUrl ? ' aria-disabled="true"' : '') + '>Visitar juego ' + ico('out') + '</a></div></article>';
    }).join('');
  }

  /* Actualiza solo la rejilla y las pestañas del catálogo: evita re-renderizar
     toda la página (y perder el foco o la posición de scroll). */
  function actualizarCatalogo() {
    var g = document.getElementById('gridRecompensas');
    if (g) g.innerHTML = recompensasHtml();
    var bar = document.getElementById('filtrosRecompensa');
    if (bar) Array.prototype.forEach.call(bar.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-cat') === App.filtro);
    });
  }

  /* Muestra el aviso superior de la página (o un alert si no existe). */
  function avisoApp(clase, html) {
    var aviso = document.getElementById('avisoApp');
    if (!aviso) { window.alert(html.replace(/<[^>]+>/g, '')); return; }
    aviso.className = clase;
    aviso.innerHTML = html;
    aviso.removeAttribute('hidden');
    aviso.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function tieneConseguida(recompensaId) {
    return ((App.st && App.st.keys) || []).some(function (k) {
      return k && String(k.recompensaId || '') === String(recompensaId);
    });
  }

  function detalleRecompensaHtml(r) {
    var conseguida = tieneConseguida(r.id);
    var puede = r.canjeable && !conseguida;
    var estados = ['DISPONIBLE', 'RESERVADA', 'ASIGNADA', 'ENTREGADA'];
    return '<div class="pnl" style="margin-top:1.1rem;border-color:var(--line-2)">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('pad') + '</span>'
      + '<div><h2>' + esc(r.nombre) + '</h2><p>por ' + esc(r.desarrolladora || 'estudio colaborador') + '</p></div>'
      + '<button class="btn btn-ghost btn-sm pnl-act" type="button" data-action="cerrar-recompensa">' + ico('x') + ' Cerrar</button></div>'
      + (r.imagen ? '<img class="detail-image" src="' + esc(r.imagen) + '" alt="" />' : '')
      + (r.video ? '<div class="detail-video"><iframe src="' + esc(r.video) + '" title="Vídeo de ' + esc(r.nombre) + '" loading="lazy" allowfullscreen></iframe></div>' : '')
      + '<div class="grid g-2">'
      + '<div>'
      + '<p style="color:var(--txt-2)">' + esc(r.descripcion || '') + '</p>'
      + '<table class="tbl"><tbody>'
      + (r.plataforma ? '<tr><td>Plataforma</td><td class="num">' + esc(r.plataforma) + '</td></tr>' : '')
      + (r.editor ? '<tr><td>Editor</td><td class="num">' + esc(r.editor) + '</td></tr>' : '')
      + (r.fechaLanzamiento ? '<tr><td>Lanzamiento</td><td class="num">' + esc(r.fechaLanzamiento) + '</td></tr>' : '')
      + (r.edadRecomendada ? '<tr><td>Edad recomendada</td><td class="num">' + esc(r.edadRecomendada) + '</td></tr>' : '')
      + '<tr><td>Disponibilidad</td><td class="num">' + esc(r.disponibilidad || 'Próximamente') + '</td></tr>'
      + '<tr><td>Precio</td><td class="num">' + num(r.pz) + ' Pz</td></tr>'
      + '</tbody></table>'
      + (r.condiciones ? '<div class="alert" style="margin-top:.9rem">' + ico('alert') + '<p><b>Condiciones</b><br />' + esc(r.condiciones) + '</p></div>' : '')
      + '</div>'
      + (r.steamUrl ? '<p style="margin-top:1rem"><a class="btn btn-ghost btn-sm" href="' + esc(r.steamUrl) + '" target="_blank" rel="noopener">Ver en Steam ' + ico('out') + '</a></p>' : '')
      + '<div>'
      + '<p class="stat-k" style="margin-bottom:.6rem">Recorrido de la key</p>'
      + '<div class="tl">' + estados.map(function (e, i) {
          var activo = i === 0;
          return '<div class="tl-item"><span class="tl-dot' + (activo ? ' now' : '') + '">' + (i + 1) + '</span>'
            + '<div class="tl-txt"><b>' + e + '</b><span>' + (i === 3 ? 'La recibes en tu espacio al confirmar' : 'Estado controlado por el sistema') + '</span></div></div>';
        }).join('') + '</div>'
      + (conseguida
          ? '<p class="alert ok" style="margin-top:1rem">' + ico('check') + '<span>Ya conseguiste esta recompensa. Tu key está en «Tus keys».</span></p>'
          : (puede
            ? '<label class="chip" style="margin-top:1rem;cursor:pointer"><input type="checkbox" id="aceptoRecompensa" style="margin-right:.4rem" /> He leído y acepto las condiciones de este título.</label>'
              + '<div class="gate-act" style="justify-content:flex-start;margin-top:1rem">'
              + '<button class="btn btn-primary" type="button" data-action="canjear" data-id="' + esc(r.id) + '" disabled>Conseguir por ' + num(r.pz) + ' Pz</button>'
              + '<a class="btn btn-ghost" href="miplaceta.html">Ver mi saldo</a>'
              + '</div>'
              + '<p class="fine" style="margin-top:.7rem">Al conseguirla se descuentan ' + num(r.pz) + ' Pz de tu saldo y se te asigna una key única. Solo puedes conseguirla una vez.</p>'
            : '<p class="alert" style="margin-top:1rem">' + ico('alert') + '<span>Esta recompensa todavía no se puede conseguir.</span></p>'))
      + '</div></div></div>';
  }

  /* ── Mi Placeta ───────────────────────────────────────────────────── */
  function pageMiPlaceta() {
    var st = App.st || {};
    var saldo = saldoPz();
    var movs = movimientos();
    var keys = st.keys || [];

    var html = '<div class="page">'
      + pageHead('Mi Placeta',
        'Tu saldo, tus movimientos y todo lo que has conseguido. El saldo en Placetas vive en tu <b>Cuenta Joven de Banco de La Placeta</b> —un tipo de cuenta con <b>12 % de cashback</b> y sus propias condiciones—. Placeta Joven no crea Pz: consulta el saldo y registra las operaciones que autorizas.',
        '<a class="btn btn-ghost btn-sm" href="beneficios.html">Ir a Beneficios</a>');

    html += '<div class="grid g-4">'
      + '<div class="stat is-accent"><span class="stat-k">Saldo disponible</span>'
      + '<span class="stat-v">' + (saldo === null ? '— <small>Pz</small>' : num(saldo) + ' <small>Pz</small>') + '</span>'
      + '<span class="stat-sub">' + (saldo === null ? 'Cuenta Joven · pendiente de conexión' : 'Cuenta Joven · Banco de La Placeta') + '</span></div>'
      + '<div class="stat"><span class="stat-k">Keys conseguidas</span><span class="stat-v">' + keys.length + '</span>'
      + '<span class="stat-sub">Una por título y usuario</span></div>'
      + '<div class="stat"><span class="stat-k">Recompensas canjeadas</span>'
      + '<span class="stat-v">' + keys.filter(function (k) { return k.estado === 'usado'; }).length + '</span>'
      + '<span class="stat-sub">Marcadas como canjeadas</span></div>'
      + '<div class="stat"><span class="stat-k">Becas activas</span><span class="stat-v">0</span>'
      + '<span class="stat-sub">Sin convocatorias abiertas</span></div>'
      + '</div>';

    /* Saldo: explicación honesta */
    if (saldo === null) {
      html += '<div class="alert">' + ico('alert')
        + '<p><b>Tu saldo todavía no se muestra aquí.</b> Las Placetas viven en tu <b>Cuenta Joven de Banco de La Placeta</b>, y la consulta en tiempo real necesita la conexión con la API del banco, que aún no está activada en este entorno. Hasta entonces, consulta tu saldo desde tu Cuenta Joven. En cuanto la conexión esté disponible aparecerá automáticamente aquí: no mostramos cifras inventadas.</p></div>';
    }

    html += '<div class="grid g-side">'
      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('chart') + '</span>'
      + '<div><h2>Movimientos</h2><p>Entradas y salidas de Placetas.</p></div></div>'
      + (movs && movs.length
        ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th class="num">Pz</th></tr></thead><tbody>'
          + movs.map(function (m) {
            var v = Number(m.pz != null ? m.pz : (m.importe || 0));
            return '<tr><td data-th="Fecha">' + esc(fecha(m.fecha || m.created_at)) + '</td>'
              + '<td data-th="Concepto">' + esc(m.concepto || m.descripcion || '—') + '</td>'
              + '<td data-th="Tipo">' + esc(m.tipo || (v >= 0 ? 'Abono' : 'Cargo')) + '</td>'
              + '<td class="num ' + (v >= 0 ? 'plus' : 'minus') + '" data-th="Pz">' + (v >= 0 ? '+' : '') + num(v) + '</td></tr>';
          }).join('')
          + '</tbody></table></div>'
        : '<div class="empty"><span class="empty-ico">' + ico('chart') + '</span>'
          + '<b>Sin movimientos que mostrar</b>'
          + '<p>El historial de Placetas se consulta en tu Cuenta Joven de Banco de La Placeta. Cuando conectemos su API, verás aquí cada recompensa obtenida y cada canje realizado.</p>'
          + '<div class="gate-act"><a class="btn btn-ghost btn-sm" href="https://www.laplaceta.org/" target="_blank" rel="noopener">Ir a La Placeta</a></div></div>')
      + '</section>'

      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico mint">' + ico('coin') + '</span>'
      + '<div><h2>Cuenta Joven</h2><p>Abrela con un contrato firmado en PlacetaID.</p></div></div>'
      + '<p style="color:var(--txt-2);font-size:.9rem">Tu saldo de Placetas vive en Banco de La Placeta. La solicitud se revisa y se firma de forma segura.</p>'
      + '<button class="btn btn-primary btn-sm" type="button" data-action="cuenta-joven">Solicitar Cuenta Joven</button>'
      + '</section>'

      + '<div class="grid" style="gap:1rem">'
      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico mint">' + ico('gift') + '</span>'
      + '<div><h2>Bonificaciones y becas</h2><p>Ayudas aplicadas a tu formación.</p></div></div>'
      + '<div class="empty" style="padding:1.5rem 1rem">'
      + '<span class="empty-ico">' + ico('gift') + '</span>'
      + '<b>Sin bonificaciones activas</b>'
      + '<p>Las becas de PlacetaEDU reducen el precio de la matrícula. Cuando haya convocatorias abiertas verás aquí las que te correspondan.</p>'
      + '</div></section>'

      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('id') + '</span>'
      + '<div><h2>Estado de la membresía</h2><p>Tu programa dentro de La Placeta.</p></div></div>'
      + '<table class="tbl"><tbody>'
      + '<tr><td>Estado</td><td class="num">' + esc(st.estado || '—') + '</td></tr>'
      + '<tr><td>Plan</td><td class="num">' + esc((st.planInfo && st.planInfo.etiqueta) || '—') + '</td></tr>'
      + '<tr><td>Válida hasta</td><td class="num">' + (st.expiresAt ? esc(fecha(st.expiresAt)) : '—') + '</td></tr>'
      + '<tr><td>Identificación</td><td class="num">PlacetaID</td></tr>'
      + '</tbody></table>'
      + '<div class="gate-act" style="justify-content:flex-start;margin-top:1rem">'
      + '<button class="btn btn-ghost btn-sm" type="button" data-action="renovar">Renovar</button>'
      + '<button class="btn btn-ghost btn-sm" type="button" data-action="cancelar">Cancelar</button>'
      + '</div></section>'
      + '</div></div>';

    if (keys.length) {
      html += '<section class="pnl">'
        + '<div class="pnl-head"><span class="card-ico cyan">' + ico('key') + '</span>'
        + '<div><h2>Recompensas obtenidas</h2><p>Historial de lo que has conseguido.</p></div></div>'
        + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Juego</th><th>Plataforma</th><th>Conseguida</th><th>Estado</th></tr></thead><tbody>'
        + keys.map(function (k) {
            return '<tr><td data-th="Juego">' + esc(k.juego || '—') + '</td>'
              + '<td data-th="Plataforma">' + esc(k.plataforma || '—') + '</td>'
              + '<td data-th="Conseguida">' + (k.otorgada ? esc(fecha(k.otorgada)) : '—') + '</td>'
              + '<td data-th="Estado">' + (k.estado === 'usado' ? 'Canjeada' : 'Disponible') + '</td></tr>';
          }).join('')
        + '</tbody></table></div></section>';
    }

    html += '</div>';
    return html;
  }

  function pageProtecciones() {
    var items = App.protecciones.length ? App.protecciones : [];
    return '<div class="page">' + pageHead('Protecciones', 'Ideas de protección para jóvenes. Solo se activarán cuando exista una aseguradora y un contrato válido.', '<span class="tag tag-amber">En preparación</span>')
      + '<div class="alert">' + ico('alert') + '<p><b>Esto no es una póliza.</b> Aquí puedes dejar interés. No hay precio, cobertura ni contratación activa.</p></div>'
      + '<div class="grid g-3">' + (items.length ? items.map(function (p) {
        return '<article class="item"><div class="item-top"><span class="item-cover cyan">' + ico(p.icono || 'shield') + '</span><div class="item-h"><h3>' + esc(p.nombre) + '</h3><p>' + esc(p.resumen) + '</p></div></div><p class="fine">' + esc(p.nota) + '</p><div class="item-foot"><button class="btn btn-ghost btn-sm" type="button" data-action="interes-proteccion" data-id="' + esc(p.id) + '">Me interesa</button></div></article>';
      }).join('') : '<div class="empty" style="grid-column:1/-1"><b>No hay propuestas publicadas</b></div>') + '</div></div>';
  }

  function pageBecas() {
    var opciones = [];
    App.caminos.forEach(function (camino) { (camino.etapas || []).forEach(function (etapa) { (etapa.elementos || []).forEach(function (elemento) { opciones.push({ camino: camino, elemento: elemento }); }); }); });
    var historial = App.becas || [];
    var html = '<div class="page">' + pageHead('Becas', 'Pide ayuda para un elemento formativo. La Junta revisa tu situación y deja el resultado explicado.', '<span class="tag tag-cyan">Solicitud clara</span>')
      + '<section class="pnl"><div class="pnl-head"><span class="card-ico mint">' + ico('gift') + '</span><div><h2>Solicitar una beca</h2><p>Los Pz, las keys y la actividad no cambian tu necesidad económica.</p></div></div>'
      + '<form id="becaForm" class="grid g-2"><label>Elemento formativo<select id="becaElemento" required>' + opciones.map(function (o) { return '<option value="' + esc(o.camino.id + '|' + o.elemento.id) + '">' + esc(o.elemento.titulo + ' · ' + o.camino.nombre) + '</option>'; }).join('') + '</select></label>'
      + '<label>Personas en la unidad<input id="becaPersonas" type="number" min="1" value="1" required /></label>'
      + '<label>Renta por persona (0–40)<input id="becaRenta" type="number" min="0" max="40" value="0" required /></label>'
      + '<label>Situación laboral (0–15)<input id="becaLaboral" type="number" min="0" max="15" value="0" required /></label>'
      + '<label>Personas dependientes (0–15)<input id="becaDependientes" type="number" min="0" max="15" value="0" required /></label>'
      + '<label>Vulnerabilidad económica (0–15)<input id="becaVulnerabilidad" type="number" min="0" max="15" value="0" required /></label>'
      + '<label>Patrimonio y recursos (0–10)<input id="becaPatrimonio" type="number" min="0" max="10" value="0" required /></label>'
      + '<label>Gastos esenciales (0–5)<input id="becaGastos" type="number" min="0" max="5" value="0" required /></label>'
      + '<label class="grid-span-2">Documentación o contexto<input id="becaDocs" type="text" placeholder="Ej. certificado de desempleo, alquiler…" /></label>'
      + '<div class="gate-act grid-span-2" style="justify-content:flex-start"><button class="btn btn-primary" type="submit">Enviar solicitud</button></div></form></section>'
      + '<section class="pnl"><div class="pnl-head"><span class="card-ico">' + ico('file') + '</span><div><h2>Mi historial</h2><p>Verás qué se ha aceptado o denegado y por qué.</p></div></div>'
      + (historial.length ? historial.map(function (b) { return '<article class="row"><span class="row-ico ' + (b.estado === 'ACEPTADA' ? 'ok' : (b.estado === 'DENEGADA' ? 'warn' : 'cyan')) + '">' + ico(b.estado === 'ACEPTADA' ? 'check' : 'file') + '</span><div class="row-txt"><b>' + esc(b.elemento) + '</b><span>' + esc(b.estado) + ' · INB ' + b.inb + ' · beca aplicada ' + b.porcentajeAplicado + '%</span><span>' + (b.motivo ? esc(b.motivo) : 'Pendiente de revisión') + '</span></div></article>'; }).join('') : '<div class="empty"><b>Aún no tienes solicitudes</b><p>Cuando envíes una, quedará guardada con todos sus datos.</p></div>') + '</section></div>';
    return html;
  }

  /* ── Rutas ────────────────────────────────────────────────────────── */
  function pageRutas() {
    var rutas = App.caminos;
    var progreso = App.caminosEstado.progreso || [];
    var html = '<div class="page">'
      + pageHead('Caminos formativos', 'Elige una meta. El camino ordena cursos, actividades y proyectos sin duplicarlos.', '<span class="tag tag-cyan">Activo</span>');

    html += '<div class="grid g-3">'
      + rutas.map(function (r) {
          var p = progreso.filter(function (item) { return item.caminoId === r.id; })[0] || { completados: 0, total: 0, porcentaje: 0, elementos: [] };
          var items = (r.etapas || []).reduce(function (all, etapa) { return all.concat((etapa.elementos || []).map(function (item) { return Object.assign({}, item, { etapa: etapa.nombre }); })); }, []);
          return '<article class="item">'
            + '<div class="item-top"><span class="item-cover">' + ico('route') + '</span>'
            + '<div class="item-h"><h3>' + esc(r.nombre) + '</h3><p>' + esc(r.descripcion || '') + '</p></div></div>'
            + '<div class="pbar" style="margin:.9rem 0 .35rem"><i style="width:' + p.porcentaje + '%"></i></div><div class="pbar-meta"><span>' + p.completados + ' de ' + p.total + ' elementos</span><b>' + p.porcentaje + ' %</b></div>'
            + '<div class="tl">' + (r.etapas || []).map(function (etapa) {
                return '<div class="tl-item"><span class="tl-dot">' + esc(etapa.id.slice(0, 1).toUpperCase()) + '</span><div class="tl-txt"><b>' + esc(etapa.nombre) + '</b><span>' + etapa.elementos.length + ' elementos</span></div></div>';
              }).join('') + '</div>'
            + '<div class="item-meta"><span class="tag tag-cyan">' + esc(r.nivel || 'Ruta') + '</span><span class="tag">+' + num(r.recompensaFinal || 0) + ' Pz al completar</span></div>'
            + '<div class="item-foot"><a class="btn btn-ghost btn-sm" href="formacion.html">Ver elementos</a>' + (items.some(function (item) { return item.convalidable; }) ? '<button class="btn btn-primary btn-sm" type="button" data-action="solicitar-convalidacion" data-camino="' + esc(r.id) + '">Convalidar</button>' : '') + '</div>'
            + '</article>';
        }).join('')
      + '</div>';
    html += '<section class="pnl" style="margin-top:1rem"><div class="pnl-head"><span class="card-ico">' + ico('check') + '</span><div><h2>Convalidaciones</h2><p>Las revisa el equipo antes de conceder la recompensa.</p></div></div>' + ((App.caminosEstado.convalidaciones || []).length ? App.caminosEstado.convalidaciones.map(function (s) { return '<div class="row"><span class="row-ico warn">' + ico('clock') + '</span><div class="row-txt"><b>' + esc(s.curso) + '</b><span>' + esc(s.proveedor) + ' · ' + esc(s.estado) + '</span></div></div>'; }).join('') : '<div class="empty"><b>Aún no tienes solicitudes</b><p>Presenta un curso externo y adjunta una referencia o certificado.</p></div>') + '</section>'
      + '</div>';
    return html;
  }

  /* ── Comunidad ────────────────────────────────────────────────────── */
  function pageComunidad() {
    var html = '<div class="page">'
      + pageHead('Comunidad',
        'Actividades, eventos, proyectos y convocatorias de La Placeta. Un sitio donde enterarte de lo que pasa y apuntarte a lo que te interese.',
        '<span class="tag tag-amber">En preparación</span>');

    html += '<div class="alert">' + ico('alert')
      + '<p><b>El área de comunidad todavía no está abierta.</b> Mientras la construimos, todas las actividades generales de La Placeta siguen disponibles en su web oficial: son para todos, participes o no en Placeta Joven.</p></div>';

    html += '<div class="grid g-2">'
      + COMUNIDAD.map(function (c) {
          return '<article class="item">'
            + '<div class="item-top"><span class="item-cover cyan">' + ico(c.icon) + '</span>'
            + '<div class="item-h"><h3>' + esc(c.titulo) + '</h3></div></div>'
            + '<p>' + esc(c.texto) + '</p>'
            + '<div class="item-meta"><span class="tag tag-amber">' + esc(c.estado) + '</span></div>'
            + '</article>';
        }).join('')
      + '</div>';

    html += '<div class="grid g-2">'
      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('cal') + '</span>'
      + '<div><h2>Mientras tanto</h2><p>Dónde encontrar lo que ya ocurre.</p></div></div>'
      + '<a class="row" href="https://www.laplaceta.org/" target="_blank" rel="noopener"><span class="row-ico">' + ico('spark') + '</span>'
      + '<div class="row-txt"><b>Web oficial de La Placeta</b><span>Actividades, proyectos y noticias del Grupo</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '<a class="row" href="https://www.laplaceta.org/proyectos/placetaedu" target="_blank" rel="noopener"><span class="row-ico">' + ico('grad') + '</span>'
      + '<div class="row-txt"><b>PlacetaEDU</b><span>Formación abierta del Grupo</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '<a class="row" href="https://bop.laplaceta.org/" target="_blank" rel="noopener"><span class="row-ico">' + ico('book') + '</span>'
      + '<div class="row-txt"><b>Boletín Oficial (BOLP)</b><span>Normativa y publicaciones oficiales</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '</section>'

      + '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('users') + '</span>'
      + '<div><h2>Tu opinión decide</h2><p>Qué construimos después.</p></div></div>'
      + '<p style="color:var(--txt-2);font-size:.9rem">Antes de abrir el área de comunidad queremos saber qué te resulta más útil: talleres, quedadas, proyectos en grupo, retos o sesiones de orientación.</p>'
      + '<div class="gate-act" style="justify-content:flex-start;margin-top:1rem">'
      + '<a class="btn btn-primary btn-sm" href="mailto:joven@laplaceta.org?subject=Qu%C3%A9%20me%20gustar%C3%ADa%20en%20Comunidad">Contar qué me gustaría</a>'
      + '</div></section>'
      + '</div>'
      + '</div>';
    return html;
  }

  function pageHead(titulo, texto, extra) {
    return '<div class="page-head"><div class="page-head-txt">'
      + '<h1>' + esc(titulo) + '</h1><p>' + texto + '</p></div>'
      + (extra ? '<div class="page-head-act">' + extra + '</div>' : '')
      + '</div>';
  }

  var PAGINAS = {
    inicio: pageInicio,
    formacion: pageFormacion,
    empleo: pageEmpleo,
    beneficios: pageBeneficios,
    protecciones: pageProtecciones,
    becas: pageBecas,
    miplaceta: pageMiPlaceta,
    rutas: pageRutas,
    comunidad: pageComunidad
  };

  /* ═══════════════════ ACCIONES ═══════════════════ */
  function conBoton(btn, texto, fn) {
    if (btn) { btn.disabled = true; btn.dataset.orig = btn.innerHTML; btn.textContent = texto; }
    return fn().catch(function (e) {
      pintarError(e);
    }).finally(function () {
      if (btn && btn.dataset.orig) { btn.disabled = false; btn.innerHTML = btn.dataset.orig; }
    });
  }

  function accionAlta(plan, btn) {
    conBoton(btn, 'Abriendo pago…', function () {
      return api('alta', { method: 'POST', body: JSON.stringify({ plan: plan }) })
        .then(function (r) { if (r && r.checkoutUrl) window.location.href = r.checkoutUrl; });
    });
  }
  function accionRenovar(btn) {
    conBoton(btn, 'Abriendo pago…', function () {
      return api('renovar', { method: 'POST', body: '{}' })
        .then(function (r) { if (r && r.checkoutUrl) window.location.href = r.checkoutUrl; });
    });
  }
  function accionVerificar(btn) {
    conBoton(btn, 'Comprobando pago…', function () {
      return api('verificar', { method: 'POST', body: '{}' }).then(function (r) {
        if (r && r.ok && r.estado === 'ACTIVO') return boot();
        throw Object.assign(new Error('sin_suscripcion'), { code: 'sin_suscripcion' });
      }).catch(function (e) {
        var card = ROOT.querySelector('.gate-card');
        if (card) {
          var av = card.querySelector('.alert');
          if (!av) { av = document.createElement('p'); card.appendChild(av); }
          av.className = 'alert';
          av.innerHTML = ico('alert') + '<span>' + esc(mensajeError(e)) + '</span>';
        } else {
          pintarError(e);
        }
      });
    });
  }
  function accionCancelar(btn) {
    if (!window.confirm('¿Seguro que quieres cancelar Placeta Joven? Mantendrás las ventajas hasta el final del período pagado.')) return;
    conBoton(btn, 'Cancelando…', function () {
      return api('cancelar', { method: 'POST', body: '{}' }).then(function () { return boot(); });
    });
  }
  function accionCanjear(id, btn) {
    conBoton(btn, 'Procesando…', function () {
      return api('recompensas', { method: 'POST', body: JSON.stringify({ recompensaId: id }) })
        .then(function () {
          return api('status').then(function (st) {
            App.st = st;
            App.vista = null;
            render();
            avisoApp('alert ok', ico('check') + '<span>¡Recompensa conseguida! Tu key ya está en «Tus keys».</span>');
          });
        })
        .catch(function (e) {
          var m = {
            canjeo_desactivado: 'El canje con Placetas se activará cuando haya recompensas confirmadas.',
            ya_conseguida: 'Ya conseguiste esta recompensa: solo se puede conseguir una vez por usuario y título.',
            no_disponible: 'Esta recompensa todavía no está disponible.',
            sin_stock: 'Acabamos de quedarnos sin keys de esta recompensa. Vuelve pronto.',
            no_activa: 'Necesitas tener Placeta Joven activa para conseguir recompensas.',
            recompensa_no_encontrada: 'No hemos encontrado esa recompensa. Recarga la página.'
          }[e && e.code];
          if (!m) throw e;
          avisoApp('alert', ico('alert') + '<span>' + esc(m) + '</span>');
        });
    });
  }
  function accionUsarKey(keyId, btn) {
    conBoton(btn, 'Guardando…', function () {
      return api('keys', { method: 'POST', body: JSON.stringify({ keyId: keyId, accion: 'canjear' }) })
        .then(function () { return api('status'); })
        .then(function (st) { App.st = st; render(); });
    });
  }

  /* ── CV (borrador local) ─────────────────────────────────────────── */
  var CV_KEY = 'pjv_cv_v1';
  function cvLeer() {
    try { return JSON.parse(localStorage.getItem(CV_KEY) || '{}'); } catch (e) { return {}; }
  }
  function cvCampos() {
    return ['nombre', 'email', 'titulo', 'sobre', 'formacion', 'experiencia', 'habilidades'];
  }
  function cvPintar() {
    var datos = cvLeer();
    cvCampos().forEach(function (k) {
      var el = document.getElementById('cv-' + k);
      if (el && datos[k] != null && el.value === '') el.value = datos[k];
    });
    cvPreview();
  }
  function cvRecoger() {
    var out = {};
    cvCampos().forEach(function (k) {
      var el = document.getElementById('cv-' + k);
      if (el) out[k] = el.value;
    });
    return out;
  }
  function cvPreview() {
    var p = document.getElementById('cv-preview');
    if (!p) return;
    var d = cvRecoger();
    var bloque = function (t, v) {
      if (!String(v || '').trim()) return '';
      return '<h4 style="margin:.9rem 0 .3rem;font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:#6D28D9">' + esc(t) + '</h4>'
        + '<p style="margin:0;white-space:pre-wrap;font-size:.88rem">' + esc(v) + '</p>';
    };
    var vacio = !cvCampos().some(function (k) { return String(d[k] || '').trim(); });
    if (vacio) {
      p.innerHTML = '<p style="margin:0;font-size:.86rem;color:#6a6380">Rellena los campos y verás aquí tu currículum. El borrador se guarda solo en este navegador.</p>';
      return;
    }
    p.innerHTML = '<h3 style="margin:0;font-size:1.25rem;color:#241236">' + esc(d.nombre || 'Tu nombre') + '</h3>'
      + (d.titulo ? '<p style="margin:.15rem 0 .4rem;font-size:.95rem;color:#5F4E7C">' + esc(d.titulo) + '</p>' : '')
      + (d.email ? '<p style="margin:0;font-size:.82rem;color:#5F4E7C">' + esc(d.email) + '</p>' : '')
      + bloque('Sobre mí', d.sobre)
      + bloque('Formación', d.formacion)
      + bloque('Experiencia y proyectos', d.experiencia)
      + bloque('Habilidades', d.habilidades);
  }
  function cvGuardar() {
    try {
      localStorage.setItem(CV_KEY, JSON.stringify(cvRecoger()));
      var e = document.getElementById('cv-estado');
      if (e) e.textContent = 'Borrador guardado en este navegador · ' + new Date().toLocaleTimeString('es-ES');
    } catch (err) {
      var e2 = document.getElementById('cv-estado');
      if (e2) e2.textContent = 'No se ha podido guardar el borrador en este navegador.';
    }
  }
  function cvLimpiar() {
    if (!window.confirm('¿Vaciar el borrador de tu currículum? Esta acción no afecta a tu cuenta.')) return;
    try { localStorage.removeItem(CV_KEY); } catch (e) { /* ignore */ }
    cvCampos().forEach(function (k) {
      var el = document.getElementById('cv-' + k);
      if (el) el.value = '';
    });
    cvPreview();
    var e = document.getElementById('cv-estado');
    if (e) e.textContent = 'Borrador vaciado.';
  }

  function accionConvalidar(caminoId) {
    var camino = App.caminos.filter(function (item) { return item.id === caminoId; })[0];
    if (!camino) return;
    var elementosCamino = (camino.etapas || []).reduce(function (all, etapa) { return all.concat(etapa.elementos || []); }, []);
    var convalidables = elementosCamino.filter(function (item) { return item.convalidable; });
    var curso = window.prompt('Escribe el ID del elemento que has completado:\n' + convalidables.map(function (item) { return item.id + ' · ' + item.titulo; }).join('\n'));
    if (!curso) return;
    var referencia = window.prompt('Referencia del certificado o actividad (opcional):') || '';
    return api('caminos', { method: 'POST', body: JSON.stringify({ caminoId: caminoId, cursoId: curso, referencia: referencia }) })
      .then(function () { return api('caminos'); })
      .then(function (data) { App.caminosEstado = data.estado || App.caminosEstado; render(); });
  }

  function accionCuentaJoven(btn) {
    conBoton(btn, 'Preparando contrato…', function () {
      return api('cuenta-joven', { method: 'POST', body: JSON.stringify({ aceptarCashback: true }) }).then(function (data) {
        var url = data && data.solicitud && (data.solicitud.firmaUrl || data.solicitud.url);
        if (!url) throw Object.assign(new Error('firma_no_disponible'), { code: 'firma_no_disponible' });
        window.location.href = url;
      });
    });
  }

  function accionSolicitarBeca() {
    var seleccion = String(document.getElementById('becaElemento').value || '').split('|');
    return api('becas', { method: 'POST', body: JSON.stringify({
      caminoId: seleccion[0], elementoId: seleccion[1],
      indicadores: {
        renta: document.getElementById('becaRenta').value,
        laboral: document.getElementById('becaLaboral').value,
        dependientes: document.getElementById('becaDependientes').value,
        vulnerabilidad: document.getElementById('becaVulnerabilidad').value,
        patrimonio: document.getElementById('becaPatrimonio').value,
        gastos: document.getElementById('becaGastos').value
      },
      documentacion: [document.getElementById('becaDocs').value]
    }) }).then(function (data) { App.becas.unshift(data.beca); render(); });
  }

  /* ── Eventos (delegación) ─────────────────────────────────────────── */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-action]');
    if (!t) return;
    var accion = t.getAttribute('data-action');

    switch (accion) {
      case 'reload': boot(); break;
      case 'alta': accionAlta(t.getAttribute('data-plan'), t); break;
      case 'renovar': accionRenovar(t); break;
      case 'verificar': accionVerificar(t); break;
      case 'cancelar': accionCancelar(t); break;
      case 'logout':
        try { AUTH.clearSession(); } catch (e) { /* ignore */ }
        window.location.href = '../index.html';
        break;
      case 'copiar-key':
        (function (code, btn) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(function () {
              var o = btn.innerHTML;
              btn.innerHTML = '¡Copiada!';
              setTimeout(function () { btn.innerHTML = o; }, 1600);
            });
          }
        })(t.getAttribute('data-code'), t);
        break;
      case 'usar-key': accionUsarKey(t.getAttribute('data-key'), t); break;
      case 'abrir-recompensa':
        App.vista = App.recompensas.filter(function (r) { return String(r.id) === t.getAttribute('data-id'); })[0] || null;
        render();
        var det = document.getElementById('detalleRecompensa');
        if (det) det.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'cerrar-recompensa': App.vista = null; render(); break;
      case 'canjear': accionCanjear(t.getAttribute('data-id'), t); break;
      case 'solicitar-convalidacion': accionConvalidar(t.getAttribute('data-camino')); break;
      case 'cuenta-joven': accionCuentaJoven(t); break;
      case 'interes-proteccion': api('protecciones', { method: 'POST', body: JSON.stringify({ proteccionId: t.getAttribute('data-id') }) }).then(function () { t.textContent = 'Interés registrado'; t.disabled = true; }).catch(function (e) { pintarError(e); }); break;
      case 'filtrar-recompensa':
        App.filtro = t.getAttribute('data-cat');
        actualizarCatalogo();
        break;
      case 'filtrar-formacion':
        App.filtroFormacion = t.getAttribute('data-area');
        var g = document.getElementById('gridFormacion');
        if (g) g.innerHTML = formacionCards(App.filtroFormacion);
        Array.prototype.forEach.call(document.querySelectorAll('#filtrosFormacion .tab'), function (b) {
          b.classList.toggle('is-on', b.getAttribute('data-area') === App.filtroFormacion);
        });
        break;
      case 'cv-guardar': cvGuardar(); break;
      case 'cv-limpiar': cvLimpiar(); break;
      case 'cv-imprimir': window.print(); break;
      case 'toggle-side': toggleSide(); break;
      case 'tema': alternarTema(); break;
    }
  });

  document.addEventListener('change', function (ev) {
    if (ev.target && ev.target.id === 'aceptoRecompensa') {
      var b = ROOT.querySelector('[data-action="canjear"]');
      if (b) b.disabled = !ev.target.checked;
    }
  });

  document.addEventListener('submit', function (ev) {
    if (ev.target && ev.target.id === 'becaForm') {
      ev.preventDefault();
      accionSolicitarBeca().catch(function (error) { pintarError(error); });
    }
  });

  document.addEventListener('input', function (ev) {
    if (!ev.target) return;
    if (ev.target.id === 'buscarRecompensa') {
      App.busqueda = ev.target.value || '';
      actualizarCatalogo();
    }
    if (String(ev.target.id || '').indexOf('cv-') === 0) cvPreview();
  });

  /* ── Tema claro / oscuro ──────────────────────────────────────────── */
  function pintarIconoTema() {
    var t = document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
    var b = document.getElementById('btnTema');
    if (b) {
      b.innerHTML = ico(t === 'oscuro' ? 'sol' : 'luna');
      b.setAttribute('aria-pressed', String(t === 'oscuro'));
      b.setAttribute('title', t === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    }
  }
  function alternarTema() {
    var nuevo = document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'claro' : 'oscuro';
    document.documentElement.setAttribute('data-tema', nuevo);
    try { localStorage.setItem('pjv_tema', nuevo); } catch (e) { /* ignore */ }
    pintarIconoTema();
  }

  /* ── Menú lateral en móvil ────────────────────────────────────────── */
  function toggleSide(force) {
    var side = document.getElementById('side');
    var bd = document.getElementById('sideBackdrop');
    if (!side) return;
    var abrir = typeof force === 'boolean' ? force : !side.classList.contains('is-open');
    side.classList.toggle('is-open', abrir);
    if (bd) bd.classList.toggle('is-open', abrir);
  }
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('#sideToggle')) { toggleSide(); return; }
    if (ev.target.closest('#sideBackdrop')) { toggleSide(false); return; }
    if (ev.target.closest('#side a')) { toggleSide(false); }
  });

  /* ── Render ───────────────────────────────────────────────────────── */
  function render() {
    var fn = PAGINAS[PAGE] || pageInicio;
    var contenido = (App.vista ? '' : '')
      + '<p id="avisoApp" class="alert" hidden></p>'
      + fn()
      + (App.vista ? '' : '');
    ROOT.innerHTML = shellHtml(contenido);

    if (App.vista) {
      var det = document.getElementById('detalleRecompensa');
      if (det) det.innerHTML = detalleRecompensaHtml(App.vista);
    }
    if (PAGE === 'empleo') cvPintar();
    pintarIconoTema();
    window.scrollTo(0, 0);
  }

  /* ── Arranque ─────────────────────────────────────────────────────── */
  async function boot() {
    if (BOOT) BOOT.remove();
    pintarCargando();

    var st;
    try {
      st = await api('status');
    } catch (e) {
      if (e && e.status === 401) {
        try { AUTH.clearSession(); } catch (clearError) { /* ignore */ }
        try {
          var publicPlans = await api('planes');
          App.planes = Array.isArray(publicPlans.planes) ? publicPlans.planes : [];
        } catch (plansError) { App.planes = []; }
        pintarSinSesion();
        return;
      }
      pintarError(e);
      return;
    }
    App.st = st;

    if (st && st.bloqueado) { pintarBloqueado(st); return; }
    if (st && st.requiereAlta) { pintarSinSuscripcion(st); return; }
    if (!st || !st.estado) { pintarSinSuscripcion(st); return; }
    if (st.estado !== 'ACTIVO') { pintarEstadoPendiente(st); return; }

    // Suscripción activa: cargamos el catálogo y pintamos el espacio.
    try {
      var res = await api('recompensas');
      App.recompensas = (res && Array.isArray(res.recompensas)) ? res.recompensas : [];
      App.demo = !!(res && res.demo);
    } catch (e) {
      App.recompensas = [];
      App.demo = false;
      App.catalogError = e;
    }
    try {
      var caminosRes = await api('caminos');
      App.caminos = Array.isArray(caminosRes.caminos) ? caminosRes.caminos : [];
      App.caminosEstado = caminosRes.estado || App.caminosEstado;
    } catch (e) {
      App.caminos = [];
    }
    try {
      var proteccionesRes = await api('protecciones');
      App.protecciones = Array.isArray(proteccionesRes.protecciones) ? proteccionesRes.protecciones : [];
    } catch (e) { App.protecciones = []; }
    try {
      var becasRes = await api('becas');
      App.becas = Array.isArray(becasRes.becas) ? becasRes.becas : [];
    } catch (e) { App.becas = []; }
    render();

    if (new URLSearchParams(window.location.search).get('pago') === 'ok') {
      setTimeout(function () { accionVerificar(null); }, 1200);
    }
  }

  // Sin sesión: no llamamos a la API, mostramos la puerta de acceso.
  (function init() {
    var ses = null;
    try { ses = AUTH ? AUTH.getSession() : null; } catch (e) { ses = null; }
    if (!ses || !ses.token) {
      api('planes').then(function (data) {
        App.planes = Array.isArray(data.planes) ? data.planes : [];
      }).catch(function () {
        App.planes = [];
      }).then(function () {
        if (BOOT) BOOT.remove();
        pintarSinSesion();
      });
      return;
    }
    boot();
  })();
})();
