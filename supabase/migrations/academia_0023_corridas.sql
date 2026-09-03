-- academia_0023_corridas.sql
-- La misma encuesta, corrida varias veces, sin perder lo anterior.
--
-- POR QUÉ
-- Hasta aquí una encuesta era de un solo uso: para volver a correrla había que
-- reiniciarla —borrando las respuestas— o duplicarla entera. Ninguna de las dos
-- sirve para lo que de verdad pasa: el mismo juego de preguntas se usa en tres
-- eventos distintos, y de los tres se quieren los datos.
--
-- Y "empezar de cero sin borrar" no se puede resolver en la interfaz: si las
-- respuestas viejas siguen colgando de la pregunta, la primera gráfica de la
-- corrida nueva ya empieza con los números de la anterior. Hay que separarlas
-- en la base.
--
-- POR QUÉ UN ENTERO Y NO UNA TABLA `poll_runs`
-- La tabla sería el modelo de libro: id, fechas, nombre por corrida. Se eligió
-- el entero porque todo lo que la tabla daría de más —cuándo corrió cada una—
-- ya se puede deducir de las respuestas, y a cambio cada consulta de esta
-- feature se habría llevado un join más. Con un entero, filtrar por la corrida
-- actual es una comparación; con la tabla, un join y un subselect del máximo.
-- Si algún día hace falta ponerle nombre a una corrida, se agrega la tabla y
-- este entero se vuelve su `numero`.
--
-- LA CORRIDA LA SELLA LA BASE, NO LA APLICACIÓN
-- Las dos columnas nuevas de detalle las llena un trigger a partir de la
-- encuesta. Si dependieran de que cada `insert` acordara el valor correcto,
-- bastaría un camino nuevo que lo olvidara para que una respuesta cayera en la
-- corrida equivocada — y eso no da error, solo cuenta mal.

-- ==========================================================================
-- 1. Las columnas
-- ==========================================================================

alter table academia.polls
  add column corrida integer not null default 1;

comment on column academia.polls.corrida is
  'Cuántas veces se ha corrido esta encuesta. Lo que se proyecta y se agrega es SIEMPRE la corrida actual; las anteriores se conservan y salen en la exportación.';

-- El default de 1 es para las filas que ya existen. Se quita después: en
-- adelante el valor lo pone el trigger, y un default sería una forma silenciosa
-- de que una fila se quedara en la corrida 1 para siempre.
alter table academia.poll_answers
  add column corrida integer not null default 1;
alter table academia.poll_answers
  alter column corrida drop default;

alter table academia.poll_participants
  add column corrida integer not null default 1;
alter table academia.poll_participants
  alter column corrida drop default;

-- ==========================================================================
-- 2. Una persona entra una vez POR CORRIDA, no una vez por encuesta
-- ==========================================================================
--
-- El constraint viejo era `unique (poll_id, participant_id)`, declarado en
-- línea, así que su nombre lo generó Postgres. Se busca por catálogo en vez de
-- escribirlo a mano: depender de un nombre generado es frágil.

do $$
declare
  nombre_constraint text;
begin
  select con.conname into nombre_constraint
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'academia'
     and rel.relname = 'poll_participants'
     and con.contype = 'u'
     and pg_get_constraintdef(con.oid) like '%participant_id%'
     and pg_get_constraintdef(con.oid) like '%poll_id%'
   limit 1;

  if nombre_constraint is not null then
    execute format(
      'alter table academia.poll_participants drop constraint %I', nombre_constraint
    );
  end if;
end;
$$;

alter table academia.poll_participants
  add constraint poll_participants_una_por_corrida
  unique (poll_id, participant_id, corrida);

create index poll_participants_corrida_idx
  on academia.poll_participants (poll_id, corrida, joined_at);

create index poll_answers_corrida_idx
  on academia.poll_answers (question_id, corrida) where hidden = false;

-- ==========================================================================
-- 3. Helpers
-- ==========================================================================

create or replace function academia.corrida_de_encuesta(p_poll_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select p.corrida from academia.polls p where p.id = p_poll_id
$$;

comment on function academia.corrida_de_encuesta(uuid) is
  'La corrida en curso de una encuesta. Es el filtro de todo lo que se proyecta.';

revoke all on function academia.corrida_de_encuesta(uuid) from public;
grant execute on function academia.corrida_de_encuesta(uuid) to authenticated, service_role;

-- ==========================================================================
-- 4. Los triggers que sellan la corrida
-- ==========================================================================

create or replace function academia.sella_corrida_de_respuesta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.corrida into new.corrida
    from academia.poll_questions q
    join academia.polls p on p.id = q.poll_id
   where q.id = new.question_id;
  return new;
end;
$$;

create trigger poll_answers_sella_corrida
  before insert on academia.poll_answers
  for each row execute function academia.sella_corrida_de_respuesta();

create or replace function academia.sella_corrida_de_asistencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.corrida = academia.corrida_de_encuesta(new.poll_id);
  return new;
end;
$$;

create trigger poll_participants_sella_corrida
  before insert on academia.poll_participants
  for each row execute function academia.sella_corrida_de_asistencia();

revoke all on function academia.sella_corrida_de_respuesta() from public;
grant execute on function academia.sella_corrida_de_respuesta() to authenticated, service_role;
revoke all on function academia.sella_corrida_de_asistencia() from public;
grant execute on function academia.sella_corrida_de_asistencia() to authenticated, service_role;

-- ==========================================================================
-- 5. "Sin respuestas" ahora significa "sin respuestas EN ESTA CORRIDA"
-- ==========================================================================
--
-- Es lo que hace posible arrancar una corrida nueva sin borrar nada: se sube el
-- contador de la encuesta y, desde el punto de vista de las preguntas, no queda
-- ninguna respuesta que contradecir. Las de la corrida anterior siguen ahí,
-- pero pertenecen a otra corrida.
--
-- La regla de fondo no cambió y sigue siendo la de academia_0022: una pregunta
-- no retrocede mientras haya respuestas que puedan contradecir lo que la sala
-- ya vio proyectado.

create or replace function academia.pregunta_sin_respuestas(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
      from academia.poll_answers a
      join academia.poll_questions q on q.id = a.question_id
      join academia.polls p on p.id = q.poll_id
     where a.question_id = p_question_id
       and a.corrida = p.corrida
  )
$$;

comment on function academia.pregunta_sin_respuestas(uuid) is
  'true si a la pregunta no le queda ninguna respuesta EN LA CORRIDA ACTUAL. Es lo que habilita reiniciar y arrancar una corrida nueva. Ver academia_0023.';
