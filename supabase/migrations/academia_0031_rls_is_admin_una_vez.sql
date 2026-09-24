-- academia_0031 · RLS: is_admin() se evalúa una vez por consulta, no una vez por fila
--
-- Medido el 24-sep-2026 con EXPLAIN ANALYZE como el admin (rol authenticated,
-- claims del JWT): leer las 188 inscripciones de un curso con su perfil
-- tardaba 67 ms; el progreso del curso, 50 ms; 25 perfiles, 31 ms. De esos
-- milisegundos casi todos eran academia.is_admin(): es `security definer`
-- —tiene que serlo para leer profiles sin recursión de RLS—, y por eso
-- Postgres no la puede inlinear ni sacar del bucle: la llamaba UNA VEZ POR
-- FILA en cada policy (`user_id = auth.uid() or academia.is_admin()`), y
-- cada llamada es una búsqueda en profiles (~0.2 ms). Con 188 filas son 40 ms
-- por tabla; con mil alumnos serían 200 ms por tabla y por consulta, en cada
-- clic del panel.
--
-- Envuelta en `(select academia.is_admin())` es un InitPlan: Postgres la evalúa
-- una vez al arrancar la consulta y reutiliza el valor. Mismas policies, misma
-- lógica, mismo resultado booleano: cambia solo cuántas veces se calcula.
-- Después de esto las tres consultas de arriba tardan 0.9, 1.1 y 0.5 ms.
--
-- Lo mismo para las cuatro vistas: is_admin() como InitPlan, y
-- has_enrollment()/has_active_access() —que dependen de la fila— como
-- `course_id in (select …)`, que se evalúa una vez y se busca en memoria. Las
-- vistas siguen con security_invoker=false, igual que antes.
--
-- El archivo se generó del catálogo vivo (pg_policies, pg_get_viewdef): cada
-- `alter policy` es la expresión desplegada, deparseada por Postgres, con el
-- único cambio del paréntesis. 110 de 128 policies llamaban a
-- is_admin()/is_superadmin() por fila; el resto no cambia.

alter policy "access_links_lee_equipo" on academia.access_links
  using ((select academia.is_admin()));

alter policy "assignment_submissions_delete_admin" on academia.assignment_submissions
  using ((select academia.is_admin()));

alter policy "assignment_submissions_select_propio_o_admin" on academia.assignment_submissions
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (select academia.is_admin())));

alter policy "assignment_submissions_update_admin" on academia.assignment_submissions
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "assignments_delete_admin" on academia.assignments
  using ((select academia.is_admin()));

alter policy "assignments_insert_admin" on academia.assignments
  with check ((select academia.is_admin()));

alter policy "assignments_select_con_acceso" on academia.assignments
  using (((select academia.is_admin()) OR academia.has_active_access(academia.curso_de_leccion(lesson_id))));

alter policy "assignments_update_admin" on academia.assignments
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "certificates_delete_superadmin" on academia.certificates
  using ((select academia.is_superadmin()));

alter policy "certificates_select_propio_o_admin" on academia.certificates
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (select academia.is_admin())));

alter policy "client_errors_borra_equipo" on academia.client_errors
  using ((select academia.is_admin()));

alter policy "client_errors_lee_equipo" on academia.client_errors
  using ((select academia.is_admin()));

alter policy "cohort_sessions_delete_admin" on academia.cohort_sessions
  using ((select academia.is_admin()));

alter policy "cohort_sessions_insert_admin" on academia.cohort_sessions
  with check ((select academia.is_admin()));

alter policy "cohort_sessions_select_su_cohorte" on academia.cohort_sessions
  using (((select academia.is_admin()) OR academia.pertenece_a_cohorte(cohort_id)));

alter policy "cohort_sessions_update_admin" on academia.cohort_sessions
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "cohorts_delete_admin" on academia.cohorts
  using ((select academia.is_admin()));

alter policy "cohorts_insert_admin" on academia.cohorts
  with check ((select academia.is_admin()));

alter policy "cohorts_select_inscrito" on academia.cohorts
  using (((select academia.is_admin()) OR academia.has_enrollment(course_id)));

alter policy "cohorts_update_admin" on academia.cohorts
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "community_comments_delete_admin" on academia.community_comments
  using ((select academia.is_admin()));

alter policy "community_comments_insert_propio" on academia.community_comments
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'visible'::text) AND ((select academia.is_admin()) OR academia.has_active_access(academia.curso_de_post(post_id)))));

alter policy "community_comments_select_visible" on academia.community_comments
  using (((select academia.is_admin()) OR ((status = 'visible'::text) AND academia.has_active_access(academia.curso_de_post(post_id)))));

alter policy "community_comments_update_admin" on academia.community_comments
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "community_posts_delete_admin" on academia.community_posts
  using ((select academia.is_admin()));

alter policy "community_posts_insert_propio" on academia.community_posts
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (status = 'visible'::text) AND (pinned = false) AND ((select academia.is_admin()) OR academia.has_active_access(course_id))));

alter policy "community_posts_select_visible" on academia.community_posts
  using (((select academia.is_admin()) OR ((status = 'visible'::text) AND academia.has_active_access(course_id))));

alter policy "community_posts_update_admin" on academia.community_posts
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "community_reactions_delete_propio" on academia.community_reactions
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (select academia.is_admin())));

alter policy "community_reactions_insert_propio" on academia.community_reactions
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND ((select academia.is_admin()) OR ((post_id IS NOT NULL) AND academia.has_active_access(( SELECT p.course_id
   FROM academia.community_posts p
  WHERE (p.id = community_reactions.post_id)))) OR ((comment_id IS NOT NULL) AND academia.has_active_access(academia.curso_de_post(( SELECT c.post_id
   FROM academia.community_comments c
  WHERE (c.id = community_reactions.comment_id))))))));

alter policy "community_reactions_select_visible" on academia.community_reactions
  using (((select academia.is_admin()) OR ((post_id IS NOT NULL) AND academia.has_active_access(( SELECT p.course_id
   FROM academia.community_posts p
  WHERE (p.id = community_reactions.post_id)))) OR ((comment_id IS NOT NULL) AND academia.has_active_access(academia.curso_de_post(( SELECT c.post_id
   FROM academia.community_comments c
  WHERE (c.id = community_reactions.comment_id)))))));

alter policy "companies_delete_admin" on academia.companies
  using ((select academia.is_admin()));

alter policy "companies_insert_admin" on academia.companies
  with check ((select academia.is_admin()));

alter policy "companies_update_admin" on academia.companies
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "courses_delete_superadmin" on academia.courses
  using ((select academia.is_superadmin()));

alter policy "courses_insert_admin" on academia.courses
  with check ((select academia.is_admin()));

alter policy "courses_select_inscrito" on academia.courses
  using (((select academia.is_admin()) OR academia.has_enrollment(id)));

alter policy "courses_update_admin" on academia.courses
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "dynamic_boards_delete_admin" on academia.dynamic_boards
  using ((select academia.is_admin()));

alter policy "dynamic_boards_insert_miembro" on academia.dynamic_boards
  with check (((select academia.is_admin()) OR (academia.dinamica_abierta(dynamic_id) AND academia.has_active_access(academia.curso_de_dinamica(dynamic_id)) AND (((company_id IS NOT NULL) AND (company_id = academia.mi_empresa()) AND (owner_user_id IS NULL)) OR ((owner_user_id = ( SELECT auth.uid() AS uid)) AND (company_id IS NULL) AND (academia.mi_empresa() IS NULL))))));

alter policy "dynamic_boards_select_miembro" on academia.dynamic_boards
  using (((select academia.is_admin()) OR (academia.es_miembro_de_tablero(id) AND academia.has_enrollment(academia.curso_de_tablero(id)))));

alter policy "dynamic_boards_update_admin" on academia.dynamic_boards
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "dynamic_cells_select_miembro" on academia.dynamic_cells
  using (((select academia.is_admin()) OR (academia.es_miembro_de_tablero(board_id) AND academia.has_enrollment(academia.curso_de_tablero(board_id)))));

alter policy "dynamic_columns_delete_creador_o_admin" on academia.dynamic_columns
  using (((select academia.is_admin()) OR ((created_by = ( SELECT auth.uid() AS uid)) AND academia.puede_editar_tablero(board_id))));

alter policy "dynamic_columns_select_miembro" on academia.dynamic_columns
  using (((select academia.is_admin()) OR (academia.es_miembro_de_tablero(board_id) AND academia.has_enrollment(academia.curso_de_tablero(board_id)))));

alter policy "dynamic_rows_delete_admin" on academia.dynamic_rows
  using ((select academia.is_admin()));

alter policy "dynamic_rows_insert_admin" on academia.dynamic_rows
  with check ((select academia.is_admin()));

alter policy "dynamic_rows_update_admin" on academia.dynamic_rows
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "dynamics_delete_admin" on academia.dynamics
  using ((select academia.is_admin()));

alter policy "dynamics_insert_admin" on academia.dynamics
  with check ((select academia.is_admin()));

alter policy "dynamics_select_admin_o_inscrito" on academia.dynamics
  using (((select academia.is_admin()) OR ((status <> 'draft'::text) AND academia.has_enrollment(course_id))));

alter policy "dynamics_update_admin" on academia.dynamics
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "enrollments_delete_admin" on academia.enrollments
  using ((select academia.is_admin()));

alter policy "enrollments_insert_admin" on academia.enrollments
  with check ((select academia.is_admin()));

alter policy "enrollments_select_propio_o_admin" on academia.enrollments
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (select academia.is_admin())));

alter policy "enrollments_update_admin" on academia.enrollments
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "lesson_attachments_delete_admin" on academia.lesson_attachments
  using ((select academia.is_admin()));

alter policy "lesson_attachments_insert_admin" on academia.lesson_attachments
  with check ((select academia.is_admin()));

alter policy "lesson_attachments_select_con_acceso" on academia.lesson_attachments
  using (((select academia.is_admin()) OR academia.has_active_access(academia.curso_de_leccion(lesson_id))));

alter policy "lesson_attachments_update_admin" on academia.lesson_attachments
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "lesson_comments_delete_admin" on academia.lesson_comments
  using ((select academia.is_admin()));

alter policy "lesson_comments_select_visible" on academia.lesson_comments
  using (((select academia.is_admin()) OR ((status = 'visible'::text) AND academia.has_active_access(academia.curso_de_leccion(lesson_id)))));

alter policy "lesson_comments_update_admin" on academia.lesson_comments
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "lesson_progress_delete_admin" on academia.lesson_progress
  using ((select academia.is_admin()));

alter policy "lesson_progress_select_propio_o_admin" on academia.lesson_progress
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (select academia.is_admin())));

alter policy "lessons_delete_admin" on academia.lessons
  using ((select academia.is_admin()));

alter policy "lessons_insert_admin" on academia.lessons
  with check ((select academia.is_admin()));

alter policy "lessons_select_con_acceso" on academia.lessons
  using (((select academia.is_admin()) OR ((status = 'published'::text) AND academia.has_active_access(academia.curso_del_modulo(module_id)))));

alter policy "lessons_update_admin" on academia.lessons
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "modules_delete_admin" on academia.modules
  using ((select academia.is_admin()));

alter policy "modules_insert_admin" on academia.modules
  with check ((select academia.is_admin()));

alter policy "modules_select_inscrito" on academia.modules
  using (((select academia.is_admin()) OR academia.has_enrollment(course_id)));

alter policy "modules_update_admin" on academia.modules
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "participants_delete_admin" on academia.participants
  using ((select academia.is_admin()));

alter policy "participants_insert_admin" on academia.participants
  with check ((select academia.is_admin()));

alter policy "participants_select_admin_o_propio" on academia.participants
  using (((select academia.is_admin()) OR (user_id = ( SELECT auth.uid() AS uid))));

alter policy "participants_update_admin" on academia.participants
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "payments_delete_superadmin" on academia.payments
  using ((select academia.is_superadmin()));

alter policy "payments_select_propio_o_admin" on academia.payments
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (select academia.is_admin())));

alter policy "poll_answers_delete_admin" on academia.poll_answers
  using ((select academia.is_admin()));

alter policy "poll_answers_select_admin" on academia.poll_answers
  using ((select academia.is_admin()));

alter policy "poll_answers_update_admin" on academia.poll_answers
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "poll_participants_delete_admin" on academia.poll_participants
  using ((select academia.is_admin()));

alter policy "poll_participants_select_admin" on academia.poll_participants
  using ((select academia.is_admin()));

alter policy "poll_questions_delete_admin" on academia.poll_questions
  using ((select academia.is_admin()));

alter policy "poll_questions_insert_admin" on academia.poll_questions
  with check ((select academia.is_admin()));

alter policy "poll_questions_select_admin_o_inscrito" on academia.poll_questions
  using (((select academia.is_admin()) OR academia.has_enrollment(academia.curso_de_encuesta(poll_id))));

alter policy "poll_questions_update_admin" on academia.poll_questions
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "polls_delete_admin" on academia.polls
  using ((select academia.is_admin()));

alter policy "polls_insert_admin" on academia.polls
  with check ((select academia.is_admin()));

alter policy "polls_select_admin_o_inscrito" on academia.polls
  using (((select academia.is_admin()) OR academia.has_enrollment(course_id)));

alter policy "polls_update_admin" on academia.polls
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "posts_delete_admin" on academia.posts
  using ((select academia.is_admin()));

alter policy "posts_insert_admin" on academia.posts
  with check ((select academia.is_admin()));

alter policy "posts_select_publicado" on academia.posts
  using (((select academia.is_admin()) OR ((published_at IS NOT NULL) AND (published_at <= now()) AND ((audience_course_id IS NULL) OR academia.has_enrollment(audience_course_id)))));

alter policy "posts_update_admin" on academia.posts
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "profiles_delete_superadmin" on academia.profiles
  using ((select academia.is_superadmin()));

alter policy "profiles_insert_admin" on academia.profiles
  with check ((select academia.is_admin()));

alter policy "profiles_select_propio_o_admin" on academia.profiles
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (select academia.is_admin())));

alter policy "profiles_update_admin" on academia.profiles
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "quiz_attempts_delete_admin" on academia.quiz_attempts
  using ((select academia.is_admin()));

alter policy "quiz_attempts_select_propio_o_admin" on academia.quiz_attempts
  using (((user_id = ( SELECT auth.uid() AS uid)) OR (select academia.is_admin())));

alter policy "quiz_questions_delete_admin" on academia.quiz_questions
  using ((select academia.is_admin()));

alter policy "quiz_questions_insert_admin" on academia.quiz_questions
  with check ((select academia.is_admin()));

alter policy "quiz_questions_select_admin" on academia.quiz_questions
  using ((select academia.is_admin()));

alter policy "quiz_questions_update_admin" on academia.quiz_questions
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

alter policy "quizzes_delete_admin" on academia.quizzes
  using ((select academia.is_admin()));

alter policy "quizzes_insert_admin" on academia.quizzes
  with check ((select academia.is_admin()));

alter policy "quizzes_select_con_acceso" on academia.quizzes
  using (((select academia.is_admin()) OR academia.has_active_access(academia.curso_de_leccion(lesson_id))));

alter policy "quizzes_update_admin" on academia.quizzes
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

-- --- vistas -----------------------------------------------------------------

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
          WHERE d.course_id = e.course_id AND (d.status = 'closed'::text OR d.status = 'open'::text AND d.closes_at IS NOT NULL AND d.closes_at <= now()) AND (EXISTS ( SELECT 1
                   FROM academia.dynamic_rows r
                  WHERE r.dynamic_id = d.id AND r.row_kind = 'criterio'::text)) AND (EXISTS ( SELECT 1
                   FROM academia.dynamic_boards b
                     JOIN academia.dynamic_columns c ON c.board_id = b.id
                  WHERE b.dynamic_id = d.id AND (p.company_id IS NOT NULL AND b.company_id = p.company_id OR b.owner_user_id = e.user_id) AND NOT (EXISTS ( SELECT 1
                           FROM academia.dynamic_rows r
                          WHERE r.dynamic_id = d.id AND r.row_kind = 'criterio'::text AND NOT (EXISTS ( SELECT 1
                                   FROM academia.dynamic_cells x
                                  WHERE x.column_id = c.id AND x.row_id = r.id AND x.numeric_value IS NOT NULL))))))) AS dinamicas
   FROM academia.enrollments e
     JOIN academia.profiles p ON p.user_id = e.user_id
  WHERE e.status = 'active'::text AND p.role = 'alumno'::text AND p.status = 'active'::text AND (e.course_id IN (SELECT x.course_id FROM academia.enrollments x WHERE x.user_id = (SELECT auth.uid()) AND x.status = 'active'::text) OR (SELECT academia.is_admin()));

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
    (m.course_id IN (SELECT x.course_id FROM academia.enrollments x WHERE x.user_id = (SELECT auth.uid()) AND x.status = 'active'::text AND (x.expires_at IS NULL OR x.expires_at > now()))) AS desbloqueada
   FROM academia.lessons l
     JOIN academia.modules m ON m.id = l.module_id
  WHERE l.status = 'published'::text AND ((SELECT academia.is_admin()) OR m.course_id IN (SELECT x.course_id FROM academia.enrollments x WHERE x.user_id = (SELECT auth.uid()) AND x.status = 'active'::text));

create or replace view academia.public_profiles with (security_invoker=false) as
SELECT user_id,
    full_name,
    avatar_url,
    role = ANY (ARRAY['admin'::text, 'superadmin'::text]) AS es_equipo
   FROM academia.profiles p
  WHERE (SELECT academia."current_role"()) IS NOT NULL;

create or replace view academia.quiz_questions_public with (security_invoker=false) as
SELECT id,
    quiz_id,
    question,
    options,
    "position"
   FROM academia.quiz_questions q
  WHERE (SELECT academia.is_admin()) OR academia.has_active_access(academia.curso_del_quiz(quiz_id));
