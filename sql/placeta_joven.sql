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

-- tipoJuego = clave (se canjea con Pz) o recomendado (acceso gratuito externo).
-- Estos campos viven dentro de `data` para mantener compatibilidad con filas existentes.

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
  }'::jsonb),
  ('vj-ejemplo-4', 'videojuegos', 4, true, '{
    "nombre": "Videojuego Ejemplo 4",
    "desarrolladora": "Estudio Ejemplo Cuatro",
    "genero": "Aventura",
    "descripcion": "Una aventura roguelite con un mundo generado. Ejemplo de ficha para la maqueta: este título no existe todavía.",
    "plataforma": "Steam",
    "edadRecomendada": "10+",
    "pz": 400,
    "imagen": null,
    "disponibilidad": "Disponible",
    "condiciones": "Una key por usuario y título. No se pueden revender las claves."
  }'::jsonb),
  ('vj-ejemplo-5', 'videojuegos', 5, true, '{
    "nombre": "Videojuego Ejemplo 5",
    "desarrolladora": "Estudio Ejemplo Cinco",
    "genero": "Carreras",
    "descripcion": "Un arcade de carreras para partidas cortas. Ejemplo de ficha para la maqueta: este título no existe todavía.",
    "plataforma": "Steam",
    "edadRecomendada": "7+",
    "pz": 300,
    "imagen": null,
    "disponibilidad": "Disponible",
    "condiciones": "Una key por usuario y título. No se pueden revender las claves."
  }'::jsonb),
  ('vj-ejemplo-6', 'videojuegos', 6, true, '{
    "nombre": "Videojuego Ejemplo 6",
    "desarrolladora": "Estudio Ejemplo Seis",
    "genero": "Estrategia",
    "descripcion": "Un juego de estrategia por turnos. Ejemplo de ficha para la maqueta: este título no existe todavía.",
    "plataforma": "Steam",
    "edadRecomendada": "12+",
    "pz": 600,
    "imagen": null,
    "disponibilidad": "Disponible",
    "condiciones": "Una key por usuario y título. No se pueden revender las claves."
  }'::jsonb)
on conflict (id) do nothing;

-- Solo las recompensas «Disponibles» de las que hay stock real se pueden canjear.
update public.placeta_joven_recompensas
  set data = data || '{"canjeable": true}'::jsonb
  where id in ('vj-ejemplo-1', 'vj-ejemplo-2', 'vj-ejemplo-4', 'vj-ejemplo-5', 'vj-ejemplo-6');
update public.placeta_joven_recompensas
  set data = data || '{"canjeable": false}'::jsonb
  where id = 'vj-ejemplo-3';

-- ══════════════════════════════════════════════════════════════════════════
-- Pool de keys por recompensa (códigos reales, SOLO en el servidor)
-- --------------------------------------------------------------------------
-- Cada fila = una key en stock de una recompensa. El cliente NUNCA ve esta
-- tabla: la API entrega el código únicamente al socio que la consigue (la
-- guarda en su doc.keys). `estado` = disponible | asignada. Cuando una key
-- se asigna se marca con el placeta_id y se impide reasignarla (1 por título).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.placeta_joven_keypool (
  id text primary key,
  recompensa_id text not null,
  codigo text not null,
  plataforma text not null default '',
  estado text not null default 'disponible',
  placeta_id text,
  asignada_en timestamptz,
  creada_en timestamptz not null default now()
);

-- Sin políticas de lectura: ni anónimo ni authenticated leen los códigos.
-- Solo la service role key (usada por la API) puede leer/asignar.
alter table public.placeta_joven_keypool enable row level security;

-- Seed de ejemplo (códigos INVENTADOS, no reales) para poder probar el canje
-- de extremo a extremo. Cuando haya colaboraciones reales se sustituyen por
-- los códigos reales del estudio.
insert into public.placeta_joven_keypool (id, recompensa_id, codigo, plataforma, estado) values
  ('kp-demo-1', 'vj-ejemplo-1', 'VJ1-EJEMPLO-0000-AAAA', 'steam', 'disponible'),
  ('kp-demo-2', 'vj-ejemplo-1', 'VJ1-EJEMPLO-0000-BBBB', 'steam', 'disponible'),
  ('kp-demo-3', 'vj-ejemplo-2', 'VJ2-EJEMPLO-1111-CCCC', 'steam', 'disponible'),
  ('kp-demo-4', 'vj-ejemplo-2', 'VJ2-EJEMPLO-1111-DDDD', 'steam', 'disponible'),
  ('kp-demo-5', 'vj-ejemplo-4', 'VJ4-EJEMPLO-2222-EEEE', 'steam', 'disponible'),
  ('kp-demo-6', 'vj-ejemplo-4', 'VJ4-EJEMPLO-2222-FFFF', 'steam', 'disponible'),
  ('kp-demo-7', 'vj-ejemplo-5', 'VJ5-EJEMPLO-3333-GGGG', 'steam', 'disponible'),
  ('kp-demo-8', 'vj-ejemplo-5', 'VJ5-EJEMPLO-3333-HHHH', 'steam', 'disponible'),
  ('kp-demo-9', 'vj-ejemplo-6', 'VJ6-EJEMPLO-4444-IIII', 'steam', 'disponible'),
  ('kp-demo-10', 'vj-ejemplo-6', 'VJ6-EJEMPLO-4444-JJJJ', 'steam', 'disponible')
on conflict (id) do nothing;

-- Vista de stock disponible por recompensa (para mostrar «Quedan N» / «Agotado»
-- sin exponer los códigos). La API la lee con la service role key.
-- Nota: para cargar cientos de keys de un solo uso por título usa
-- `node scripts/load-keys.js <recompensaId> keys.txt` (una key por línea).
create or replace view public.placeta_joven_keypool_stock as
select
  recompensa_id,
  count(*) filter (where estado = 'disponible') as disponibles,
  count(*) as total
from public.placeta_joven_keypool
group by recompensa_id;
