-- Placeta Joven · esquema inicial (v28)
-- ESTADO: propuesta, NO aplicada. Revísala en un proyecto de pruebas antes de producción.
-- Principios: RLS en todo, cambios sensibles solo por funciones SECURITY DEFINER,
-- claves de juego SIEMPRE cifradas (el cifrado lo hace la Edge Function, la BD solo guarda texto cifrado).
begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- ajustes
create table public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
create policy app_settings_read on public.app_settings for select to authenticated using (key in ('demo_mode','commission_pct'));
insert into public.app_settings(key, value) values
  ('demo_mode','true'), ('commission_pct','12'), ('max_claim_pz','75'), ('daily_pz_cap','600');

create function public.setting(k text) returns text
language sql stable security definer set search_path = public as
$$ select value from public.app_settings where key = k $$;
revoke all on function public.setting(text) from public, anon, authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------- perfiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  placetaid_sub text unique,
  full_name text not null default '' check (char_length(full_name) <= 120),
  nickname text check (nickname is null or char_length(nickname) between 2 and 30),
  display_name text generated always as (coalesce(nullif(nickname, ''), full_name)) stored,
  avatar_path text check (avatar_path is null or avatar_path like id::text || '/%'),
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  age14_confirmed boolean not null default false,
  age18_confirmed boolean not null default false,
  is_admin boolean not null default false,
  played_ms bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- sin policy de INSERT/DELETE: el perfil lo crea el trigger de alta.

create function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then      -- llamada directa del cliente
    if new.id <> old.id or new.is_admin <> old.is_admin or new.placetaid_sub is distinct from old.placetaid_sub
       or new.played_ms <> old.played_ms or new.created_at <> old.created_at then
      raise exception 'FORBIDDEN_FIELD' using errcode = '42501';
    end if;
  end if;
  if new.marketing_opt_in and not old.marketing_opt_in then new.marketing_opt_in_at := now();
  elsif not new.marketing_opt_in then new.marketing_opt_in_at := null; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, placetaid_sub, full_name)
  values (new.id, new.raw_user_meta_data->>'placetaid_sub', left(coalesce(new.raw_user_meta_data->>'full_name',''), 120))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- planes
create table public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('mensual','anual')),
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source text not null default 'demo',
  external_ref text unique,             -- id del pago en la pasarela (idempotencia del webhook)
  created_at timestamptz not null default now()
);
create index on public.user_plans(user_id, status, expires_at);
alter table public.user_plans enable row level security;
create policy user_plans_select on public.user_plans for select to authenticated using (user_id = auth.uid() or public.is_admin());

create function public.has_active_plan(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.user_plans where user_id = p_uid and status = 'active' and expires_at > now()) $$;
grant execute on function public.has_active_plan(uuid) to authenticated;

-- Todo lo que requiere plan llama a esta función: sin plan -> error PLAN_REQUIRED.
create function public.require_plan() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not public.has_active_plan(auth.uid()) then raise exception 'PLAN_REQUIRED' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.require_plan() from public, anon;

-- Pago simulado. Solo funciona con demo_mode = 'true'. En producción: webhook de pago firmado (TECH-002).
create function public.demo_activate_plan(p_plan text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_exp timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if public.setting('demo_mode') <> 'true' then raise exception 'DEMO_DISABLED' using errcode = 'P0001'; end if;
  if p_plan not in ('mensual','anual') then raise exception 'BAD_PLAN' using errcode = 'P0001'; end if;
  v_exp := case when p_plan = 'mensual' then now() + interval '1 month' else now() + interval '1 year' end;
  insert into public.user_plans(user_id, plan, expires_at, source) values (auth.uid(), p_plan, v_exp, 'demo');
  return v_exp;
end $$;
grant execute on function public.demo_activate_plan(text) to authenticated;

-- ---------------------------------------------------------------- estudios y catálogo
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null unique check (char_length(name) between 2 and 80),
  about text check (char_length(about) <= 1200),
  highlight text check (char_length(highlight) <= 300),
  web text check (web is null or web ~ '^https://'),
  founded text check (char_length(founded) <= 20),
  base text check (char_length(base) <= 80),
  founders text check (char_length(founders) <= 200),
  logo_path text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.studio_members (
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor')),
  primary key (studio_id, user_id)
);

create function public.is_studio_member(p_studio uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.studio_members where studio_id = p_studio and user_id = auth.uid()) $$;
grant execute on function public.is_studio_member(uuid) to authenticated;

alter table public.studios enable row level security;
alter table public.studio_members enable row level security;
create policy studios_select on public.studios for select to authenticated using (true);
create policy studios_update on public.studios for update to authenticated using (public.is_studio_member(id) or public.is_admin()) with check (public.is_studio_member(id) or public.is_admin());
create policy studios_admin_ins on public.studios for insert to authenticated with check (public.is_admin());
create policy members_select on public.studio_members for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy members_admin on public.studio_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

create function public.studios_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if new.id <> old.id or new.slug <> old.slug or new.verified <> old.verified or new.created_at <> old.created_at then
      raise exception 'FORBIDDEN_FIELD' using errcode = '42501';
    end if;
    if new.logo_path is not null and new.logo_path not like new.id::text || '/%' then
      raise exception 'BAD_LOGO_PATH' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger studios_guard before update on public.studios for each row execute function public.studios_guard();

create table public.products (
  id text primary key check (id ~ '^[a-z0-9_-]{2,60}$'),
  studio_id uuid not null references public.studios(id),
  title text not null check (char_length(title) between 2 and 120),
  description text check (char_length(description) <= 2000),
  genre text not null default 'Otros',
  platform text,
  pegi smallint check (pegi in (3,7,12,16,18)),
  adult boolean not null default false,
  price_pz integer not null check (price_pz between 0 and 100000),   -- precio final, ya con comisión incluida
  discount_pct smallint not null default 0 check (discount_pct between 0 and 90),
  trial boolean not null default false,                               -- juego gratis con recompensa por jugar
  itch_url text check (itch_url is null or itch_url ~ '^https://'),
  store_url text check (store_url is null or store_url ~ '^https://'),
  embed_url text check (embed_url is null or embed_url ~ '^https://'),
  exe_match text check (exe_match is null or exe_match ~ '^[A-Za-z0-9_.-]{2,40}$'),
  -- Arcade Shield · estado del juego incrustado, verificado en servidor
  embed_ok boolean not null default false,
  embed_checked_at timestamptz,
  embed_error text,
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  media jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products(studio_id);
alter table public.products enable row level security;
create policy products_select on public.products for select to authenticated
  using (status = 'published' or public.is_studio_member(studio_id) or public.is_admin());
create policy products_insert on public.products for insert to authenticated
  with check (public.is_studio_member(studio_id) or public.is_admin());
create policy products_update on public.products for update to authenticated
  using (public.is_studio_member(studio_id) or public.is_admin())
  with check (public.is_studio_member(studio_id) or public.is_admin());

create function public.products_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'draft'; new.embed_ok := false; new.embed_checked_at := null; new.embed_error := null;
    else
      if new.id <> old.id or new.studio_id <> old.studio_id or new.created_at <> old.created_at then
        raise exception 'FORBIDDEN_FIELD' using errcode = '42501';
      end if;
      -- el estudio no se publica a sí mismo ni marca su embed como válido: lo hace el servidor/admin
      if new.status <> old.status and new.status = 'published' then new.status := old.status; end if;
      new.embed_ok := old.embed_ok; new.embed_checked_at := old.embed_checked_at; new.embed_error := old.embed_error;
      if new.embed_url is distinct from old.embed_url then new.embed_ok := false; new.embed_error := 'Pendiente de comprobar'; end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger products_guard before insert or update on public.products for each row execute function public.products_guard();

-- ---------------------------------------------------------------- claves (NUNCA en claro)
create table public.product_keys (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  key_cipher text not null,                 -- 'v1:' || base64(iv || AES-256-GCM(clave)) · lo cifra la Edge Function
  key_hash text not null,                   -- HMAC-SHA256 hex de la clave normalizada (solo para detectar duplicados)
  key_last4 text not null check (char_length(key_last4) = 4),
  status text not null default 'available' check (status in ('available','redeemed','revoked')),
  added_by uuid references auth.users(id),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, key_hash)
);
create index on public.product_keys(product_id, status);
alter table public.product_keys enable row level security;          -- sin policies: nadie del cliente la lee ni escribe
revoke all on public.product_keys from anon, authenticated;

create table public.key_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid, product_id text, key_id uuid,
  action text not null check (action in ('import','reveal','revoke')),
  detail jsonb
);
alter table public.key_audit enable row level security;
revoke all on public.key_audit from anon, authenticated;
create policy key_audit_admin on public.key_audit for select to authenticated using (public.is_admin());
grant select on public.key_audit to authenticated;

-- Catálogo para el cliente: solo recuento de claves, nunca claves.
create view public.catalog as
select p.id, p.studio_id, s.name as studio_name, s.slug as studio_slug, p.title, p.description, p.genre, p.platform, p.pegi,
       p.adult, p.price_pz, p.discount_pct, p.trial, p.itch_url, p.store_url,
       case when p.embed_ok then p.embed_url end as embed_url, p.embed_ok, p.exe_match, p.media,
       (select count(*) from public.product_keys k where k.product_id = p.id and k.status = 'available')::int as stock
from public.products p join public.studios s on s.id = p.studio_id
where p.status = 'published';
grant select on public.catalog to authenticated;

create function public.studio_key_stats(p_studio uuid)
returns table(product_id text, title text, available int, redeemed int, revoked int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_studio_member(p_studio) or public.is_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return query
    select p.id, p.title,
      count(*) filter (where k.status = 'available')::int, count(*) filter (where k.status = 'redeemed')::int,
      count(*) filter (where k.status = 'revoked')::int
    from public.products p left join public.product_keys k on k.product_id = p.id
    where p.studio_id = p_studio group by p.id, p.title order by p.title;
end $$;
grant execute on function public.studio_key_stats(uuid) to authenticated;

-- ---------------------------------------------------------------- Pz (libro mayor) y pedidos
create table public.pz_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta <> 0),
  concept text not null check (char_length(concept) <= 200),
  ref text not null,                        -- clave de idempotencia
  created_at timestamptz not null default now(),
  unique (user_id, ref)
);
create index on public.pz_ledger(user_id, created_at);
alter table public.pz_ledger enable row level security;
create policy ledger_select on public.pz_ledger for select to authenticated using (user_id = auth.uid());

create function public.get_balance() returns integer language sql stable security definer set search_path = public as
$$ select coalesce(sum(delta), 0)::int from public.pz_ledger where user_id = auth.uid() $$;
grant execute on function public.get_balance() to authenticated;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  product_id text not null references public.products(id),
  key_id uuid not null references public.product_keys(id),
  price_pz integer not null,
  commission_pz integer not null,           -- 12 % para el Grupo de La Placeta
  studio_net_pz integer not null,           -- resto para el estudio
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
alter table public.orders enable row level security;
create policy orders_select on public.orders for select to authenticated using (user_id = auth.uid());
-- Los estudios NO leen pedidos (no ven quién compró); usan studio_key_stats para recuentos.

-- Pedidos propios con la clave enmascarada (la clave completa solo sale por la Edge Function reveal-key).
create function public.my_orders() returns table(id uuid, product_id text, title text, studio_name text, price_pz int, created_at timestamptz, key_last4 text)
language sql stable security definer set search_path = public as $$
  select o.id, o.product_id, p.title, s.name, o.price_pz, o.created_at, k.key_last4
  from public.orders o join public.products p on p.id = o.product_id join public.studios s on s.id = p.studio_id
  join public.product_keys k on k.id = o.key_id where o.user_id = auth.uid() order by o.created_at desc $$;
grant execute on function public.my_orders() to authenticated;

-- Canjear: requiere plan, edad, saldo y clave libre. Todo en una transacción.
create function public.redeem_product(p_product text, p_adult_ok boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_p public.products; v_key public.product_keys; v_price int; v_comm int; v_order uuid; v_bal int; v_pct numeric;
begin
  perform public.require_plan();
  select * into v_p from public.products where id = p_product and status = 'published';
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_p.trial then raise exception 'PRODUCT_IS_FREE' using errcode = 'P0001'; end if;
  if v_p.adult and not (p_adult_ok and (select age18_confirmed from public.profiles where id = auth.uid())) then
    raise exception 'AGE_REQUIRED' using errcode = 'P0001'; end if;
  if exists (select 1 from public.orders where user_id = auth.uid() and product_id = p_product) then
    raise exception 'ALREADY_OWNED' using errcode = 'P0001'; end if;
  -- bloquea al usuario para que dos canjes simultáneos no gasten el mismo saldo
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  v_price := round(v_p.price_pz * (100 - v_p.discount_pct) / 100.0);
  select coalesce(sum(delta), 0) into v_bal from public.pz_ledger where user_id = auth.uid();
  if v_bal < v_price then raise exception 'INSUFFICIENT_PZ' using errcode = 'P0001'; end if;
  select * into v_key from public.product_keys where product_id = p_product and status = 'available'
    order by created_at limit 1 for update skip locked;
  if not found then raise exception 'OUT_OF_STOCK' using errcode = 'P0001'; end if;
  v_pct := public.setting('commission_pct')::numeric;
  v_comm := round(v_price * v_pct / 100.0);
  update public.product_keys set status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = now() where id = v_key.id;
  insert into public.orders(user_id, product_id, key_id, price_pz, commission_pz, studio_net_pz)
    values (auth.uid(), p_product, v_key.id, v_price, v_comm, v_price - v_comm) returning id into v_order;
  if v_price > 0 then
    insert into public.pz_ledger(user_id, delta, concept, ref) values (auth.uid(), -v_price, 'Canje: ' || v_p.title, 'order:' || v_order);
  end if;
  return v_order;
end $$;
grant execute on function public.redeem_product(text, boolean) to authenticated;

-- ---------------------------------------------------------------- recompensas
create table public.claims (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_key text not null,
  amount integer not null check (amount between 1 and 75),
  status text not null default 'confirmed' check (status in ('confirmed','review','rejected')),
  evidence jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, claim_key)
);
alter table public.claims enable row level security;
create policy claims_select on public.claims for select to authenticated using (user_id = auth.uid() or public.is_admin());

create table public.attempt_reviews (
  id bigserial primary key,
  claim_id bigint not null references public.claims(id) on delete cascade,
  evidence jsonb not null,                  -- TECH-006: borrar pasado el plazo de conservación
  decided_by uuid references auth.users(id),
  decided_at timestamptz
);
alter table public.attempt_reviews enable row level security;
create policy reviews_admin on public.attempt_reviews for select to authenticated using (public.is_admin());

-- Reglas comunes de recompensa: plan, importe ≤ 75, tope diario, idempotencia.
create function public._grant_pz(p_key text, p_amount int, p_concept text, p_evidence jsonb, p_review boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare v_today int; v_claim bigint;
begin
  perform public.require_plan();
  if p_amount < 1 or p_amount > public.setting('max_claim_pz')::int then raise exception 'AMOUNT_OUT_OF_RANGE' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 1));
  if exists (select 1 from public.claims where user_id = auth.uid() and claim_key = p_key) then
    raise exception 'ALREADY_CLAIMED' using errcode = 'P0001'; end if;
  select coalesce(sum(delta), 0) into v_today from public.pz_ledger
    where user_id = auth.uid() and delta > 0 and created_at >= date_trunc('day', now());
  if v_today + p_amount > public.setting('daily_pz_cap')::int then raise exception 'DAILY_CAP' using errcode = 'P0001'; end if;
  insert into public.claims(user_id, claim_key, amount, status, evidence)
    values (auth.uid(), p_key, p_amount, case when p_review then 'review' else 'confirmed' end, case when p_review then p_evidence end)
    returning id into v_claim;
  if p_review then
    insert into public.attempt_reviews(claim_id, evidence) values (v_claim, coalesce(p_evidence, '{}'::jsonb));
  else
    insert into public.pz_ledger(user_id, delta, concept, ref) values (auth.uid(), p_amount, p_concept, 'claim:' || p_key);
  end if;
  return (select coalesce(sum(delta), 0)::int from public.pz_ledger where user_id = auth.uid());
end $$;
revoke all on function public._grant_pz(text, int, text, jsonb, boolean) from public, anon, authenticated;

-- Tests: la corrección sigue en el cliente (TECH-001). El servidor limita importe, repetición y tope diario.
create function public.claim_test_reward(p_test text, p_amount int, p_concept text, p_evidence jsonb default null, p_review boolean default false) returns int
language sql security definer set search_path = public as
$$ select public._grant_pz('test:' || left(p_test, 80), p_amount, left(p_concept, 200), p_evidence, p_review) $$;
grant execute on function public.claim_test_reward(text, int, text, jsonb, boolean) to authenticated;

-- Aprobar una recompensa en revisión (solo admin)
create function public.review_decide(p_claim bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_c public.claims;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_c from public.claims where id = p_claim and status = 'review' for update;
  if not found then raise exception 'NOT_IN_REVIEW' using errcode = 'P0001'; end if;
  update public.claims set status = case when p_ok then 'confirmed' else 'rejected' end where id = p_claim;
  update public.attempt_reviews set decided_by = auth.uid(), decided_at = now() where claim_id = p_claim;
  if p_ok then insert into public.pz_ledger(user_id, delta, concept, ref) values (v_c.user_id, v_c.amount, 'Revisión aprobada', 'claim:' || v_c.claim_key); end if;
end $$;
grant execute on function public.review_decide(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------- tiempo de juego + Arcade Shield en servidor
create table public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id),
  source text not null check (source in ('web','desktop')),
  started_at timestamptz not null default now(),
  last_beat_at timestamptz not null default now(),
  last_presence_at timestamptz not null default now(),
  ms_total bigint not null default 0,
  broken boolean not null default false,     -- el jugador (o el sistema) marcó que el juego no cargaba / daba error
  ended boolean not null default false
);
create index on public.play_sessions(user_id, product_id);
alter table public.play_sessions enable row level security;
create policy sessions_select on public.play_sessions for select to authenticated using (user_id = auth.uid());

create table public.embed_reports (
  id bigserial primary key,
  product_id text not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text, created_at timestamptz not null default now(),
  unique (product_id, user_id, created_at)
);
alter table public.embed_reports enable row level security;
create policy embed_reports_admin on public.embed_reports for select to authenticated using (public.is_admin());

create function public.start_play_session(p_product text, p_source text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_p public.products; v_id uuid;
begin
  perform public.require_plan();
  select * into v_p from public.products where id = p_product and status = 'published';
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001'; end if;
  -- Arcade Shield: un juego incrustado solo cuenta si el servidor comprobó que carga (check-embed)
  if p_source = 'web' and not (v_p.embed_ok and v_p.embed_url is not null) then
    raise exception 'EMBED_UNAVAILABLE' using errcode = 'P0001'; end if;
  if p_source = 'desktop' and v_p.exe_match is null then raise exception 'DESKTOP_UNSUPPORTED' using errcode = 'P0001'; end if;
  -- una sola sesión viva por usuario
  update public.play_sessions set ended = true where user_id = auth.uid() and not ended;
  insert into public.play_sessions(user_id, product_id, source) values (auth.uid(), p_product, p_source) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.start_play_session(text, text) to authenticated;

-- Latido: el servidor no se fía del cliente. Suma como máximo el tiempo real transcurrido (y ≤ 35 s por latido).
-- En web exige confirmación de presencia reciente (≤ 6 min). Devuelve el total de ms de la sesión.
create function public.record_heartbeat(p_session uuid, p_delta_ms int) returns bigint
language plpgsql security definer set search_path = public as $$
declare v public.play_sessions; v_gap bigint; v_add bigint;
begin
  perform public.require_plan();
  select * into v from public.play_sessions where id = p_session and user_id = auth.uid() for update;
  if not found or v.ended then raise exception 'SESSION_INVALID' using errcode = 'P0001'; end if;
  if v.broken then raise exception 'SESSION_BROKEN' using errcode = 'P0001'; end if;
  v_gap := (extract(epoch from (now() - v.last_beat_at)) * 1000)::bigint;
  v_add := least(greatest(p_delta_ms, 0), 35000, v_gap + 1500);
  if v_gap < 4000 then v_add := 0; end if;                                -- anti-spam: mínimo 4 s entre latidos
  if v.source = 'web' and now() - v.last_presence_at > interval '6 minutes' then v_add := 0; end if;
  update public.play_sessions set ms_total = ms_total + v_add, last_beat_at = now() where id = p_session;
  if v_add > 0 then update public.profiles set played_ms = played_ms + v_add where id = auth.uid(); end if;
  return v.ms_total + v_add;
end $$;
grant execute on function public.record_heartbeat(uuid, int) to authenticated;

create function public.confirm_presence(p_session uuid) returns void
language sql security definer set search_path = public as
$$ update public.play_sessions set last_presence_at = now() where id = p_session and user_id = auth.uid() and not ended $$;
grant execute on function public.confirm_presence(uuid) to authenticated;

-- "El juego no carga": detiene la sesión, no cuenta y, con 3 jugadores distintos en 24 h, retira el embed.
create function public.report_embed_broken(p_session uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v public.play_sessions; v_n int;
begin
  select * into v from public.play_sessions where id = p_session and user_id = auth.uid();
  if not found then raise exception 'SESSION_INVALID' using errcode = 'P0001'; end if;
  update public.play_sessions set broken = true, ended = true where id = p_session;
  insert into public.embed_reports(product_id, user_id, reason) values (v.product_id, auth.uid(), left(p_reason, 200));
  select count(distinct user_id) into v_n from public.embed_reports where product_id = v.product_id and created_at > now() - interval '24 hours';
  if v_n >= 3 then update public.products set embed_ok = false, embed_error = 'Retirado: varios jugadores reportan errores' where id = v.product_id; end if;
end $$;
grant execute on function public.report_embed_broken(uuid, text) to authenticated;

create table public.play_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  body text not null check (char_length(body) between 30 and 800),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.play_ratings enable row level security;
create policy ratings_select on public.play_ratings for select to authenticated using (true);

-- Recompensa por jugar: el servidor calcula los hitos con SU tiempo (no el del cliente).
create function public.claim_play_reward(p_product text, p_stars int default null, p_body text default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_ms bigint; v_pz int := 0; v_bonus int := 0;
begin
  perform public.require_plan();
  select coalesce(sum(ms_total), 0) into v_ms from public.play_sessions
    where user_id = auth.uid() and product_id = p_product and not broken;
  v_pz := case when v_ms >= 1800000 then 75 when v_ms >= 900000 then 37 when v_ms >= 300000 then 12 else 0 end;
  if v_pz = 0 then raise exception 'NOT_ENOUGH_TIME' using errcode = 'P0001'; end if;
  if p_stars between 1 and 5 and char_length(coalesce(p_body, '')) between 30 and 800 then
    insert into public.play_ratings(user_id, product_id, stars, body) values (auth.uid(), p_product, p_stars, p_body)
      on conflict (user_id, product_id) do nothing;
    if found then v_bonus := 12; end if;
  end if;
  -- _grant_pz limita a 75 por reclamación: el bonus de valoración va en su propia reclamación
  if v_bonus > 0 then perform public._grant_pz('rate:' || p_product, v_bonus, 'Valoración · ' || p_product, null); end if;
  return public._grant_pz('play:' || p_product, v_pz, 'Arcade Shield · ' || p_product || ' · ' || (v_ms / 60000) || ' min', null);
end $$;
grant execute on function public.claim_play_reward(text, int, text) to authenticated;

-- ---------------------------------------------------------------- banners promocionales
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'season' check (kind in ('blackfriday','season','english','custom')),
  locale text not null default 'es' check (locale in ('es','en')),
  title text not null check (char_length(title) <= 80),
  subtitle text check (char_length(subtitle) <= 160),
  cta_label text default 'Ver ofertas',
  filter text not null default 'Ofertas',          -- filtro de Diversión que aplica el banner ('Ofertas', un género o 'dev:Estudio')
  color_from text not null default '#7B3FF2' check (color_from ~ '^#[0-9A-Fa-f]{6}$'),
  color_to text not null default '#2BD67B' check (color_to ~ '^#[0-9A-Fa-f]{6}$'),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  sort int not null default 0
);
alter table public.banners enable row level security;
create policy banners_select on public.banners for select to authenticated
  using ((active and now() between starts_at and ends_at) or public.is_admin());
create policy banners_admin on public.banners for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.banners(kind, title, subtitle, cta_label, filter, color_from, color_to, starts_at, ends_at, sort) values
 ('blackfriday','Black Friday en Placeta Joven','Juegos indie con descuento hasta el lunes. Tus Pz rinden más.','Ver ofertas','Ofertas','#111111','#7B3FF2','2026-11-23','2026-12-01',0);

-- ---------------------------------------------------------------- almacenamiento
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars','avatars', false, 524288, array['image/jpeg','image/png','image/webp']),
  ('studio-logos','studio-logos', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Fotos de perfil: privadas, una carpeta por usuario ({uid}/...). Se muestran con URL firmada.
create policy avatars_rw on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- Logos de estudio: lectura pública; escritura solo de miembros en {studio_id}/...
create policy logos_read on storage.objects for select using (bucket_id = 'studio-logos');
create policy logos_write on storage.objects for all to authenticated
  using (bucket_id = 'studio-logos' and public.is_studio_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'studio-logos' and public.is_studio_member(((storage.foldername(name))[1])::uuid));

commit;
