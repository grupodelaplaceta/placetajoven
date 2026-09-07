# Placeta Joven — Web pública (joven.laplaceta.org)

Web pública del programa **Placeta Joven**: el programa opcional de pago para
jóvenes (16–30) dentro de La Placeta. Logo oficial: `jovenlogo.png`.
Tipografías **Bebas Neue** + **Plus Jakarta Sans**.

## Stack
- Web estática (HTML/CSS/JS) — sin framework ni build.
- Desplegable en Vercel → `joven.laplaceta.org` (mismo patrón que `junior.laplaceta.org`).

## Estructura
```
jovenlogo.png        → logo oficial (fuente)
public/
  index.html         → página única (hero + qué incluye + cómo funciona + planes + colabora + FAQ)
  css/styles.css     → estilos (tokens, componentes, secciones)
  js/main.js         → menú móvil, animaciones de entrada
  img/jovenlogo.png  → logo oficial servido (favicon + marca)
```

## Ventajas actuales (solo lo real, nada inventado)
1. **Formación Cisco NetAcad** — cursos oficiales de Cisco Networking Academy
   a través de PlacetaEDU.
2. **Cursos con descuento en Pz** — cursos propios de La Placeta que se pagan
   en Placetas con precio reducido para Placeta Joven.
3. **Keys de juegos indie** — claves de estudios independientes que colaboran
   con el proyecto (sin mínimos, no se revenden).
4. **Cashback 12% · Cuenta Joven** — conectando una cuenta de Banco de La
   Placeta y convirtiéndola en Cuenta Joven: 12 % de cashback en gastos
   (impuestos excluidos).

El programa se ampliará con más ventajas cuando haya colaboradores reales.

## Contenido de la página
- Mensaje principal: «Más ventajas. Más experiencias. Más Placeta.» con
  precios 10 €/año · 1,95 €/mes.
- Aclaración siempre visible: *Placeta Joven es opcional. Puedes utilizar
  La Placeta sin contratar este programa.*
- Cómo funciona: PlacetaID → plan → pago → activación automática (+ estados).
- Planes mensual / anual · Colabora (estudios indie y proyectos) · FAQ.
- Soporte: **joven@laplaceta.org**.

## Oferta anual
- La oferta anual de beneficios se llama **«Drop Joven '26»** y está **incluida en ambos
  planes** (mensual 1,95 €/mes y anual 10 €/año): formación Cisco, descuentos, keys
  indie y cashback.
- El plan anual destaca porque sale **más rentable a fin de cuenta**: 10 €/año frente a
  23,40 € pagando mes a mes (ahorras un 57 %).

## Acceso
- El acceso/contratación se hace a través de la **pasarela PlacetaID (plid26)**
  en `https://id.laplaceta.org`. Todos los CTAs «Acceder con PlacetaID» /
  «Quiero Placeta Joven» apuntan ahí.
- **Requisito**: `joven.laplaceta.org` debe estar dado de alta como
  **solicitante** en plid26 (con `client_id`/apiKey y `redirect_uri` =
  `https://joven.laplaceta.org/auth/callback.html`). Detalles y payload exacto
  en `docs/flujo-placetajoven.md` (sección 0).
- Al entrar, el sistema comprueba la **edad (16–30)** con la fecha de
  nacimiento de PlacetaID: si no se tiene la edad, se **bloquea** el acceso a
  Placeta Joven. Con la edad permitida se ve el **estado** de la suscripción y
  se puede **dar de alta**, **renovar** o **cancelar**.

## Repositorio
- Repo de este proyecto: `https://github.com/grupodelaplaceta/placetajoven.git`
  (rama `main`).

## Pagos (Lemon Squeezy)
- Proveedor de pago: **Lemon Squeezy** (cuota en euros).
- Plan mensual → producto **1342686** (1,95 €/mes).
- Plan anual → producto **1343043** (10 €/año).
- Detalle de integración (checkout, webhook, entidad `placeta_joven`,
  estados y seguridad): ver `docs/flujo-placetajoven.md`.
- IDs y precios centralizados en `config/placetajoven.json`.
- Credenciales (nunca en git): `LS_API_KEY`, `LS_WEBHOOK_SECRET`,
  `LS_STORE_ID`.

## Diseño
- El logo oficial (`jovenlogo.png`, fondo transparente) se muestra siempre
  **sobre morado oscuro** y sin caja blanca en el hero, cabecera y cierre.

## Despliegue (Vercel)
- Importar el repo / carpeta; Framework `Other` / `Static`; Output `/`.
- `vercel.json` ya enruta `/` → `public/index.html`.

## API (funciones Vercel) — ya implementada
- `GET  /api/status`     → estado del usuario (control de edad 16–30 vía PlacetaID).
- `POST /api/alta`       → checkout de Lemon Squeezy para darse de alta.
- `POST /api/renovar`    → checkout para renovar.
- `POST /api/cancelar`   → cancelar (mantiene las ventajas hasta fin de período).
- `POST /api/webhook`    → webhook de Lemon Squeezy (verifica firma `X-Signature`).
- `POST /api/verificar`  → reconcilia el pago: busca en Lemon Squeezy una
  suscripción activa por email y activa la cuenta si el usuario ya pagó (caso
  «sigue en PENDIENTE aunque pagué»). Nunca hace pagar dos veces.
- `GET  /api/recompensas`→ catálogo de recompensas disponibles (ver abajo).
- `POST /api/recompensas`→ canjear una recompensa (entrega la key al socio).
- Panel de usuario: espacio multipágina en `public/espacio/`:
  - `espacio/inicio.html`   → Mi espacio (suscripción, noticias, destacados).
  - `espacio/academia.html` → Academia Joven (cursos Cisco NetAcad en PlacetaEDU).
  - `espacio/apoyo.html`    → Apoyo Indie (juegos y keys).
  - `mi.html` (entrada tras PlacetaID) redirige a `espacio/inicio.html`.
  - Motor compartido: `public/js/espacio.js` (sesión/estado + contenido por página).
- Lógica pura testeada: `npm test` (`tests/core.test.js`).
- Config necesaria en producción: variables de `.env.example`
  (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, LS_API_KEY, LS_STORE_ID,
  LS_WEBHOOK_SECRET, LS_VARIANT_MENSUAL/ANUAL, PLACETAID_BASE_URL).
  Tablas Supabase: ejecuta `sql/placeta_joven.sql`.

## Recompensas disponibles (catálogo con Placetas · Pz)
- Sección «Recompensas disponibles» dentro del espacio joven (`mi.html`): tarjetas
  del catálogo con filtros (**Todos · Videojuegos · Formación · Experiencias · Otros**)
  y una ficha por recompensa (imagen, desarrolladora, descripción, plataforma, edad
  recomendada, Pz necesarios, disponibilidad, condiciones y botón «Conseguir recompensa»).
- Datos en Supabase (tabla `placeta_joven_recompensas`, creada por
  `sql/placeta_joven.sql`). La API lee con la service role key y solo expone campos
  públicos (ver `lib/recompensas.js` y `api/recompensas.js`).
- El seed contiene **solo ejemplos** («Videojuego Ejemplo 1–3», nombres inventados):
  todavía no hay ninguna colaboración confirmada. Si la tabla no existe o Supabase no
  está configurado, la API devuelve el mismo catálogo de ejemplo con `demo: true`
  para que la maqueta funcione sin base de datos.

## Canje de recompensas (cómo se almacenan y entregan las keys)
- **Pool de keys**: tabla `placeta_joven_keypool` (una fila = una key en stock de una
  recompensa). Solo la API la lee con la service role key: los códigos nunca llegan al
  navegador salvo al socio que la consigue (ver `lib/keypool.js`). `estado` =
  `disponible` | `asignada`; al asignar se marca con el `placeta_id` y no se reasigna.
- **Cientos de keys por título (500 de un solo uso)**: cada key es una fila del pool y se
  entrega a un único socio (una key por usuario y título). Para cargarlas en bloque:
  `node scripts/load-keys.js <recompensaId> keys.txt [plataforma]` (una key por línea;
  idempotente: reimportar no duplica). El catálogo muestra el stock real (vista
  `placeta_joven_keypool_stock`) y pasa a **Agotado** cuando no quedan keys.
- **Academia Joven** (`espacio/academia.html`): los cursos disponibles son los de
  Cisco Networking Academy a través de PlacetaEDU y la matrícula se gestiona desde
  Placeta Joven. Ser Placeta Joven suma **+20 puntos de acceso** para conseguir
  plaza en los cursos.
- **Pendiente abandonado**: un `PENDIENTE` sin confirmar caduca a las **2 horas**
  (`pendienteCaducada` en `lib/placetajoven.js`) y deja al usuario elegir plan de
  nuevo; mientras está reciente puede «Comprobar» o «Pagar de nuevo».
- **Si ya pagó pero sigue PENDIENTE**: en «Pago en proceso» hay un botón
  **«Ya he pagado · Verificar pago»** (y se intenta automáticamente al volver con
  `?pago=ok`) que llama a `POST /api/verificar`, busca la suscripción activa en
  Lemon Squeezy por email (`lib/checkout.js` → `buscarActivaPorEmail`) y activa la
  cuenta con `activarDoc` (nunca cobra dos veces).
- **Canje** (`POST /api/recompensas`): comprueba edad 16–30, suscripción activa o
  cancelada con vigencia, recompensa canjeable y **una key por usuario y título**
  (ledger `doc.recompensas`). Al canjear: toma una key del pool, la guarda en
  `doc.keys` del socio (aparece en «Keys de juegos indie» con origen «Recompensa · N Pz»)
  y registra el coste en Pz en el ledger. Ver `lib/recompensas.js` (`yaConseguida`,
  `anadirKey`) y `api/recompensas.js`.
- **Placetas (Pz)**: el coste se registra pero **no se descuenta saldo** todavía (no
  existe wallet Pz en el ecosistema). Cuando exista el saldo real se añadirá la
  comprobación y el débito en el punto de canje.
- **Activación**: el canje está **desactivado por defecto** (`RECOMPENSAS_CANJEO=0`).
  Al tener colaboraciones reales y cargar códigos reales en el keypool, pon
  `RECOMPENSAS_CANJEO=1` en Vercel.

## Pendiente para fases siguientes
- Gestión de ventajas (`joven_benefits`) y panel de administración (RSP).
- Desplegar plid26 con el solicitante de Placeta Joven para validar el login.
- Verificación/débito real del saldo de Placetas (Pz) al canjear (ecosistema Banco/PlacetaID).
