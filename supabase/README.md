# Supabase · Placeta Joven (v28)

**Estado: propuesta, NO aplicada ni ejecutada.** El `0001_placeta_joven.sql` anterior no venía en el zip, así que esta migración
está reescrita desde cero según el README previo (compárala con la tuya si la conservas). No he podido probar el SQL contra un Postgres.

## Orden de despliegue (proyecto de PRUEBAS primero)
1. Ejecuta `migrations/0001_placeta_joven.sql`, luego `seed.sql` (estudios y juegos, sin claves) y revisa `tests/rls_smoke.sql` con usuarios de prueba.
2. Secretos de las funciones (`supabase secrets set …`):
   - `PLACETAID_CLIENT_ID=plid27_3mRLkTpOxHxGuYg2`
   - `PLACETAID_CLIENT_SECRET=…` (el que te dio PlacetaID; **solo aquí, nunca en el navegador ni en el repositorio**)
   - `KEYS_ENC_SECRET=$(openssl rand -base64 32)` y `KEYS_HMAC_SECRET=$(openssl rand -base64 32)` — **guárdalos aparte: si se pierden, las claves son irrecuperables**
   - `ALLOWED_ORIGINS=https://joven.laplaceta.org` · `APP_ORIGIN=https://joven.laplaceta.org`
3. `supabase functions deploy placetaid-exchange studio-keys reveal-key check-embed` (ver `config.snippet.toml` para `verify_jwt`).
4. Rellena `app/config.js` (URL y clave anon) y despliega `app/` en Vercel (`vercel.json` ya reescribe `/placetaid`).
5. Auth: desactiva el registro público y los proveedores que no uses (los usuarios se crean desde PlacetaID vía la función). Sitio/redirect: solo `https://joven.laplaceta.org`.
6. Administradores y estudios por SQL (ejemplos al final de `seed.sql`). Publicar un juego nuevo: `update products set status='published' where id='…'`.

## Qué cambia
- **Claves**: la Edge Function las cifra (AES-256-GCM) antes de guardarlas; `product_keys` no tiene policies ni permisos para el cliente.
  Solo `reveal-key` las descifra, bajo demanda, para el dueño del pedido, con límite (20/h) y auditoría. Los estudios solo ven recuentos.
- **Plan**: toda acción de dinero/Pz/juego pasa por `require_plan()` → error `PLAN_REQUIRED`; el cliente muestra el error y lleva a Planes.
- **12 %**: es comisión de venta del Grupo de La Placeta, incluida en el precio (el estudio recibe el 88 %). Se guarda en `orders.commission_pz`.
- **Arcade Shield en servidor**: ver abajo.
- **Perfiles**: apodo (por defecto el nombre completo), foto (bucket privado, recortada y recodificada en el navegador), correo y teléfono de contacto, consentimiento de promociones con fecha, horas jugadas (`played_ms`, solo escribe el servidor).
- **Estudios**: panel para editar perfil y logo, juegos y precios, y subir claves.
- **Banners**: tabla `banners` (hay uno de Black Friday 23-nov→1-dic-2026). `locale` permite banners en inglés.

## Arcade Shield: qué fallaba y qué se hizo
Fallos: el evento `onload` del iframe salta también con páginas de error, y tras un solo clic dentro del juego el contador se creía «activo» para siempre.
Ahora: (1) `check-embed` comprueba en servidor que la URL responde 2xx, es HTML y permite incrustarse; si no, `embed_ok=false` y `start_play_session` rechaza (`EMBED_UNAVAILABLE`);
(2) el tiempo lo suma el servidor (`record_heartbeat`: ≤35 s por latido, nunca más que el tiempo real, mínimo 4 s entre latidos);
(3) en web exige confirmar presencia cada 4 min (el servidor corta a los 6); (4) si no carga en 25 s o el jugador pulsa «no carga», la sesión no cuenta y con 3 jugadores en 24 h se retira el juego;
(5) las Pz de jugar las calcula el servidor con su tiempo, no el del cliente.
**Límite honesto**: un iframe de otro dominio no deja ver errores internos del juego; se mitiga con lo anterior, pero no se elimina.

## Pendiente / deuda
- **Confirmar con PlacetaID** el formato de la respuesta de `/api/public/exchange` (la función supone `user.sub|id`, `name`, `email`). Si no devuelve email, se crea uno `…@placetaid.invalid`.
- **Escritorio**: para iniciar sesión hay que poner `CFG.appUrl` en `main.js` (carga la web alojada); con `file://` no hay callback posible. Detecta ahora varios juegos y cuenta horas aunque la app esté en otra pantalla.
- **Admin de la app** (KPIs, catálogo, cola de revisiones) sigue local y está oculto en modo real (TECH-007). Revisiones: `select review_decide(<claim_id>, true)`.
- **Cursos** y **cashback por opinión** no están conectados al servidor: en modo real no dan Pz.
- TECH-001 (corrección de tests en cliente), TECH-002 (pago real), TECH-003 (token en sessionStorage), TECH-004 (edad por casilla), TECH-005 (latidos manipulables en desktop), TECH-006 (borrar `attempt_reviews.evidence` a los 90 días) siguen abiertas.
- MFA de administración: las cuentas entran por PlacetaID, así que el MFA debe exigirse allí; mientras, los cambios de admin se hacen por SQL.
- Cargar `supabase-js` desde jsdelivr sin SRI: conviene fijar el hash o servirlo desde tu dominio.

## Placeta Joven (API del banco)
- Ejecuta también `migrations/0002_joven_api.sql` (añade `profiles.dip`, `profiles.joven_iban`, `profiles.birth_date`; el cliente no puede modificarlos).
- Crea la clave en placetaone (Bancos → Gestionar → Claves de API) con **solo dos permisos: `joven:gestionar` y `joven:leer`**. Se muestra una sola vez.
- Guárdala como secreto: `supabase secrets set PLACETAONE_API_KEY=plk_...` (y opcional `PLACETAONE_BASE`). **Nunca en `config.js`, en Vercel ni en el chat.**
- `supabase functions deploy joven-api placetaid-exchange`. El cliente solo pide `account`, `open_account`, `movements` o `shops`; ruta, IBAN, DIP y fecha de nacimiento salen siempre del perfil del usuario autenticado.
- Conectado: ver el IBAN, el disponible, si está congelada/elegible y los últimos movimientos; abrir la cuenta (16-31 años); listar comercios.
- **Pagos y recargas NO están cableados a propósito**: antes hay que decidir si los Pz de la tienda son el saldo de la cuenta Joven (entonces canjear = `POST /joven/pagos`, con Idempotency-Key por pedido) o un saldo aparte.
- Congelar/descongelar y promociones Junior→Joven son solo del Banco de La Placeta: irían en un panel de administración, no en la app del jugador.
- Supuestos a confirmar con PlacetaID: que devuelve `dip` y `fecha_nacimiento` (o `birth_date`) al canjear el código. Si el campo se llama distinto, hay que ajustarlo en `placetaid-exchange`.

## Los Pz son la cuenta Placeta Joven (migración 0003 + función `joven-pay`)
Orden: 0001 → 0002 → 0003 → 0004. `pz_ledger` y `get_balance()` quedan obsoletos: el saldo es el `disponible` del banco.
- **Comprar**: `begin_order` reserva la clave y crea un pedido `pending` → `joven-pay` cobra con `POST /joven/pagos` (`Idempotency-Key = pj-order-<id>`) hacia la cuenta de Placeta Joven → `finish_order` marca `paid`. Si el banco rechaza (422), se libera la clave. Si hay un corte de red, el pedido queda `pending` y reintentar es seguro (mismo cobro, nunca doble). `reveal-key` solo entrega claves de pedidos `paid`.
- **Recompensas**: la reclamación se valida en BD (plan, tope 75, 600/día, no repetir) y queda `payout_status = pending`; `joven-pay` la abona con `POST /joven/recargas` (`pj-claim-<id>`) desde la cuenta de administración. Se reintenta al iniciar sesión.
- Secretos nuevos: `PLACETAJOVEN_COMERCIO_IBAN` (cuenta de empresa de Placeta Joven que recibe los pagos; debe salir en `GET /joven/comercios`) y `PLACETAJOVEN_ORIGEN_IBAN` (cuenta de administración que paga las recompensas). La clave de API necesita `joven:gestionar` + `joven:leer`.
- Despliega: `supabase functions deploy joven-pay joven-api reveal-key placetaid-exchange studio-keys check-embed`.

### Ojo (decisiones tuyas)
- El banco llama **IVA** al 12 % de `/joven/pagos` (base → comercio, IVA → cuenta recaudadora). Tu texto dice que es comisión del Grupo de La Placeta: configura `joven_iva_pct` y la cuenta recaudadora para que coincida, o el desglose del banco y el de la tienda dirán cosas distintas.
- El cobro entra en la cuenta de Placeta Joven; **el pago a los estudios (su 88 %) aún no está implementado** (`orders.studio_net_pz` lo registra).
- Si la cuenta de administración se queda sin fondos, las recompensas quedan pendientes (no se pierden) hasta recargarla.
- Congelar la cuenta al vencer el plan (`/congelar`) es solo del Banco de La Placeta: hoy nada lo hace automáticamente.
- Sin cuenta Joven (fuera de 16-31 años o sin abrir) no se puede comprar ni cobrar recompensas; la app lo indica.

## Quién puede ser Placeta Joven (migración 0004)
Desde los **16 años cumplidos hasta el 31 de diciembre del año en que se cumplen 31**. Sin fecha de nacimiento verificada, tampoco.
Se aplica en cuatro sitios: `is_joven_eligible()` + `require_plan()` (base de datos: compras, recompensas y jugar fallan con `NOT_ELIGIBLE`; tampoco se puede activar un plan),
`joven-api` (no pide abrir cuenta al banco), `joven-pay` (ni cobros ni recompensas) y la app (pantalla «Placeta Joven no está disponible para ti» con solo cerrar sesión y legales).
Aviso: la fecha de nacimiento depende de que PlacetaID la devuelva en `fecha_nacimiento`/`birth_date`; si no llega, **nadie será elegible**. Tras comprobarlo con un usuario real, ajusta el nombre del campo en `placetaid-exchange`.
Pendiente: quien deja de ser elegible con una cuenta ya abierta se congela en el banco (lo hace el propio banco cada día), pero sus pedidos pendientes y recompensas sin pagar quedan bloqueados por esta regla.
