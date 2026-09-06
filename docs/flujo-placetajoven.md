# Flujo de acceso y suscripción de Placeta Joven

Blueprint de cómo entrará un usuario y cómo gestionará su **Placeta Joven**,
incluida la integración de pagos con **Lemon Squeezy**.

> Estado: definición para implementación (backend). Los botones de la web
> apuntan hoy a la pasarela PlacetaID (`https://id.laplaceta.org`).

## 0. Requisito: darse de alta como «solicitante» en plid26

Para que `joven.laplaceta.org` pueda usarse contra la pasarela de identificación
(plid26 / `id.laplaceta.org`), el proyecto debe estar **registrado como
solicitante (Solicitante)** en plid26. Sin ese alta, la pasarela responde
`Aplicación solicitante no autorizada` al usar un `client_id`.

### Datos del solicitante (Placeta Joven · web)
```
nombre:        'Placeta Joven (joven.laplaceta.org)'
descripcion:   'Web oficial del programa Placeta Joven.'
plataforma:    'web'
urlOrigen:     'https://joven.laplaceta.org/auth/callback.html'
redirectUris:  ['https://joven.laplaceta.org/auth/callback.html',
                'http://localhost:3000/auth/callback.html']
apiKey:        'placetajoven-web'        (client id; generar si se usa el alta admin)
pkceRequired:  true
permitirWebFallback: true
logo:          'https://joven.laplaceta.org/img/jovenlogo.png'
bgColor:       '#2A0750'
activo:        true
```

### Vía 1 — Alta por API de administración de plid26
```http
POST https://id.laplaceta.org/api/admin/solicitantes
Headers: X-API-Key: <ADMIN_API_KEY>
{
  "nombre": "Placeta Joven (joven.laplaceta.org)",
  "descripcion": "Web oficial del programa Placeta Joven.",
  "plataforma": "web",
  "urlOrigen": "https://joven.laplaceta.org/auth/callback.html",
  "redirectUris": [
    "https://joven.laplaceta.org/auth/callback.html",
    "http://localhost:3000/auth/callback.html"
  ],
  "logo": "https://joven.laplaceta.org/img/jovenlogo.png",
  "bgColor": "#2A0750"
}
```
Devuelve `{ ok: true, solicitante, apiKey }` (guardar ese `apiKey` como
`client_id`).

### Vía 2 — Solicitante integrado (código de plid26)
Añadir una entrada a `BUILTIN_SOLICITANTES` en `server.js` de plid26
(`ensureBuiltinSolicitantes()` la crea al arrancar):
```js
{
  nombre: 'Placeta Joven (joven.laplaceta.org)',
  descripcion: 'Web oficial del programa Placeta Joven.',
  plataforma: 'web',
  urlOrigen: 'https://joven.laplaceta.org/auth/callback.html',
  redirectUris: [
    'https://joven.laplaceta.org/auth/callback.html',
    'http://localhost:3000/auth/callback.html'
  ],
  apiKey: process.env.PLACETAID_JOVEN_CLIENT_ID || 'placetajoven-web',
  activo: true,
  pkceRequired: true,
  permitirWebFallback: true
}
```

### Inicio de sesión desde la web (formato que espera la pasarela)
```
https://id.laplaceta.org/?client_id=placetajoven-web&redirect_uri=<encodeURIComponent(callback)>&platform=web&state=<aleatorio>
```
La pasarela valida `client_id`, autentica (DIP + contraseña + 2FA o PlacetaID
Móvil) y redirige al `redirect_uri` con `token` y `user`. Un `auth/callback.html`
(patrón: `voleyclub/auth/callback.html`) guarda la sesión y muestra el estado de
Placeta Joven. En plid26 los `redirectUris` deben coincidir exactamente con el
`redirect_uri` usado.

## 1. Entrada con PlacetaID
- El usuario entra con su **PlacetaID** (pasarela plid26 / `id.laplaceta.org`).
- El sistema lee la **fecha de nacimiento** del Registro y calcula la edad.
- Edad permitida: **16 a 30 años (ambos incluidos)**.
  - ✅ Si la tiene → se muestra el apartado **Placeta Joven**.
  - ❌ Si no → **se bloquea el acceso** a Placeta Joven (mensaje claro, sin
    dejar contratar). El resto de La Placeta no se ve afectado.

## 2. Panel «Mi Placeta Joven» (tras el login)
| Situación | Qué se muestra |
|---|---|
| Sin suscripción | Botón **Darme de alta** (elige plan mensual o anual). |
| Suscripción ACTIVA | Plan, vigencia (`expires_at`) y botones **Renovar** y **Cancelar**. |
| CANCELADO / EXPIRADO | Estado visible; se puede **renovar** para volver a activar. |

Acciones posibles en el panel:
- **Darse de alta** (primera vez) → checkout de Lemon Squeezy del plan elegido.
- **Renovar** → nuevo checkout del mismo plan (o cambiar de plan).
- **Cancelar** → estado `CANCELADO`; mantiene las ventajas hasta el final del
  período ya pagado (no se revoca en el acto).

## 3. Estados de la suscripción
`PENDIENTE` (pago iniciado/no confirmado) → `ACTIVO` → (`SUSPENDIDO` |
`CANCELADO` | `EXPIRADO`).

- `ACTIVO`: dentro del período pagado.
- `SUSPENDIDO`: temporal (p. ej. incidencia de edad/pago).
- `CANCELADO`: cancelado por el usuario o la administración (vigente hasta
  `expires_at`).
- `EXPIRADO`: fin de período sin renovación.

## 4. Lemon Squeezy (pagos)
- Proveedor de pago: **Lemon Squeezy** (cuota en **EUR**).
- Planes y **product IDs**:
  - Plan **mensual** → producto `1342686` (1,95 €/mes).
  - Plan **anual** → producto `1343043` (10 €/año).

### Flujo de alta/renovación
1. Backend crea un **checkout** de Lemon Squeezy para el plan elegido
   (`/v1/checkouts` con el `variant_id`/producto configurado; requiere la
   **API key** de Lemon Squeezy en `.env`, p. ej. `LS_API_KEY`).
2. Devuelve la `url` de checkout; el usuario paga en el entorno de Lemon Squeezy.
3. Lemon Squeezy notifica al backend mediante **webhook**.
4. El backend activa/renueva la suscripción y persiste el estado.

### Webhook (backend)
- Endpoint único, p. ej. `POST /api/placetajoven/webhook`.
- **Verificar siempre la firma** (header `X-Signature` de Lemon Squeezy con
  `LS_WEBHOOK_SECRET`) antes de procesar nada.
- Eventos a mapear (tipo `subscription_*` y `order_created`):
  - `subscription_created` / `payment_success` → `ACTIVO` (calcular
    `expires_at`).
  - `subscription_updated` (cambio de plan/variante) → actualizar `plan`.
  - `subscription_cancelled` → `CANCELADO` (mantener hasta fin de período).
  - `subscription_expired` → `EXPIRADO`.
  - `subscription_resumed` → `ACTIVO`.

## 5. Persistencia — entidad `placeta_joven`
```
id
placeta_id        → DIP de PlacetaID del titular
status            → PENDIENTE | ACTIVO | SUSPENDIDO | CANCELADO | EXPIRADO
plan              → mensual | anual
started_at
expires_at        → vigencia (mensual +1 mes, anual +1 año)
payment_provider  → 'lemonsqueezy'
subscription_id   → id de suscripción de Lemon Squeezy
ls_customer_id    → (opcional) cliente en Lemon Squeezy
created_at
updated_at
```

## 6. Dónde implementar (pendiente de decisión)
- La vista «al entrar con PlacetaID» vive del lado de la pasarela/cliente que
  recibe el login. Se recomienda: backend propio de Placeta Joven (o extensión
  del servicio que ya guarde sesiones de PlacetaID) que exponga:
  - `GET  /placetajoven` → estado (con regla de edad).
  - `POST /placetajoven/alta` → checkout LS (mensual/anual).
  - `POST /placetajoven/renovar` → checkout LS.
  - `POST /placetajoven/cancelar` → CANCELADO.
  - `POST /placetajoven/webhook` → Lemon Squeezy.
- Las credenciales van en variables de entorno: `LS_API_KEY`,
  `LS_WEBHOOK_SECRET`, `LS_STORE_ID` (para checkout). Nada de secretos en git.

## 7. Seguridad
- La edad/estado se calcula **en servidor**; nunca confiar en el cliente.
- El webhook verifica firma y es idempotente por `subscription_id`.
- La cancelación no elimina el acceso hasta `expires_at`.
- Solo PlacetaID puede consultar el estado (token de sesión), con `placeta_id`
  del propio usuario.
