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
- La oferta anual de beneficios se llama **«Drop Joven '26»**: el plan anual
  (10 €/año) da acceso a las ventajas del programa durante la edición '26.

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
- Panel de usuario: `mi.html` («Mi Placeta Joven»).
- Lógica pura testeada: `npm test` (`tests/core.test.js`).
- Config necesaria en producción: variables de `.env.example`
  (LS_API_KEY, LS_STORE_ID, LS_WEBHOOK_SECRET, LS_VARIANT_MENSUAL/ANUAL,
  PLACETAID_BASE_URL, MONGODB_URI opcional).

## Pendiente para fases siguientes
- Gestión de ventajas (`joven_benefits`) y panel de administración (RSP).
- Desplegar plid26 con el solicitante de Placeta Joven para validar el login.
