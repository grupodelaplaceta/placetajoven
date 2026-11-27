-- Pruebas manuales (SQL Editor, proyecto de PRUEBAS). Sustituye los UUID por usuarios de prueba reales.
-- A = jugador con plan · B = jugador SIN plan · E = miembro de estudio · X = admin
-- Cada bloque indica el resultado esperado. Para simular un usuario:
--   set local role authenticated; select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);

-- 1) B (sin plan) intenta canjear / cobrar / jugar -> ERROR PLAN_REQUIRED en los tres
-- select public.redeem_product('speedbubble');
-- select public.claim_test_reward('t1', 10, 'x');
-- select public.start_play_session('speedbubble','web');

-- 2) A intenta subirse is_admin / played_ms / placetaid_sub -> ERROR FORBIDDEN_FIELD
-- update public.profiles set is_admin = true where id = '<A>';
-- update public.profiles set played_ms = 99999999 where id = '<A>';

-- 3) Nadie del cliente lee claves -> permission denied
-- select * from public.product_keys;
-- select * from public.key_audit;                   -- solo admin (0 filas para A)

-- 4) A reclama 76 Pz -> AMOUNT_OUT_OF_RANGE · reclama dos veces el mismo test -> ALREADY_CLAIMED
-- select public.claim_test_reward('t1', 76, 'x');
-- select public.claim_test_reward('t1', 10, 'x'); select public.claim_test_reward('t1', 10, 'x');

-- 5) Tope diario: 8 reclamaciones de 75 (600) y una más -> DAILY_CAP

-- 6) Canje: con saldo y clave libre crea pedido, descuenta Pz y marca la clave 'redeemed'; repetir -> ALREADY_OWNED
--    sin saldo -> INSUFFICIENT_PZ · sin claves -> OUT_OF_STOCK
-- select public.redeem_product('<producto>');
-- select * from public.my_orders();                  -- solo key_last4, nunca la clave

-- 7) Estudio: E edita su juego (OK), edita el de otro estudio (0 filas), intenta published/embed_ok (se ignora), cambia studio_id (FORBIDDEN_FIELD)
-- update public.products set status='published', embed_ok=true where id='<juego de E>';   -- no cambia nada
-- select * from public.studio_key_stats('<estudio de otro>');                              -- ERROR FORBIDDEN

-- 8) Arcade Shield: juego con embed_ok=false -> start_play_session('...','web') da EMBED_UNAVAILABLE.
--    Latidos: dos seguidos con <4 s suman 0; un delta de 3600000 suma como mucho 35000 y nunca más que el tiempo real;
--    sin confirm_presence en >6 min, los latidos web suman 0.
-- select public.record_heartbeat('<sesión>', 3600000);

-- 9) report_embed_broken desde 3 usuarios distintos en 24 h -> products.embed_ok pasa a false

-- 10) Banners: A solo ve los activos y dentro de fechas; no puede insertar (RLS)
