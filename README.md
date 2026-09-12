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

- **Bebas Neue** para títulos (identidad de la marca) + **Plus Jakarta Sans** para texto
  + **JetBrains Mono** para datos (Pz, códigos de keys).
- **Tema oscuro permanente** en la web pública y el espacio privado.

---

## Estructura

```
jovenlogo.png              → logo oficial (fuente)
public/
  index.html               → landing pública (una sola página con secciones)
  css/
    pjv.css                → design system (tokens, componentes, secciones)
    app.css                → shell de la webapp (barra lateral + cabecera + contenido)
    legal.css              → páginas legales
  js/
    placetaid.js           → cliente PlacetaID (sesión en cookie de 7 días)
    landing.js             → cabecera, menú, tema, animaciones y aviso de sesión
    app.js                 → motor de la webapp (sesión, estado y las 7 secciones)
    legal.js               → carga el documento legal desde el BOLP
  espacio/
    inicio.html            → Inicio (saldo, progreso, para ti, membresía, noticias)
    formacion.html         → Formación (Cisco NetAcad vía PlacetaEDU, becas, historial)
    empleo.html            → Empleo y futuro (CV, recursos, orientación) · en preparación
    beneficios.html        → Beneficios (keys, catálogo en Pz, estados de la key)
    miplaceta.html         → Mi Placeta (saldo, movimientos, becas, membresía)
    rutas.html             → Rutas (9 objetivos con sus pasos) · en preparación
    comunidad.html         → Comunidad (actividades, proyectos, encuestas) · en preparación
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
| GET | `/api/status` | Estado del usuario (control de edad 16–30) + sus keys |
| GET | `/api/planes` | Tarifas públicas, sin sesión |
| GET | `/api/caminos` | Caminos formativos, cursos y estado de convalidaciones |
| POST | `/api/caminos` | Solicitar convalidación de un curso o actividad externa |
| POST | `/api/cuenta-joven` | Solicitar apertura contractual de Cuenta Joven vía Banco/PlacetaID |
| POST | `/api/alta` | Checkout para darse de alta (`{ plan }`) |
| POST | `/api/renovar` | Checkout para renovar |
| POST | `/api/cancelar` | Cancelar (mantiene las ventajas hasta fin de período) |
| POST | `/api/verificar` | Reconcilia un pago ya hecho (evita el doble cobro) |
| GET | `/api/recompensas` | Catálogo de recompensas |
| POST | `/api/recompensas` | Canjear una recompensa (`{ recompensaId }`) |
| POST | `/api/keys` | Marcar una key como canjeada (`{ keyId, accion }`) |
| POST | `/api/webhook` | Webhook de Lemon Squeezy (verifica la firma `X-Signature`) |

Lógica pura testeada: `npm test` (`tests/core.test.js`).

## Acceso interior de pruebas

Para revisar la webapp sin pasar por el pago, habilita únicamente en local o en
un Preview de Vercel:

```env
PLACETAJOVEN_TEST_MODE=1
PLACETAJOVEN_TEST_KEY=<clave-larga-y-aleatoria>
PLACETAJOVEN_TEST_DIP=TEST-PLACETA-JOVEN
PLACETAJOVEN_TEST_EDAD=25
```

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

## Despliegue (Vercel)

- Framework `Other` / `Static`; `vercel.json` enruta `/` → `public/index.html`,
  `/entrar` → `public/espacio/inicio.html`, `/mi`, `/espacio/*`, `/terminos`,
  `/privacidad` y las funciones de `/api`.
- Tablas Supabase: ejecutar `sql/placeta_joven.sql`.

## Repositorio

- `https://github.com/grupodelaplaceta/placetajoven.git` (rama `main`).
