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
    becas: [],
    actividades: [],
    actividadesEstado: [],
    run: null,           // actividad en curso (dentro del camino)
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
    { id: 'miplaceta', label: 'Mi Placeta', icon: 'coin', href: 'miplaceta.html' },
    { id: 'rutas', label: 'Caminos', icon: 'route', href: 'rutas.html', grupo: 'Formación' },
    { id: 'becas', label: 'Becas', icon: 'gift', href: 'becas.html' },
    { id: 'beneficios', label: 'Beneficios', icon: 'pad', href: 'beneficios.html', grupo: 'Ventajas' },
    { id: 'empleo', label: 'Empleo y futuro', icon: 'brief', href: 'empleo.html', soon: true, grupo: 'Más' },
    { id: 'comunidad', label: 'Comunidad', icon: 'users', href: 'comunidad.html', soon: true }
  ];
  var TITULOS = {
    inicio: 'Inicio', formacion: 'Caminos', empleo: 'Empleo y futuro',
    beneficios: 'Beneficios', becas: 'Becas', miplaceta: 'Mi Placeta', rutas: 'Caminos', comunidad: 'Comunidad'
  };

  /* ── Datos de contenido (catálogos propios de la interfaz) ────────── */

  // La formación vive en los caminos: sus elementos vienen de la API
  // (/api/caminos) y de PlacetaEDU. No hay catálogo local de cursos sueltos.

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

  /* ── Armazón: cabecera de plataforma ──────────────────────────────────
     Placeta Joven se navega como una plataforma (cabecera arriba y contenido
     a lo ancho), no como un panel de trabajo con barra lateral. */
  function navItems(clase, soloPronto) {
    var items = '';
    NAV.forEach(function (n) {
      if (soloPronto === true && !n.soon) return;
      if (soloPronto === false && n.soon) return;
      items += '<a class="' + clase + '-item' + (n.id === PAGE ? ' is-on' : '') + '" href="' + n.href + '"'
        + (n.id === PAGE ? ' aria-current="page"' : '') + '>' + ico(n.icon)
        + '<span>' + esc(n.label) + '</span>'
        + (n.soon ? '<i class="soon">Pronto</i>' : '') + '</a>';
    });
    return items;
  }

  function headerHtml() {
    var nombre = nombreUsuario();
    var saldo = saldoPz();
    var plan = (App.st && App.st.planInfo && App.st.planInfo.etiqueta) || 'Placeta Joven';
    var primerNombre = (nombre || 'Joven').split(/\s+/)[0];
    return '<header class="topbar" id="topbar">'
      + '<div class="topbar-in">'
      + '<a class="brand" href="inicio.html" aria-label="Placeta Joven">'
      + '<img src="../img/jovenlogo.png" alt="" />'
      + '<span class="brand-txt"><b>Placeta Joven</b><span>' + esc(TITULOS[PAGE] || 'Inicio') + '</span></span></a>'
      + '<nav class="topnav" aria-label="Secciones">' + navItems('topnav', false)
      + '<div class="moremenu">'
      + '<button class="topnav-item" type="button" data-action="menu-mas" aria-expanded="false" aria-controls="masPanel">'
      + ico('spark') + '<span>Más</span>' + ico('down') + '</button>'
      + '<div class="usermenu-panel" id="masPanel" hidden>' + navItems('usermenu', true) + '</div>'
      + '</div></nav>'
      + '<div class="topbar-r">'
      + '<span class="pz-pill" title="' + (saldo === null ? 'Tu Cuenta Joven de Banco de La Placeta guarda el saldo en Placetas' : 'Saldo de tu Cuenta Joven · Banco de La Placeta') + '">'
      + ico('coin') + (saldo === null ? '—' : num(saldo)) + '<small>PZ</small></span>'
      + '<div class="usermenu">'
      + '<button class="user" type="button" data-action="menu-usuario" aria-expanded="false" aria-controls="userPanel">'
      + '<span class="user-ava">' + esc(iniciales(nombre)) + '</span>'
      + '<span class="user-txt"><b>' + esc(primerNombre) + '</b><span>' + esc(plan) + '</span></span>'
      + ico('down') + '</button>'
      + '<div class="usermenu-panel" id="userPanel" hidden>'
      + '<a href="miplaceta.html">' + ico('coin') + 'Mi Placeta</a>'
      + '<a href="rutas.html">' + ico('route') + 'Mis caminos</a>'
      + '<a href="becas.html">' + ico('gift') + 'Mis becas</a>'
      + '<a href="../index.html">' + ico('home') + 'Web pública</a>'
      + '<a href="mailto:joven@laplaceta.org">' + ico('file') + 'Ayuda</a>'
      + '<button type="button" data-action="logout" class="is-danger">' + ico('out') + 'Cerrar sesión</button>'
      + '</div></div>'
      + '<button class="icon-btn" id="navToggle" type="button" aria-label="Abrir menú" aria-controls="navDrawer" aria-expanded="false">' + ico('menu') + '</button>'
      + '</div></div>'
      + '<nav class="navdrawer" id="navDrawer" aria-label="Secciones" hidden>' + navItems('navdrawer') + '</nav>'      + '</header>';
  }

  function plural(n, singular, prural) { return Number(n) === 1 ? singular : (prural || singular + 's'); }
  function pasos(n) { return n + ' ' + plural(n, 'paso'); }
  function elementos(n) { return n + ' ' + plural(n, 'elemento'); }

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
    return '<div class="shell">' + headerHtml()
      + '<main class="app-body" id="main">' + contenido + '</main>'
      + '<footer class="app-foot">'
      + '<span><b>Placeta Joven</b> · programa joven de La Placeta</span>'
      + '<span><a href="../index.html">Web pública</a> · <a href="mailto:joven@laplaceta.org">joven@laplaceta.org</a></span>'
      + '</footer>'
      + '</div>';
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

    var progresos = (App.caminosEstado.progreso || []).slice().sort(function (a, b) { return b.porcentaje - a.porcentaje; });
    var progreso = progresos[0];
    var caminoActual = progreso ? App.caminos.filter(function (c) { return c.id === progreso.caminoId; })[0] : null;
    var becasPendientes = (App.becas || []).filter(function (b) { return b.estado === 'PENDIENTE'; });

    var html = ''
      + '<div class="page page-home">'
      + '<div class="page-head"><div class="page-head-txt">'
      + '<h1>Hola, ' + esc(prim) + '</h1>'
      + '<p>' + (activa ? 'Esto es lo que tienes ahora.' : 'Tu programa no está activo.') + '</p>'
      + '</div></div>';

    /* Dos datos y una acción: el resto vive en sus secciones */
    html += '<div class="home-top">'
      + '<div class="home-card">'
      + '<span class="home-k">Saldo</span>'
      + '<b class="home-num">' + (saldo === null ? '—' : num(saldo)) + ' <small>Pz</small></b>'
      + '<a class="home-link" href="miplaceta.html">Movimientos y Cuenta Joven ' + ico('arrow') + '</a>'
      + '</div>'
      + '<div class="home-card">'
      + '<span class="home-k">Tu camino</span>'
      + (caminoActual
        ? '<b class="home-title">' + esc(caminoActual.nombre) + '</b>'
          + '<div class="pbar"><i style="width:' + (progreso.porcentaje || 0) + '%"></i></div>'
          + '<div class="pbar-meta"><span>' + progreso.completados + ' de ' + progreso.total + '</span><b>' + (progreso.porcentaje || 0) + ' %</b></div>'
          + '<a class="btn btn-primary btn-sm" href="rutas.html?camino=' + encodeURIComponent(caminoActual.id) + '">Continuar</a>'
        : '<b class="home-title">Elige un camino</b>'
          + '<p class="fine">Todavía no has empezado ninguno.</p>'
          + '<a class="btn btn-primary btn-sm" href="rutas.html">Ver caminos</a>')
      + '</div>'
      + '</div>';

    /* Accesos directos: cuatro filas, sin duplicar información */
    html += '<section class="pnl home-links">'
      + '<div class="pnl-head"><span class="card-ico">' + ico('spark') + '</span>'
      + '<div><h2>Para ti</h2><p>Solo lo que puedes usar ahora.</p></div></div>'
      + '<a class="row" href="rutas.html"><span class="row-ico">' + ico('route') + '</span>'
      + '<div class="row-txt"><b>Caminos formativos</b><span>' + (App.caminos.length ? App.caminos.length + ' caminos disponibles' : 'Elige tu objetivo') + '</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '<a class="row" href="beneficios.html"><span class="row-ico cyan">' + ico('pad') + '</span>'
      + '<div class="row-txt"><b>Beneficios y claves</b><span>' + (App.recompensas.length ? App.recompensas.length + ' en el catálogo' : 'Catálogo de estudios indie') + '</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '<a class="row" href="becas.html"><span class="row-ico mint">' + ico('gift') + '</span>'
      + '<div class="row-txt"><b>Becas</b><span>' + (becasPendientes.length ? becasPendientes.length + ' solicitud pendiente' : 'Pide beca desde cualquier elemento') + '</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '<a class="row" href="miplaceta.html"><span class="row-ico">' + ico('key') + '</span>'
      + '<div class="row-txt"><b>Mis claves</b><span>' + (keys.length ? keys.length + ' conseguidas' : 'Todavía no tienes ninguna') + '</span></div>'
      + '<span class="row-go">' + ico('arrow') + '</span></a>'
      + '</section>'
      + '</div>';
    return html;
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
  /* Tesorería: las ventas entran en la cuenta business de Placeta Joven y de
     ahí salen las recompensas. Placeta Joven solo registra la orden: mueve el
     Banco. Sin cuenta configurada no se inventa ningún saldo. */
  function panelTesoreria() {
    var t = (App.st && App.st.tesoreria) || null;
    if (!t) return '';
    var ordenes = t.ordenesPendientes || [];
    return '<section class="pnl">'
      + '<div class="pnl-head"><span class="card-ico cyan">' + ico('coin') + '</span>'
      + '<div><h2>Órdenes al Banco</h2><p>Recompensas que has ganado y aún no se han liquidado.</p></div>'
      + (t.totalPendientePz ? '<span class="tag tag-mint pnl-act">+' + num(t.totalPendientePz) + ' Pz</span>' : '')
      + '</div>'
      + (ordenes.length
          ? ordenes.map(function (o) {
              return '<div class="row"><span class="row-ico cyan">' + ico('clock') + '</span><div class="row-txt"><b>' + esc(o.actividad || o.concepto || 'Recompensa') + '</b><span>Pendiente de confirmar por el Banco</span></div>'
                + '<span class="row-val plus">+' + num(Number(o.recompensaPz || 0) + Number(o.bonusPz || 0)) + '</span></div>';
            }).join('')
          : '<div class="row"><span class="row-ico">' + ico('check') + '</span><div class="row-txt"><b>Nada pendiente</b><span>Todo lo que has ganado está liquidado</span></div></div>')
      + (t.aviso ? '<p class="fine">' + esc(t.aviso) + '</p>' : '')
      + '</section>';
  }

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

      + panelTesoreria()

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

  function pageBecas() {
    var historial = App.becas || [];
    var html = '<div class="page">' + pageHead('Becas', 'Solicítalas desde el elemento formativo. RSP aporta tus valores y aquí guardamos el expediente.', '<span class="tag tag-cyan">Solicitud clara</span>')
      + '<section class="pnl"><div class="pnl-head"><span class="card-ico">' + ico('file') + '</span><div><h2>Mi historial</h2><p>Verás qué se ha aceptado o denegado y por qué.</p></div></div>'
      + (historial.length ? historial.map(function (b) { return '<article class="row"><span class="row-ico ' + (b.estado === 'ACEPTADA' ? 'ok' : (b.estado === 'DENEGADA' ? 'warn' : 'cyan')) + '">' + ico(b.estado === 'ACEPTADA' ? 'check' : 'file') + '</span><div class="row-txt"><b>' + esc(b.elemento) + '</b><span>' + esc(b.estado) + ' · INB ' + b.inb + ' · beca aplicada ' + b.porcentajeAplicado + '%</span><span>' + (b.motivo ? esc(b.motivo) : 'Pendiente de revisión') + '</span></div></article>'; }).join('') : '<div class="empty"><b>Aún no tienes solicitudes</b><p>Cuando envíes una, quedará guardada con todos sus datos.</p></div>') + '</section></div>';
    return html;
  }

  /* ── Actividades: se hacen dentro del camino, paso a paso ─────────── */
  var TIPOS_TXT = {
    test: 'Elige una opción',
    verdadero_falso: 'Verdadero o falso',
    escrita: 'Respuesta corta',
    ordenar: 'Ordena los pasos',
    relacionar: 'Relaciona cada elemento',
    sql: 'Escribe la consulta',
    excel: 'Escribe la fórmula'
  };

  function actividadPorId(id) {
    return (App.actividades || []).filter(function (a) { return a.id === id; })[0] || null;
  }
  function estadoActividad(id) {
    return (App.actividadesEstado || []).filter(function (e) { return e.actividadId === id; })[0] || null;
  }
  function puntosRun() {
    var t = 0;
    Object.keys(App.run.hechos).forEach(function (k) { t += Number(App.run.hechos[k].obtenidos || 0); });
    return t;
  }
  function maxRun() {
    return App.run.a.ejercicios.reduce(function (s, e) { return s + Number(e.puntos || 0); }, 0);
  }
  function abrirActividad(actividadId, caminoId, elementoId) {
    var a = actividadPorId(actividadId);
    if (!a) { avisoApp('alert err', ico('alert') + '<span>Esa actividad no está disponible ahora mismo.</span>'); return; }
    App.run = { a: a, caminoId: caminoId || null, elementoId: elementoId || null, paso: 0, respuestas: {}, hechos: {}, fb: null, final: null, sel: null };
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function pintarRun() {
    var host = document.getElementById('lrHost');
    if (!host) { var y = window.scrollY; render(); window.scrollTo(0, y); return; }
    host.innerHTML = runnerContenido();
    var campo = document.getElementById('lrCampo');
    if (campo && !campo.disabled) campo.focus();
  }
  function runnerActividad() {
    return '<div class="page" id="lrHost">' + runnerContenido() + '</div>';
  }

  function runnerContenido() {
    var r = App.run, a = r.a;
    var total = a.ejercicios.length;
    var camino = (App.caminos || []).filter(function (c) { return c.id === r.caminoId; })[0];
    var intento = estadoActividad(a.id);

    var html = pageHead(a.titulo, (camino ? '<a href="rutas.html?camino=' + esc(camino.id) + '">' + esc(camino.nombre) + '</a> · ' : '') + esc(a.categoria) + ' · ' + a.minutos + ' min',
        '<button class="btn btn-ghost btn-sm" type="button" data-action="cerrar-actividad">Salir</button>')
      + '<div class="lr-top"><div class="lr-steps">'
      + a.ejercicios.map(function (e, i) {
          var h = r.hechos[e.id];
          return '<span class="lr-dot' + (h ? (h.ok ? ' ok' : ' bad') : (i === r.paso && !r.final ? ' now' : '')) + '"></span>';
        }).join('')
      + '</div><div class="pbar-meta"><span>' + (r.final ? 'Actividad terminada' : 'Ejercicio ' + (r.paso + 1) + ' de ' + total) + '</span>'
      + '<b>' + puntosRun() + ' / ' + maxRun() + ' puntos</b></div></div>';

    if (r.final) return html + panelResultado();

    var e = a.ejercicios[r.paso];
    var fb = r.fb;
    html += '<section class="pnl lr ' + (fb ? '' : 'lr-in') + '" key="' + r.paso + '">'
      + '<div class="lr-tipo">' + esc(TIPOS_TXT[e.tipo] || e.tipo) + '<span>' + e.puntos + ' pts</span></div>'
      + '<h2 class="lr-ask">' + esc(e.enunciado) + '</h2>'
      + figuraEjercicio(e.imagen)
      + cuerpoEjercicio(e)
      + (fb ? '<div class="lr-fb ' + (fb.ok ? 'ok' : 'bad') + '">' + ico(fb.ok ? 'check' : 'alert') + '<span>' + (fb.ok ? '<b>¡Correcto!</b> +' + fb.obtenidos + ' puntos' : '<b>No es correcto.</b> Verás la respuesta en el repaso final.') + '</span></div>' : '')
      + '<div class="lr-act">'
      + (intento && intento.completada ? '<span class="lr-hint lr-act-nota">' + ico('check') + 'Ya la superaste con ' + intento.mejorPorcentaje + '%</span>' : '')
      + (fb
          ? '<button class="btn btn-primary" type="button" data-action="lr-paso">' + (r.paso + 1 >= total ? 'Ver mi resultado' : 'Siguiente ejercicio') + '<kbd>Intro</kbd></button>'
          : (cuerpoEjercicioAuto(e) ? '' : '<button class="btn btn-primary" type="button" data-action="lr-comprobar">Comprobar<kbd>Intro</kbd></button>'))
      + '</div></section>';
    return html;
  }

  // Los tipos de opción única se corrigen al pulsar; el resto necesitan el botón.
  function cuerpoEjercicioAuto(e) { return e.tipo === 'test' || e.tipo === 'verdadero_falso'; }

  function cuerpoEjercicio(e) {
    var r = App.run;
    var resp = r.respuestas[e.id];
    var fb = r.fb;
    var bloque = fb && fb.ejercicioId === e.id;

    if (cuerpoEjercicioAuto(e)) {
      var opciones = e.tipo === 'test' ? (e.opciones || []) : ['Verdadero', 'Falso'];
      var elegido = e.tipo === 'test' ? Number(resp) : (resp === true ? 0 : (resp === false ? 1 : NaN));
      return '<div class="lr-opts">' + opciones.map(function (o, idx) {
        var on = elegido === idx;
        var cls = on && bloque ? (fb.ok ? ' is-ok' : ' is-bad') : (on ? ' is-on' : '');
        return '<button class="lr-opt' + cls + '" type="button" data-action="lr-opcion" data-idx="' + idx + '"' + (fb ? ' disabled' : '') + '>'
          + '<span class="lr-opt-key">' + esc(teclaLibre(idx)) + '</span><span class="lr-opt-txt">' + esc(o) + '</span>'
          + (on && bloque ? '<span class="lr-opt-mark">' + ico(fb.ok ? 'check' : 'x') + '</span>' : '') + '</button>';
      }).join('') + '</div>'
        + (fb ? '' : '<p class="lr-hint lr-kbd">Elige con el ratón o pulsa <kbd>' + esc(teclaLibre(0)) + '</kbd>–<kbd>' + esc(teclaLibre(opciones.length - 1)) + '</kbd></p>');
    }

    if (e.tipo === 'ordenar') {
      var orden = Array.isArray(resp) ? resp : [];
      var hechos = orden.length === (e.elementos || []).length;
      return '<div class="lr-toolbar"><span class="lr-hint">' + (hechos ? 'Revisa el orden y comprueba.' : 'Pulsa los pasos en orden de arriba a abajo.') + '</span>'
        + (orden.length && !fb ? '<button class="lr-mini" type="button" data-action="lr-vaciar">Vaciar</button>' : '') + '</div>'
        + '<ol class="lr-seq' + (orden.length ? '' : ' is-empty') + '">' + (orden.length ? orden.map(function (orig, pos) {
            return '<li class="lr-step"><span class="lr-num">' + (pos + 1) + '</span><span class="lr-step-txt">' + esc(e.elementos[orig]) + '</span>'
              + (fb ? '' : '<span class="lr-step-act">'
                + '<button class="lr-mini" type="button" data-action="lr-mover" data-pos="' + pos + '" data-dir="-1" title="Subir" aria-label="Subir"' + (pos === 0 ? ' disabled' : '') + '>↑</button>'
                + '<button class="lr-mini" type="button" data-action="lr-mover" data-pos="' + pos + '" data-dir="1" title="Bajar" aria-label="Bajar"' + (pos === orden.length - 1 ? ' disabled' : '') + '>↓</button>'
                + '<button class="lr-mini" type="button" data-action="lr-quitar" data-pos="' + pos + '" title="Quitar" aria-label="Quitar">×</button>'
                + '</span>') + '</li>';
          }).join('') : '<li class="lr-hint">Tu orden aparecerá aquí…</li>') + '</ol>'
        + '<div class="lr-pool">' + (e.elementos || []).map(function (el, idx) {
            var usado = orden.indexOf(idx) >= 0;
            return '<button class="lr-chip' + (usado ? ' is-used' : '') + '" type="button" data-action="lr-poner" data-idx="' + idx + '"' + (fb || usado ? ' disabled' : '') + '>' + esc(el) + '</button>';
          }).join('') + '</div>';
    }

    if (e.tipo === 'relacionar') {
      var izquierda = e.izquierda || [];
      var derecha = e.derecha || [];
      var mapa = (resp && typeof resp === 'object' && !Array.isArray(resp)) ? resp : {};
      var mezcla = 'mezcla-' + e.id;
      if (!r[mezcla]) {
        r[mezcla] = derecha.map(function (_, i) { return i; });
        for (var k = r[mezcla].length - 1; k > 0; k--) {
          var j = Math.floor(Math.random() * (k + 1));
          var tmp = r[mezcla][k]; r[mezcla][k] = r[mezcla][j]; r[mezcla][j] = tmp;
        }
      }
      var usados = Object.keys(mapa).map(function (cl) { return mapa[cl]; });
      return '<div class="lr-toolbar"><span class="lr-hint">' + (r.sel ? 'Ahora elige con qué se relaciona «' + esc(r.sel) + '».' : 'Pulsa un elemento de la izquierda y luego su pareja.') + '</span>'
        + (Object.keys(mapa).length && !fb ? '<button class="lr-mini" type="button" data-action="lr-vaciar">Vaciar</button>' : '') + '</div>'
        + '<div class="lr-pairs">' + izquierda.map(function (izq) {
            var dado = mapa[izq];
            var cls = r.sel === izq ? ' is-on' : (dado ? ' is-ok' : '');
            return '<button class="lr-opt' + cls + '" type="button" data-action="lr-izq" data-izq="' + esc(izq) + '"' + (fb ? ' disabled' : '') + '>'
              + '<span class="lr-opt-txt">' + esc(izq) + '</span>'
              + '<span class="lr-opt-side">' + (dado ? esc(dado) : '—') + '</span></button>';
          }).join('') + '</div>'
        + '<div class="lr-pool">' + r[mezcla].map(function (i) {
            var usado = usados.indexOf(derecha[i]) >= 0;
            return '<button class="lr-chip' + (usado ? ' is-used' : '') + '" type="button" data-action="lr-der" data-val="' + esc(derecha[i]) + '"' + (fb || usado || !r.sel ? ' disabled' : '') + '>' + esc(derecha[i]) + '</button>';
          }).join('') + '</div>';
    }

    return '<input class="lr-field' + (e.tipo === 'sql' || e.tipo === 'excel' ? ' mono' : '') + '" id="lrCampo" type="text" autocomplete="off" spellcheck="false"'
      + ' placeholder="' + (e.tipo === 'sql' ? 'SELECT … FROM …' : (e.tipo === 'excel' ? '=B2*C2' : 'Escribe tu respuesta')) + '"'
      + ' value="' + esc(resp == null ? '' : resp) + '"' + (fb ? ' disabled' : '') + ' />'
      + (!fb && e.tipo === 'escrita' ? '<p class="lr-hint">No hace falta copiar la respuesta exacta: no cuenta el acento ni una errata leve.</p>' : '')
      + (e.pista && !fb ? '<p class="lr-hint">' + ico('spark') + ' ' + esc(e.pista) + '</p>' : '');
  }

  function teclaLibre(idx) {
    if (idx < 9) return String(idx + 1);
    return String.fromCharCode(65 + idx - 9);
  }

  /* Las figuras son dibujos nuestros: public/js/senales.js guarda el trazado y
     su fuente. Durante la pregunta solo se enseña el dibujo y de dónde sale:
     el nombre de la señal es la respuesta, así que aparece al corregir. */
  function figuraEjercicio(imagen) {
    if (!imagen || !imagen.dibujo) return '';
    var S = window.Senales;
    if (!S || !S.existe(imagen.dibujo)) return '';
    return '<figure class="lr-fig">' + S.svg(imagen.dibujo, imagen)
      + '<figcaption><span class="lr-fuente">Fuente: ' + esc(S.fuente(imagen.dibujo)) + '</span></figcaption></figure>';
  }

  /* Miniatura y nombre para el repaso final, que ya no puede destripar nada. */
  function figuraMini(imagen) {
    if (!imagen || !imagen.dibujo) return '';
    var S = window.Senales;
    if (!S || !S.existe(imagen.dibujo)) return '';
    return '<span class="lr-rev-fig" title="' + esc(S.leyenda(imagen.dibujo)) + '">' + S.svg(imagen.dibujo, imagen) + '</span>';
  }
  function nombreFigura(imagen) {
    if (!imagen || !imagen.dibujo) return '';
    var S = window.Senales;
    if (!S || !S.existe(imagen.dibujo)) return '';
    return '<span class="lr-rev-fig-name">' + esc(S.leyenda(imagen.dibujo)) + '</span>';
  }

  function puedeComprobar(e) {
    var resp = App.run.respuestas[e.id];
    if (cuerpoEjercicioAuto(e)) return resp != null;
    if (e.tipo === 'ordenar') return Array.isArray(resp) && resp.length === (e.elementos || []).length;
    if (e.tipo === 'relacionar') return resp && Object.keys(resp).length === (e.izquierda || []).length;
    return Boolean(String(resp == null ? '' : resp).trim());
  }

  function comprobarPaso() {
    var r = App.run, e = r.a.ejercicios[r.paso];
    if (!puedeComprobar(e)) { avisoApp('alert warn', ico('alert') + '<span>' + (cuerpoEjercicioAuto(e) ? 'Elige una opción.' : 'Completa el ejercicio antes de comprobar.') + '</span>'); return Promise.resolve(); }
    return api('actividades', { method: 'POST', body: JSON.stringify({ accion: 'comprobar', actividadId: r.a.id, ejercicioId: e.id, respuesta: r.respuestas[e.id] }) })
      .then(function (data) {
        r.hechos[e.id] = data.comprobacion;
        r.fb = data.comprobacion;
        pintarRun();
      })
      .catch(function () { avisoApp('alert err', ico('alert') + '<span>No hemos podido comprobar el ejercicio. Reinténtalo.</span>'); });
  }

  function avanzarPaso() {
    var r = App.run;
    r.fb = null;
    r.sel = null;
    if (r.paso + 1 >= r.a.ejercicios.length) return terminarActividad();
    r.paso += 1;
    pintarRun();
    return Promise.resolve();
  }

  function terminarActividad() {
    var r = App.run;
    return api('actividades', { method: 'POST', body: JSON.stringify({ actividadId: r.a.id, respuestas: r.respuestas }) })
      .then(function (data) {
        r.final = data;
        return Promise.all([
          api('actividades').then(function (res) {
            App.actividadesEstado = res.estado || [];
            App.actividades = Array.isArray(res.actividades) ? res.actividades : App.actividades;
          }),
          api('caminos').then(function (res) {
            App.caminos = Array.isArray(res.caminos) ? res.caminos : App.caminos;
            App.caminosEstado = res.estado || App.caminosEstado;
          })
        ]);
      })
      .then(function () { pintarRun(); window.scrollTo({ top: 0, behavior: 'smooth' }); })
      .catch(function (error) {
        if (error && error.code === 'sin_intentos') { avisoApp('alert warn', ico('alert') + '<span>Has agotado los intentos de esta actividad.</span>'); return; }
        avisoApp('alert err', ico('alert') + '<span>No hemos podido corregir la actividad. Reinténtalo.</span>');
      });
  }

  function textoSolucion(e) {
    if (e.tipo === 'test') return (e.opciones || [])[Number(e.correcta)] || '';
    if (e.tipo === 'verdadero_falso') return e.correcta ? 'Verdadero' : 'Falso';
    if (e.tipo === 'ordenar') return (e.correcta || []).map(function (i) { return (e.elementos || [])[i]; }).join(' → ');
    if (e.tipo === 'relacionar') return (e.pares || []).map(function (p) { return p[0] + ' → ' + p[1]; }).join(' · ');
    return e.solucion || '';
  }

  // Traduce la respuesta cruda del usuario a algo legible para el repaso.
  function textoRespuesta(e, dada) {
    if (dada == null || dada === '') return null;
    if (e.tipo === 'test') return (e.opciones || [])[Number(dada)] || null;
    if (e.tipo === 'verdadero_falso') return dada === true || dada === 'true' ? 'Verdadero' : 'Falso';
    if (e.tipo === 'ordenar') {
      var arr = Array.isArray(dada) ? dada : [];
      if (!arr.length || arr.length !== (e.elementos || []).length) return arr.length ? arr.map(function (i) { return e.elementos[i]; }).join(' → ') : null;
      return arr.map(function (i) { return e.elementos[i]; }).join(' → ');
    }
    if (e.tipo === 'relacionar') {
      var claves = Object.keys(dada || {});
      return claves.length ? claves.map(function (k) { return k + ' → ' + dada[k]; }).join(' · ') : null;
    }
    return String(dada);
  }

  function panelResultado() {
    var r = App.run, f = r.final, res = f.resultado;
    var revision = f.revision || [];
    var premio = Number(f.recompensaPendiente || 0) + Number(f.bonusPendiente || 0);
    var camino = (App.caminos || []).filter(function (c) { return c.id === r.caminoId; })[0];
    var html = '<section class="pnl lr-pop"><div class="pnl-head"><span class="card-ico ' + (res.aprobado ? 'mint' : 'amber') + '">' + ico(res.aprobado ? 'check' : 'alert') + '</span>'
      + '<div><h2>' + (res.aprobado ? '¡Actividad superada!' : 'Todavía no llega al mínimo') + '</h2><p>' + (res.aprobado ? 'Has superado el mínimo de ' + (r.a.evaluacion.minimo || 0) + '%.' : 'Necesitas un ' + (r.a.evaluacion.minimo || 0) + '% para superarla.') + '</p></div></div>'
      + '<div class="lr-score">' + res.porcentaje + '<small>% · ' + res.obtenidos + ' de ' + res.maximo + ' puntos</small></div>'
      + '<div class="pbar" style="margin:1rem 0 .35rem"><i style="width:' + res.porcentaje + '%"></i></div>'
      + '<div class="pbar-meta"><span>Intentos usados: ' + res.intentos + ' de ' + res.limite + '</span><b>' + (res.penalizacion ? 'Penalización −' + res.penalizacion + ' puntos' : 'Sin penalización') + '</b></div>';
    if (premio) html += '<p class="alert ok" style="margin-top:1rem">' + ico('coin') + '<span><b>+' + num(premio) + ' Pz</b> enviados al Banco de La Placeta como orden pendiente. La actividad no crea Placetas por sí misma.</span></p>';
    else if (res.aprobado) html += '<p class="alert" style="margin-top:1rem">' + ico('coin') + '<span>Esta actividad ya estaba superada, así que no genera una recompensa nueva.</span></p>';
    if (revision.length) {
      html += '<h3 class="lr-rev-title">Repaso del intento</h3><div class="lr-rev">' + revision.map(function (e) {
        var dado = textoRespuesta(e, e.dada);
        return '<div class="lr-rev-row' + (e.ok ? ' is-ok' : '') + '">' + figuraMini(e.imagen) + '<span class="lr-rev-mark">' + ico(e.ok ? 'check' : 'x') + '</span><div class="lr-rev-txt"><b>' + esc(e.enunciado) + '</b>'
          + nombreFigura(e.imagen)
          + (e.ok ? '<span class="lr-rev-good">Correcto</span>' : '')
          + (!e.ok && dado ? '<span class="lr-rev-bad">Tu respuesta: ' + esc(dado) + '</span>' : '')
          + (!e.ok ? '<span class="lr-rev-good">Correcta: ' + esc(textoSolucion(e) || '—') + '</span>' : '')
          + (!e.ok && !dado ? '<span class="lr-rev-bad">Sin responder</span>' : '') + '</div></div>';
      }).join('') + '</div>';
    }
    html += '<div class="lr-act">'
      + (camino ? '<button class="btn btn-ghost" type="button" data-action="lr-volver-camino" data-camino="' + esc(camino.id) + '">Volver al camino</button>' : '')
      + (!res.aprobado && res.intentos < res.limite ? '<button class="btn btn-primary" type="button" data-action="lr-reintentar">Reintentar</button>' : '')
      + '</div></section>';
    return html;
  }

  /* ── Rutas ────────────────────────────────────────────────────────── */
  function pageRutas() {
    if (App.run) return runnerActividad();
    var rutas = App.caminos;
    var progreso = App.caminosEstado.progreso || [];
    var pedido = new URLSearchParams(window.location.search).get('camino');
    if (pedido && !App.caminoSeleccionado) {
      App.caminoSeleccionado = App.caminos.filter(function (item) { return item.id === pedido; })[0] || null;
    }
    if (App.caminoSeleccionado) return detalleCamino(App.caminoSeleccionado);
    var html = '<div class="page">'
      + pageHead('Caminos formativos', 'Elige una meta. El camino ordena cursos, actividades y proyectos sin duplicarlos.', '<span class="tag tag-cyan">' + rutas.length + ' disponibles</span>');

    html += '<div class="grid g-3">' + rutas.map(tarjetaCamino).join('') + '</div>';

    html += '<section class="pnl" style="margin-top:1rem"><div class="pnl-head"><span class="card-ico">' + ico('check') + '</span><div><h2>Convalidaciones</h2><p>Las revisa el equipo antes de conceder la recompensa.</p></div></div>' + ((App.caminosEstado.convalidaciones || []).length ? App.caminosEstado.convalidaciones.map(function (s) { return '<div class="row"><span class="row-ico warn">' + ico('clock') + '</span><div class="row-txt"><b>' + esc(s.curso) + '</b><span>' + esc(s.proveedor) + ' · ' + esc(s.estado) + '</span></div></div>'; }).join('') : '<div class="empty"><b>Aún no tienes solicitudes</b><p>Presenta un curso externo y adjunta una referencia o certificado.</p></div>') + '</section>'
      + '</div>';
    return html;
  }

  /* Tarjeta de camino: qué es, cuánto llevas y cuál es el siguiente paso. */
  function tarjetaCamino(r) {
    var progreso = (App.caminosEstado.progreso || []).filter(function (item) { return item.caminoId === r.id; })[0] || { completados: 0, total: 0, porcentaje: 0, elementos: [] };
    var estados = progreso.elementos || [];
    var etapas = (r.etapas || []).filter(function (e) { return e && e.elementos; });
    var hechos = estados.filter(function (e) { return e.estado === 'COMPLETADO'; }).length;
    var empezado = hechos > 0;

    var pasos = etapas.map(function (etapa, i) {
      var ids = (etapa.elementos || []).filter(function (el) { return el && el.tipo !== 'recurso'; }).map(function (el) { return el.id; });
      var hechosEtapa = ids.filter(function (id) {
        var st = estados.filter(function (e) { return e.id === id; })[0];
        return st && st.estado === 'COMPLETADO';
      }).length;
      var enCurso = ids.some(function (id) {
        var st = estados.filter(function (e) { return e.id === id; })[0];
        return st && st.estado === 'DISPONIBLE';
      });
      var completo = ids.length > 0 && hechosEtapa === ids.length;
      return '<li class="ps' + (completo ? ' is-done' : (enCurso ? ' is-now' : '')) + '">'
        + '<span class="ps-num">' + (completo ? ico('check') : (i + 1)) + '</span>'
        + '<span class="ps-name">' + esc(etapa.nombre) + '</span>'
        + '<span class="ps-count">' + (completo ? 'Hecho' : hechosEtapa + '/' + ids.length) + '</span></li>';
    }).join('');

    return '<article class="pathway' + (empezado ? ' is-started' : '') + '">'
      + '<header class="pathway-h">'
      + '<span class="pathway-ico">' + ico('route') + '</span>'
      + '<div class="pathway-h-txt"><h3>' + esc(r.nombre) + '</h3><p>' + esc(r.descripcion || '') + '</p></div>'
      + '</header>'
      + '<div class="pathway-tags">'
      + '<span class="tag">' + esc(r.nivel || 'Ruta') + '</span>'
      + '<span class="tag">' + pasos2(progreso.total) + '</span>'
      + (r.recompensaFinal ? '<span class="tag tag-mint">+' + num(r.recompensaFinal) + ' Pz al completar</span>' : '')
      + '</div>'
      + '<div class="pathway-prog">'
      + '<div class="pbar"><i style="width:' + progreso.porcentaje + '%"></i></div>'
      + '<div class="pbar-meta"><span>' + hechos + ' de ' + progreso.total + ' hechos</span><b>' + progreso.porcentaje + ' %</b></div>'
      + '</div>'
      + '<ol class="pathway-steps">' + pasos + '</ol>'
      + '<footer class="pathway-f">'
      + '<button class="btn ' + (empezado ? 'btn-ghost' : 'btn-primary') + ' btn-sm btn-block" type="button" data-action="abrir-camino" data-camino="' + esc(r.id) + '">'
      + ico('arrow') + (empezado ? 'Seguir donde lo dejaste' : 'Empezar el camino') + '</button>'
      + '</footer></article>';
  }
  function pasos2(n) { return n + ' ' + plural(n, 'paso'); }

  function detalleCamino(camino) {
    var progreso = (App.caminosEstado.progreso || []).filter(function (item) { return item.caminoId === camino.id; })[0] || { elementos: [], porcentaje: 0 };
    var estados = progreso.elementos || [];
    var hechos = estados.filter(function (item) { return item.estado === 'COMPLETADO'; }).length;
    var indice = 0;
    // Los requisitos se guardan como identificadores; al usuario se le enseña el título.
    var tituloDe = {};
    (camino.etapas || []).forEach(function (etapa) {
      (etapa.elementos || []).forEach(function (el) { if (el) tituloDe[el.id] = el.titulo; });
    });
    var nombreReq = function (ids) {
      return (ids || []).map(function (id) { return tituloDe[id] || 'otro paso'; }).join(', ');
    };

    var html = '<div class="page">'
      + pageHead(camino.nombre, camino.descripcion || '', '<button class="btn btn-ghost btn-sm" type="button" data-action="cerrar-camino">Todos los caminos</button>')
      + '<section class="pnl"><div class="pnl-head"><span class="card-ico">' + ico('route') + '</span>'
      + '<div><h2>Tu recorrido</h2><p>' + hechos + ' de ' + estados.length + ' pasos hechos · ' + progreso.porcentaje + '%</p></div></div>'
      + '<div class="pbar"><i style="width:' + progreso.porcentaje + '%"></i></div></section>';

    (camino.etapas || []).forEach(function (etapa) {
      var items = (etapa.elementos || []).filter(Boolean);
      var soloPasos = items.filter(function (el) { return el.tipo !== 'recurso'; });
      var hechosEtapa = soloPasos.filter(function (el) {
        var st = estados.filter(function (it) { return it.id === el.id; })[0];
        return st && st.estado === 'COMPLETADO';
      }).length;
      var esActual = soloPasos.some(function (el) {
        var st = estados.filter(function (it) { return it.id === el.id; })[0];
        return st && st.estado === 'DISPONIBLE';
      });
      var pct = soloPasos.length ? Math.round((hechosEtapa / soloPasos.length) * 100) : 0;
      var etapaHecha = soloPasos.length > 0 && hechosEtapa === soloPasos.length;

      html += '<section class="stage' + (etapaHecha ? ' is-done' : (esActual ? ' is-now' : '')) + '">'
        + '<div class="stage-top"><span class="stage-num">' + (etapaHecha ? '✓' : (++indice)) + '</span>'
        + '<div class="stage-txt"><h2>' + esc(etapa.nombre) + '</h2><p>' + (soloPasos.length ? hechosEtapa + ' de ' + soloPasos.length + ' ' + plural(soloPasos.length, 'paso') : 'Recursos de apoyo') + '</p></div>'
        + '<span class="tag' + (esActual ? ' tag-cyan' : '') + '">' + (etapaHecha ? 'Etapa hecha' : (esActual ? 'En curso' : (soloPasos.length ? 'Pendiente' : 'Apoyo'))) + '</span></div>'
        + '<div class="stage-bar"><i style="width:' + pct + '%"></i></div>'
        + '<div class="grid g-2">';

      items.forEach(function (elemento) {
        var esActividad = elemento.tipo === 'actividad';
        var esRecurso = elemento.tipo === 'recurso';
        // Un recurso no es un paso: ni se completa ni se bloquea.
        var estado = esRecurso
          ? { estado: 'RECURSO' }
          : (estados.filter(function (item) { return item.id === elemento.id; })[0] || { estado: 'BLOQUEADO' });
        var intento = esActividad ? estadoActividad(elemento.actividadId) : null;
        var bloqueado = estado.estado === 'BLOQUEADO';
        var hecho = estado.estado === 'COMPLETADO';
        html += '<article class="item pathway-element ' + (bloqueado ? 'is-locked' : '') + '">'
          + '<div class="item-top"><span class="item-cover ' + (hecho ? 'mint' : (esActividad ? 'cyan' : '')) + '">' + ico(hecho ? 'check' : (bloqueado ? 'lock' : (esActividad ? 'spark' : 'book'))) + '</span>'
          + '<div class="item-h"><h3>' + esc(elemento.titulo) + '</h3><p>' + esc(esActividad ? 'Actividad · ' + (elemento.ejercicios || 0) + ' ejercicios · ' + (elemento.minutos || 0) + ' min' : (elemento.proveedor || '')) + '</p></div></div>'
          + '<div class="item-meta">'
          + (esActividad
              ? (elemento.recompensaActividad ? '<span class="tag tag-mint">+' + num(elemento.recompensaActividad) + ' Pz al aprobar</span>' : '')
                + (elemento.bonusActividad ? '<span class="tag tag-cyan">+' + num(elemento.bonusActividad) + ' Pz extra si aciertas todo</span>' : '')
              : (esRecurso ? '<span class="tag">Recurso externo</span>' : '<span class="tag">+' + num(elemento.recompensa || 0) + ' Pz</span>' + (elemento.pmb != null ? '<span class="tag tag-cyan">Beca hasta ' + elemento.pmb + '%</span>' : '')))
          + (intento ? '<span class="tag">Nota ' + intento.mejorPorcentaje + '%</span>' : '')
          + '</div>'
          + '<p class="fine">' + (esRecurso ? esc(elemento.descripcion || 'Enlace de apoyo') : (bloqueado ? 'Se abre al completar: ' + esc(nombreReq(elemento.requisitos)) : (hecho ? 'Completado' : 'Disponible ahora'))) + '</p>'
          + '<div class="gate-act" style="justify-content:flex-start">'
          + (esActividad && !bloqueado ? '<button class="btn ' + (hecho ? 'btn-ghost' : 'btn-primary') + ' btn-sm" type="button" data-action="lr-abrir" data-actividad="' + esc(elemento.actividadId) + '" data-camino="' + esc(camino.id) + '" data-elemento="' + esc(elemento.id) + '">' + (hecho ? 'Volver a hacerla' : 'Hacer la actividad') + '</button>' : '')
          + (esRecurso && elemento.url ? '<a class="btn btn-ghost btn-sm" href="' + esc(elemento.url) + '" target="_blank" rel="noopener">Abrir en la DGT</a>' : '')
          + (!esActividad && !esRecurso && !bloqueado && !hecho && (elemento.matricula || elemento.gestion) ? '<button class="btn btn-primary btn-sm" type="button" data-action="abrir-beca" data-camino="' + esc(camino.id) + '" data-elemento="' + esc(elemento.id) + '">Acceder con beca</button>' : '')
          + (elemento.convalidable && !bloqueado ? '<button class="btn btn-ghost btn-sm" type="button" data-action="solicitar-convalidacion" data-camino="' + esc(camino.id) + '">Convalidar</button>' : '')
          + '</div></article>';
      });

      html += '</div></section>';
    });

    html += '</div>';
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
    formacion: pageRutas,
    empleo: pageEmpleo,
    beneficios: pageBeneficios,
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

  function accionBeca(btn) {
    var caminoId = tAttr(btn, 'data-camino');
    var elementoId = tAttr(btn, 'data-elemento');
    btn.disabled = true;
    btn.textContent = 'Calculando…';
    api('becas?accion=calcular&caminoId=' + encodeURIComponent(caminoId) + '&elementoId=' + encodeURIComponent(elementoId)).then(function (data) {
      var r = data.resultado;
      var texto = 'Beca reconocida: ' + r.porcentajeReconocido + '%\n' + 'Máximo del elemento: ' + r.pmb + '%\n' + 'Beca aplicada: ' + r.porcentajeAplicado + '%\n\nPrecio elegible: ' + r.precioElegible + ' Pz\nBeca: -' + r.becaPz + ' Pz\nAportación: ' + r.aportacionPz + ' Pz\n\n¿Quieres enviar la solicitud?';
      if (!window.confirm(texto)) return;
      return api('becas', { method: 'POST', body: JSON.stringify({ caminoId: caminoId, elementoId: elementoId }) }).then(function () { window.location.href = 'becas.html'; });
    }).catch(function (error) {
      // Un fallo al calcular no debe vaciar el espacio: se avisa en la página.
      render();
      avisoApp('alert err', ico('alert') + '<span>' + esc(mensajeBeca(error)) + '</span>');
    }).finally(function () { btn.disabled = false; btn.textContent = 'Acceder con beca'; });
  }

  function mensajeBeca(error) {
    var c = (error && (error.code || error.status)) || '';
    if (c === 'rsp_beca_no_configurada') return 'La valoración de becas aún no está conectada con RSP. Escríbenos si necesitas la beca ahora.';
    if (c === 'valoracion_no_disponible') return 'Todavía no tenemos tu valoración socioeconómica. La Junta debe registrarla en RSP para poder calcular la beca.';
    if (c === 'valoracion_no_encontrada') return 'Todavía no tenemos tu valoración socioeconómica. La Junta debe registrarla en RSP para poder calcular la beca.';
    if (c === 'elemento_formativo_no_encontrado') return 'No hemos podido identificar ese elemento formativo.';
    if (error && error.status === 401) return 'Tu sesión ha caducado. Vuelve a identificarte.';
    return 'No hemos podido calcular la beca ahora mismo. Reinténtalo en un momento.';
  }

  function tAttr(element, name) { return element.getAttribute(name) || ''; }

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
      case 'abrir-camino': App.caminoSeleccionado = App.caminos.filter(function (item) { return item.id === t.getAttribute('data-camino'); })[0] || null; render(); break;
      case 'cerrar-camino': App.caminoSeleccionado = null; render(); break;
      case 'cuenta-joven': accionCuentaJoven(t); break;
      case 'abrir-beca': accionBeca(t); break;
      case 'lr-opcion': {
        var ej = App.run.a.ejercicios[App.run.paso];
        App.run.respuestas[ej.id] = ej.tipo === 'test' ? Number(t.getAttribute('data-idx')) : (Number(t.getAttribute('data-idx')) === 0);
        comprobarPaso();
        break;
      }
      case 'lr-poner': {
        var eo = App.run.a.ejercicios[App.run.paso];
        var lista = Array.isArray(App.run.respuestas[eo.id]) ? App.run.respuestas[eo.id].slice() : [];
        lista.push(Number(t.getAttribute('data-idx')));
        App.run.respuestas[eo.id] = lista;
        pintarRun();
        break;
      }
      case 'lr-mover': {
        var em = App.run.a.ejercicios[App.run.paso];
        var lm = Array.isArray(App.run.respuestas[em.id]) ? App.run.respuestas[em.id].slice() : [];
        var pos = Number(t.getAttribute('data-pos'));
        var dir = Number(t.getAttribute('data-dir'));
        var destino = pos + dir;
        if (destino >= 0 && destino < lm.length) {
          var tmp = lm[pos]; lm[pos] = lm[destino]; lm[destino] = tmp;
          App.run.respuestas[em.id] = lm;
          pintarRun();
        }
        break;
      }
      case 'lr-quitar': {
        var eq = App.run.a.ejercicios[App.run.paso];
        var lq = Array.isArray(App.run.respuestas[eq.id]) ? App.run.respuestas[eq.id].slice() : [];
        lq.splice(Number(t.getAttribute('data-pos')), 1);
        App.run.respuestas[eq.id] = lq;
        pintarRun();
        break;
      }
      case 'lr-vaciar': {
        var ev = App.run.a.ejercicios[App.run.paso];
        App.run.respuestas[ev.id] = ev.tipo === 'ordenar' ? [] : {};
        App.run.sel = null;
        pintarRun();
        break;
      }
      case 'lr-izq': {
        var ei = App.run.a.ejercicios[App.run.paso];
        var izq = t.getAttribute('data-izq');
        var actual = App.run.respuestas[ei.id] || {};
        if (App.run.sel === izq) App.run.sel = null;                  // volver a pulsar lo deselecciona
        else if (actual[izq]) {                                       // ya emparejado: se suelta
          delete actual[izq];
          App.run.respuestas[ei.id] = actual;
          App.run.sel = null;
        } else App.run.sel = izq;
        pintarRun();
        break;
      }
      case 'lr-der': {
        var er = App.run.a.ejercicios[App.run.paso];
        if (App.run.sel) {
          var mapa = App.run.respuestas[er.id] || {};
          mapa[App.run.sel] = t.getAttribute('data-val');
          App.run.respuestas[er.id] = mapa;
          App.run.sel = null;
          pintarRun();
        }
        break;
      }
      case 'lr-abrir': abrirActividad(t.getAttribute('data-actividad'), t.getAttribute('data-camino'), t.getAttribute('data-elemento')); break;
      case 'lr-comprobar': comprobarPaso(); break;
      case 'lr-paso': avanzarPaso(); break;
      case 'lr-reintentar':
        App.run.paso = 0; App.run.respuestas = {}; App.run.hechos = {}; App.run.fb = null; App.run.final = null; App.run.sel = null;
        pintarRun();
        break;
      case 'lr-volver-camino':
        App.run = null;
        App.caminoSeleccionado = App.caminos.filter(function (x) { return x.id === t.getAttribute('data-camino'); })[0] || null;
        render();
        break;
      case 'cerrar-actividad': App.run = null; render(); break;
      case 'filtrar-recompensa':
        App.filtro = t.getAttribute('data-cat');
        actualizarCatalogo();
        break;
      case 'cv-guardar': cvGuardar(); break;
      case 'cv-limpiar': cvLimpiar(); break;
      case 'cv-imprimir': window.print(); break;
      case 'toggle-side': alternarCajon(); break;
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
    if (ev.target && ev.target.id === 'actForm') ev.preventDefault();
  });

  document.addEventListener('keydown', function (ev) {
    if (!App.run || App.run.final) return;
    var e = App.run.a.ejercicios[App.run.paso];
    if (ev.key === 'Escape') { App.run = null; render(); return; }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (App.run.fb) avanzarPaso(); else comprobarPaso();
      return;
    }
    // En opción única: 1..9 / A..Z eligen y corrigen de una vez.
    if (!App.run.fb && cuerpoEjercicioAuto(e) && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      var opciones = e.tipo === 'test' ? (e.opciones || []).length : 2;
      var pos = '123456789'.indexOf(ev.key);
      if (pos < 0) pos = 'abcdefghijklmnopqrstuvwxyz'.indexOf(String(ev.key).toLowerCase());
      if (pos >= 0 && pos < opciones) {
        ev.preventDefault();
        App.run.respuestas[e.id] = e.tipo === 'test' ? pos : (pos === 0);
        comprobarPaso();
      }
    }
  });

  document.addEventListener('input', function (ev) {
    if (!ev.target) return;
    if (ev.target.id === 'lrCampo' && App.run) {
      var e = App.run.a.ejercicios[App.run.paso];
      App.run.respuestas[e.id] = ev.target.value;
    }
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

  /* ── Menú de plataforma: desplegable de usuario y cajón en móvil ──── */
  function cerrarMenus() {
    var panel = document.getElementById('userPanel');
    var boton = document.querySelector('[data-action="menu-usuario"]');
    if (panel) panel.hidden = true;
    if (boton) boton.setAttribute('aria-expanded', 'false');
    var mas = document.getElementById('masPanel');
    var botonMas = document.querySelector('[data-action="menu-mas"]');
    if (mas) mas.hidden = true;
    if (botonMas) botonMas.setAttribute('aria-expanded', 'false');
    var cajon = document.getElementById('navDrawer');
    var nav = document.getElementById('navToggle');
    if (cajon) cajon.hidden = true;
    if (nav) nav.setAttribute('aria-expanded', 'false');
  }
  function alternarMenu(idPanel, accion) {
    var panel = document.getElementById(idPanel);
    var boton = document.querySelector('[data-action="' + accion + '"]');
    if (!panel) return;
    var abrir = panel.hidden;
    cerrarMenus();
    panel.hidden = !abrir;
    if (boton) boton.setAttribute('aria-expanded', String(abrir));
  }
  function alternarPanel() { alternarMenu('userPanel', 'menu-usuario'); }
  function alternarMas() { alternarMenu('masPanel', 'menu-mas'); }
  function alternarCajon() {
    var cajon = document.getElementById('navDrawer');
    var boton = document.getElementById('navToggle');
    if (!cajon) return;
    var abrir = cajon.hidden;
    cerrarMenus();
    cajon.hidden = !abrir;
    if (boton) boton.setAttribute('aria-expanded', String(abrir));
  }
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('#navToggle')) { alternarCajon(); return; }
    if (ev.target.closest('[data-action="menu-usuario"]')) { alternarPanel(); return; }
    if (ev.target.closest('[data-action="menu-mas"]')) { alternarMas(); return; }
    if (ev.target.closest('#navDrawer a')) { cerrarMenus(); return; }
    // Cualquier clic fuera cierra los desplegables.
    if (!ev.target.closest('.usermenu') && !ev.target.closest('.moremenu')) {
      var abierto = document.querySelector('.usermenu-panel:not([hidden])');
      if (abierto) cerrarMenus();
    }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') cerrarMenus();
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
      var becasRes = await api('becas');
      App.becas = Array.isArray(becasRes.becas) ? becasRes.becas : [];
    } catch (e) { App.becas = []; }
    try {
      var actRes = await api('actividades');
      App.actividades = Array.isArray(actRes.actividades) ? actRes.actividades : [];
      App.actividadesEstado = Array.isArray(actRes.estado) ? actRes.estado : [];
    } catch (e) { App.actividades = []; }
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
