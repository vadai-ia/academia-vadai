-- academia_0045_agente.sql
-- M21: el agente de la comunidad.
--
-- POR QUÉ
-- Alejandro (16-oct-2026): un agente que conteste en todas las comunidades con
-- la voz de VADAI, con un retraso que se sienta humano; que deje borrador y
-- avise cuando no está seguro; que junte ideas y peticiones; que arme un
-- resumen digerible; búsqueda web limitada; tope de US$50 al mes con modelos
-- baratos, sin contestar cosas que no hagan sentido, y todo reportado al panel.
--
-- QUÉ CAMBIA
--   1. `agent_settings` (una fila): modo (apagado, solo borradores, automático),
--      prompt, umbral, horario, retraso, búsqueda web, tope y modelos.
--   2. `agent_knowledge`: lo que el agente sabe (material del repo, la
--      descripción de las lecciones publicadas, transcripts de Fireflies,
--      subtítulos de Bunny, notas del equipo), por curso o general.
--   3. `agent_jobs`: la cola. Un trabajo por publicación o comentario, único
--      (no se contesta dos veces lo mismo), tomado con un update atómico.
--   4. `agent_runs`: cada llamada al modelo con sus tokens y su costo. El tope
--      se cuida RESERVANDO el peor caso antes de llamar
--      (`academia_agente_reservar`, con candado: dos corridas a la vez no se
--      pasan del tope).
--   5. `agent_drafts`: respuestas y noticias que esperan a una persona.
--   6. `community_insights`: ideas, peticiones, quejas y dudas que se repiten.
--   7. `agent_digests`: el resumen del día.
--   8. `lesson_comments.via` y `agent_job_id` en los comentarios: la firma
--      («con Claude, nuestra IA» o «revisado por el Equipo VADAI») y un índice
--      único que impide dos respuestas del mismo trabajo.
--
-- Ajustes y costos: solo `is_admin()`. Borradores, ideas, resumen y cola: del
-- equipo (el community manager atiende la comunidad). Escribe el servidor.
--
-- `es_qa`: la suite corre contra esta misma base, con un Claude simulado. Sus
-- ajustes, su cola, su gasto, sus borradores y su resumen van aparte
-- (es_qa = true): una corrida de pruebas nunca cambia el modo del agente real,
-- ni gasta de su tope, ni le deja borradores al equipo.

-- ==========================================================================
-- 1. Ajustes
-- ==========================================================================

create table academia.agent_settings (
  es_qa             boolean primary key default false,
  -- 'apagado': no hace nada. 'borradores': todo va a borrador. 'automatico':
  -- publica lo que tiene certeza; lo demás, a borrador.
  modo              text not null default 'borradores' check (modo in ('apagado', 'borradores', 'automatico')),
  prompt            text not null default '' check (char_length(prompt) <= 20000),
  umbral            numeric(3, 2) not null default 0.80 check (umbral between 0.5 and 1),
  espera_min        integer not null default 25 check (espera_min between 0 and 600),
  espera_max        integer not null default 120 check (espera_max between 0 and 1440),
  hora_inicio       integer not null default 8 check (hora_inicio between 0 and 23),
  hora_fin          integer not null default 21 check (hora_fin between 1 and 24),
  busqueda_web      boolean not null default false,
  noticias          boolean not null default true,
  tope_usd          numeric(8, 2) not null default 50 check (tope_usd >= 0),
  modelo_rapido     text not null default 'claude-haiku-5-5',
  modelo_fuerte     text not null default 'claude-sonnet-5-5',
  -- Lo pone el servidor al llegar al tope; se quita solo al cambiar de mes o
  -- al subir el tope.
  pausado_por_tope  boolean not null default false,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references academia.profiles (user_id) on delete set null,
  check (espera_max >= espera_min),
  check (hora_fin > hora_inicio)
);

insert into academia.agent_settings (es_qa) values (false), (true) on conflict do nothing;

alter table academia.agent_settings enable row level security;

create policy agent_settings_admin on academia.agent_settings
  for all to authenticated
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

-- El community manager solo necesita saber si está encendido y si está en pausa.
create policy agent_settings_equipo_lee on academia.agent_settings
  for select to authenticated
  using ((select academia.is_equipo()));

-- ==========================================================================
-- 2. Conocimiento
-- ==========================================================================

create table academia.agent_knowledge (
  id          uuid primary key default gen_random_uuid(),
  fuente      text not null check (fuente in ('repo', 'plataforma', 'fireflies', 'bunny', 'equipo')),
  -- Para no duplicar al reimportar: la ruta del archivo, el id del transcript…
  clave       text not null,
  titulo      text not null check (char_length(titulo) between 2 and 200),
  -- null = vale para todos los cursos (ayuda de la plataforma, voz, glosario).
  course_id   uuid references academia.courses (id) on delete cascade,
  contenido   text not null check (char_length(contenido) <= 400000),
  -- Para el panel, sin traer el texto completo.
  caracteres  integer generated always as (char_length(contenido)) stored,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (fuente, clave)
);

create index agent_knowledge_curso_idx on academia.agent_knowledge (course_id) where activo;

alter table academia.agent_knowledge enable row level security;

create policy agent_knowledge_equipo_lee on academia.agent_knowledge
  for select to authenticated
  using ((select academia.is_equipo()));

create policy agent_knowledge_admin on academia.agent_knowledge
  for all to authenticated
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

-- ==========================================================================
-- 3. La cola
-- ==========================================================================

create table academia.agent_jobs (
  id               uuid primary key default gen_random_uuid(),
  -- 'post': una publicación del muro. 'comentario': un comentario en una
  -- publicación. 'leccion': una pregunta en una lección.
  tipo_origen      text not null check (tipo_origen in ('post', 'comentario', 'leccion')),
  origen_id        uuid not null,
  es_qa            boolean not null default false,
  course_id        uuid not null references academia.courses (id) on delete cascade,
  -- El hilo al que se contesta: el id de la publicación, o el comentario raíz de la lección.
  hilo_id          uuid not null,
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente', 'procesando', 'hecho', 'borrador', 'omitido', 'fallido')),
  toca_en          timestamptz not null,
  intentos         integer not null default 0,
  bloqueado_hasta  timestamptz,
  resultado        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tipo_origen, origen_id)
);

create index agent_jobs_por_tocar_idx on academia.agent_jobs (es_qa, toca_en) where estado = 'pendiente';

alter table academia.agent_jobs enable row level security;

create policy agent_jobs_equipo_lee on academia.agent_jobs
  for select to authenticated
  using ((select academia.is_equipo()));

-- Toma hasta `p_n` trabajos que ya tocan, de forma atómica: dos corridas del
-- cron a la vez nunca toman el mismo. Un trabajo «procesando» cuyo candado
-- venció (la corrida se cayó) vuelve a la cola; al tercer intento, fallido.
create or replace function academia.academia_agente_tomar(p_n integer, p_qa boolean)
returns setof academia.agent_jobs
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update academia.agent_jobs
     set estado = case when intentos >= 3 then 'fallido' else 'pendiente' end,
         resultado = case when intentos >= 3 then 'Tres intentos sin terminar.' else resultado end
   where estado = 'procesando' and bloqueado_hasta < now() and es_qa = p_qa;

  return query
  update academia.agent_jobs j
     set estado = 'procesando',
         intentos = j.intentos + 1,
         bloqueado_hasta = now() + interval '10 minutes',
         updated_at = now()
   where j.id in (
     select id from academia.agent_jobs
      where estado = 'pendiente' and toca_en <= now() and es_qa = p_qa
      order by toca_en
      limit p_n
      for update skip locked
   )
  returning j.*;
end;
$$;

revoke all on function academia.academia_agente_tomar(integer, boolean) from public, anon, authenticated;
grant execute on function academia.academia_agente_tomar(integer, boolean) to service_role;

-- ==========================================================================
-- 4. Corridas y el tope
-- ==========================================================================

create table academia.agent_runs (
  id                      uuid primary key default gen_random_uuid(),
  job_id                  uuid references academia.agent_jobs (id) on delete set null,
  es_qa                   boolean not null default false,
  tarea                   text not null check (tarea in ('responder', 'escalar', 'resumen', 'noticias', 'probador')),
  modelo                  text not null,
  estado                  text not null default 'reservada' check (estado in ('reservada', 'cerrada')),
  reservado_usd           numeric(10, 6) not null default 0,
  costo_usd               numeric(10, 6) not null default 0,
  tokens_entrada          integer not null default 0,
  tokens_salida           integer not null default 0,
  tokens_cache_lectura    integer not null default 0,
  tokens_cache_escritura  integer not null default 0,
  busquedas               integer not null default 0,
  decision                text,
  certeza                 numeric(3, 2),
  motivo                  text,
  created_at              timestamptz not null default now()
);

create index agent_runs_mes_idx on academia.agent_runs (es_qa, created_at);

alter table academia.agent_runs enable row level security;

create policy agent_runs_admin on academia.agent_runs
  for select to authenticated
  using ((select academia.is_admin()));

-- Lo gastado este mes (hora de la Ciudad de México): lo cerrado más lo
-- reservado que sigue abierto.
create or replace function academia.academia_agente_gastado(p_qa boolean default false)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case when estado = 'cerrada' then costo_usd else reservado_usd end), 0)
    from academia.agent_runs
   where es_qa = p_qa
     and created_at >= (date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City');
$$;

-- Reserva `p_monto` para una llamada SI cabe en el tope. Con candado sobre los
-- ajustes: dos corridas a la vez no se pasan juntas. Devuelve el id de la
-- corrida, o null si no cabe (y entonces pausa al agente).
create or replace function academia.academia_agente_reservar(
  p_monto numeric, p_tarea text, p_modelo text, p_job uuid, p_qa boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tope numeric;
  v_id uuid;
begin
  select tope_usd into v_tope from academia.agent_settings where es_qa = p_qa for update;
  if v_tope is null or academia.academia_agente_gastado(p_qa) + p_monto > v_tope then
    update academia.agent_settings set pausado_por_tope = true where es_qa = p_qa;
    return null;
  end if;
  insert into academia.agent_runs (job_id, tarea, modelo, reservado_usd, es_qa)
  values (p_job, p_tarea, p_modelo, p_monto, p_qa)
  returning id into v_id;
  return v_id;
end;
$$;

-- Lo gastado es dinero: solo el admin y el servidor (un community manager no ve costos).
revoke all on function academia.academia_agente_gastado(boolean) from public, anon, authenticated;
grant execute on function academia.academia_agente_gastado(boolean) to service_role;
revoke all on function academia.academia_agente_reservar(numeric, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function academia.academia_agente_reservar(numeric, text, text, uuid, boolean) to service_role;

-- ==========================================================================
-- 5. Borradores, ideas y resumen
-- ==========================================================================

create table academia.agent_drafts (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('respuesta', 'noticia')),
  es_qa          boolean not null default false,
  job_id         uuid references academia.agent_jobs (id) on delete set null,
  course_id      uuid references academia.courses (id) on delete cascade,
  tipo_origen    text check (tipo_origen in ('post', 'comentario', 'leccion')),
  hilo_id        uuid,
  titulo         text,
  texto          text not null check (char_length(texto) <= 10000),
  fuente         text,
  certeza        numeric(3, 2),
  motivo         text,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'publicado', 'descartado')),
  revisado_por   uuid references academia.profiles (user_id) on delete set null,
  revisado_en    timestamptz,
  publicado_id   uuid,
  created_at     timestamptz not null default now()
);

create index agent_drafts_pendientes_idx on academia.agent_drafts (created_at) where estado = 'pendiente';

alter table academia.agent_drafts enable row level security;

create policy agent_drafts_equipo on academia.agent_drafts
  for select to authenticated
  using ((select academia.is_equipo()));

create policy agent_drafts_equipo_revisa on academia.agent_drafts
  for update to authenticated
  using ((select academia.is_equipo()))
  with check ((select academia.is_equipo()));

create table academia.community_insights (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('idea', 'peticion', 'queja', 'duda_frecuente', 'elogio')),
  es_qa       boolean not null default false,
  resumen     text not null check (char_length(resumen) between 3 and 500),
  course_id   uuid references academia.courses (id) on delete cascade,
  hilo_id     uuid,
  atendida    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index community_insights_fecha_idx on academia.community_insights (created_at desc);

alter table academia.community_insights enable row level security;

create policy community_insights_equipo on academia.community_insights
  for select to authenticated
  using ((select academia.is_equipo()));

create policy community_insights_equipo_atiende on academia.community_insights
  for update to authenticated
  using ((select academia.is_equipo()))
  with check ((select academia.is_equipo()));

create table academia.agent_digests (
  fecha       date not null,
  es_qa       boolean not null default false,
  contenido   jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (fecha, es_qa)
);

alter table academia.agent_digests enable row level security;

create policy agent_digests_equipo on academia.agent_digests
  for select to authenticated
  using ((select academia.is_equipo()));

-- ==========================================================================
-- 6. La firma y una sola respuesta por trabajo
-- ==========================================================================

alter table academia.lesson_comments
  add column via text not null default 'humano' check (via in ('humano', 'api', 'agente', 'agente_revisado'));

alter table academia.community_comments
  add column agent_job_id uuid references academia.agent_jobs (id) on delete set null;
alter table academia.lesson_comments
  add column agent_job_id uuid references academia.agent_jobs (id) on delete set null;

create unique index community_comments_un_trabajo_idx on academia.community_comments (agent_job_id) where agent_job_id is not null;
create unique index lesson_comments_un_trabajo_idx on academia.lesson_comments (agent_job_id) where agent_job_id is not null;

-- Como en 0044: fuera del servidor, `via` es 'humano' y no hay trabajo del agente.
create or replace function academia.academia_via_leccion_solo_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not academia.es_servicio() then
    new.via := 'humano';
    new.agent_job_id := null;
  end if;
  return new;
end;
$$;

create trigger lesson_comments_via_solo_servidor
  before insert or update of via, agent_job_id on academia.lesson_comments
  for each row execute function academia.academia_via_leccion_solo_servidor();

create or replace function academia.academia_trabajo_solo_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not academia.es_servicio() then
    new.agent_job_id := null;
  end if;
  return new;
end;
$$;

create trigger community_comments_trabajo_solo_servidor
  before insert or update of agent_job_id on academia.community_comments
  for each row execute function academia.academia_trabajo_solo_servidor();

revoke all on function academia.academia_via_leccion_solo_servidor() from public;
revoke all on function academia.academia_trabajo_solo_servidor() from public;
grant execute on function academia.academia_via_leccion_solo_servidor() to authenticated, service_role;
grant execute on function academia.academia_trabajo_solo_servidor() to authenticated, service_role;
