-- academia_0014_vistas.sql
-- Vistas que resuelven lo que RLS no puede: filtrar COLUMNAS.
--
-- RLS decide qué FILAS ve cada quien. No sabe ocultar una columna. Hay dos
-- casos en este proyecto donde el problema es justamente una columna:
--
--   1. El alumno con acceso vencido debe ver los TÍTULOS de sus lecciones
--      (candado, §3.3) pero no el video ni el contenido.
--   2. Ningún alumno debe leer `correct_option_id` antes de contestar el quiz.
--
-- Las tres vistas son SECURITY DEFINER (security_invoker = false): corren con
-- los permisos de `postgres` y por lo tanto NO disparan la RLS de las tablas
-- base. Eso las hace potentes y peligrosas a partes iguales: su cláusula WHERE
-- es la ÚNICA barrera. Están escritas para que ningún camino devuelva filas sin
-- pasar por un helper de acceso.
--
-- (El linter de Supabase marca estas vistas como "security definer view". Es
-- intencional y es el motivo por el que existen.)

-- --------------------------------------------------------------------------
-- lesson_outline — la estructura del curso sin su contenido.
--
-- Es lo que ve el alumno cuyo acceso expiró: usa has_enrollment (estructura),
-- no has_active_access (contenido). No expone description_rich ni
-- bunny_video_id; del video solo dice si existe y cuánto dura.
-- --------------------------------------------------------------------------

create view academia.lesson_outline
with (security_invoker = false)
as
select
  l.id,
  l.module_id,
  m.course_id,
  l.title,
  l.position,
  l.lesson_type,
  l.is_required,
  (l.bunny_video_id is not null) as tiene_video,
  l.video_duration_sec,
  -- Para que la UI sepa si pintar candado sin tener que preguntar aparte.
  academia.has_active_access(m.course_id) as desbloqueada
from academia.lessons l
join academia.modules m on m.id = l.module_id
where l.status = 'published'
  and (academia.is_admin() or academia.has_enrollment(m.course_id));

comment on view academia.lesson_outline is
  'Estructura de lecciones sin contenido protegido. La ve el alumno aunque su acceso haya expirado.';

-- --------------------------------------------------------------------------
-- quiz_questions_public — las preguntas sin la respuesta.
--
-- La tabla quiz_questions es admin-only por RLS. El alumno solo llega aquí, y
-- esta vista no proyecta correct_option_id. La calificación es server-side.
-- --------------------------------------------------------------------------

create view academia.quiz_questions_public
with (security_invoker = false)
as
select
  q.id,
  q.quiz_id,
  q.question,
  q.options,
  q.position
from academia.quiz_questions q
where academia.is_admin()
   or academia.has_active_access(academia.curso_del_quiz(q.quiz_id));

comment on view academia.quiz_questions_public is
  'Preguntas SIN correct_option_id. Es el único camino del alumno hacia un quiz.';

-- --------------------------------------------------------------------------
-- public_profiles — autoría en comentarios y comunidad.
--
-- Los hilos necesitan nombre y avatar del autor, pero profiles solo deja ver la
-- fila propia. Esta vista expone lo mínimo y nunca el correo ni el rol crudo:
-- en su lugar da un booleano para el badge "Equipo VADAI" (§3.7).
-- --------------------------------------------------------------------------

create view academia.public_profiles
with (security_invoker = false)
as
select
  p.user_id,
  p.full_name,
  p.avatar_url,
  (p.role in ('admin', 'superadmin')) as es_equipo
from academia.profiles p
-- Solo miembros de la academia. Un autenticado sin perfil no ve a nadie.
where academia.current_role() is not null;

comment on view academia.public_profiles is
  'Nombre y avatar para mostrar autoría. Sin email ni rol crudo.';

-- --------------------------------------------------------------------------
-- Permisos: lectura para usuarios autenticados, nada de escritura.
-- --------------------------------------------------------------------------

revoke all on academia.lesson_outline from public, anon, authenticated;
revoke all on academia.quiz_questions_public from public, anon, authenticated;
revoke all on academia.public_profiles from public, anon, authenticated;

grant select on academia.lesson_outline to authenticated, service_role;
grant select on academia.quiz_questions_public to authenticated, service_role;
grant select on academia.public_profiles to authenticated, service_role;
