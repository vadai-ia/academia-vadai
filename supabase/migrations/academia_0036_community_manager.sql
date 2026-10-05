-- academia_0036_community_manager.sql
-- Un rol nuevo, `community_manager`: atiende la comunidad y opera la academia
-- casi como un admin, sin tocar la estructura de los cursos, las altas ni el
-- dinero.
--
-- POR QUÉ
-- Alejandro (3-oct-2026): "agregar el rol de community managers… que desde el
-- portal de admin en comunidades puedan interactuar, contestar y dar
-- seguimiento". Sus decisiones:
--   - Casi admin: todo lo de un admin menos crear cursos, dar de alta,
--     eliminar cuentas y ver pagos.
--   - Contenido: solo sesiones en vivo y grabaciones (agenda sesiones, liga
--     grabaciones, sube el video de una lección y sus adjuntos). No toca
--     módulos, lecciones, quizzes, tareas ni generaciones.
--   - Alumnos: todo menos alta y eliminar (ve fichas y correos, reenvía el
--     acceso, cambia empresa o generación, suspende, revoca o extiende).
--   - Alcance: todas las comunidades de la academia; no se inscribe a cursos.
--   - Para el alumno contesta como «Equipo VADAI».
--   - Solo un superadmin da o quita el rol.
--
-- CÓMO: NEGAR POR DEFAULT
-- `is_admin()` sigue significando admin o superadmin. Se agrega `is_equipo()`
-- (admin, superadmin o community manager) y solo las políticas donde el CM sí
-- entra pasan a usarla: toda lectura salvo pagos, y las escrituras de la lista
-- de arriba. Una tabla nueva que use `is_admin()` nace cerrada para el CM: hay
-- que decidir abrírsela, no acordarse de cerrársela.
--
-- Dos huecos que una política no alcanza a cerrar van por trigger:
--   - `lessons`: el CM actualiza solo el video, su duración y la publicación
--     (la grabación). Título, módulo, tipo, posición, descripción: no.
--   - `enrollments`: el CM cambia estado, vigencia y generación, nunca el curso
--     ni la persona (eso sería dar acceso a un curso, que es un alta).
-- Y `proteger_campos_de_perfil` aprende que el CM no cambia roles ni toca
-- cuentas del equipo, y que dar o quitar el rol de CM es solo de superadmin.
--
-- Las políticas se reescribieron a partir de su texto vivo en la base
-- (pg_policies, 3-oct-2026), cambiando solo `is_admin()` por `is_equipo()`, y
-- conservan la forma `(select …)` de 0031.

-- ==========================================================================
-- 1. El rol
-- ==========================================================================

alter table academia.profiles drop constraint profiles_role_check;
alter table academia.profiles add constraint profiles_role_check
  check (role = any (array['superadmin', 'admin', 'community_manager', 'alumno', 'invitado']));

create or replace function academia.is_equipo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(academia.current_role() in ('admin', 'superadmin', 'community_manager'), false)
$$;

revoke all on function academia.is_equipo() from public;
grant execute on function academia.is_equipo() to authenticated, service_role;

-- ==========================================================================
-- 2. Políticas, funciones y vistas que pasan a «equipo»
-- ==========================================================================

-- --- Políticas (84) -----------------------------------------------------
alter policy "access_links_lee_equipo" on academia.access_links
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "assignment_submissions_select_propio_o_admin" on academia.assignment_submissions
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT academia.is_equipo() AS is_equipo)));

alter policy "assignment_submissions_update_admin" on academia.assignment_submissions
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "assignments_select_con_acceso" on academia.assignments
  using ((( SELECT academia.is_equipo() AS is_equipo) OR academia.ve_leccion(lesson_id)));

alter policy "certificates_select_propio_o_admin" on academia.certificates
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT academia.is_equipo() AS is_equipo)));

alter policy "client_errors_borra_equipo" on academia.client_errors
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "client_errors_lee_equipo" on academia.client_errors
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "cohort_sessions_delete_admin" on academia.cohort_sessions
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "cohort_sessions_insert_admin" on academia.cohort_sessions
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "cohort_sessions_select_su_cohorte" on academia.cohort_sessions
  using ((( SELECT academia.is_equipo() AS is_equipo) OR academia.pertenece_a_cohorte(cohort_id)));

alter policy "cohort_sessions_update_admin" on academia.cohort_sessions
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "cohorts_select_inscrito" on academia.cohorts
  using ((( SELECT academia.is_equipo() AS is_equipo) OR (academia.has_enrollment(course_id) AND ((NOT academia.curso_por_generaciones(course_id)) OR (id = academia.generacion_del_alumno(course_id))))));

alter policy "community_comments_delete_admin" on academia.community_comments
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "community_comments_insert_propio" on academia.community_comments
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'visible'::text) AND (( SELECT academia.is_equipo() AS is_equipo) OR academia.ve_post(post_id))));

alter policy "community_comments_select_visible" on academia.community_comments
  using ((( SELECT academia.is_equipo() AS is_equipo) OR ((status = 'visible'::text) AND academia.ve_post(post_id))));

alter policy "community_comments_update_admin" on academia.community_comments
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "community_posts_delete_admin" on academia.community_posts
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "community_posts_insert_propio" on academia.community_posts
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'visible'::text) AND (pinned = false) AND (( SELECT academia.is_equipo() AS is_equipo) OR academia.inscrito_en_generacion(course_id, cohort_id, true))));

alter policy "community_posts_select_visible" on academia.community_posts
  using ((( SELECT academia.is_equipo() AS is_equipo) OR ((status = 'visible'::text) AND academia.inscrito_en_generacion(course_id, cohort_id, true))));

alter policy "community_posts_update_admin" on academia.community_posts
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "community_reactions_delete_propio" on academia.community_reactions
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT academia.is_equipo() AS is_equipo)));

alter policy "community_reactions_insert_propio" on academia.community_reactions
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT academia.is_equipo() AS is_equipo) OR ((post_id IS NOT NULL) AND academia.ve_post(post_id)) OR ((comment_id IS NOT NULL) AND academia.ve_post(( SELECT c.post_id
   FROM academia.community_comments c
  WHERE (c.id = community_reactions.comment_id)))))));

alter policy "community_reactions_select_visible" on academia.community_reactions
  using ((( SELECT academia.is_equipo() AS is_equipo) OR ((post_id IS NOT NULL) AND academia.ve_post(post_id)) OR ((comment_id IS NOT NULL) AND academia.ve_post(( SELECT c.post_id
   FROM academia.community_comments c
  WHERE (c.id = community_reactions.comment_id))))));

alter policy "companies_delete_admin" on academia.companies
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "companies_insert_admin" on academia.companies
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "companies_update_admin" on academia.companies
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "courses_select_inscrito" on academia.courses
  using ((( SELECT academia.is_equipo() AS is_equipo) OR academia.has_enrollment(id)));

alter policy "dynamic_boards_delete_admin" on academia.dynamic_boards
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "dynamic_boards_insert_miembro" on academia.dynamic_boards
  with check ((( SELECT academia.is_equipo() AS is_equipo) OR (academia.dinamica_abierta(dynamic_id) AND academia.ve_dinamica(dynamic_id, true) AND (((company_id IS NOT NULL) AND (company_id = academia.mi_empresa()) AND (owner_user_id IS NULL)) OR ((owner_user_id = ( SELECT auth.uid() AS uid)) AND (company_id IS NULL) AND (academia.mi_empresa() IS NULL))))));

alter policy "dynamic_boards_select_miembro" on academia.dynamic_boards
  using ((( SELECT academia.is_equipo() AS is_equipo) OR (academia.es_miembro_de_tablero(id) AND academia.ve_dinamica(dynamic_id, false))));

alter policy "dynamic_boards_update_admin" on academia.dynamic_boards
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "dynamic_cells_select_miembro" on academia.dynamic_cells
  using ((( SELECT academia.is_equipo() AS is_equipo) OR (academia.es_miembro_de_tablero(board_id) AND academia.ve_dinamica(academia.dinamica_del_tablero(board_id), false))));

alter policy "dynamic_columns_delete_creador_o_admin" on academia.dynamic_columns
  using ((( SELECT academia.is_equipo() AS is_equipo) OR ((created_by = ( SELECT auth.uid() AS uid)) AND academia.puede_editar_tablero(board_id))));

alter policy "dynamic_columns_select_miembro" on academia.dynamic_columns
  using ((( SELECT academia.is_equipo() AS is_equipo) OR (academia.es_miembro_de_tablero(board_id) AND academia.ve_dinamica(academia.dinamica_del_tablero(board_id), false))));

alter policy "dynamic_rows_delete_admin" on academia.dynamic_rows
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "dynamic_rows_insert_admin" on academia.dynamic_rows
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "dynamic_rows_update_admin" on academia.dynamic_rows
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "dynamics_delete_admin" on academia.dynamics
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "dynamics_insert_admin" on academia.dynamics
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "dynamics_select_admin_o_inscrito" on academia.dynamics
  using ((( SELECT academia.is_equipo() AS is_equipo) OR ((status <> 'draft'::text) AND academia.inscrito_en_generacion(course_id, cohort_id, false))));

alter policy "dynamics_update_admin" on academia.dynamics
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "enrollments_select_propio_o_admin" on academia.enrollments
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT academia.is_equipo() AS is_equipo)));

alter policy "enrollments_update_admin" on academia.enrollments
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "lesson_attachments_delete_admin" on academia.lesson_attachments
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "lesson_attachments_insert_admin" on academia.lesson_attachments
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "lesson_attachments_select_con_acceso" on academia.lesson_attachments
  using ((( SELECT academia.is_equipo() AS is_equipo) OR academia.ve_leccion(lesson_id)));

alter policy "lesson_attachments_update_admin" on academia.lesson_attachments
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "lesson_comments_delete_admin" on academia.lesson_comments
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "lesson_comments_insert_propio" on academia.lesson_comments
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'visible'::text) AND (( SELECT academia.is_equipo() AS is_equipo) OR academia.ve_leccion(lesson_id))));

alter policy "lesson_comments_select_visible" on academia.lesson_comments
  using ((( SELECT academia.is_equipo() AS is_equipo) OR ((status = 'visible'::text) AND academia.ve_leccion(lesson_id))));

alter policy "lesson_comments_update_admin" on academia.lesson_comments
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "lesson_progress_select_propio_o_admin" on academia.lesson_progress
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT academia.is_equipo() AS is_equipo)));

alter policy "lessons_select_con_acceso" on academia.lessons
  using ((( SELECT academia.is_equipo() AS is_equipo) OR ((status = 'published'::text) AND academia.ve_modulo(module_id, true))));

alter policy "lessons_update_admin" on academia.lessons
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "modules_select_inscrito" on academia.modules
  using ((( SELECT academia.is_equipo() AS is_equipo) OR academia.inscrito_en_generacion(course_id, cohort_id, false)));

alter policy "participants_delete_admin" on academia.participants
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "participants_insert_admin" on academia.participants
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "participants_select_admin_o_propio" on academia.participants
  using ((( SELECT academia.is_equipo() AS is_equipo) OR (user_id = ( SELECT auth.uid() AS uid))));

alter policy "participants_update_admin" on academia.participants
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "poll_answers_delete_admin" on academia.poll_answers
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "poll_answers_select_admin" on academia.poll_answers
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "poll_answers_update_admin" on academia.poll_answers
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "poll_participants_delete_admin" on academia.poll_participants
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "poll_participants_select_admin" on academia.poll_participants
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "poll_questions_delete_admin" on academia.poll_questions
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "poll_questions_insert_admin" on academia.poll_questions
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "poll_questions_select_admin_o_inscrito" on academia.poll_questions
  using ((( SELECT academia.is_equipo() AS is_equipo) OR academia.ve_encuesta(poll_id)));

alter policy "poll_questions_update_admin" on academia.poll_questions
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "polls_delete_admin" on academia.polls
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "polls_insert_admin" on academia.polls
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "polls_select_admin_o_inscrito" on academia.polls
  using ((( SELECT academia.is_equipo() AS is_equipo) OR academia.inscrito_en_generacion(course_id, cohort_id, false)));

alter policy "polls_update_admin" on academia.polls
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "posts_delete_admin" on academia.posts
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "posts_insert_admin" on academia.posts
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "posts_select_publicado" on academia.posts
  using ((( SELECT academia.is_equipo() AS is_equipo) OR ((published_at IS NOT NULL) AND (published_at <= now()) AND ((audience_course_id IS NULL) OR ((audience_cohort_id IS NULL) AND academia.has_enrollment(audience_course_id)) OR academia.inscrito_en_generacion(audience_course_id, audience_cohort_id, false)))));

alter policy "posts_update_admin" on academia.posts
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "profiles_select_propio_o_admin" on academia.profiles
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT academia.is_equipo() AS is_equipo)));

alter policy "profiles_update_admin" on academia.profiles
  using (( SELECT academia.is_equipo() AS is_equipo))
  with check (( SELECT academia.is_equipo() AS is_equipo));

alter policy "quiz_attempts_select_propio_o_admin" on academia.quiz_attempts
  using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT academia.is_equipo() AS is_equipo)));

alter policy "quiz_questions_select_admin" on academia.quiz_questions
  using (( SELECT academia.is_equipo() AS is_equipo));

alter policy "quizzes_select_con_acceso" on academia.quizzes
  using ((( SELECT academia.is_equipo() AS is_equipo) OR academia.ve_leccion(lesson_id)));

alter policy "academia_adjuntos_admin_todo" on storage.objects
  using (((bucket_id = 'academia-adjuntos'::text) AND academia.is_equipo()))
  with check (((bucket_id = 'academia-adjuntos'::text) AND academia.is_equipo()));

alter policy "academia_media_admin_todo" on storage.objects
  using (((bucket_id = 'academia-media'::text) AND academia.is_equipo()))
  with check (((bucket_id = 'academia-media'::text) AND academia.is_equipo()));

alter policy "academia_certificados_admin_select" on storage.objects
  using (((bucket_id = 'academia-certificados'::text) AND academia.is_equipo()));

-- --- Funciones: dinámicas, tableros, sello de generación, mover de generación
CREATE OR REPLACE FUNCTION academia.dinamica_visible(p_dynamic_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select academia.is_equipo() or exists (
    select 1
      from academia.dynamics d
     where d.id = p_dynamic_id
       and d.status <> 'draft'
       and academia.inscrito_en_generacion(d.course_id, d.cohort_id, false)
  )
$function$;

CREATE OR REPLACE FUNCTION academia.puede_editar_tablero(p_board_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select academia.is_equipo() or (
    academia.es_miembro_de_tablero(p_board_id)
    and academia.dinamica_abierta(academia.dinamica_del_tablero(p_board_id))
    and academia.ve_dinamica(academia.dinamica_del_tablero(p_board_id), true)
  )
$function$;

CREATE OR REPLACE FUNCTION academia.columna_protegida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.board_id <> old.board_id then
    raise exception 'Un proyecto no se mueve de tablero.' using errcode = '22023';
  end if;

  if new.created_by is distinct from old.created_by
     and not (academia.is_equipo() or academia.es_servicio()) then
    raise exception 'Quién creó el proyecto no se cambia.' using errcode = '42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION academia.publicacion_sella_generacion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_equipo boolean := academia.is_equipo() or academia.es_servicio();
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
$function$;

CREATE OR REPLACE FUNCTION academia.academia_mover_de_generacion(alumno uuid, curso uuid, generacion uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_previa uuid;
begin
  if not academia.is_equipo() then
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

-- --- Vistas: es_equipo incluye al CM; el CM ve el temario completo
-- public_profiles (opciones: ["security_invoker=false"])
create or replace view academia.public_profiles with (security_invoker=false) as
SELECT user_id,
    full_name,
    avatar_url,
    role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'community_manager'::text]) AS es_equipo
   FROM academia.profiles p
  WHERE (( SELECT academia."current_role"() AS "current_role")) IS NOT NULL;

-- lesson_outline (opciones: ["security_invoker=false"])
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
    (EXISTS ( SELECT 1
           FROM academia.enrollments x
             JOIN academia.courses c ON c.id = x.course_id
          WHERE x.user_id = (( SELECT auth.uid() AS uid)) AND x.status = 'active'::text AND (x.expires_at IS NULL OR x.expires_at > now()) AND x.course_id = m.course_id AND
                CASE
                    WHEN c.course_type = 'cohort'::text THEN x.cohort_id = m.cohort_id
                    ELSE m.cohort_id IS NULL
                END)) AS desbloqueada,
    m.cohort_id
   FROM academia.lessons l
     JOIN academia.modules m ON m.id = l.module_id
  WHERE l.status = 'published'::text AND (( SELECT academia.is_equipo() AS is_equipo) OR (EXISTS ( SELECT 1
           FROM academia.enrollments x
             JOIN academia.courses c ON c.id = x.course_id
          WHERE x.user_id = (( SELECT auth.uid() AS uid)) AND x.status = 'active'::text AND x.course_id = m.course_id AND
                CASE
                    WHEN c.course_type = 'cohort'::text THEN x.cohort_id = m.cohort_id
                    ELSE m.cohort_id IS NULL
                END)));

-- quiz_questions_public (opciones: ["security_invoker=false"])
create or replace view academia.quiz_questions_public with (security_invoker=false) as
SELECT id,
    quiz_id,
    question,
    options,
    "position"
   FROM academia.quiz_questions q
  WHERE ( SELECT academia.is_equipo() AS is_equipo) OR academia.ve_leccion(academia.leccion_del_quiz(quiz_id));

-- actividad_por_curso (opciones: ["security_invoker=false"])
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
    e.cohort_id
   FROM academia.enrollments e
     JOIN academia.profiles p ON p.user_id = e.user_id
  WHERE e.status = 'active'::text AND p.role = 'alumno'::text AND p.status = 'active'::text AND (( SELECT academia.is_equipo() AS is_equipo) OR (EXISTS ( SELECT 1
           FROM academia.enrollments x
             JOIN academia.courses c ON c.id = x.course_id
          WHERE x.user_id = (( SELECT auth.uid() AS uid)) AND x.status = 'active'::text AND x.course_id = e.course_id AND
                CASE
                    WHEN c.course_type = 'cohort'::text THEN x.cohort_id = e.cohort_id
                    ELSE true
                END)));

-- Siguen siendo solo de admin (no se tocan):
--   assignment_submissions.assignment_submissions_delete_admin (DELETE)
--   assignments.assignments_delete_admin (DELETE)
--   assignments.assignments_insert_admin (INSERT)
--   assignments.assignments_update_admin (UPDATE)
--   cohorts.cohorts_delete_admin (DELETE)
--   cohorts.cohorts_insert_admin (INSERT)
--   cohorts.cohorts_update_admin (UPDATE)
--   courses.courses_insert_admin (INSERT)
--   courses.courses_update_admin (UPDATE)
--   enrollments.enrollments_delete_admin (DELETE)
--   enrollments.enrollments_insert_admin (INSERT)
--   lesson_progress.lesson_progress_delete_admin (DELETE)
--   lessons.lessons_delete_admin (DELETE)
--   lessons.lessons_insert_admin (INSERT)
--   modules.modules_delete_admin (DELETE)
--   modules.modules_insert_admin (INSERT)
--   modules.modules_update_admin (UPDATE)
--   payments.payments_select_propio_o_admin (SELECT)
--   profiles.profiles_insert_admin (INSERT)
--   quiz_attempts.quiz_attempts_delete_admin (DELETE)
--   quiz_questions.quiz_questions_delete_admin (DELETE)
--   quiz_questions.quiz_questions_insert_admin (INSERT)
--   quiz_questions.quiz_questions_update_admin (UPDATE)
--   quizzes.quizzes_delete_admin (DELETE)
--   quizzes.quizzes_insert_admin (INSERT)
--   quizzes.quizzes_update_admin (UPDATE)

-- ==========================================================================
-- 3. Perfiles: el CM no cambia roles ni toca al equipo
-- ==========================================================================

create or replace function academia.proteger_campos_de_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if academia.es_servicio() or academia.is_superadmin() then
    return new;
  end if;

  -- Un admin hace lo de siempre, salvo dar o quitar el rol de community
  -- manager: eso es solo de un superadmin (decidido 3-oct-2026).
  if academia.is_admin() then
    if new.role is distinct from old.role
       and 'community_manager' in (new.role, old.role) then
      raise exception 'Solo un superadmin da o quita el rol de community manager.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Un community manager sobre la cuenta de otra persona: estado, empresa,
  -- nombre y correo sí; el rol y la identidad, no; y a nadie del equipo.
  if academia.is_equipo() and old.user_id <> (select auth.uid()) then
    if old.role in ('superadmin', 'admin', 'community_manager') then
      raise exception 'Solo un admin cambia una cuenta del equipo.' using errcode = '42501';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Solo un admin cambia el rol de alguien.' using errcode = '42501';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'Una cuenta no cambia de identidad.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'No puedes cambiar tu rol.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'No puedes cambiar el estado de tu cuenta.' using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id or new.email is distinct from old.email then
    raise exception 'No puedes cambiar tu identidad.' using errcode = '42501';
  end if;

  if new.company_id is distinct from old.company_id then
    raise exception 'La empresa la asigna el equipo.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ==========================================================================
-- 4. Lecciones: el CM solo toca la grabación
-- ==========================================================================

create or replace function academia.academia_leccion_solo_grabacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if academia.es_servicio() or academia.is_admin() then
    return new;
  end if;

  -- Solo el equipo llega aquí (lessons_update_admin), así que quien no es
  -- admin es un community manager.
  if (to_jsonb(new) - array['bunny_video_id', 'video_duration_sec', 'status', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['bunny_video_id', 'video_duration_sec', 'status', 'updated_at']) then
    raise exception 'De una lección, el community manager solo cambia el video y si está publicada.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger lessons_solo_grabacion
  before update on academia.lessons
  for each row execute function academia.academia_leccion_solo_grabacion();

-- ==========================================================================
-- 5. Inscripciones: el CM no cambia de curso ni de persona
-- ==========================================================================

create or replace function academia.academia_inscripcion_sin_mover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if academia.es_servicio() or academia.is_admin() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.course_id is distinct from old.course_id then
    raise exception 'Solo un admin cambia el curso o la persona de una inscripción.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger enrollments_sin_mover
  before update on academia.enrollments
  for each row execute function academia.academia_inscripcion_sin_mover();

revoke all on function academia.academia_leccion_solo_grabacion() from public;
revoke all on function academia.academia_inscripcion_sin_mover() from public;
grant execute on function academia.academia_leccion_solo_grabacion() to authenticated, service_role;
grant execute on function academia.academia_inscripcion_sin_mover() to authenticated, service_role;
