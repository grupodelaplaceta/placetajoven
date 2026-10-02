# Placeta Joven — joven.laplaceta.org

Landing pública **+** webapp del programa **Placeta Joven**: el espacio de La Placeta
para jóvenes de **16 a 30 años**. Formación oficial (Cisco NetAcad vía PlacetaEDU),
proyectos, keys de juegos indie y beneficios que se consiguen participando.

Proyecto **sostenible y sin ánimo de lucro**: la cuota es simbólica (1,95 €/mes ·
10 €/año) y los ingresos se reinvierten en la entidad y en sus proyectos.

---

## Stack

- Web estática (HTML/CSS/JS), **sin framework ni build**.
- Desplegable en Vercel → `joven.laplaceta.org` (mismo patrón que `junior.laplaceta.org`).
- Funciones serverless en `/api` (Node) para PlacetaID, suscripción y recompensas.

## Tipografía y temas

- **Chakra Petch** para títulos + **Bricolage Grotesque** para texto + **JetBrains Mono** para datos.
- **Baruta** y **Super Bouncer** quedan como fuentes decorativas opcionales; sus archivos no están incluidos y el navegador usa Chakra Petch como respaldo.
- Tema oscuro por defecto; se conserva la preferencia clara si la persona la había elegido.

---

## Estructura

```
public/img/joven.png       → logotipo de Placeta Joven
public/
  plataforma.html          → portada pública y acceso a la plataforma
  filosofia.html           → filosofía y apoyo al videojuego independiente
  estudios.html            → información y propuesta de colaboración para estudios
  css/
    plataforma.css         → portada pública y páginas informativas
    pjv.css                → design system (tokens, componentes, secciones)
    app.css                → shell de la webapp (barra lateral + cabecera + contenido)
    legal.css              → páginas legales
  js/
    placetaid.js           → cliente PlacetaID (sesión en cookie de 7 días)
    plataforma.js          → escaparate público, tarifas y acceso local de pruebas
    landing.js             → cabecera, menú, tema, animaciones y aviso de sesión
    app.js                 → motor de la webapp (sesión, estado, formación, tienda y paneles autorizados)
    legal.js               → carga el documento legal desde el BOLP
  espacio/
    inicio.html            → Inicio (saldo, progreso, para ti, membresía, noticias)
    formacion.html         → Formación (Cisco NetAcad vía PlacetaEDU, becas, historial)
    empleo.html            → Empleo y futuro (CV, recursos, orientación) · en preparación
    beneficios.html        → Beneficios (keys, catálogo en Pz, estados de la key)
    miplaceta.html         → Mi Placeta (saldo, movimientos, becas, membresía)
    rutas.html             → Rutas (9 objetivos con sus pasos) · en preparación
    comunidad.html         → Comunidad (actividades, proyectos, encuestas) · en preparación
    misiones.html          → misión diaria basada en actividad formativa real
    juego.html             → ficha de juego y opiniones públicas
    estudio.html           → perfil público de una desarrolladora
    admin.html             → panel admin (solo allowlist de servidor)
    studio.html            → panel de estudio (solo catálogo asignado)
    academia.html          → redirección a formacion.html (enlaces antiguos)
    apoyo.html             → redirección a beneficios.html (enlaces antiguos)
  mi.html                  → entrada tras PlacetaID → redirige a espacio/inicio.html
  terminos.html            → términos y condiciones (texto servido por el BOLP)
  privacidad.html          → política de privacidad (texto servido por el BOLP)
  auth/callback.html       → retorno de PlacetaID
.legacy/                   → versiones anteriores (no se despliegan; ver .gitignore)
```

### Landing pública

Secciones: hero · tarifas · formación · beneficios actuales · colaboraciones ·
preguntas frecuentes · cierre.

### Webapp

Cada página declara su vista con `<body data-page="…">` y **`js/app.js` hace todo lo
demás**: comprueba la sesión de PlacetaID, resuelve el estado del programa y pinta la
puerta o el espacio completo.

Puertas (estados sin suscripción activa):

| Situación | Qué ve el usuario |
|---|---|
| Sin sesión | «Identifícate con PlacetaID» |
| Edad fuera de 16–30 | «Todavía no es tu momento» + La Placeta sigue abierta |
| Sin suscripción / expirada / cancelada | «Elige tu plan» (mensual / anual) |
| Pago pendiente | «Pago en proceso» + verificar el pago (nunca cobra dos veces) |
| Suspendida | «Suscripción suspendida» + regularizar |

---

## Ventajas actuales (solo lo real, nada inventado)

1. **Formación Cisco NetAcad** — cursos oficiales de Cisco Networking Academy a través
   de **PlacetaEDU**, con recompensa en Pz al completar y **becas** sobre la matrícula.
2. **Cuenta Joven · 12 % de cashback** — convirtiendo una cuenta de **Banco de La
   Placeta** en **Cuenta Joven**, con las condiciones de ese tipo de cuenta.
3. **Keys de juegos indie** — claves de estudios independientes que colaboran con el
   programa (una key por usuario y título, sin reventa).
4. **Cursos con precio reducido** — cursos propios de La Placeta pagados en Placetas.

Las áreas de **Empleo y futuro**, **Rutas** y **Comunidad** están marcadas como
*En preparación* en toda la interfaz: no se anuncia nada que todavía no funcione.

## Placetas (Pz) y el saldo

- **Placeta Joven no crea Pz.** Las Placetas viven en la **Cuenta Joven** del titular en
  **Banco de La Placeta**.
- La plataforma **consulta el saldo** y **registra las operaciones que el usuario
  autoriza**; nunca emite Pz ni permite comprarlas con dinero real.
- Las Pz se obtienen realizando actividades del ecosistema (entre ellas las educativas
  de PlacetaEDU).
- Mientras la API del banco no esté conectada, la interfaz muestra el saldo como
  *pendiente de conexión* y explica dónde consultarlo. **No se muestran cifras
  inventadas**: si algún día `/api/status` devuelve `saldo`, la interfaz lo pinta sola.
- El precio en Pz de cada recompensa se calcula con los **índices y tasas del programa**
  (precio de referencia, antigüedad, lanzamiento o beta, categoría, edad recomendada,
  disponibilidad, valor educativo y campañas activas).

## Keys y recompensas

- Cada key tiene un estado trazable: `DISPONIBLE → RESERVADA → ASIGNADA → ENTREGADA`.
- Una key entregada no vuelve al inventario y no puede entregarse dos veces.
- Límite: **una key por título y usuario**.
- El catálogo se sirve desde `/api/recompensas`. Si Supabase no está configurado o
  falla, la API devuelve un error explícito; no inventa títulos ni colaboraciones.

## Acceso con PlacetaID

- El acceso se hace con la pasarela **PlacetaID (plid26)** en `https://id.laplaceta.org`.
- Requisito: `joven.laplaceta.org` debe estar dado de alta como **solicitante** en plid26
  (`client_id` = `placetajoven-web`, `redirect_uri` =
  `https://joven.laplaceta.org/auth/callback.html`). Detalles en
  `docs/flujo-placetajoven.md`.
- La edad (16–30) se comprueba con la fecha de nacimiento de PlacetaID.

## API (funciones Vercel)

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/status` | Estado del usuario (control de edad 16–30), keys y progreso del límite mensual del motor propio |
| GET | `/api/escaparate` | Juegos con stock confirmado y juegos gratuitos marcados para promoción; lectura pública |
| GET/POST | `/api/panel` | Panel admin/estudio; roles comprobados en servidor, nunca en el cliente |
| GET | `/api/opiniones` | Opiniones públicas sin identidad ni códigos de keys |
| POST | `/api/opiniones` | Publicar opinión de una key propia tras 24 h; 40 Pz pendientes si queda límite mensual |
| GET | `/api/planes` | Tarifas públicas, sin sesión |
| GET | `/api/caminos` | Caminos formativos, cursos y estado de convalidaciones |
| POST | `/api/caminos` | Solicitar convalidación de un curso o actividad externa |
| POST | `/api/cuenta-joven` | Solicitar apertura contractual de Cuenta Joven vía Banco/PlacetaID |
| GET | `/api/protecciones` | Catálogo informativo de propuestas de protección |
| POST | `/api/protecciones` | Registrar interés del usuario, sin contratación |
| GET | `/api/becas` | Historial personal de solicitudes y baremo aplicado |
| POST | `/api/becas` | Crear solicitud de beca con INB y desglose económico |
| POST | `/api/becas` | Resolver desde la Junta usando `X-Junta-API-Key` y `accion=resolver` |
| POST | `/api/alta` | Checkout para darse de alta (`{ plan }`) |
| POST | `/api/renovar` | Checkout para renovar |
| POST | `/api/cancelar` | Cancelar (mantiene las ventajas hasta fin de período) |
| POST | `/api/verificar` | Reconcilia un pago ya hecho (evita el doble cobro) |
| GET | `/api/recompensas` | Catálogo de recompensas |
| POST | `/api/recompensas` | Canjear una recompensa (`{ recompensaId }`) |
| POST | `/api/keys` | Marcar una key como canjeada (`{ keyId, accion }`) |
| POST | `/api/webhook` | Webhook de Lemon Squeezy (verifica la firma `X-Signature`) |

### Catálogo, paneles y economía

- Una ficha de colaboración aparece en el escaparate cuando está activa y hay stock verificable en el keypool.
- Un juego gratuito requiere `data.gratis=true`, `data.tipoJuego="recomendado"`, `data.promocionada=true` y una URL HTTP(S) oficial.
- El panel admin se autoriza con `PLACETAJOVEN_ADMIN_DIPS`; los estudios se vinculan mediante `PLACETAJOVEN_STUDIOS_JSON` (`DIP` → `studioId`). Estas variables contienen identificadores personales y solo van en el entorno privado del servidor, nunca en el repositorio.
- El panel de estudio solo devuelve fichas con su `studioId`; permite cargar claves y muestra únicamente stock agregado. La administración puede publicar/pausar fichas. Sin Supabase, ambos paneles indican que no están configurados y no simulan datos.
- El límite predeterminado de 400 Pz se aplica server-side a recompensas nuevas del motor de actividades y cuenta las órdenes generadas durante el mes UTC. Las recompensas que PlacetaEDU gestione fuera de este motor aún no entran en ese acumulado.
- El saldo y el cashback son responsabilidad de Banco de La Placeta. El canje está bloqueado en servidor mientras la API bancaria no confirme el cargo; ninguna variable de entorno puede activarlo por sí sola.
- Los textos legales vigentes siguen sirviéndose desde el BOLP; las páginas de información no sustituyen esos documentos oficiales.
- Las opiniones se guardan en `placeta_joven_opiniones`; aplica el esquema de `sql/placeta_joven.sql`. RLS bloquea lectura directa de DIP/keyId; solo la API publica texto, juego, valoración y fecha.
- La misión diaria destaca una actividad formativa pendiente; completarla otorga la recompensa propia de esa actividad, no un bonus arbitrario adicional.

Lógica pura testeada: `npm test` (`tests/core.test.js`).

## Acceso interior de pruebas

Para revisar la webapp sin pasar por el pago, habilita únicamente en local o en
un Preview de Vercel:

```env
PLACETAJOVEN_TEST_MODE=1
PLACETAJOVEN_TEST_KEY=<clave-larga-y-aleatoria>
PLACETAJOVEN_TEST_DIP=TEST-PLACETA-JOVEN
PLACETAJOVEN_TEST_EDAD=25
PLACETAJOVEN_TEST_PANEL=admin
```

`PLACETAJOVEN_TEST_PANEL` acepta `admin` o `studio` solo con el modo de pruebas local/Preview activo; nunca concede permisos en producción.

Después abre `/test-login.html` y usa la clave configurada. El acceso crea una
sesión sintética activa y no escribe suscripciones, pagos ni datos de usuarios.
El modo se bloquea automáticamente cuando `VERCEL_ENV=production` o
`NODE_ENV=production`. No uses un DNI real como identidad de pruebas.

## Pagos (Lemon Squeezy)

- Plan mensual → producto **1342686** (1,95 €/mes).
- Plan anual → producto **1343043** (10 €/año).
- IDs y precios centralizados en `config/placetajoven.json`.
- Credenciales (nunca en git): `LS_API_KEY`, `LS_WEBHOOK_SECRET`, `LS_STORE_ID`,
  `LS_VARIANT_MENSUAL`, `LS_VARIANT_ANUAL`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `PLACETAID_BASE_URL` (ver `.env.example`).

La integración bancaria usa `PLACETA_BANCO_API_URL` y `PLACETA_BANCO_API_KEY`.
Si no están configuradas, la solicitud de Cuenta Joven devuelve `banco_no_configurado`
y no se simula ninguna cuenta ni movimiento de Pz.

Los caminos consumen `GET {PLACETAEDU_API_URL}/pathways` cuando
`PLACETAEDU_API_URL` está configurada. Placeta Joven organiza esos elementos,
pero PlacetaEDU conserva la fuente de verdad de cursos, actividades, progreso y
certificados.

Las becas se registran en la API propia con expediente completo: indicadores,
INB, nivel reconocido, PMB del elemento, porcentaje aplicado, importes,
documentación, estado y motivo de resolución. Una denegación exige motivo.
El botón «Acceder con beca» consulta automáticamente a RSP mediante
`RSP_API_URL`/`RSP_API_KEY`; sin esa conexión no permite calcular ni enviar una
solicitud con valores manuales.

## Protecciones

La sección Protecciones es actualmente un catálogo de interés, no un seguro
contratable. No publica primas, coberturas contractuales ni exclusiones hasta
que exista una aseguradora autorizada, producto aprobado, documentación legal
y un flujo de firma integrado con PlacetaID.

## Despliegue (Vercel)

- Framework `Other` / `Static`; `vercel.json` enruta `/` → `public/plataforma.html`,
  `/entrar` → `public/espacio/inicio.html`, `/mi`, `/espacio/*`, `/terminos`,
  `/privacidad` y las funciones de `/api`.
- Tablas Supabase: ejecutar `sql/placeta_joven.sql`.

## Repositorio

- `https://github.com/grupodelaplaceta/placetajoven.git` (rama `main`).
