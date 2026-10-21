-- ============================================================================
-- academia_0046_noticias_y_avisos.sql — M24: publicar desde el panel y noticias con IA
--
-- Pedido de Alejandro (20-oct-2026): desde el panel de V-AI-P escribir
-- publicaciones, avisos y noticias; un botón que «cace» las mejores noticias de
-- IA del día, las limpie y deje un top 3 con imagen, título, resumen y «Leer
-- más»; y crear una noticia pegando la liga de un artículo o de un video. Nada
-- se publica solo: el equipo revisa y publica con un clic.
--
--   1. `community_posts` gana la liga de la noticia (`enlace_url`, `enlace_medio`),
--      su `resumen`, el fijado con fecha de fin (`pinned_until`) y quién la
--      publicó (`publicado_por`, cuando firma «Equipo VADAI»). Solo el equipo y
--      el servidor los escriben (trigger, no security definer: `es_servicio()`
--      mira `current_user`, que en una función definer siempre es el dueño).
--   2. `academia_desfijar_vencidos()`: quita el fijado cuando pasa su fecha. No
--      hay pg_cron: se llama al leer el muro, en el panel y en el cron.
--   3. El tema «Avisos» (solo el equipo) en la casa de V-AI-P.
--   4. `news_hunts` y `news_items`: cada búsqueda (cacería o liga) y sus
--      propuestas. Las escribe solo el servidor; el equipo las lee y las revisa.
--   5. `agent_runs` acepta las tareas nuevas y registra lecturas de páginas.
--   6. `academia_noticias_iniciar()`: abre una búsqueda con candado, límite del
--      día y una a la vez.
--
-- Solo schema `academia`. La aplica Alejandro con `pnpm db:migrate`.
-- ============================================================================

-- ==========================================================================
-- 1. Publicaciones con liga, resumen y fijado con fecha
-- ==========================================================================

alter table academia.community_posts
  add column enlace_url text
    check (enlace_url is null or (enlace_url ~ '^https://' and char_length(enlace_url) <= 2000)),
  add column enlace_medio text
    check (enlace_medio is null or char_length(enlace_medio) between 1 and 80),
  add column resumen text
    check (resumen is null or char_length(resumen) between 1 and 600),
  add column pinned_until timestamptz,
  add column publicado_por uuid references academia.profiles (user_id) on delete set null;

-- El barrido de fijados vencidos solo mira los que tienen fecha.
create index community_posts_fijado_hasta_idx
  on academia.community_posts (pinned_until)
  where pinned and pinned_until is not null;

-- Solo el equipo y el servidor escriben estos campos. A un alumno se le
-- ignoran en silencio (en un insert quedan en null; en un update, como
-- estaban), igual que `via` en 0044. `publicado_por` es siempre quien firma:
-- una persona del equipo no puede ponerle a otra.
create or replace function academia.academia_post_campos_de_equipo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if academia.es_servicio() then
    return new;
  end if;

  if academia.is_equipo() then
    if new.publicado_por is not null and new.publicado_por is distinct from auth.uid()
       and (tg_op = 'INSERT' or new.publicado_por is distinct from old.publicado_por) then
      new.publicado_por := auth.uid();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.enlace_url := null;
    new.enlace_medio := null;
    new.resumen := null;
    new.pinned_until := null;
    new.publicado_por := null;
  else
    new.enlace_url := old.enlace_url;
    new.enlace_medio := old.enlace_medio;
    new.resumen := old.resumen;
    new.pinned_until := old.pinned_until;
    new.publicado_por := old.publicado_por;
  end if;
  return new;
end;
$$;

create trigger community_posts_campos_de_equipo
  before insert or update of enlace_url, enlace_medio, resumen, pinned_until, publicado_por
  on academia.community_posts
  for each row execute function academia.academia_post_campos_de_equipo();

revoke all on function academia.academia_post_campos_de_equipo() from public;
grant execute on function academia.academia_post_campos_de_equipo() to authenticated, service_role;

-- ==========================================================================
-- 2. Fijados que vencen
-- ==========================================================================

-- Definer a propósito: quien abre el muro no puede editar publicaciones ajenas,
-- pero sí tiene que ver el muro sin un fijado vencido arriba. Solo hace esto:
-- apagar fijados cuya fecha ya pasó.
create or replace function academia.academia_desfijar_vencidos()
returns integer
language sql
security definer
set search_path = ''
as $$
  with vencidos as (
    update academia.community_posts
       set pinned = false, pinned_until = null
     where pinned and pinned_until is not null and pinned_until <= now()
    returning 1
  )
  select count(*)::int from vencidos
$$;

revoke all on function academia.academia_desfijar_vencidos() from public;
grant execute on function academia.academia_desfijar_vencidos() to authenticated, service_role;

-- ==========================================================================
-- 3. El tema «Avisos» en la casa de V-AI-P
-- ==========================================================================

-- Avisos que no son clase (una herramienta nueva, un cambio de horario, una
-- bienvenida): publicaciones del equipo, fijadas el tiempo que se elija, donde
-- los miembros comentan y reaccionan. Las clases viven en la pestaña Clases.
insert into academia.community_topics (course_id, name, slug, position, solo_equipo)
select p.hub_course_id, 'Avisos', 'avisos', -2, true
  from academia.membership_plans p
 where p.slug = 'v-ai-p' and p.hub_course_id is not null
on conflict (course_id, slug) do update set solo_equipo = true;

-- ==========================================================================
-- 4. Las búsquedas de noticias y sus propuestas
-- ==========================================================================

create table academia.news_hunts (
  id           uuid primary key default gen_random_uuid(),
  es_qa        boolean not null default false,
  tipo         text not null check (tipo in ('caceria', 'liga')),
  origen       text not null check (origen in ('boton', 'cron')),
  estado       text not null default 'buscando'
               check (estado in ('buscando', 'lista', 'sin_resultados', 'fallida')),
  paso         text,
  pedido_por   uuid references academia.profiles (user_id) on delete set null,
  url_pedida   text check (url_pedida is null or char_length(url_pedida) <= 2000),
  enfoque      text check (enfoque is null or char_length(enfoque) <= 300),
  -- [{ "url": …, "motivo": "duplicada|vieja|rota|no_publica|inventada|dominio|…" }]
  descartes    jsonb not null default '[]'::jsonb check (jsonb_typeof(descartes) = 'array'),
  detalle      text check (detalle is null or char_length(detalle) <= 2000),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

-- Una búsqueda de cada tipo a la vez (por modo QA).
create unique index news_hunts_una_a_la_vez
  on academia.news_hunts (es_qa, tipo)
  where estado = 'buscando';

create index news_hunts_dia_idx on academia.news_hunts (es_qa, tipo, started_at desc);

alter table academia.news_hunts enable row level security;

create policy news_hunts_select_equipo on academia.news_hunts
  for select to authenticated
  using ((select academia.is_equipo()));

create table academia.news_items (
  id                   uuid primary key default gen_random_uuid(),
  es_qa                boolean not null default false,
  hunt_id              uuid references academia.news_hunts (id) on delete set null,
  course_id            uuid not null references academia.courses (id) on delete cascade,
  url                  text not null check (url ~ '^https://' and char_length(url) <= 2000),
  url_original         text check (url_original is null or char_length(url_original) <= 2000),
  -- sha256 de la URL normalizada: la llave para no repetir una noticia.
  url_hash             text not null check (url_hash ~ '^[0-9a-f]{64}$'),
  tipo_fuente          text not null default 'articulo' check (tipo_fuente in ('articulo', 'video')),
  medio                text check (medio is null or char_length(medio) <= 80),
  titulo               text not null check (char_length(titulo) between 3 and 160),
  resumen              text not null check (char_length(resumen) between 1 and 600),
  texto                text not null check (char_length(texto) between 1 and 5000),
  imagen_url           text check (imagen_url is null or char_length(imagen_url) <= 2000),
  imagen_path          text check (imagen_path is null or char_length(imagen_path) <= 400),
  publicado_en_fuente  timestamptz,
  orden                smallint,
  -- Solo para el equipo: la advertencia del modelo y las fuentes que consultó.
  notas                text check (notas is null or char_length(notas) <= 2000),
  estado               text not null default 'propuesta'
                       check (estado in ('propuesta', 'publicada', 'descartada')),
  post_id              uuid references academia.community_posts (id) on delete set null,
  revisado_por         uuid references academia.profiles (user_id) on delete set null,
  revisado_en          timestamptz,
  created_at           timestamptz not null default now(),
  unique (es_qa, url_hash)
);

create index news_items_propuestas_idx on academia.news_items (es_qa, estado, created_at desc);

alter table academia.news_items enable row level security;

-- El equipo las ve y las revisa (descartar, corregir título o texto). Crearlas
-- y publicarlas es trabajo del servidor.
create policy news_items_select_equipo on academia.news_items
  for select to authenticated
  using ((select academia.is_equipo()));

create policy news_items_update_equipo on academia.news_items
  for update to authenticated
  using ((select academia.is_equipo()))
  with check ((select academia.is_equipo()));

-- ==========================================================================
-- 5. Las corridas del modelo: tareas nuevas y lecturas de páginas
-- ==========================================================================

alter table academia.agent_runs drop constraint agent_runs_tarea_check;
alter table academia.agent_runs
  add constraint agent_runs_tarea_check
  check (tarea in ('responder', 'escalar', 'resumen', 'noticias', 'probador', 'noticias_redactar', 'noticia_liga'));

alter table academia.agent_runs
  add column lecturas integer not null default 0,
  add column news_hunt_id uuid references academia.news_hunts (id) on delete set null;

-- ==========================================================================
-- 6. Abrir una búsqueda: candado, límite del día y una a la vez
-- ==========================================================================

-- Cierra las búsquedas que se quedaron colgadas (más de 6 minutos), cuenta las
-- del día (hora de la Ciudad de México) y abre una nueva. Regresa su id, o un
-- error con mensaje para el panel:
--   P0001 'limite'     ya se hicieron las del día
--   P0001 'ocupado'    hay una de ese tipo en curso
create or replace function academia.academia_noticias_iniciar(
  p_tipo text,
  p_origen text,
  p_pedido_por uuid,
  p_url text,
  p_enfoque text,
  p_limite integer,
  p_qa boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy timestamptz := date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
  v_hechas integer;
  v_id uuid;
begin
  -- Una a la vez por tipo: serializa a quien llega al mismo tiempo.
  perform pg_advisory_xact_lock(hashtext('academia_noticias_' || p_tipo || '_' || p_qa::text));

  update academia.news_hunts
     set estado = 'fallida', paso = null, finished_at = now(),
         detalle = coalesce(detalle, 'Se quedó sin terminar más de 6 minutos.')
   where estado = 'buscando' and es_qa = p_qa and started_at < now() - interval '6 minutes';

  if exists (select 1 from academia.news_hunts where estado = 'buscando' and es_qa = p_qa and tipo = p_tipo) then
    raise exception 'ocupado';
  end if;

  select count(*) into v_hechas
    from academia.news_hunts
   where es_qa = p_qa and tipo = p_tipo and started_at >= v_hoy
     and estado <> 'fallida';
  if v_hechas >= p_limite then
    raise exception 'limite';
  end if;

  insert into academia.news_hunts (es_qa, tipo, origen, pedido_por, url_pedida, enfoque, paso)
  values (p_qa, p_tipo, p_origen, p_pedido_por, p_url, p_enfoque, 'Empezando')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function academia.academia_noticias_iniciar(text, text, uuid, text, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function academia.academia_noticias_iniciar(text, text, uuid, text, text, integer, boolean)
  to service_role;
