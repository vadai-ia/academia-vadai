-- academia_0013_rls.sql
-- RLS en TODAS las tablas del schema, sin excepción (CLAUDE.md).
--
-- Convenciones:
--   * Toda policy declara `to authenticated`. `anon` nunca entra: no hay lectura
--     pública en el MVP. La verificación de certificados va por service role.
--   * `service_role` tiene BYPASSRLS en Supabase, así que estas policies no
--     aplican al provisioning ni al webhook. Eso es a propósito (§4).
--   * Una tabla con RLS y CERO policies queda cerrada a todo el mundo salvo
--     service role. Es el caso de stripe_events y schema_migrations.
--   * `(select auth.uid())` en vez de `auth.uid()`: el planner lo evalúa una vez
--     por query en lugar de una vez por fila.
--
-- El criterio de acceso al contenido:
--   has_enrollment()     -> ESTRUCTURA (sobrevive al vencimiento)
--   has_active_access()  -> CONTENIDO  (exige vigencia)

alter table academia.profiles               enable row level security;
alter table academia.courses                enable row level security;
alter table academia.modules                enable row level security;
alter table academia.lessons                enable row level security;
alter table academia.lesson_attachments     enable row level security;
alter table academia.enrollments            enable row level security;
alter table academia.lesson_progress        enable row level security;
alter table academia.cohorts                enable row level security;
alter table academia.cohort_sessions        enable row level security;
alter table academia.quizzes                enable row level security;
alter table academia.quiz_questions         enable row level security;
alter table academia.quiz_attempts          enable row level security;
alter table academia.assignments            enable row level security;
alter table academia.assignment_submissions enable row level security;
alter table academia.certificates           enable row level security;
alter table academia.lesson_comments        enable row level security;
alter table academia.community_posts        enable row level security;
alter table academia.community_comments     enable row level security;
alter table academia.posts                  enable row level security;
alter table academia.payments               enable row level security;
alter table academia.stripe_events          enable row level security;
alter table academia.schema_migrations      enable row level security;

-- ==========================================================================
-- profiles
-- ==========================================================================

create policy profiles_select_propio_o_admin on academia.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or academia.is_admin());

-- Sin registro público: las cuentas nacen de una compra o una invitación,
-- siempre server-side (§2). Ningún alumno puede crearse un perfil.
create policy profiles_insert_admin on academia.profiles
  for insert to authenticated
  with check (academia.is_admin());

create policy profiles_update_propio on academia.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy profiles_update_admin on academia.profiles
  for update to authenticated
  using (academia.is_admin())
  with check (academia.is_admin());

create policy profiles_delete_superadmin on academia.profiles
  for delete to authenticated
  using (academia.is_superadmin());

-- RLS filtra filas, no columnas: la policy de arriba deja al alumno editar su
-- propia fila, y sin este trigger podría subirse el rol a superadmin.
create or replace function academia.proteger_campos_de_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if academia.es_servicio() or academia.is_admin() then
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

  return new;
end;
$$;

create trigger profiles_proteger_campos
  before update on academia.profiles
  for each row execute function academia.proteger_campos_de_perfil();

-- ==========================================================================
-- courses / modules  — ESTRUCTURA: sobreviven al vencimiento
-- ==========================================================================

create policy courses_select_inscrito on academia.courses
  for select to authenticated
  using (academia.is_admin() or academia.has_enrollment(id));

create policy courses_insert_admin on academia.courses
  for insert to authenticated with check (academia.is_admin());
create policy courses_update_admin on academia.courses
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy courses_delete_superadmin on academia.courses
  for delete to authenticated using (academia.is_superadmin());

create policy modules_select_inscrito on academia.modules
  for select to authenticated
  using (academia.is_admin() or academia.has_enrollment(course_id));

create policy modules_insert_admin on academia.modules
  for insert to authenticated with check (academia.is_admin());
create policy modules_update_admin on academia.modules
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy modules_delete_admin on academia.modules
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- lessons / lesson_attachments — CONTENIDO: exigen vigencia
--
-- El alumno vencido NO ve estas filas. Ve los títulos por la vista
-- academia.lesson_outline (0014), que no expone description_rich ni el
-- bunny_video_id.
-- ==========================================================================

create policy lessons_select_con_acceso on academia.lessons
  for select to authenticated
  using (
    academia.is_admin()
    or (
      status = 'published'
      and academia.has_active_access(academia.curso_del_modulo(module_id))
    )
  );

create policy lessons_insert_admin on academia.lessons
  for insert to authenticated with check (academia.is_admin());
create policy lessons_update_admin on academia.lessons
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy lessons_delete_admin on academia.lessons
  for delete to authenticated using (academia.is_admin());

create policy lesson_attachments_select_con_acceso on academia.lesson_attachments
  for select to authenticated
  using (
    academia.is_admin()
    or academia.has_active_access(academia.curso_de_leccion(lesson_id))
  );

create policy lesson_attachments_insert_admin on academia.lesson_attachments
  for insert to authenticated with check (academia.is_admin());
create policy lesson_attachments_update_admin on academia.lesson_attachments
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy lesson_attachments_delete_admin on academia.lesson_attachments
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- enrollments
-- ==========================================================================

create policy enrollments_select_propio_o_admin on academia.enrollments
  for select to authenticated
  using (user_id = (select auth.uid()) or academia.is_admin());

create policy enrollments_insert_admin on academia.enrollments
  for insert to authenticated with check (academia.is_admin());
create policy enrollments_update_admin on academia.enrollments
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy enrollments_delete_admin on academia.enrollments
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- lesson_progress
--
-- SELECT no depende de la vigencia: al expirar el acceso el progreso NO se
-- borra ni se oculta (§6.3). Escribir sí exige acceso vigente.
-- ==========================================================================

create policy lesson_progress_select_propio_o_admin on academia.lesson_progress
  for select to authenticated
  using (user_id = (select auth.uid()) or academia.is_admin());

create policy lesson_progress_insert_propio on academia.lesson_progress
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and academia.has_active_access(academia.curso_de_leccion(lesson_id))
  );

create policy lesson_progress_update_propio on academia.lesson_progress
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and academia.has_active_access(academia.curso_de_leccion(lesson_id))
  )
  with check (user_id = (select auth.uid()));

create policy lesson_progress_delete_admin on academia.lesson_progress
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- cohorts / cohort_sessions
-- ==========================================================================

create policy cohorts_select_inscrito on academia.cohorts
  for select to authenticated
  using (academia.is_admin() or academia.has_enrollment(course_id));

create policy cohorts_insert_admin on academia.cohorts
  for insert to authenticated with check (academia.is_admin());
create policy cohorts_update_admin on academia.cohorts
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy cohorts_delete_admin on academia.cohorts
  for delete to authenticated using (academia.is_admin());

-- Solo las sesiones de SU cohorte, no las de cualquier grupo del curso.
create policy cohort_sessions_select_su_cohorte on academia.cohort_sessions
  for select to authenticated
  using (academia.is_admin() or academia.pertenece_a_cohorte(cohort_id));

create policy cohort_sessions_insert_admin on academia.cohort_sessions
  for insert to authenticated with check (academia.is_admin());
create policy cohort_sessions_update_admin on academia.cohort_sessions
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy cohort_sessions_delete_admin on academia.cohort_sessions
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- quizzes
--
-- quiz_questions es SOLO admin: contiene correct_option_id. El alumno lee la
-- vista academia.quiz_questions_public (0014).
-- ==========================================================================

create policy quizzes_select_con_acceso on academia.quizzes
  for select to authenticated
  using (
    academia.is_admin()
    or academia.has_active_access(academia.curso_de_leccion(lesson_id))
  );

create policy quizzes_insert_admin on academia.quizzes
  for insert to authenticated with check (academia.is_admin());
create policy quizzes_update_admin on academia.quizzes
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy quizzes_delete_admin on academia.quizzes
  for delete to authenticated using (academia.is_admin());

create policy quiz_questions_select_admin on academia.quiz_questions
  for select to authenticated using (academia.is_admin());
create policy quiz_questions_insert_admin on academia.quiz_questions
  for insert to authenticated with check (academia.is_admin());
create policy quiz_questions_update_admin on academia.quiz_questions
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy quiz_questions_delete_admin on academia.quiz_questions
  for delete to authenticated using (academia.is_admin());

create policy quiz_attempts_select_propio_o_admin on academia.quiz_attempts
  for select to authenticated
  using (user_id = (select auth.uid()) or academia.is_admin());

create policy quiz_attempts_insert_propio on academia.quiz_attempts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and academia.has_active_access(academia.curso_del_quiz(quiz_id))
  );

-- Un intento es un hecho histórico: no se edita. Sin policy de UPDATE.
create policy quiz_attempts_delete_admin on academia.quiz_attempts
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- assignments / assignment_submissions
-- ==========================================================================

create policy assignments_select_con_acceso on academia.assignments
  for select to authenticated
  using (
    academia.is_admin()
    or academia.has_active_access(academia.curso_de_leccion(lesson_id))
  );

create policy assignments_insert_admin on academia.assignments
  for insert to authenticated with check (academia.is_admin());
create policy assignments_update_admin on academia.assignments
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy assignments_delete_admin on academia.assignments
  for delete to authenticated using (academia.is_admin());

create policy assignment_submissions_select_propio_o_admin on academia.assignment_submissions
  for select to authenticated
  using (user_id = (select auth.uid()) or academia.is_admin());

create policy assignment_submissions_insert_propio on academia.assignment_submissions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'submitted'
    and reviewed_by is null
    and academia.has_active_access(academia.curso_de_tarea(assignment_id))
  );

-- Reentrega: solo si el admin la rechazó, y vuelve a quedar como 'submitted'.
-- El alumno no puede aprobarse solo ni escribirse su propio feedback.
create policy assignment_submissions_reentrega on academia.assignment_submissions
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'rejected'
    and academia.has_active_access(academia.curso_de_tarea(assignment_id))
  )
  with check (
    user_id = (select auth.uid())
    and status = 'submitted'
  );

create policy assignment_submissions_update_admin on academia.assignment_submissions
  for update to authenticated
  using (academia.is_admin()) with check (academia.is_admin());

create policy assignment_submissions_delete_admin on academia.assignment_submissions
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- certificates
--
-- Se emiten y se firman server-side con service role: no hay policy de INSERT
-- ni de UPDATE para nadie. La verificación pública por folio tampoco usa RLS.
-- ==========================================================================

create policy certificates_select_propio_o_admin on academia.certificates
  for select to authenticated
  using (user_id = (select auth.uid()) or academia.is_admin());

create policy certificates_delete_superadmin on academia.certificates
  for delete to authenticated using (academia.is_superadmin());

-- ==========================================================================
-- lesson_comments
-- ==========================================================================

create policy lesson_comments_select_visible on academia.lesson_comments
  for select to authenticated
  using (
    academia.is_admin()
    or (
      status = 'visible'
      and academia.has_active_access(academia.curso_de_leccion(lesson_id))
    )
  );

create policy lesson_comments_insert_propio on academia.lesson_comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'visible'
    and academia.has_active_access(academia.curso_de_leccion(lesson_id))
  );

-- Ventana de 15 minutos (§3.7). Pasada la ventana, ni editar ni borrar.
-- El borrado del alumno es lógico: pasa el status a 'deleted'.
create policy lesson_comments_update_propio on academia.lesson_comments
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'visible'
    and academia.dentro_de_ventana_de_edicion(created_at)
  )
  with check (
    user_id = (select auth.uid())
    and status in ('visible', 'deleted')
  );

create policy lesson_comments_update_admin on academia.lesson_comments
  for update to authenticated
  using (academia.is_admin()) with check (academia.is_admin());

create policy lesson_comments_delete_admin on academia.lesson_comments
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- community_posts / community_comments
-- ==========================================================================

create policy community_posts_select_visible on academia.community_posts
  for select to authenticated
  using (
    academia.is_admin()
    or (status = 'visible' and academia.has_active_access(course_id))
  );

-- `pinned = false`: fijar es prerrogativa del admin (§3.8).
create policy community_posts_insert_propio on academia.community_posts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'visible'
    and pinned = false
    and academia.has_active_access(course_id)
  );

create policy community_posts_update_propio on academia.community_posts
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'visible'
    and academia.dentro_de_ventana_de_edicion(created_at)
  )
  with check (
    user_id = (select auth.uid())
    and status in ('visible', 'deleted')
    and pinned = false
  );

create policy community_posts_update_admin on academia.community_posts
  for update to authenticated
  using (academia.is_admin()) with check (academia.is_admin());

create policy community_posts_delete_admin on academia.community_posts
  for delete to authenticated using (academia.is_admin());

create policy community_comments_select_visible on academia.community_comments
  for select to authenticated
  using (
    academia.is_admin()
    or (
      status = 'visible'
      and academia.has_active_access(academia.curso_de_post(post_id))
    )
  );

create policy community_comments_insert_propio on academia.community_comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'visible'
    and academia.has_active_access(academia.curso_de_post(post_id))
  );

create policy community_comments_update_propio on academia.community_comments
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'visible'
    and academia.dentro_de_ventana_de_edicion(created_at)
  )
  with check (
    user_id = (select auth.uid())
    and status in ('visible', 'deleted')
  );

create policy community_comments_update_admin on academia.community_comments
  for update to authenticated
  using (academia.is_admin()) with check (academia.is_admin());

create policy community_comments_delete_admin on academia.community_comments
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- posts (blog y anuncios)
--
-- Usa has_enrollment, no has_active_access: un alumno con acceso vencido sigue
-- viendo los anuncios del curso. Es justo donde vive el CTA de recompra.
-- ==========================================================================

create policy posts_select_publicado on academia.posts
  for select to authenticated
  using (
    academia.is_admin()
    or (
      published_at is not null
      and published_at <= now()
      and (
        audience_course_id is null
        or academia.has_enrollment(audience_course_id)
      )
    )
  );

create policy posts_insert_admin on academia.posts
  for insert to authenticated with check (academia.is_admin());
create policy posts_update_admin on academia.posts
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy posts_delete_admin on academia.posts
  for delete to authenticated using (academia.is_admin());

-- ==========================================================================
-- payments
--
-- Los escribe el webhook con service role. Nadie más inserta ni actualiza.
-- Borrar es exclusivo de superadmin (§4).
-- ==========================================================================

create policy payments_select_propio_o_admin on academia.payments
  for select to authenticated
  using (user_id = (select auth.uid()) or academia.is_admin());

create policy payments_delete_superadmin on academia.payments
  for delete to authenticated using (academia.is_superadmin());

-- ==========================================================================
-- stripe_events y schema_migrations
--
-- RLS activo y CERO policies: inalcanzables para cualquier usuario final.
-- Solo service role (BYPASSRLS) y las conexiones directas de los scripts.
-- ==========================================================================
