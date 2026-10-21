-- ============================================================================
-- academia_0048_contenido_de_vaip.sql — M26: las clases grabadas y las herramientas de V-AI-P
--
-- Pedido de Alejandro (21-oct-2026): V-AI-P no es un curso. Es a donde se paga
-- para entrar todos los días después de terminar uno. Las grabaciones van «por
-- módulo mensual y en cada mes subir las grabaciones y en esa grabación ponerle
-- el día», y las herramientas son «videos rápidos como si fueran reels» con las
-- etiquetas que él quiera: creativas, administrativas, comerciales, RH,
-- financieras, contables…
--
-- Las dos son LECCIONES de la casa del plan: así reusan el reproductor con
-- token, la subida directa a Bunny, la RLS por inscripción, el avance, los
-- comentarios, el material y la bandeja del Muro. Lo que cambia es cómo se
-- organizan:
--
--   1. `academia.es_casa(curso)`: el curso es la casa de algún plan.
--   2. `modules.kind` ('curso' | 'mes' | 'herramientas') y `modules.month`.
--   3. `lessons.recorded_on` (el día de la clase), `orientation`, `cover_path`
--      y `published_at`, con sus reglas.
--   4. Etiquetas de herramientas: `tool_tags` y `lesson_tool_tags`, con las
--      seis iniciales sembradas en la casa de V-AI-P.
--   5. El community manager crea contenido de V-AI-P —y solo eso— por tres
--      RPC con nombre; el insert directo sigue siendo de admin. El trigger de
--      0036 se reemplaza para que pueda editar ese contenido.
--   6. Puntos: `actividad_por_curso` cuenta aparte grabaciones y herramientas.
--
-- `courses.category` (las «herramientas como curso» de 0043, sin datos) queda
-- obsoleta y se borra en 0049, DESPUÉS del deploy. Solo schema `academia`. La
-- aplica Alejandro con `pnpm db:migrate`.
-- ============================================================================

-- ==========================================================================
-- 1. ¿Es la casa de un plan?
-- ==========================================================================

-- Cualquier plan, en cualquier estado: las casas de los planes QA se
-- comportan igual que la real, y las suites prueban sin tocarla.
create or replace function academia.es_casa(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from academia.membership_plans p where p.hub_course_id = p_course);
$$;

revoke all on function academia.es_casa(uuid) from public, anon;
grant execute on function academia.es_casa(uuid) to authenticated, service_role;

-- ==========================================================================
-- 2. Módulos con tipo: los de un curso, los meses y las herramientas
-- ==========================================================================

alter table academia.modules
  add column kind text not null default 'curso'
    check (kind in ('curso', 'mes', 'herramientas')),
  add column month date
    check (month is null or extract(day from month) = 1),
  add constraint modules_mes_con_fecha check ((kind = 'mes') = (month is not null));

comment on column academia.modules.kind is
  'curso: un módulo normal. mes: las grabaciones de V-AI-P de ese mes. herramientas: los videos cortos de V-AI-P. Los dos últimos solo existen en la casa de un plan.';

-- Un mes por casa y generación; un módulo de herramientas por casa y generación.
create unique index modules_un_mes_idx
  on academia.modules (course_id, cohort_id, month) where kind = 'mes';
create unique index modules_unas_herramientas_idx
  on academia.modules (course_id, cohort_id) where kind = 'herramientas';

create or replace function academia.academia_modulo_de_vaip()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.kind is distinct from old.kind or new.month is distinct from old.month) then
    raise exception 'El tipo y el mes de un módulo no cambian.' using errcode = '23514';
  end if;
  if new.kind <> 'curso' and not academia.es_casa(new.course_id) then
    raise exception 'Los meses y las herramientas solo existen en la casa de un plan.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger modules_de_vaip
  before insert or update on academia.modules
  for each row execute function academia.academia_modulo_de_vaip();

revoke all on function academia.academia_modulo_de_vaip() from public;
grant execute on function academia.academia_modulo_de_vaip() to authenticated, service_role;

-- ==========================================================================
-- 3. Lecciones: el día de la clase, la orientación, la portada y cuándo salió
-- ==========================================================================

alter table academia.lessons
  add column recorded_on date,
  add column orientation text not null default 'horizontal'
    check (orientation in ('horizontal', 'vertical')),
  add column cover_path text
    check (cover_path is null or char_length(cover_path) <= 300),
  add column published_at timestamptz;

comment on column academia.lessons.recorded_on is 'El día de la clase, en las grabaciones de V-AI-P (módulos «mes»).';
comment on column academia.lessons.orientation is 'Cómo se grabó el video: horizontal (16:9) o vertical (9:16, tipo reel).';
comment on column academia.lessons.cover_path is 'La portada dibujada de una herramienta, en academia-media.';
comment on column academia.lessons.published_at is 'La primera vez que se publicó: ordena «Lo nuevo».';

-- La primera publicación se sella sola. Las lecciones de antes se quedan en
-- null: rellenarlas tocaría el `updated_at` de todas, y «Lo nuevo» solo mira
-- el contenido de V-AI-P, que nace con esta migración.
create or replace function academia.academia_leccion_publicada_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger lessons_publicada_en
  before insert or update on academia.lessons
  for each row execute function academia.academia_leccion_publicada_en();

-- Las reglas del contenido de V-AI-P: en un mes, el día cae en ese mes; las
-- dos son videos; y no se publica sin video.
create or replace function academia.academia_leccion_de_vaip()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text;
  v_month date;
begin
  select m.kind, m.month into v_kind, v_month from academia.modules m where m.id = new.module_id;
  if v_kind is null or v_kind = 'curso' then
    return new;
  end if;

  if new.lesson_type <> 'video' then
    raise exception 'Las grabaciones y las herramientas son videos.' using errcode = '23514';
  end if;
  if v_kind = 'mes' and (new.recorded_on is null or date_trunc('month', new.recorded_on)::date <> v_month) then
    raise exception 'La fecha de la grabación tiene que caer en su mes.' using errcode = '23514';
  end if;
  if new.status = 'published' and new.bunny_video_id is null then
    raise exception 'Sube el video antes de publicar.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger lessons_contenido_vaip
  before insert or update on academia.lessons
  for each row execute function academia.academia_leccion_de_vaip();

revoke all on function academia.academia_leccion_publicada_en() from public;
revoke all on function academia.academia_leccion_de_vaip() from public;
grant execute on function academia.academia_leccion_publicada_en() to authenticated, service_role;
grant execute on function academia.academia_leccion_de_vaip() to authenticated, service_role;

-- ==========================================================================
-- 4. El community manager y las lecciones (reemplaza la regla de 0036)
-- ==========================================================================

-- En una lección de un CURSO, el CM sigue tocando solo la grabación (0036),
-- ahora con `published_at`, que sella el trigger de arriba al publicar.
-- En el contenido de V-AI-P (meses y herramientas) lo edita todo —título,
-- fecha, descripción, orientación, portada— menos el tipo, «obligatoria» y
-- sacarlo de su clase de módulo: es lo que decidió Alejandro (admin y CM suben
-- y publican; borrar sigue siendo de admin, por RLS).
create or replace function academia.academia_leccion_solo_grabacion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_viejo record;
  v_nuevo record;
begin
  if academia.es_servicio() or academia.is_admin() then
    return new;
  end if;

  select m.kind, m.course_id into v_viejo from academia.modules m where m.id = old.module_id;
  if v_viejo.kind in ('mes', 'herramientas') then
    select m.kind, m.course_id into v_nuevo from academia.modules m where m.id = new.module_id;
    if new.lesson_type is distinct from old.lesson_type
       or new.is_required is distinct from old.is_required
       or v_nuevo.kind is distinct from v_viejo.kind
       or v_nuevo.course_id is distinct from v_viejo.course_id then
      raise exception 'De una grabación o herramienta, el community manager no cambia el tipo ni la saca de su lugar.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Solo el equipo llega aquí (lessons_update_admin), así que quien no es
  -- admin es un community manager.
  if (to_jsonb(new) - array['bunny_video_id', 'video_duration_sec', 'status', 'updated_at', 'published_at'])
     is distinct from
     (to_jsonb(old) - array['bunny_video_id', 'video_duration_sec', 'status', 'updated_at', 'published_at']) then
    raise exception 'De una lección, el community manager solo cambia el video y si está publicada.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ==========================================================================
-- 5. Etiquetas de herramientas
-- ==========================================================================

create table academia.tool_tags (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references academia.courses (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 40),
  slug        text not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  position    integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, slug)
);

comment on table academia.tool_tags is
  'Las etiquetas de las herramientas de V-AI-P (creativas, RH, contables…). Las crea el equipo; archivar las esconde sin perder lo etiquetado.';

create trigger tool_tags_updated_at
  before update on academia.tool_tags
  for each row execute function academia.set_updated_at();

create table academia.lesson_tool_tags (
  lesson_id   uuid not null references academia.lessons (id) on delete cascade,
  tag_id      uuid not null references academia.tool_tags (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (lesson_id, tag_id)
);

create index lesson_tool_tags_etiqueta_idx on academia.lesson_tool_tags (tag_id);

-- La etiqueta y la herramienta son de la misma casa, y solo se etiquetan herramientas.
create or replace function academia.academia_etiqueta_coherente()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text;
  v_curso_leccion uuid;
  v_curso_etiqueta uuid;
begin
  select m.kind, m.course_id into v_kind, v_curso_leccion
    from academia.lessons l join academia.modules m on m.id = l.module_id
   where l.id = new.lesson_id;
  select t.course_id into v_curso_etiqueta from academia.tool_tags t where t.id = new.tag_id;
  if v_kind is distinct from 'herramientas' then
    raise exception 'Solo las herramientas llevan etiquetas.' using errcode = '23514';
  end if;
  if v_curso_leccion is distinct from v_curso_etiqueta then
    raise exception 'La etiqueta no es de esta comunidad.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger lesson_tool_tags_coherente
  before insert or update on academia.lesson_tool_tags
  for each row execute function academia.academia_etiqueta_coherente();

revoke all on function academia.academia_etiqueta_coherente() from public;
grant execute on function academia.academia_etiqueta_coherente() to authenticated, service_role;

alter table academia.tool_tags enable row level security;
alter table academia.lesson_tool_tags enable row level security;

create policy tool_tags_select on academia.tool_tags
  for select to authenticated
  using ((select academia.is_equipo()) or academia.has_enrollment(course_id));
create policy tool_tags_insert_equipo on academia.tool_tags
  for insert to authenticated
  with check ((select academia.is_equipo()) and academia.es_casa(course_id));
create policy tool_tags_update_equipo on academia.tool_tags
  for update to authenticated
  using ((select academia.is_equipo()))
  with check ((select academia.is_equipo()) and academia.es_casa(course_id));
create policy tool_tags_delete_admin on academia.tool_tags
  for delete to authenticated
  using ((select academia.is_admin()));

create policy lesson_tool_tags_select on academia.lesson_tool_tags
  for select to authenticated
  using ((select academia.is_equipo()) or academia.ve_leccion(lesson_id));
create policy lesson_tool_tags_insert_equipo on academia.lesson_tool_tags
  for insert to authenticated
  with check ((select academia.is_equipo()));
create policy lesson_tool_tags_delete_equipo on academia.lesson_tool_tags
  for delete to authenticated
  using ((select academia.is_equipo()));

-- Las seis con las que arranca V-AI-P. Se agregan más desde el panel.
insert into academia.tool_tags (course_id, name, slug, position)
select p.hub_course_id, t.name, t.slug, t.position
  from academia.membership_plans p
  cross join (values
    ('Creativas', 'creativas', 1),
    ('Administrativas', 'administrativas', 2),
    ('Comerciales', 'comerciales', 3),
    ('RH', 'rh', 4),
    ('Financieras', 'financieras', 5),
    ('Contables', 'contables', 6)
  ) as t(name, slug, position)
 where p.slug = 'v-ai-p' and p.hub_course_id is not null
on conflict (course_id, slug) do nothing;

-- ==========================================================================
-- 6. Crear contenido de V-AI-P: tres RPC con nombre
-- ==========================================================================

-- La generación de la casa: la abierta (o sin fin); si no, la más reciente.
create or replace function academia.academia_generacion_de_la_casa(p_casa uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select h.id
    from academia.cohorts h
   where h.course_id = p_casa
   order by (h.open_for_enrollment and (h.ends_on is null or h.ends_on >= (now() at time zone 'America/Mexico_City')::date)) desc,
            h.starts_on desc nulls last,
            h.created_at desc
   limit 1;
$$;

-- «Octubre 2026», «14 de octubre»: los nombres los arma la base para no
-- depender del idioma del servidor.
create or replace function academia.academia_nombre_de_mes(p_fecha date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])
         [extract(month from p_fecha)::int] || ' ' || extract(year from p_fecha)::int;
$$;

-- El módulo del mes de esa fecha, creado si falta.
create or replace function academia.academia_mes_de_la_casa(p_casa uuid, p_generacion uuid, p_fecha date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', p_fecha)::date;
  v_id uuid;
begin
  select m.id into v_id from academia.modules m
   where m.course_id = p_casa and m.cohort_id is not distinct from p_generacion and m.kind = 'mes' and m.month = v_mes;
  if v_id is not null then
    return v_id;
  end if;
  insert into academia.modules (course_id, cohort_id, title, position, kind, month)
  values (p_casa, p_generacion, academia.academia_nombre_de_mes(v_mes),
          extract(year from v_mes)::int * 12 + extract(month from v_mes)::int, 'mes', v_mes)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    select m.id into v_id from academia.modules m
     where m.course_id = p_casa and m.cohort_id is not distinct from p_generacion and m.kind = 'mes' and m.month = v_mes;
  end if;
  return v_id;
end;
$$;

-- Una grabación nueva, en borrador, en su mes. Si no trae título usa el de la
-- clase de ese día; y si esa clase existe y no tiene grabación, la liga.
create or replace function academia.academia_vaip_nueva_grabacion(
  p_casa uuid,
  p_fecha date,
  p_titulo text default null,
  p_sesion uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_generacion uuid;
  v_modulo uuid;
  v_sesion uuid;
  v_titulo text;
  v_id uuid;
begin
  if not academia.is_equipo() then
    raise exception 'Solo el equipo sube grabaciones.' using errcode = '42501';
  end if;
  if not academia.es_casa(p_casa) then
    raise exception 'Ese curso no es la casa de un plan.' using errcode = '22023';
  end if;
  if p_fecha is null then
    raise exception 'Falta la fecha de la clase.' using errcode = '22023';
  end if;

  v_generacion := academia.academia_generacion_de_la_casa(p_casa);
  if v_generacion is null then
    raise exception 'La casa no tiene generación.' using errcode = '22023';
  end if;

  -- La clase: la que se eligió (de esta generación, sin grabación) o la única
  -- clase sin grabación de ese día.
  if p_sesion is not null then
    select s.id, s.title into v_sesion, v_titulo from academia.cohort_sessions s
     where s.id = p_sesion and s.cohort_id = v_generacion and s.recording_lesson_id is null;
    if v_sesion is null then
      raise exception 'Esa clase no es de esta comunidad o ya tiene grabación.' using errcode = '22023';
    end if;
  else
    select s.id, s.title into v_sesion, v_titulo from academia.cohort_sessions s
     where s.cohort_id = v_generacion and s.kind = 'clase' and s.recording_lesson_id is null
       and (s.scheduled_at at time zone 'America/Mexico_City')::date = p_fecha
       and (select count(*) from academia.cohort_sessions x
             where x.cohort_id = v_generacion and x.kind = 'clase' and x.recording_lesson_id is null
               and (x.scheduled_at at time zone 'America/Mexico_City')::date = p_fecha) = 1;
  end if;

  v_titulo := coalesce(nullif(btrim(p_titulo), ''), v_titulo,
    'Clase del ' || extract(day from p_fecha)::int || ' de ' ||
    lower((array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'])[extract(month from p_fecha)::int]));

  v_modulo := academia.academia_mes_de_la_casa(p_casa, v_generacion, p_fecha);

  insert into academia.lessons (module_id, title, position, lesson_type, status, is_required, recorded_on)
  values (v_modulo, left(v_titulo, 200), extract(day from p_fecha)::int, 'video', 'draft', false, p_fecha)
  returning id into v_id;

  if v_sesion is not null then
    update academia.cohort_sessions set recording_lesson_id = v_id where id = v_sesion;
  end if;
  return v_id;
end;
$$;

-- Cambiar el día de una grabación la mueve a su mes (creándolo si falta).
create or replace function academia.academia_vaip_fechar_grabacion(p_leccion uuid, p_fecha date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_casa uuid;
  v_generacion uuid;
  v_kind text;
  v_modulo uuid;
begin
  if not academia.is_equipo() then
    raise exception 'Solo el equipo cambia la fecha de una grabación.' using errcode = '42501';
  end if;
  select m.course_id, m.cohort_id, m.kind into v_casa, v_generacion, v_kind
    from academia.lessons l join academia.modules m on m.id = l.module_id where l.id = p_leccion;
  if v_kind is distinct from 'mes' or p_fecha is null then
    raise exception 'Esa lección no es una grabación de V-AI-P.' using errcode = '22023';
  end if;
  v_modulo := academia.academia_mes_de_la_casa(v_casa, v_generacion, p_fecha);
  update academia.lessons
     set module_id = v_modulo, recorded_on = p_fecha, position = extract(day from p_fecha)::int
   where id = p_leccion;
end;
$$;

-- Una herramienta nueva, en borrador, en el módulo de herramientas.
create or replace function academia.academia_vaip_nueva_herramienta(
  p_casa uuid,
  p_titulo text,
  p_orientacion text default 'vertical'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_generacion uuid;
  v_modulo uuid;
  v_id uuid;
begin
  if not academia.is_equipo() then
    raise exception 'Solo el equipo sube herramientas.' using errcode = '42501';
  end if;
  if not academia.es_casa(p_casa) then
    raise exception 'Ese curso no es la casa de un plan.' using errcode = '22023';
  end if;
  if coalesce(char_length(btrim(p_titulo)), 0) < 3 then
    raise exception 'El título necesita al menos 3 caracteres.' using errcode = '22023';
  end if;

  v_generacion := academia.academia_generacion_de_la_casa(p_casa);
  if v_generacion is null then
    raise exception 'La casa no tiene generación.' using errcode = '22023';
  end if;

  select m.id into v_modulo from academia.modules m
   where m.course_id = p_casa and m.cohort_id = v_generacion and m.kind = 'herramientas';
  if v_modulo is null then
    insert into academia.modules (course_id, cohort_id, title, position, kind)
    values (p_casa, v_generacion, 'Herramientas', 0, 'herramientas')
    on conflict do nothing
    returning id into v_modulo;
    if v_modulo is null then
      select m.id into v_modulo from academia.modules m
       where m.course_id = p_casa and m.cohort_id = v_generacion and m.kind = 'herramientas';
    end if;
  end if;

  insert into academia.lessons (module_id, title, position, lesson_type, status, is_required, orientation)
  values (v_modulo, left(btrim(p_titulo), 200),
          coalesce((select max(l.position) + 1 from academia.lessons l where l.module_id = v_modulo), 1),
          'video', 'draft', false,
          case when p_orientacion = 'horizontal' then 'horizontal' else 'vertical' end)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function academia.academia_generacion_de_la_casa(uuid) from public, anon;
revoke all on function academia.academia_nombre_de_mes(date) from public, anon;
revoke all on function academia.academia_mes_de_la_casa(uuid, uuid, date) from public, anon, authenticated;
revoke all on function academia.academia_vaip_nueva_grabacion(uuid, date, text, uuid) from public, anon;
revoke all on function academia.academia_vaip_fechar_grabacion(uuid, date) from public, anon;
revoke all on function academia.academia_vaip_nueva_herramienta(uuid, text, text) from public, anon;
grant execute on function academia.academia_generacion_de_la_casa(uuid) to authenticated, service_role;
grant execute on function academia.academia_nombre_de_mes(date) to authenticated, service_role;
grant execute on function academia.academia_mes_de_la_casa(uuid, uuid, date) to service_role;
grant execute on function academia.academia_vaip_nueva_grabacion(uuid, date, text, uuid) to authenticated, service_role;
grant execute on function academia.academia_vaip_fechar_grabacion(uuid, date) to authenticated, service_role;
grant execute on function academia.academia_vaip_nueva_herramienta(uuid, text, text) to authenticated, service_role;

-- ==========================================================================
-- 7. Puntos: grabaciones y herramientas vistas, aparte de las lecciones
-- ==========================================================================

-- Decisión de Alejandro (21-oct-2026): «ambas suman pero un poco menos». La
-- vista solo CUENTA; los pesos (lección 10, grabación 5, herramienta 3) viven
-- en lib/gamificacion/reglas.ts. `lecciones` deja de contar el contenido de
-- V-AI-P y las dos columnas nuevas van al final (así lo exige
-- `create or replace view`). Lo demás es la definición vigente, sin cambios.
create or replace view academia.actividad_por_curso with (security_invoker = false) as
 SELECT e.user_id,
    e.course_id,
    ( SELECT count(*)::integer AS count
           FROM academia.lesson_progress lp
             JOIN academia.lessons l ON l.id = lp.lesson_id
             JOIN academia.modules m ON m.id = l.module_id
          WHERE lp.user_id = e.user_id AND lp.completed AND m.course_id = e.course_id AND m.kind = 'curso'::text) AS lecciones,
    ( SELECT count(DISTINCT qa.quiz_id)::integer AS count
           FROM academia.quiz_attempts qa
          WHERE qa.user_id = e.user_id AND qa.passed AND academia.curso_del_quiz(qa.quiz_id) = e.course_id) AS quizzes,
    ( SELECT count(DISTINCT s.assignment_id)::integer AS count
           FROM academia.assignment_submissions s
          WHERE s.user_id = e.user_id AND (s.status = ANY (ARRAY['submitted'::text, 'approved'::text])) AND academia.curso_de_tarea(s.assignment_id) = e.course_id) AS tareas,
    ( SELECT count(DISTINCT s.assignment_id)::integer AS count
           FROM academia.assignment_submissions s
          WHERE s.user_id = e.user_id AND s.status = 'approved'::text AND academia.curso_de_tarea(s.assignment_id) = e.course_id) AS tareas_aprobadas,
    ( SELECT count(*)::integer AS count
           FROM academia.community_posts cp
          WHERE cp.user_id = e.user_id AND cp.status = 'visible'::text AND cp.course_id = e.course_id) AS publicaciones,
    (( SELECT count(*)::integer AS count
           FROM academia.community_comments cc
             JOIN academia.community_posts cp ON cp.id = cc.post_id
          WHERE cc.user_id = e.user_id AND cc.status = 'visible'::text AND cp.course_id = e.course_id)) + (( SELECT count(*)::integer AS count
           FROM academia.lesson_comments lc
          WHERE lc.user_id = e.user_id AND lc.status = 'visible'::text AND academia.curso_de_leccion(lc.lesson_id) = e.course_id)) AS comentarios,
    ( SELECT count(*)::integer AS count
           FROM academia.certificates c
          WHERE c.user_id = e.user_id AND c.course_id = e.course_id) AS certificados,
    ( SELECT count(*)::integer AS count
           FROM academia.dynamics d
          WHERE d.course_id = e.course_id AND NOT d.cohort_id IS DISTINCT FROM e.cohort_id AND (d.status = 'closed'::text OR d.status = 'open'::text AND d.closes_at IS NOT NULL AND d.closes_at <= now()) AND (EXISTS ( SELECT 1
                   FROM academia.dynamic_rows r
                  WHERE r.dynamic_id = d.id AND r.row_kind = 'criterio'::text)) AND (EXISTS ( SELECT 1
                   FROM academia.dynamic_boards b
                     JOIN academia.dynamic_columns c ON c.board_id = b.id
                  WHERE b.dynamic_id = d.id AND (p.company_id IS NOT NULL AND b.company_id = p.company_id OR b.owner_user_id = e.user_id) AND NOT (EXISTS ( SELECT 1
                           FROM academia.dynamic_rows r
                          WHERE r.dynamic_id = d.id AND r.row_kind = 'criterio'::text AND NOT (EXISTS ( SELECT 1
                                   FROM academia.dynamic_cells x
                                  WHERE x.column_id = c.id AND x.row_id = r.id AND x.numeric_value IS NOT NULL))))))) AS dinamicas,
    e.cohort_id,
    ( SELECT count(*)::integer AS count
           FROM academia.lesson_progress lp
             JOIN academia.lessons l ON l.id = lp.lesson_id
             JOIN academia.modules m ON m.id = l.module_id
          WHERE lp.user_id = e.user_id AND lp.completed AND m.course_id = e.course_id AND m.kind = 'mes'::text) AS grabaciones,
    ( SELECT count(*)::integer AS count
           FROM academia.lesson_progress lp
             JOIN academia.lessons l ON l.id = lp.lesson_id
             JOIN academia.modules m ON m.id = l.module_id
          WHERE lp.user_id = e.user_id AND lp.completed AND m.course_id = e.course_id AND m.kind = 'herramientas'::text) AS herramientas
   FROM academia.enrollments e
     JOIN academia.profiles p ON p.user_id = e.user_id
  WHERE e.status = 'active'::text AND p.role = 'alumno'::text AND p.status = 'active'::text AND (( SELECT academia.is_equipo() AS is_equipo) OR (( SELECT auth.role() AS role)) = 'service_role'::text OR (EXISTS ( SELECT 1
           FROM academia.enrollments x
             JOIN academia.courses c ON c.id = x.course_id
          WHERE x.user_id = (( SELECT auth.uid() AS uid)) AND x.status = 'active'::text AND x.course_id = e.course_id AND
                CASE
                    WHEN c.course_type = 'cohort'::text THEN x.cohort_id = e.cohort_id
                    ELSE true
                END)));

-- ==========================================================================
-- 8. `courses.category` queda obsoleta
-- ==========================================================================

comment on column academia.courses.category is
  'OBSOLETA desde M26 (21-oct-2026): las herramientas son lecciones con etiquetas (tool_tags). Se borra en 0049.';
