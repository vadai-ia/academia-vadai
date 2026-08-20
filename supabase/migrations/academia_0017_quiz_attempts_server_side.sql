-- academia_0017_quiz_attempts_server_side.sql
--
-- CIERRA UNA FALSIFICACIÓN DE CERTIFICADO detectada al sondear las policies:
-- el alumno podía hacer POST a quiz_attempts con { score: 100, passed: true }
-- sin contestar una sola pregunta. Como §3.6 condiciona el certificado a tener
-- los quizzes obligatorios aprobados, eso volvía el certificado falsificable
-- con una petición de una línea.
--
-- POR QUÉ ESTO NO ES UN CAMBIO DE ALCANCE
-- §4 del master document dice que el alumno hace INSERT en `attempts`. Pero esa
-- línea se contradice con dos decisiones del propio spec:
--
--   1. §3.4 pide calificación inmediata y NO revelar la respuesta correcta.
--   2. Por eso `correct_option_id` quedó fuera del alcance del alumno (0006/0014).
--
-- Si el alumno no puede leer la respuesta correcta, su navegador no puede
-- calcular `score` ni `passed`. Luego la calificación SIEMPRE ocurrió del lado
-- del servidor, y la fila del intento tiene que nacer ahí. La policy de INSERT
-- del alumno no solo era insegura: era inservible.
--
-- CÓMO QUEDA
-- El alumno manda sus respuestas a una server action; esa acción compara contra
-- correct_option_id con service role, calcula el puntaje y escribe el intento.
-- El alumno sigue LEYENDO sus propios intentos, que es lo que necesita la UI.
--
-- Esto es una decisión de seguridad que toca M5. Si Alejandro prefiere la
-- lectura literal de §4, revertir es una línea:
--   create policy quiz_attempts_insert_propio on academia.quiz_attempts
--     for insert to authenticated
--     with check (user_id = (select auth.uid())
--                 and academia.has_active_access(academia.curso_del_quiz(quiz_id)));

drop policy if exists quiz_attempts_insert_propio on academia.quiz_attempts;

comment on table academia.quiz_attempts is
  'Los intentos los escribe el servidor con service role tras calificar. El alumno solo puede LEER los suyos: sin policy de INSERT no puede auto-reportarse aprobado.';

-- Borra el intento falso que dejó el sondeo, para no ensuciar los datos QA.
delete from academia.quiz_attempts a
 using academia.profiles p
 where p.user_id = a.user_id
   and p.email like 'qa-%';
