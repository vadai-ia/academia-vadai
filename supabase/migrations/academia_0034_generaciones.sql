-- academia_0034_generaciones.sql
-- Generaciones: cada generación de un curso ve SOLO su contenido, su comunidad,
-- sus dinámicas, sus encuestas y su ranking.
--
-- POR QUÉ
-- El 3-oct-2026 se prepara la segunda generación de «Claude en tu empresa».
-- Hasta hoy una «cohorte» solo decidía qué calendario de sesiones en vivo veía
-- el alumno (`cohort_sessions`, `pertenece_a_cohorte`). Todo lo demás era del
-- CURSO: las grabaciones son lecciones normales del temario (módulos «Sesión
-- 1…8»), la comunidad cuelga de `course_id`, y `polls.cohort_id` y
-- `dynamics.cohort_id` eran una etiqueta que la RLS ignoraba. Una Generación 2
-- habría visto las grabaciones y las preguntas de la 1.
--
-- DECISIONES (Alejandro, 3-oct-2026; detalle en docs/M16.md)
--   1. Todo el contenido es por generación: cada módulo pertenece a una. Un
--      curso sin generaciones (evergreen) sigue con módulos del curso.
--   2. Comunidad por generación. El equipo publica en una o en todas (una
--      copia por generación, agrupadas por `broadcast_id`).
--   3. Dinámicas, encuestas y ranking por generación. Los puntos son de la
--      persona y se conservan; el ranking compara dentro de la generación.
--   4. Una generación por persona y curso; el equipo la cambia. Se conserva
--      `unique (user_id, course_id)`.
--   5. A lo más una generación «abierta a inscripciones» por curso: ahí caen
--      Stripe, el catálogo gratis y el alta manual sin elección.
--   6. Terminar (pasó `ends_on`) solo cierra inscripciones: el alumno sigue
--      viendo todo mientras su acceso al curso esté vigente.
--   7. Una generación nueva copia la estructura de otra sin videos ni
--      grabaciones; las lecciones copiadas nacen en borrador.
--   8. «Cohorte» desaparece de lo visible; los identificadores se quedan.
--
-- «Curso con generaciones» = `courses.course_type = 'cohort'` (ya existe y se
-- edita en el panel). «Terminada» se deriva de `ends_on < current_date` al
-- leer, como `dinamica_abierta`: sin cron.
--
-- TODO EN UNA TRANSACCIÓN. Un estado a medias (policies por generación sin el
-- backfill) dejaría en blanco el curso que hoy tiene 189 alumnos. El backfill
-- va guardado por slug para que el mismo archivo corra en una base sin el
-- curso real, y las aserciones abortan si algo no cuadra.

-- ==========================================================================
-- 1. Columnas e índices
-- ==========================================================================

alter table academia.cohorts
  add column open_for_enrollment boolean not null default false;

-- A lo más una abierta por curso: la regla vive en el índice, como
-- `poll_questions_una_abierta`.
create unique index cohorts_una_abierta_por_curso
  on academia.cohorts (course_id)
  where open_for_enrollment;

-- `restrict`: borrar una generación con contenido fallaría en cascada sobre
-- módulos -> lecciones -> progreso. El equipo mueve o borra los módulos antes.
alter table academia.modules
  add column cohort_id uuid references academia.cohorts (id) on delete restrict;

create index modules_cohort_idx
  on academia.modules (cohort_id, position)
  where cohort_id is not null;

alter table academia.community_posts
  add column cohort_id    uuid references academia.cohorts (id) on delete set null,
  add column broadcast_id uuid;

create index community_posts_gen_feed_idx
  on academia.community_posts (cohort_id, pinned desc, created_at desc)
  where cohort_id is not null;

create index community_posts_broadcast_idx
  on academia.community_posts (broadcast_id)
  where broadcast_id is not null;

-- Anuncios dirigidos a una generación (null = todo el curso, como hasta hoy).
alter table academia.posts
  add column audience_cohort_id uuid references academia.cohorts (id) on delete set null;

-- Una generación copiada comparte los archivos adjuntos: el permiso de
-- descarga pasa a resolverse por la ruta (ver `puede_descargar_adjunto`).
create index lesson_attachments_path_idx
  on academia.lesson_attachments (storage_path);

comment on column academia.cohorts.open_for_enrollment is
  'La generación que recibe las inscripciones nuevas (Stripe, catálogo, alta manual sin elección). A lo más una por curso.';
comment on column academia.modules.cohort_id is
  'La generación dueña del módulo. Obligatoria si el curso es por generaciones; nula si es evergreen.';
comment on column academia.community_posts.broadcast_id is
  'Agrupa las copias de una publicación del equipo hecha «a todas las generaciones».';

-- ==========================================================================
-- 2. Backfill (idempotente, guardado)
-- ==========================================================================

do $$
declare
  v_gen uuid;
  v_n   integer;
  r     record;
begin
  -- (a) Filas cuya generación es de OTRO curso se desligan. El caso real: una
  --     encuesta de «Academia VADAI» marcada con la Generación 1 de «Claude en
  --     tu empresa». Va antes de (b) para que no se barra a la generación.
  for r in
    select 'polls' as tabla, p.id, p.cohort_id from academia.polls p
     where p.cohort_id is not null and academia.curso_de_cohorte(p.cohort_id) <> p.course_id
    union all
    select 'dynamics', d.id, d.cohort_id from academia.dynamics d
     where d.cohort_id is not null and academia.curso_de_cohorte(d.cohort_id) <> d.course_id
    union all
    select 'enrollments', e.id, e.cohort_id from academia.enrollments e
     where e.cohort_id is not null and academia.curso_de_cohorte(e.cohort_id) <> e.course_id
  loop
    raise notice '0034: % % tenía la generación % de otro curso; queda sin generación', r.tabla, r.id, r.cohort_id;
  end loop;

  update academia.polls set cohort_id = null
   where cohort_id is not null and academia.curso_de_cohorte(cohort_id) <> course_id;
  update academia.dynamics set cohort_id = null
   where cohort_id is not null and academia.curso_de_cohorte(cohort_id) <> course_id;
  update academia.enrollments set cohort_id = null
   where cohort_id is not null and academia.curso_de_cohorte(cohort_id) <> course_id;

  -- (b) Cada curso por generaciones con UNA sola generación le pasa todo lo que
  --     estaba a nivel curso (el caso real es «Claude en tu empresa»; el QA
  --     archivado sigue la misma regla). Con más de una generación y módulos
  --     sueltos no hay forma de decidir: se aborta.
  for r in
    select c.id, c.slug, (select count(*) from academia.cohorts g where g.course_id = c.id) as gens
      from academia.courses c
     where c.course_type = 'cohort'
       and exists (select 1 from academia.cohorts g where g.course_id = c.id)
  loop
    if r.gens <> 1 then
      if exists (select 1 from academia.modules m where m.course_id = r.id and m.cohort_id is null) then
        raise exception '0034: % tiene % generaciones y módulos sin generación; asígnalos antes', r.slug, r.gens;
      end if;
      continue;
    end if;

    select id into v_gen from academia.cohorts where course_id = r.id limit 1;

    update academia.modules set cohort_id = v_gen where course_id = r.id and cohort_id is null;
    get diagnostics v_n = row_count;
    raise notice '0034: %: % módulos -> su generación', r.slug, v_n;

    update academia.community_posts set cohort_id = v_gen where course_id = r.id and cohort_id is null;
    get diagnostics v_n = row_count;
    raise notice '0034: %: % publicaciones -> su generación', r.slug, v_n;

    update academia.polls set cohort_id = v_gen where course_id = r.id and cohort_id is null;
    get diagnostics v_n = row_count;
    raise notice '0034: %: % encuestas -> su generación', r.slug, v_n;

    update academia.dynamics set cohort_id = v_gen where course_id = r.id and cohort_id is null;
    get diagnostics v_n = row_count;
    raise notice '0034: %: % dinámicas -> su generación', r.slug, v_n;

    update academia.enrollments set cohort_id = v_gen
     where course_id = r.id and cohort_id is null and status = 'active';
    get diagnostics v_n = row_count;
    raise notice '0034: %: % inscripciones sin generación -> su generación', r.slug, v_n;

    -- La generación sigue en curso: las compras de hoy tienen que caer ahí.
    if exists (select 1 from academia.cohorts
                where id = v_gen and (ends_on is null or ends_on >= current_date)) then
      update academia.cohorts set open_for_enrollment = true where id = v_gen;
      raise notice '0034: %: su generación queda abierta a inscripciones', r.slug;
    else
      raise notice '0034: %: su generación ya terminó; abre una desde el panel antes de vender', r.slug;
    end if;
  end loop;

  if not exists (select 1 from academia.courses where slug = 'claude-en-tu-empresa') then
    raise notice '0034: no existe claude-en-tu-empresa en esta base';
  end if;

  -- (c) Cursos marcados «por generaciones» sin ninguna generación (el QA
  --     ajeno; Academia VADAI si lo estuviera): quedan evergreen para seguir
  --     funcionando a nivel curso.
  for r in
    select c.id, c.slug from academia.courses c
     where c.course_type = 'cohort'
       and not exists (select 1 from academia.cohorts g where g.course_id = c.id)
  loop
    update academia.courses set course_type = 'evergreen' where id = r.id;
    raise notice '0034: % no tiene generaciones; queda evergreen', r.slug;
  end loop;
end $$;

-- ==========================================================================
-- 3. Aserciones: si algo no cuadra, no se aplica nada
-- ==========================================================================

do $$
begin
  if exists (
    select 1 from academia.modules m
      join academia.courses c on c.id = m.course_id
     where c.course_type = 'cohort' and m.cohort_id is null
  ) then
    raise exception '0034: quedan módulos sin generación en un curso por generaciones';
  end if;

  if exists (
    select 1 from academia.modules m
     where m.cohort_id is not null and academia.curso_de_cohorte(m.cohort_id) <> m.course_id
  ) or exists (
    select 1 from academia.community_posts p
     where p.cohort_id is not null and academia.curso_de_cohorte(p.cohort_id) <> p.course_id
  ) then
    raise exception '0034: hay filas cuya generación es de otro curso';
  end if;

  if exists (
    select 1 from academia.modules m
      join academia.courses c on c.id = m.course_id
     where c.course_type = 'evergreen' and m.cohort_id is not null
  ) then
    raise exception '0034: un curso evergreen tiene módulos con generación';
  end if;
end $$;

-- ==========================================================================
-- 4. Helpers (patrón 0012: sql stable security definer, search_path vacío)
-- ==========================================================================

-- LA REGLA. ¿Quien pregunta está inscrito en ESTA generación del curso?
--   * Curso por generaciones: la fila trae generación y es la de la
--     inscripción. Una inscripción sin generación no ve nada por generación.
--   * Evergreen: basta la inscripción, y la fila no trae generación.
-- `p_exige_vigencia` distingue CONTENIDO (vigente) de ESTRUCTURA (inscrito),
-- la misma pareja que has_active_access / has_enrollment.
create or replace function academia.inscrito_en_generacion(
  p_course_id uuid,
  p_cohort_id uuid,
  p_exige_vigencia boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from academia.enrollments e
      join academia.courses c on c.id = e.course_id
     where e.user_id = (select auth.uid())
       and e.course_id = p_course_id
       and e.status = 'active'
       and (not p_exige_vigencia or e.expires_at is null or e.expires_at > now())
       and case when c.course_type = 'cohort'
                then p_cohort_id is not null and e.cohort_id = p_cohort_id
                else p_cohort_id is null
           end
  )
$$;

create or replace function academia.generacion_del_alumno(p_course_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.cohort_id
    from academia.enrollments e
   where e.user_id = (select auth.uid())
     and e.course_id = p_course_id
     and e.status = 'active'
$$;

create or replace function academia.curso_por_generaciones(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.course_type = 'cohort' from academia.courses c where c.id = p_course_id), false)
$$;

-- Abierta a inscripciones Y no terminada. Se evalúa al leer, sin cron.
create or replace function academia.generacion_abierta_del_curso(p_course_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id
    from academia.cohorts g
   where g.course_id = p_course_id
     and g.open_for_enrollment
     and (g.ends_on is null or g.ends_on >= current_date)
   limit 1
$$;

-- Resolución por jerarquía: reemplazan a has_active_access(curso_de_x(...)).
create or replace function academia.ve_modulo(p_module_id uuid, p_exige_vigencia boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.inscrito_en_generacion(m.course_id, m.cohort_id, p_exige_vigencia)
    from academia.modules m
   where m.id = p_module_id
$$;

create or replace function academia.ve_leccion(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.ve_modulo(l.module_id, true)
    from academia.lessons l
   where l.id = p_lesson_id
$$;

create or replace function academia.ve_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.inscrito_en_generacion(p.course_id, p.cohort_id, true)
    from academia.community_posts p
   where p.id = p_post_id
$$;

create or replace function academia.ve_encuesta(p_poll_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.inscrito_en_generacion(p.course_id, p.cohort_id, false)
    from academia.polls p
   where p.id = p_poll_id
$$;

create or replace function academia.ve_dinamica(p_dynamic_id uuid, p_exige_vigencia boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.inscrito_en_generacion(d.course_id, d.cohort_id, p_exige_vigencia)
    from academia.dynamics d
   where d.id = p_dynamic_id
$$;

create or replace function academia.leccion_del_quiz(p_quiz_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select q.lesson_id from academia.quizzes q where q.id = p_quiz_id
$$;

create or replace function academia.leccion_de_tarea(p_assignment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.lesson_id from academia.assignments a where a.id = p_assignment_id
$$;

-- Misma firma que en 0028; ahora la generación cuenta.
create or replace function academia.dinamica_visible(p_dynamic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.is_admin() or exists (
    select 1
      from academia.dynamics d
     where d.id = p_dynamic_id
       and d.status <> 'draft'
       and academia.inscrito_en_generacion(d.course_id, d.cohort_id, false)
  )
$$;

create or replace function academia.puede_editar_tablero(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.is_admin() or (
    academia.es_miembro_de_tablero(p_board_id)
    and academia.dinamica_abierta(academia.dinamica_del_tablero(p_board_id))
    and academia.ve_dinamica(academia.dinamica_del_tablero(p_board_id), true)
  )
$$;

-- Misma firma que en 0018. Antes leía el uuid de la lección en la ruta; ahora
-- una generación copiada COMPARTE el archivo (misma `storage_path` en dos
-- lecciones), así que el permiso se resuelve por la ruta: basta que alguna
-- lección que la referencia sea visible para quien pregunta.
create or replace function academia.puede_descargar_adjunto(p_ruta text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  partes text[];
begin
  partes := string_to_array(p_ruta, '/');
  if array_length(partes, 1) is null
     or array_length(partes, 1) < 3
     or partes[1] <> 'lecciones'
  then
    return false;
  end if;

  return exists (
    select 1
      from academia.lesson_attachments a
     where a.storage_path = p_ruta
       and academia.ve_leccion(a.lesson_id)
  );
end;
$$;

-- ==========================================================================
-- 5. Disparadores
-- ==========================================================================

-- La generación es del mismo curso. Mismas columnas en las cinco tablas.
create or replace function academia.generacion_del_mismo_curso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cohort_id is not null
     and academia.curso_de_cohorte(new.cohort_id) is distinct from new.course_id then
    raise exception 'La generación no pertenece a este curso.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger modules_generacion_coherente
  before insert or update of course_id, cohort_id on academia.modules
  for each row execute function academia.generacion_del_mismo_curso();
create trigger community_posts_generacion_coherente
  before insert or update of course_id, cohort_id on academia.community_posts
  for each row execute function academia.generacion_del_mismo_curso();
create trigger polls_generacion_coherente
  before insert or update of course_id, cohort_id on academia.polls
  for each row execute function academia.generacion_del_mismo_curso();
create trigger dynamics_generacion_coherente
  before insert or update of course_id, cohort_id on academia.dynamics
  for each row execute function academia.generacion_del_mismo_curso();
create trigger enrollments_generacion_coherente
  before insert or update of course_id, cohort_id on academia.enrollments
  for each row execute function academia.generacion_del_mismo_curso();

-- Anuncios: la generación es del curso de la audiencia (y lo fija si faltaba).
create or replace function academia.anuncio_generacion_coherente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.audience_cohort_id is not null then
    if new.audience_course_id is null then
      new.audience_course_id := academia.curso_de_cohorte(new.audience_cohort_id);
    elsif academia.curso_de_cohorte(new.audience_cohort_id) is distinct from new.audience_course_id then
      raise exception 'La generación no pertenece a ese curso.' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create trigger posts_generacion_coherente
  before insert or update of audience_course_id, audience_cohort_id on academia.posts
  for each row execute function academia.anuncio_generacion_coherente();

-- Un módulo de un curso por generaciones lleva generación; uno evergreen, no.
-- `academia.convirtiendo` es una marca de transacción que levanta
-- `academia_activar_generaciones` mientras mueve el contenido existente.
create or replace function academia.modulo_generacion_obligatoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
begin
  if coalesce(current_setting('academia.convirtiendo', true), '') = '1' then
    return new;
  end if;
  select course_type into v_tipo from academia.courses where id = new.course_id;
  if v_tipo = 'cohort' and new.cohort_id is null then
    raise exception 'Este curso es por generaciones: elige la generación del módulo.' using errcode = '23514';
  end if;
  if v_tipo = 'evergreen' and new.cohort_id is not null then
    raise exception 'Este curso no tiene generaciones: el módulo va sin generación.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger modules_generacion_obligatoria
  before insert or update of course_id, cohort_id on academia.modules
  for each row execute function academia.modulo_generacion_obligatoria();

-- Cambiar el tipo de curso con módulos incoherentes falla con mensaje: nada
-- cambia en silencio.
create or replace function academia.curso_tipo_coherente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('academia.convirtiendo', true), '') = '1' then
    return new;
  end if;
  if new.course_type = 'evergreen'
     and exists (select 1 from academia.modules m where m.course_id = new.id and m.cohort_id is not null) then
    raise exception 'Este curso tiene módulos por generación: no puede volver a evergreen.' using errcode = '23514';
  end if;
  if new.course_type = 'cohort'
     and exists (select 1 from academia.modules m where m.course_id = new.id and m.cohort_id is null) then
    raise exception 'Crea la primera generación desde el curso: ahí se mueve el contenido actual.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger courses_tipo_coherente
  before update of course_type on academia.courses
  for each row execute function academia.curso_tipo_coherente();

-- Una generación con módulos o inscritos no cambia de curso.
create or replace function academia.generacion_curso_fijo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.course_id is distinct from old.course_id and (
       exists (select 1 from academia.modules m where m.cohort_id = old.id)
    or exists (select 1 from academia.enrollments e where e.cohort_id = old.id)
  ) then
    raise exception 'Esta generación ya tiene contenido o alumnos: no cambia de curso.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger cohorts_curso_fijo
  before update of course_id on academia.cohorts
  for each row execute function academia.generacion_curso_fijo();

-- Una generación terminada no se abre a inscripciones.
create or replace function academia.generacion_abrir_solo_vigente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.open_for_enrollment and new.ends_on is not null and new.ends_on < current_date then
    raise exception 'Esta generación ya terminó: no se abre a inscripciones.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger cohorts_abrir_solo_vigente
  before insert or update of open_for_enrollment, ends_on on academia.cohorts
  for each row execute function academia.generacion_abrir_solo_vigente();

-- La base sella la generación de una publicación (doctrina de 0023):
--   * al insertar como alumno en un curso por generaciones, la suya;
--   * en un curso evergreen, ninguna;
--   * curso y generación son inmutables para quien no es del equipo.
create or replace function academia.publicacion_sella_generacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_equipo boolean := academia.is_admin() or academia.es_servicio();
begin
  if tg_op = 'UPDATE' then
    if not v_equipo and (
         new.course_id is distinct from old.course_id
      or new.cohort_id is distinct from old.cohort_id
    ) then
      raise exception 'Una publicación no cambia de generación.' using errcode = '42501';
    end if;
    return new;
  end if;

  if not academia.curso_por_generaciones(new.course_id) then
    new.cohort_id := null;
  elsif new.cohort_id is null and not v_equipo then
    new.cohort_id := academia.generacion_del_alumno(new.course_id);
  end if;
  return new;
end;
$$;

create trigger community_posts_sella_generacion
  before insert or update on academia.community_posts
  for each row execute function academia.publicacion_sella_generacion();

-- ==========================================================================
-- 6. Policies (nombres y forma de 0031)
-- ==========================================================================

-- --- contenido: exige vigencia ---------------------------------------------

alter policy "modules_select_inscrito" on academia.modules
  using (((select academia.is_admin()) OR academia.inscrito_en_generacion(course_id, cohort_id, false)));

alter policy "lessons_select_con_acceso" on academia.lessons
  using (((select academia.is_admin()) OR ((status = 'published'::text) AND academia.ve_modulo(module_id, true))));

alter policy "lesson_attachments_select_con_acceso" on academia.lesson_attachments
  using (((select academia.is_admin()) OR academia.ve_leccion(lesson_id)));

alter policy "quizzes_select_con_acceso" on academia.quizzes
  using (((select academia.is_admin()) OR academia.ve_leccion(lesson_id)));

alter policy "assignments_select_con_acceso" on academia.assignments
  using (((select academia.is_admin()) OR academia.ve_leccion(lesson_id)));

alter policy "lesson_comments_select_visible" on academia.lesson_comments
  using (((select academia.is_admin()) OR ((status = 'visible'::text) AND academia.ve_leccion(lesson_id))));

alter policy "lesson_comments_insert_propio" on academia.lesson_comments
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'visible'::text) AND academia.ve_leccion(lesson_id)));

-- El select del progreso sigue sin filtro de generación: el progreso
-- sobrevive al cambio de generación (nunca se borra).
alter policy "lesson_progress_insert_propio" on academia.lesson_progress
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND academia.ve_leccion(lesson_id)));

alter policy "lesson_progress_update_propio" on academia.lesson_progress
  using (((user_id = ( SELECT auth.uid() AS uid)) AND academia.ve_leccion(lesson_id)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));

alter policy "assignment_submissions_insert_propio" on academia.assignment_submissions
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'submitted'::text) AND (reviewed_by IS NULL) AND academia.ve_leccion(academia.leccion_de_tarea(assignment_id))));

alter policy "assignment_submissions_reentrega" on academia.assignment_submissions
  using (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'rejected'::text) AND academia.ve_leccion(academia.leccion_de_tarea(assignment_id))))
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'submitted'::text)));

alter policy "community_posts_select_visible" on academia.community_posts
  using (((select academia.is_admin()) OR ((status = 'visible'::text) AND academia.inscrito_en_generacion(course_id, cohort_id, true))));

-- El `with check` corre DESPUÉS del disparador que sella la generación: un
-- alumno sin generación en un curso por generaciones queda rechazado aquí.
alter policy "community_posts_insert_propio" on academia.community_posts
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'visible'::text) AND (pinned = false) AND ((select academia.is_admin()) OR academia.inscrito_en_generacion(course_id, cohort_id, true))));

alter policy "community_comments_select_visible" on academia.community_comments
  using (((select academia.is_admin()) OR ((status = 'visible'::text) AND academia.ve_post(post_id))));

alter policy "community_comments_insert_propio" on academia.community_comments
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'visible'::text) AND ((select academia.is_admin()) OR academia.ve_post(post_id))));

alter policy "community_reactions_select_visible" on academia.community_reactions
  using (((select academia.is_admin()) OR ((post_id IS NOT NULL) AND academia.ve_post(post_id)) OR ((comment_id IS NOT NULL) AND academia.ve_post(( SELECT c.post_id
   FROM academia.community_comments c
  WHERE (c.id = community_reactions.comment_id))))));

alter policy "community_reactions_insert_propio" on academia.community_reactions
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND ((select academia.is_admin()) OR ((post_id IS NOT NULL) AND academia.ve_post(post_id)) OR ((comment_id IS NOT NULL) AND academia.ve_post(( SELECT c.post_id
   FROM academia.community_comments c
  WHERE (c.id = community_reactions.comment_id)))))));

-- --- estructura: basta la inscripción -----------------------------------

alter policy "polls_select_admin_o_inscrito" on academia.polls
  using (((select academia.is_admin()) OR academia.inscrito_en_generacion(course_id, cohort_id, false)));

alter policy "poll_questions_select_admin_o_inscrito" on academia.poll_questions
  using (((select academia.is_admin()) OR academia.ve_encuesta(poll_id)));

alter policy "dynamics_select_admin_o_inscrito" on academia.dynamics
  using (((select academia.is_admin()) OR ((status <> 'draft'::text) AND academia.inscrito_en_generacion(course_id, cohort_id, false))));

alter policy "dynamic_boards_select_miembro" on academia.dynamic_boards
  using (((select academia.is_admin()) OR (academia.es_miembro_de_tablero(id) AND academia.ve_dinamica(dynamic_id, false))));

alter policy "dynamic_boards_insert_miembro" on academia.dynamic_boards
  with check (((select academia.is_admin()) OR (academia.dinamica_abierta(dynamic_id) AND academia.ve_dinamica(dynamic_id, true) AND (((company_id IS NOT NULL) AND (company_id = academia.mi_empresa()) AND (owner_user_id IS NULL)) OR ((owner_user_id = ( SELECT auth.uid() AS uid)) AND (company_id IS NULL) AND (academia.mi_empresa() IS NULL))))));

alter policy "dynamic_columns_select_miembro" on academia.dynamic_columns
  using (((select academia.is_admin()) OR (academia.es_miembro_de_tablero(board_id) AND academia.ve_dinamica(academia.dinamica_del_tablero(board_id), false))));

alter policy "dynamic_cells_select_miembro" on academia.dynamic_cells
  using (((select academia.is_admin()) OR (academia.es_miembro_de_tablero(board_id) AND academia.ve_dinamica(academia.dinamica_del_tablero(board_id), false))));

-- El alumno solo conoce SU generación (nombre, fechas); el equipo, todas.
alter policy "cohorts_select_inscrito" on academia.cohorts
  using (((select academia.is_admin()) OR (academia.has_enrollment(course_id) AND ((NOT academia.curso_por_generaciones(course_id)) OR (id = academia.generacion_del_alumno(course_id))))));

-- Anuncios: a todos, a un curso entero o a una generación.
alter policy "posts_select_publicado" on academia.posts
  using (((select academia.is_admin()) OR ((published_at IS NOT NULL) AND (published_at <= now()) AND ((audience_course_id IS NULL) OR ((audience_cohort_id IS NULL) AND academia.has_enrollment(audience_course_id)) OR academia.inscrito_en_generacion(audience_course_id, audience_cohort_id, false)))));

-- ==========================================================================
-- 7. Vistas (`create or replace` solo admite AÑADIR columnas al final)
-- ==========================================================================

create or replace view academia.lesson_outline with (security_invoker=false) as
SELECT l.id,
    l.module_id,
    m.course_id,
    l.title,
    l."position",
    l.lesson_type,
    l.is_required,
    l.bunny_video_id IS NOT NULL AS tiene_video,
    l.video_duration_sec,
    (EXISTS (
      SELECT 1
        FROM academia.enrollments x
        JOIN academia.courses c ON c.id = x.course_id
       WHERE x.user_id = (SELECT auth.uid())
         AND x.status = 'active'::text
         AND (x.expires_at IS NULL OR x.expires_at > now())
         AND x.course_id = m.course_id
         AND CASE WHEN c.course_type = 'cohort' THEN x.cohort_id = m.cohort_id ELSE m.cohort_id IS NULL END
    )) AS desbloqueada,
    m.cohort_id
   FROM academia.lessons l
     JOIN academia.modules m ON m.id = l.module_id
  WHERE l.status = 'published'::text
    AND ((SELECT academia.is_admin()) OR EXISTS (
      SELECT 1
        FROM academia.enrollments x
        JOIN academia.courses c ON c.id = x.course_id
       WHERE x.user_id = (SELECT auth.uid())
         AND x.status = 'active'::text
         AND x.course_id = m.course_id
         AND CASE WHEN c.course_type = 'cohort' THEN x.cohort_id = m.cohort_id ELSE m.cohort_id IS NULL END
    ));

create or replace view academia.quiz_questions_public with (security_invoker=false) as
SELECT id,
    quiz_id,
    question,
    options,
    "position"
   FROM academia.quiz_questions q
  WHERE (SELECT academia.is_admin()) OR academia.ve_leccion(academia.leccion_del_quiz(quiz_id));

-- Los conteos siguen por curso (los puntos son de la persona y se conservan al
-- cambiarla de generación); `dinamicas` cuenta solo las de su generación; la
-- última columna dice en qué generación compite, y solo se ven las filas de la
-- propia generación: el ranking es por generación.
create or replace view academia.actividad_por_curso with (security_invoker=false) as
SELECT e.user_id,
    e.course_id,
    ( SELECT count(*)::integer AS count
           FROM academia.lesson_progress lp
          WHERE lp.user_id = e.user_id AND lp.completed AND academia.curso_de_leccion(lp.lesson_id) = e.course_id) AS lecciones,
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
          WHERE d.course_id = e.course_id AND d.cohort_id IS NOT DISTINCT FROM e.cohort_id AND (d.status = 'closed'::text OR d.status = 'open'::text AND d.closes_at IS NOT NULL AND d.closes_at <= now()) AND (EXISTS ( SELECT 1
                   FROM academia.dynamic_rows r
                  WHERE r.dynamic_id = d.id AND r.row_kind = 'criterio'::text)) AND (EXISTS ( SELECT 1
                   FROM academia.dynamic_boards b
                     JOIN academia.dynamic_columns c ON c.board_id = b.id
                  WHERE b.dynamic_id = d.id AND (p.company_id IS NOT NULL AND b.company_id = p.company_id OR b.owner_user_id = e.user_id) AND NOT (EXISTS ( SELECT 1
                           FROM academia.dynamic_rows r
                          WHERE r.dynamic_id = d.id AND r.row_kind = 'criterio'::text AND NOT (EXISTS ( SELECT 1
                                   FROM academia.dynamic_cells x
                                  WHERE x.column_id = c.id AND x.row_id = r.id AND x.numeric_value IS NOT NULL))))))) AS dinamicas,
    e.cohort_id
   FROM academia.enrollments e
     JOIN academia.profiles p ON p.user_id = e.user_id
  WHERE e.status = 'active'::text AND p.role = 'alumno'::text AND p.status = 'active'::text
    AND ((SELECT academia.is_admin()) OR EXISTS (
      SELECT 1
        FROM academia.enrollments x
        JOIN academia.courses c ON c.id = x.course_id
       WHERE x.user_id = (SELECT auth.uid())
         AND x.status = 'active'::text
         AND x.course_id = e.course_id
         AND CASE WHEN c.course_type = 'cohort' THEN x.cohort_id = e.cohort_id ELSE true END
    ));

grant select on academia.lesson_outline, academia.quiz_questions_public, academia.actividad_por_curso to authenticated, service_role;

-- ==========================================================================
-- 8. Funciones que llama la aplicación
-- ==========================================================================

-- Convierte un curso evergreen en «por generaciones» moviendo su contenido
-- actual a la generación dada (la primera). Es la única manera de pasar de un
-- estado al otro con módulos de por medio: los disparadores de coherencia
-- exigen las dos cosas a la vez, así que se levanta la marca de transacción.
create or replace function academia.academia_activar_generaciones(curso uuid, generacion uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_n integer;
begin
  if not academia.is_admin() then
    raise exception 'Solo el equipo activa generaciones' using errcode = '42501';
  end if;
  if academia.curso_de_cohorte(generacion) is distinct from curso then
    raise exception 'La generación no es de este curso' using errcode = '22023';
  end if;
  if academia.curso_por_generaciones(curso) then
    return 0;
  end if;

  perform set_config('academia.convirtiendo', '1', true);
  update academia.modules set cohort_id = generacion where course_id = curso and cohort_id is null;
  get diagnostics v_n = row_count;
  update academia.courses set course_type = 'cohort' where id = curso;
  -- El contenido ya es de la generación: a los inscritos sin generación les
  -- toca ella, para que no se queden sin ver nada.
  update academia.enrollments set cohort_id = generacion
   where course_id = curso and cohort_id is null and status = 'active';
  perform set_config('academia.convirtiendo', '', true);
  return v_n;
end;
$function$;

-- Copia la ESTRUCTURA de una generación a otra vacía del mismo curso: módulos,
-- lecciones (sin video, en borrador), adjuntos (mismo archivo), quizzes con sus
-- preguntas y tareas. Nunca progreso, comentarios, sesiones ni grabaciones.
-- Devuelve los conteos para el aviso del panel.
create or replace function academia.academia_copiar_generacion(origen uuid, destino uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_curso    uuid;
  v_mod      integer := 0;
  v_lec      integer := 0;
  v_adj      integer := 0;
  v_quiz     integer := 0;
  v_preg     integer := 0;
  v_tareas   integer := 0;
  v_rc       integer;
  m          record;
  l          record;
  v_modulo   uuid;
  v_leccion  uuid;
  v_quiz_id  uuid;
begin
  if not academia.is_admin() then
    raise exception 'Solo el equipo copia generaciones' using errcode = '42501';
  end if;
  if origen = destino then
    raise exception 'Origen y destino son la misma generación' using errcode = '22023';
  end if;
  select course_id into v_curso from academia.cohorts where id = origen;
  if v_curso is null or v_curso is distinct from academia.curso_de_cohorte(destino) then
    raise exception 'Las dos generaciones tienen que ser del mismo curso' using errcode = '22023';
  end if;
  if exists (select 1 from academia.modules where cohort_id = destino) then
    raise exception 'La generación destino ya tiene módulos' using errcode = '22023';
  end if;

  for m in
    select * from academia.modules where cohort_id = origen order by position, created_at
  loop
    insert into academia.modules (course_id, cohort_id, title, position)
    values (m.course_id, destino, m.title, m.position)
    returning id into v_modulo;
    v_mod := v_mod + 1;

    for l in
      select * from academia.lessons where module_id = m.id order by position, created_at
    loop
      insert into academia.lessons (module_id, title, description_rich, position, lesson_type, bunny_video_id, video_duration_sec, is_required, status)
      values (v_modulo, l.title, l.description_rich, l.position, l.lesson_type, null, null, l.is_required, 'draft')
      returning id into v_leccion;
      v_lec := v_lec + 1;

      insert into academia.lesson_attachments (lesson_id, storage_path, file_name, mime_type, size_bytes)
      select v_leccion, a.storage_path, a.file_name, a.mime_type, a.size_bytes
        from academia.lesson_attachments a where a.lesson_id = l.id;
      get diagnostics v_rc = row_count;
      v_adj := v_adj + v_rc;

      if exists (select 1 from academia.quizzes q where q.lesson_id = l.id) then
        insert into academia.quizzes (lesson_id, passing_score, reveal_answers)
        select v_leccion, q.passing_score, q.reveal_answers from academia.quizzes q where q.lesson_id = l.id
        returning id into v_quiz_id;
        v_quiz := v_quiz + 1;

        insert into academia.quiz_questions (quiz_id, question, options, correct_option_id, position)
        select v_quiz_id, qq.question, qq.options, qq.correct_option_id, qq.position
          from academia.quiz_questions qq
          join academia.quizzes q on q.id = qq.quiz_id
         where q.lesson_id = l.id;
        get diagnostics v_rc = row_count;
      v_preg := v_preg + v_rc;
      end if;

      insert into academia.assignments (lesson_id, instructions_rich, allow_files, allow_text)
      select v_leccion, t.instructions_rich, t.allow_files, t.allow_text
        from academia.assignments t where t.lesson_id = l.id;
      get diagnostics v_rc = row_count;
      v_tareas := v_tareas + v_rc;
    end loop;
  end loop;

  return jsonb_build_object(
    'modulos', v_mod, 'lecciones', v_lec, 'adjuntos', v_adj,
    'quizzes', v_quiz, 'preguntas', v_preg, 'tareas', v_tareas
  );
end;
$function$;

-- Cambia a una persona de generación dentro de un curso (o le asigna una si no
-- tenía). Su progreso no se toca: solo deja de ver las lecciones de la anterior.
-- Devuelve la generación anterior (nula si no tenía).
create or replace function academia.academia_mover_de_generacion(alumno uuid, curso uuid, generacion uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_previa uuid;
begin
  if not academia.is_admin() then
    raise exception 'Solo el equipo cambia a alguien de generación' using errcode = '42501';
  end if;
  if not academia.curso_por_generaciones(curso) then
    raise exception 'Este curso no tiene generaciones' using errcode = '22023';
  end if;
  if academia.curso_de_cohorte(generacion) is distinct from curso then
    raise exception 'La generación no es de este curso' using errcode = '22023';
  end if;

  select cohort_id into v_previa
    from academia.enrollments where user_id = alumno and course_id = curso;
  if not found then
    raise exception 'La persona no está inscrita en este curso' using errcode = '22023';
  end if;

  update academia.enrollments set cohort_id = generacion
   where user_id = alumno and course_id = curso;
  return v_previa;
end;
$function$;

-- El catálogo (0033) gana la generación abierta: un curso por generaciones solo
-- se ofrece si tiene una, y sus conteos son los de esa generación.
drop function academia.academia_catalogo();

create function academia.academia_catalogo()
returns table (
  id                       uuid,
  slug                     text,
  title                    text,
  description              text,
  cover_url                text,
  price_mxn                numeric,
  price_usd                numeric,
  stripe_payment_link_mxn  text,
  stripe_payment_link_usd  text,
  access_days              integer,
  course_type              text,
  is_free                  boolean,
  lecciones                integer,
  modulos                  integer,
  inscrito                 boolean,
  generacion_abierta       text,
  generacion_inicia        date
)
language sql
stable
security definer
set search_path = ''
as $function$
  select c.id, c.slug, c.title, c.description, c.cover_url,
         c.price_mxn, c.price_usd, c.stripe_payment_link_mxn, c.stripe_payment_link_usd,
         c.access_days, c.course_type, c.is_free,
         (select count(*)::integer
            from academia.lessons l
            join academia.modules m on m.id = l.module_id
           where m.course_id = c.id and l.status = 'published'
             and (c.course_type <> 'cohort' or m.cohort_id = g.id)),
         (select count(*)::integer from academia.modules m
           where m.course_id = c.id and (c.course_type <> 'cohort' or m.cohort_id = g.id)),
         exists (
           select 1 from academia.enrollments e
            where e.course_id = c.id
              and e.user_id = (select auth.uid())
              and e.status = 'active'
         ),
         g.name,
         g.starts_on
    from academia.courses c
    left join academia.cohorts g on g.id = academia.generacion_abierta_del_curso(c.id)
   where (select auth.uid()) is not null
     and c.status = 'published'
     and c.in_catalog
     and (c.course_type <> 'cohort' or g.id is not null)
   order by c.is_free desc, c.title;
$function$;

-- Empezar gratis (0033): la inscripción cae en la generación abierta; quien
-- regresa conserva la generación que tenía.
create or replace function academia.academia_inscribirme_gratis(curso uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid    uuid := (select auth.uid());
  v_curso  academia.courses;
  v_estado text;
  v_gen    uuid;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para empezar el curso' using errcode = 'insufficient_privilege';
  end if;

  select status into v_estado from academia.profiles where user_id = v_uid;
  if v_estado is null or v_estado <> 'active' then
    raise exception 'Tu cuenta no está activa' using errcode = 'insufficient_privilege';
  end if;

  select * into v_curso from academia.courses where id = curso;
  if not found or v_curso.status <> 'published' or not v_curso.in_catalog or not v_curso.is_free then
    raise exception 'Ese curso no se puede empezar gratis' using errcode = 'check_violation';
  end if;

  if v_curso.course_type = 'cohort' then
    v_gen := academia.generacion_abierta_del_curso(v_curso.id);
    if v_gen is null then
      raise exception 'Este curso no tiene una generación abierta' using errcode = 'check_violation';
    end if;
  end if;

  insert into academia.enrollments (user_id, course_id, cohort_id, source, starts_at, expires_at, status)
  values (
    v_uid, v_curso.id, v_gen, 'catalogo', now(),
    case when v_curso.access_days is null then null else now() + make_interval(days => v_curso.access_days) end,
    'active'
  )
  on conflict (user_id, course_id) do update
    set status = 'active',
        expires_at = excluded.expires_at,
        cohort_id = coalesce(academia.enrollments.cohort_id, excluded.cohort_id);

  return v_curso.slug;
end;
$function$;

-- ==========================================================================
-- 9. Permisos (patrón 0028: nada para PUBLIC)
-- ==========================================================================

do $$
declare
  firma text;
begin
  foreach firma in array array[
    'academia.inscrito_en_generacion(uuid, uuid, boolean)',
    'academia.generacion_del_alumno(uuid)',
    'academia.curso_por_generaciones(uuid)',
    'academia.generacion_abierta_del_curso(uuid)',
    'academia.ve_modulo(uuid, boolean)',
    'academia.ve_leccion(uuid)',
    'academia.ve_post(uuid)',
    'academia.ve_encuesta(uuid)',
    'academia.ve_dinamica(uuid, boolean)',
    'academia.leccion_del_quiz(uuid)',
    'academia.leccion_de_tarea(uuid)',
    'academia.dinamica_visible(uuid)',
    'academia.puede_editar_tablero(uuid)',
    'academia.puede_descargar_adjunto(text)',
    'academia.generacion_del_mismo_curso()',
    'academia.anuncio_generacion_coherente()',
    'academia.modulo_generacion_obligatoria()',
    'academia.curso_tipo_coherente()',
    'academia.generacion_curso_fijo()',
    'academia.generacion_abrir_solo_vigente()',
    'academia.publicacion_sella_generacion()',
    'academia.academia_activar_generaciones(uuid, uuid)',
    'academia.academia_copiar_generacion(uuid, uuid)',
    'academia.academia_mover_de_generacion(uuid, uuid, uuid)'
  ]
  loop
    execute format('revoke all on function %s from public', firma);
    execute format('grant execute on function %s to authenticated, service_role', firma);
  end loop;
end;
$$;

revoke all on function academia.academia_catalogo() from public, anon;
revoke all on function academia.academia_inscribirme_gratis(uuid) from public, anon;
grant execute on function academia.academia_catalogo() to authenticated;
grant execute on function academia.academia_inscribirme_gratis(uuid) to authenticated;
