-- academia_0035_equipo_responde_en_lecciones.sql
-- El equipo puede responder una pregunta en una lección aunque no esté
-- inscrito en esa generación.
--
-- POR QUÉ
-- Desde M16 (0034) el INSERT de `lesson_comments` exige `ve_leccion()`, que
-- pide una inscripción vigente en la generación del módulo. El equipo no se
-- inscribe en las generaciones —ve todo por `is_admin()`—, así que podía LEER
-- la pregunta de un alumno pero no contestarla: Postgres rechazaba la fila.
-- `community_comments_insert_propio` ya traía la excepción del equipo desde
-- 0034; a esta se le olvidó. Lo detectó la bandeja de Comunidad del panel
-- (3-oct-2026), cuyo trabajo es justamente contestar sin entrar como alumno.
--
-- Igual que en la comunidad: la fila sigue siendo de quien la escribe
-- (`user_id = auth.uid()`) y nace visible. Solo cambia quién puede escribir.

alter policy "lesson_comments_insert_propio" on academia.lesson_comments
  with check (
    user_id = (select auth.uid())
    and status = 'visible'
    and ((select academia.is_admin()) or academia.ve_leccion(lesson_id))
  );
