-- academia_0025_curso_base_notificaciones_gamificacion.sql
-- Tres cosas pedidas por Alejandro la noche del 20-sep-2026, víspera del
-- lanzamiento. Las tres son aditivas: dos columnas y una vista.
--
-- 1. CURSO BASE. "Academia VADAI" es donde se aprende a usar la plataforma y
--    lo tiene que tener TODO alumno, sin que el admin lo marque cada vez. La
--    columna `is_default` lo dice; `darDeAlta()` inscribe a cada alumno nuevo
--    en todos los cursos base publicados.
--
-- 2. NOTIFICACIONES INTERNAS. Una campana en el encabezado con lo publicado
--    (anuncios y blog) desde la última vez que la persona la abrió. No hay
--    tabla de notificaciones ni una fila por persona y publicación: basta con
--    recordar CUÁNDO abrió la campana por última vez y comparar con
--    `posts.published_at`. Cero fan-out, cero limpieza, y "nuevo" es exacto.
--
-- 3. GAMIFICACIÓN. Puntos, niveles y un ranking por curso. Los puntos NO se
--    guardan: se calculan de lo que ya existe (lecciones hechas, quizzes
--    aprobados, tareas, publicaciones, comentarios, certificados). Guardarlos
--    sería una segunda verdad que se desincroniza; calcularlos es un select.
--    El problema es que RLS no deja a un alumno ver el progreso de los demás,
--    y un ranking necesita justo eso. La vista `actividad_por_curso` resuelve
--    el dilema igual que `public_profiles`: corre con los permisos del dueño
--    (security_invoker = false), expone SOLO conteos por (alumno, curso), y
--    filtra en su where por la inscripción de quien pregunta. Un alumno ve
--    la actividad de su grupo y de nadie más; los pesos de cada cosa viven en
--    lib/gamificacion/reglas.ts, una sola vez.

-- ==========================================================================
-- 1. Curso base
-- ==========================================================================

alter table academia.courses
  add column is_default boolean not null default false;

comment on column academia.courses.is_default is
  'Curso base: todo alumno lo recibe al darse de alta, además de lo que compre. Solo aplica si está publicado.';

-- ==========================================================================
-- 2. Notificaciones: cuándo abrió la campana por última vez
-- ==========================================================================

alter table academia.profiles
  add column notifications_seen_at timestamptz;

comment on column academia.profiles.notifications_seen_at is
  'Última vez que abrió la campana de notificaciones. Lo publicado después de esto es "nuevo". Null = nunca; entonces cuenta desde que se creó la cuenta.';

-- La persona actualiza su propia fila (policy profiles_update_propio) y el
-- trigger proteger_campos_de_perfil solo cuida rol, estado e identidad: esta
-- columna es suya y puede tocarla.

-- ==========================================================================
-- 3. Actividad por curso, para puntos y ranking
-- ==========================================================================

create view academia.actividad_por_curso
with (security_invoker = false)
as
select
  e.user_id,
  e.course_id,
  (select count(*)::int
     from academia.lesson_progress lp
    where lp.user_id = e.user_id
      and lp.completed
      and academia.curso_de_leccion(lp.lesson_id) = e.course_id) as lecciones,
  (select count(distinct qa.quiz_id)::int
     from academia.quiz_attempts qa
    where qa.user_id = e.user_id
      and qa.passed
      and academia.curso_del_quiz(qa.quiz_id) = e.course_id) as quizzes,
  (select count(distinct s.assignment_id)::int
     from academia.assignment_submissions s
    where s.user_id = e.user_id
      and s.status in ('submitted', 'approved')
      and academia.curso_de_tarea(s.assignment_id) = e.course_id) as tareas,
  (select count(distinct s.assignment_id)::int
     from academia.assignment_submissions s
    where s.user_id = e.user_id
      and s.status = 'approved'
      and academia.curso_de_tarea(s.assignment_id) = e.course_id) as tareas_aprobadas,
  (select count(*)::int
     from academia.community_posts cp
    where cp.user_id = e.user_id
      and cp.status = 'visible'
      and cp.course_id = e.course_id) as publicaciones,
  (select count(*)::int
     from academia.community_comments cc
     join academia.community_posts cp on cp.id = cc.post_id
    where cc.user_id = e.user_id
      and cc.status = 'visible'
      and cp.course_id = e.course_id)
  + (select count(*)::int
       from academia.lesson_comments lc
      where lc.user_id = e.user_id
        and lc.status = 'visible'
        and academia.curso_de_leccion(lc.lesson_id) = e.course_id) as comentarios,
  (select count(*)::int
     from academia.certificates c
    where c.user_id = e.user_id
      and c.course_id = e.course_id) as certificados
from academia.enrollments e
join academia.profiles p on p.user_id = e.user_id
where e.status = 'active'
  and p.role = 'alumno'
  and p.status = 'active'
  -- Quien pregunta solo ve los cursos donde está inscrito. `has_enrollment`
  -- e `is_admin` leen auth.uid(), así que corren como la persona, no como el
  -- dueño de la vista.
  and (academia.has_enrollment(e.course_id) or academia.is_admin());

comment on view academia.actividad_por_curso is
  'Conteos por (alumno, curso) para puntos y ranking. Solo alumnos activos con inscripción activa; solo visible a quien comparte el curso o al equipo. Los pesos están en lib/gamificacion/reglas.ts.';

grant select on academia.actividad_por_curso to authenticated, service_role;
