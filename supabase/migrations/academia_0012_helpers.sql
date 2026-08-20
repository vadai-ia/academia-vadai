-- academia_0012_helpers.sql
-- Helpers de RLS. Toda la lógica de acceso vive aquí; las policies de 0013 solo
-- las invocan. Un cambio de criterio se hace en un solo lugar.
--
-- POR QUÉ SECURITY DEFINER:
-- Estas funciones leen `academia.profiles` y `academia.enrollments`, que tienen
-- RLS. Si corrieran como el usuario que consulta, la policy de profiles llamaría
-- a current_role(), que leería profiles, que volvería a evaluar la policy...
-- recursión infinita.
--
-- Al ser SECURITY DEFINER y pertenecer a `postgres` (dueño de las tablas), se
-- ejecutan sin disparar RLS. Por eso este schema NO usa `force row level
-- security`: eso haría que ni el dueño se saltara las policies y reintroduciría
-- la recursión.
--
-- Todas llevan `set search_path = ''` y califican cada objeto. Sin eso, un
-- usuario podría crear un objeto en un schema de su search_path y secuestrar la
-- resolución de nombres dentro de una función con privilegios elevados.

-- --------------------------------------------------------------------------
-- Identidad y rol
-- --------------------------------------------------------------------------

-- Rol del usuario actual, o null si no tiene perfil o está suspendido.
-- Null es la respuesta correcta para "usuario autenticado que no pertenece a la
-- academia": no es un error, simplemente no tiene acceso a nada.
create or replace function academia.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
    from academia.profiles p
   where p.user_id = (select auth.uid())
     and p.status = 'active'
$$;

create or replace function academia.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(academia.current_role() in ('admin', 'superadmin'), false)
$$;

create or replace function academia.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(academia.current_role() = 'superadmin', false)
$$;

-- ¿La conexión actual es de servicio y no de un usuario final?
-- PostgREST hace `set local role service_role` cuando se usa la service key, y
-- las migraciones y seeds corren como `postgres`. Sirve para que los triggers de
-- protección no estorben al provisioning (§3.1), que es legítimo.
create or replace function academia.es_servicio()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
$$;

-- --------------------------------------------------------------------------
-- Los dos niveles de acceso
--
-- Esta pareja es la que materializa la regla "acceso vencido = estructura sí,
-- contenido no". Cuál de las dos use una policy define qué ve un alumno cuyo
-- enrollment expiró.
-- --------------------------------------------------------------------------

-- ESTRUCTURA: hay inscripción no revocada, sin importar la vigencia.
-- Habilita ver el curso, sus módulos, los títulos de sus lecciones y el
-- progreso histórico. Es lo que sostiene el candado y el CTA de recompra (§6.3).
create or replace function academia.has_enrollment(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from academia.enrollments e
     where e.user_id = (select auth.uid())
       and e.course_id = p_course_id
       and e.status = 'active'
  )
$$;

-- CONTENIDO: además, la vigencia no ha expirado.
-- Habilita video, adjuntos, quizzes, tareas, sesiones y comunidad.
create or replace function academia.has_active_access(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from academia.enrollments e
     where e.user_id = (select auth.uid())
       and e.course_id = p_course_id
       and e.status = 'active'
       and (e.expires_at is null or e.expires_at > now())
  )
$$;

-- --------------------------------------------------------------------------
-- Resolución de jerarquía
--
-- Las lecciones no guardan course_id: cuelgan de un módulo. Estas funciones
-- evitan repetir el join en cada policy.
-- --------------------------------------------------------------------------

create or replace function academia.curso_del_modulo(p_module_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.course_id from academia.modules m where m.id = p_module_id
$$;

create or replace function academia.curso_de_leccion(p_lesson_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.course_id
    from academia.lessons l
    join academia.modules m on m.id = l.module_id
   where l.id = p_lesson_id
$$;

create or replace function academia.curso_de_cohorte(p_cohort_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.course_id from academia.cohorts c where c.id = p_cohort_id
$$;

create or replace function academia.curso_del_quiz(p_quiz_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select academia.curso_de_leccion(q.lesson_id)
    from academia.quizzes q
   where q.id = p_quiz_id
$$;

create or replace function academia.curso_de_tarea(p_assignment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select academia.curso_de_leccion(a.lesson_id)
    from academia.assignments a
   where a.id = p_assignment_id
$$;

create or replace function academia.curso_de_post(p_post_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.course_id from academia.community_posts p where p.id = p_post_id
$$;

-- El alumno solo ve las sesiones de SU cohorte, no las de todas las cohortes
-- del curso: dos grupos del mismo curso tienen calendarios distintos.
create or replace function academia.pertenece_a_cohorte(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from academia.enrollments e
     where e.user_id = (select auth.uid())
       and e.cohort_id = p_cohort_id
       and e.status = 'active'
       and (e.expires_at is null or e.expires_at > now())
  )
$$;

-- --------------------------------------------------------------------------
-- Ventana de edición de comentarios (§3.7: 15 minutos)
-- --------------------------------------------------------------------------

create or replace function academia.dentro_de_ventana_de_edicion(p_creado_en timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_creado_en > (now() - interval '15 minutes')
$$;

-- --------------------------------------------------------------------------
-- Permisos de ejecución
--
-- Son SECURITY DEFINER: se revoca el default de PUBLIC y se concede solo a los
-- roles que las necesitan.
-- --------------------------------------------------------------------------

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'academia'
  loop
    execute format('revoke all on function %s from public', fn.firma);
    execute format('grant execute on function %s to authenticated, service_role', fn.firma);
  end loop;
end;
$$;
