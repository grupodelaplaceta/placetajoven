-- ── Placeta Joven · Supabase ──────────────────────────────────────────────
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.
-- La API guarda el documento de suscripción completo en la columna jsonb `data`.

create table if not exists public.placeta_joven (
  placeta_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Índice por subscription_id para resolver el webhook de Lemon Squeezy
create index if not exists placeta_joven_subscription_id
  on public.placeta_joven ((data ->> 'subscription_id'));

-- RLS activado: la API usa la service role key (omite RLS).
alter table public.placeta_joven enable row level security;

-- Permisos: el servicio necesita full access (lo da la service role key por defecto).
