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

-- ══════════════════════════════════════════════════════════════════════════
-- Catálogo de recompensas («Recompensas disponibles»)
-- --------------------------------------------------------------------------
-- Cada fila = una recompensa del catálogo. La API la lee con la service role
-- key y solo expone campos públicos. La columna `data` guarda la ficha.
-- El seed contiene SOLO EJEMPLOS (nombres inventados): aún no hay ninguna
-- colaboración confirmada.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.placeta_joven_recompensas (
  id text primary key,
  categoria text not null default 'otros',
  orden int not null default 0,
  activa boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.placeta_joven_recompensas enable row level security;

-- Permisos de lectura para el rol anónimo si en el futuro el catálogo se
-- muestra en la web pública. La API usa la service role key (omite RLS).
create policy "lectura publica del catalogo"
  on public.placeta_joven_recompensas
  for select
  to anon, authenticated
  using (activa = true);

-- Seed de demostración (3 ejemplos «Videojuego Ejemplo X», nada real).
insert into public.placeta_joven_recompensas (id, categoria, orden, activa, data) values
  ('vj-ejemplo-1', 'videojuegos', 1, true, '{
    "nombre": "Videojuego Ejemplo 1",
    "desarrolladora": "Estudio Ejemplo Uno",
    "descripcion": "Una aventura de puzles ambientada en un mundo luminoso. Ejemplo de ficha para la maqueta: este título no existe todavía y no representa ninguna colaboración confirmada.",
    "plataforma": "Steam",
    "edadRecomendada": "7+",
    "pz": 500,
    "imagen": null,
    "disponibilidad": "Disponible",
    "condiciones": "Una key por usuario y título. No se pueden revender las claves."
  }'::jsonb),
  ('vj-ejemplo-2', 'videojuegos', 2, true, '{
    "nombre": "Videojuego Ejemplo 2 — Playtest",
    "desarrolladora": "Estudio Ejemplo Dos",
    "descripcion": "Demo jugable (playtest) de un plataformas en desarrollo. Ejemplo de ficha para la maqueta: el acceso anticipado no está confirmado todavía.",
    "plataforma": "Steam",
    "edadRecomendada": "16+",
    "pz": 250,
    "imagen": null,
    "disponibilidad": "Disponible",
    "condiciones": "Una key por usuario y título. Solo para probar el juego durante la fase de test."
  }'::jsonb),
  ('vj-ejemplo-3', 'videojuegos', 3, true, '{
    "nombre": "Videojuego Ejemplo 3",
    "desarrolladora": "Estudio Ejemplo Tres",
    "descripcion": "Un simulador cooperativo para jugar en grupo. Ejemplo de ficha para la maqueta: la incorporación al programa está en estudio.",
    "plataforma": "Steam",
    "edadRecomendada": "12+",
    "pz": 350,
    "imagen": null,
    "disponibilidad": "Próximamente",
    "condiciones": "Una key por usuario y título. Se informará de la fecha de disponibilidad."
  }'::jsonb)
on conflict (id) do nothing;
