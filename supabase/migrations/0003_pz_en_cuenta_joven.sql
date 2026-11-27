-- 0003 · Los Pz son el saldo de la cuenta Placeta Joven del banco. NO aplicada. Ejecutar tras 0001 y 0002.
-- Compras: cobro a la cuenta Joven (POST /joven/pagos). Recompensas: recarga desde la cuenta de administración (POST /joven/recargas).
-- pz_ledger y get_balance() quedan OBSOLETOS (no se escribe en ellos); el saldo es el `disponible` del banco.
begin;

alter table public.product_keys drop constraint product_keys_status_check;
alter table public.product_keys add constraint product_keys_status_check check (status in ('available','reserved','redeemed','revoked'));

alter table public.orders add column status text not null default 'pending' check (status in ('pending','paid','failed')), add column bank_ref text;
alter table public.orders drop constraint orders_user_id_product_id_key;
create unique index orders_one_active on public.orders(user_id, product_id) where status in ('pending','paid');

alter table public.claims add column concept text,
  add column payout_status text not null default 'pending' check (payout_status in ('pending','paid','failed')),
  add column payout_ref text;

drop function public.redeem_product(text, boolean);
drop function public.claim_test_reward(text, int, text, jsonb, boolean);
drop function public.claim_play_reward(text, int, text);
drop function public._grant_pz(text, int, text, jsonb, boolean);

-- Reclamación de recompensa: valida y registra. NO mueve dinero (lo hace joven-pay/payout con idempotencia).
create function public._grant_pz(p_key text, p_amount int, p_concept text, p_evidence jsonb, p_review boolean default false) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_today int; v_claim bigint;
begin
  perform public.require_plan();
  if not exists (select 1 from public.profiles where id = auth.uid() and joven_iban is not null) then raise exception 'NO_ACCOUNT' using errcode = 'P0001'; end if;
  if p_amount < 1 or p_amount > public.setting('max_claim_pz')::int then raise exception 'AMOUNT_OUT_OF_RANGE' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1));
  if exists (select 1 from public.claims where user_id = auth.uid() and claim_key = p_key) then raise exception 'ALREADY_CLAIMED' using errcode = 'P0001'; end if;
  select coalesce(sum(amount), 0) into v_today from public.claims
    where user_id = auth.uid() and status in ('confirmed','review') and created_at >= date_trunc('day', now());
  if v_today + p_amount > public.setting('daily_pz_cap')::int then raise exception 'DAILY_CAP' using errcode = 'P0001'; end if;
  insert into public.claims(user_id, claim_key, amount, status, evidence, concept)
    values (auth.uid(), p_key, p_amount, case when p_review then 'review' else 'confirmed' end, case when p_review then p_evidence end, left(p_concept, 200))
    returning id into v_claim;
  if p_review then insert into public.attempt_reviews(claim_id, evidence) values (v_claim, coalesce(p_evidence, '{}'::jsonb)); end if;
  return v_claim;
end $$;
revoke all on function public._grant_pz(text, int, text, jsonb, boolean) from public, anon, authenticated;

create function public.claim_test_reward(p_test text, p_amount int, p_concept text, p_evidence jsonb default null, p_review boolean default false) returns bigint
language sql security definer set search_path = public as
$$ select public._grant_pz('test:' || left(p_test, 80), p_amount, p_concept, p_evidence, p_review) $$;
grant execute on function public.claim_test_reward(text, int, text, jsonb, boolean) to authenticated;

create function public.claim_play_reward(p_product text, p_stars int default null, p_body text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_ms bigint; v_pz int := 0; v_bonus int := 0;
begin
  perform public.require_plan();
  select coalesce(sum(ms_total), 0) into v_ms from public.play_sessions where user_id = auth.uid() and product_id = p_product and not broken;
  v_pz := case when v_ms >= 1800000 then 75 when v_ms >= 900000 then 37 when v_ms >= 300000 then 12 else 0 end;
  if v_pz = 0 then raise exception 'NOT_ENOUGH_TIME' using errcode = 'P0001'; end if;
  if p_stars between 1 and 5 and char_length(coalesce(p_body, '')) between 30 and 800 then
    insert into public.play_ratings(user_id, product_id, stars, body) values (auth.uid(), p_product, p_stars, p_body) on conflict (user_id, product_id) do nothing;
    if found then v_bonus := 12; end if;
  end if;
  if v_bonus > 0 then perform public._grant_pz('rate:' || p_product, v_bonus, 'Valoración · ' || p_product, null); end if;
  return public._grant_pz('play:' || p_product, v_pz, 'Arcade Shield · ' || p_product || ' · ' || (v_ms / 60000) || ' min', null);
end $$;
grant execute on function public.claim_play_reward(text, int, text) to authenticated;

create or replace function public.review_decide(p_claim bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  perform 1 from public.claims where id = p_claim and status = 'review' for update;
  if not found then raise exception 'NOT_IN_REVIEW' using errcode = 'P0001'; end if;
  update public.claims set status = case when p_ok then 'confirmed' else 'rejected' end where id = p_claim;   -- si se aprueba, joven-pay/payout la abona
  update public.attempt_reviews set decided_by = auth.uid(), decided_at = now() where claim_id = p_claim;
end $$;

-- Compra paso 1: reserva clave + pedido 'pending'. Si ya hay un pedido pendiente del mismo juego, lo REANUDA (el cobro es idempotente).
create function public.begin_order(p_product text, p_adult_ok boolean default false)
returns table(o_order_id uuid, o_price int, o_title text, o_resumed boolean)
language plpgsql security definer set search_path = public as $$
declare v_p public.products; v_key public.product_keys; v_o public.orders; v_price int; v_comm int; v_id uuid;
begin
  perform public.require_plan();
  if not exists (select 1 from public.profiles where id = auth.uid() and joven_iban is not null) then raise exception 'NO_ACCOUNT' using errcode = 'P0001'; end if;
  select * into v_p from public.products where id = p_product and status = 'published';
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_p.trial then raise exception 'PRODUCT_IS_FREE' using errcode = 'P0001'; end if;
  if v_p.adult and not (p_adult_ok and (select age18_confirmed from public.profiles where id = auth.uid())) then raise exception 'AGE_REQUIRED' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 2));
  select * into v_o from public.orders where user_id = auth.uid() and product_id = p_product and status in ('pending','paid');
  if found then
    if v_o.status = 'paid' then raise exception 'ALREADY_OWNED' using errcode = 'P0001'; end if;
    return query select v_o.id, v_o.price_pz, v_p.title, true; return;
  end if;
  v_price := round(v_p.price_pz * (100 - v_p.discount_pct) / 100.0);
  select * into v_key from public.product_keys where product_id = p_product and status = 'available' order by created_at limit 1 for update skip locked;
  if not found then raise exception 'OUT_OF_STOCK' using errcode = 'P0001'; end if;
  update public.product_keys set status = 'reserved', redeemed_by = auth.uid() where id = v_key.id;
  v_comm := round(v_price * public.setting('commission_pct')::numeric / 100.0);
  insert into public.orders(user_id, product_id, key_id, price_pz, commission_pz, studio_net_pz, status)
    values (auth.uid(), p_product, v_key.id, v_price, v_comm, v_price - v_comm, 'pending') returning id into v_id;
  return query select v_id, v_price, v_p.title, false;
end $$;
revoke all on function public.begin_order(text, boolean) from public, anon;
grant execute on function public.begin_order(text, boolean) to authenticated;

-- Compra paso 3 (solo servidor): confirma o deshace el pedido
create function public.finish_order(p_order uuid, p_ok boolean, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
declare v_o public.orders;
begin
  select * into v_o from public.orders where id = p_order and status = 'pending' for update;
  if not found then return; end if;
  if p_ok then
    update public.orders set status = 'paid', bank_ref = p_ref where id = p_order;
    update public.product_keys set status = 'redeemed', redeemed_at = now() where id = v_o.key_id;
  else
    update public.orders set status = 'failed' where id = p_order;
    update public.product_keys set status = 'available', redeemed_by = null where id = v_o.key_id;
  end if;
end $$;
revoke all on function public.finish_order(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_order(uuid, boolean, text) to service_role;

create or replace function public.my_orders() returns table(id uuid, product_id text, title text, studio_name text, price_pz int, created_at timestamptz, key_last4 text)
language sql stable security definer set search_path = public as $$
  select o.id, o.product_id, p.title, s.name, o.price_pz, o.created_at, k.key_last4
  from public.orders o join public.products p on p.id = o.product_id join public.studios s on s.id = p.studio_id
  join public.product_keys k on k.id = o.key_id where o.user_id = auth.uid() and o.status = 'paid' order by o.created_at desc $$;
commit;
