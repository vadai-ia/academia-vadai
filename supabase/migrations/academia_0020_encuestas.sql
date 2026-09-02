-- academia_0020_encuestas.sql
-- Encuestas en vivo con QR (M12, etapa 1).
--
-- Qué es: el admin arma un juego de preguntas colgado de un curso, proyecta una
-- pantalla con un QR, y la sala contesta desde el celular mientras él abre y
-- cierra pregunta por pregunta. Las respuestas se ven agregadas en vivo.
--
-- Tres cosas de este diseño no son obvias y conviene leerlas antes de tocarlo:
--
--   1. QUIEN CONTESTA PUEDE NO TENER CUENTA. `academia_0001_base.sql` concede
--      privilegios de tabla solo a `authenticated` y `service_role`: `anon` no
--      puede leer ni escribir NADA, ni aunque escribiéramos una policy para él.
--      Por eso unirse y responder van por Server Actions con service role, que
--      verifican el código de la encuesta y la cookie del participante antes de
--      escribir. Es el mismo patrón ya aprobado de /certificado/[folio]: una
--      llave pública no adivinable, resuelta server-side. Las policies de abajo
--      gobiernan al admin y al alumno autenticado, que sí pasan por RLS.
--
--   2. LA IDENTIDAD ES GLOBAL, NO POR ENCUESTA. `participants` es la persona y
--      sobrevive al evento; `poll_participants` es su asistencia a UNA encuesta.
--      Separarlas es lo que hace verdad la promesa de "te reconozco en la
--      siguiente": el correo se busca en `participants`, no en la encuesta.
--
--   3. QUE NADIE SE ADELANTE LO GARANTIZA LA BASE. No hay lógica de aplicación
--      que decida si dos preguntas pueden estar abiertas: hay un índice único
--      parcial que lo hace imposible. Ver `poll_questions_una_abierta`.

-- ==========================================================================
-- 0. `invitado`: un rol que pertenece a la academia sin ser alumno
-- ==========================================================================
--
-- Quien se registra desde el QR obtiene una cuenta real para volver a la
-- siguiente encuesta, pero NO compró nada. Con `alumno` acabaría en /mis-cursos
-- viendo un vacío que no le explica nada, y ensuciaría el padrón de alumnos.
--
-- El constraint se recrea en vez de alterarse porque un CHECK no se modifica en
-- sitio. Se busca por catálogo y no por nombre literal: el nombre lo generó
-- Postgres en 0002 y depender de él es frágil.

do $$
declare
  nombre_constraint text;
begin
  select con.conname into nombre_constraint
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'academia'
     and rel.relname = 'profiles'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) like '%role%'
   limit 1;

  if nombre_constraint is not null then
    execute format('alter table academia.profiles drop constraint %I', nombre_constraint);
  end if;
end;
$$;

alter table academia.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'alumno', 'invitado'));

comment on column academia.profiles.role is
  'superadmin y admin son equipo; alumno compró o fue invitado a un curso; invitado nació en una encuesta en vivo y todavía no compra nada.';

-- ==========================================================================
-- 1. polls — la encuesta
-- ==========================================================================
--
-- Cuelga SIEMPRE de un curso (decisión de producto, 2-sep-2026). La cohorte es
-- opcional: la misma encuesta sirve para un grupo concreto o para el curso
-- entero.
--
-- Dos llaves públicas, y son distintas a propósito:
--
--   join_code        corto y dictable en voz alta. Va en el QR y en la pantalla.
--                    Alfabeto Crockford (sin I, L, O, U) por el mismo motivo que
--                    el folio del certificado: se lee de lejos y se teclea mal.
--
--   projection_token largo. Quien lo tiene proyecta. Nunca se dicta ni se
--                    imprime, así que puede ser feo.
--
-- Un solo valor para las dos cosas sería un error: el código que la sala ve
-- proyectado abriría también la pantalla de control.

create table academia.polls (
  id                uuid primary key default gen_random_uuid(),

  course_id         uuid not null references academia.courses (id) on delete cascade,
  cohort_id         uuid references academia.cohorts (id) on delete set null,

  title             text not null,
  description       text,

  join_code         text not null unique,
  projection_token  text not null unique,

  status            text not null default 'draft'
                    check (status in ('draft', 'live', 'closed')),

  -- Si es false, solo entra quien ya tiene cuenta en la academia. Sirve para
  -- una sesión interna donde no queremos capturar desconocidos.
  allow_guests      boolean not null default true,

  -- El muro de respuestas puede mostrar el nombre o no. Ojo: esto es sobre lo
  -- que SE PROYECTA, no sobre lo que se guarda. Siempre se sabe quién contestó.
  show_names        boolean not null default true,

  -- Contador que el celular del asistente consulta para saber si algo cambió.
  -- Lo mueve el admin al abrir o cerrar una pregunta, NUNCA una respuesta:
  -- si cada respuesta lo moviera, cien personas contestando despertarían a las
  -- otras noventa y nueve. Ver el trigger de la sección 7.
  state_version     bigint not null default 0,

  created_by        uuid references academia.profiles (user_id) on delete set null,

  opened_at         timestamptz,
  closed_at         timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger polls_updated_at
  before update on academia.polls
  for each row execute function academia.set_updated_at();

create index polls_curso_idx on academia.polls (course_id, created_at desc);
create index polls_cohorte_idx on academia.polls (cohort_id) where cohort_id is not null;

comment on table academia.polls is
  'Encuesta en vivo. join_code es la llave pública que va en el QR; projection_token es la que abre la pantalla de proyección.';

-- ==========================================================================
-- 2. poll_questions — las preguntas y su estado
-- ==========================================================================
--
-- `options` repite la forma [{ "id": "a", "text": "..." }] de quiz_questions a
-- propósito: es la misma cosa y el admin ya sabe llenarla.
--
-- `settings` guarda lo que cambia según el tipo (mínimo y máximo de la escala,
-- sus etiquetas, tope de caracteres, cuántas palabras admite la nube). Va en
-- jsonb y no en columnas sueltas porque son ajustes de presentación que van a
-- crecer, y ninguna consulta filtra por ellos.

create table academia.poll_questions (
  id             uuid primary key default gen_random_uuid(),
  poll_id        uuid not null references academia.polls (id) on delete cascade,

  position       integer not null default 0,
  prompt         text not null,

  -- nube    -> texto corto, se agrupa por palabra
  -- opcion  -> una de las `options`, se dibuja en barras
  -- escala  -> un número entre settings.min y settings.max
  -- muro    -> texto largo, se muestra tal cual en tarjetas
  question_type  text not null
                 check (question_type in ('nube', 'opcion', 'escala', 'muro')),

  options        jsonb not null default '[]'::jsonb,
  settings       jsonb not null default '{}'::jsonb,

  status         text not null default 'pending'
                 check (status in ('pending', 'open', 'closed')),

  opened_at      timestamptz,
  closed_at      timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint poll_questions_options_es_arreglo
    check (jsonb_typeof(options) = 'array'),
  constraint poll_questions_settings_es_objeto
    check (jsonb_typeof(settings) = 'object'),

  -- Una pregunta de opción múltiple sin opciones no se puede contestar.
  constraint poll_questions_opcion_con_opciones
    check (question_type <> 'opcion' or jsonb_array_length(options) > 0)
);

create trigger poll_questions_updated_at
  before update on academia.poll_questions
  for each row execute function academia.set_updated_at();

create index poll_questions_poll_idx on academia.poll_questions (poll_id, position);

-- ESTO es "nadie se adelanta". Un índice único parcial: dentro de una encuesta
-- no puede haber dos filas con status='open'. No importa si el admin da doble
-- clic, si tiene dos pestañas abiertas o si dos peticiones llegan a la vez —
-- la segunda choca contra el índice. La regla vive donde no se puede esquivar,
-- igual que el unique (user_id, course_id) de enrollments.
create unique index poll_questions_una_abierta
  on academia.poll_questions (poll_id)
  where status = 'open';

comment on index academia.poll_questions_una_abierta is
  'Garantiza que a lo sumo una pregunta esté abierta por encuesta. Es la única defensa real contra que alguien se adelante; no la quites pensando que la aplicación ya lo valida.';

-- ==========================================================================
-- 3. participants — la persona, global y reutilizable
-- ==========================================================================
--
-- Esta tabla es lo que hace verdad "y eso les crea una cuenta para siguientes
-- encuestas". La identidad NO cuelga de una encuesta.
--
-- `user_id` nullable es el eje de los tres caminos de entrada:
--
--   entra con su cuenta      user_id = el suyo
--   se registra              user_id = el nuevo, y profiles.role = 'invitado'
--   "continuar como invitado" user_id = null, pero nombre/correo/teléfono igual
--
-- El apellido y el teléfono viven aquí y no en `profiles` porque profiles solo
-- tiene `full_name` y alterarla para esto sería moverle el piso a media
-- plataforma por un dato que solo usa esta feature.

create table academia.participants (
  id          uuid primary key default gen_random_uuid(),

  -- Único cuando existe: una cuenta no puede ser dos personas.
  user_id     uuid unique references academia.profiles (user_id) on delete set null,

  first_name  text not null default '',
  last_name   text not null default '',
  email       text not null,
  phone       text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger participants_updated_at
  before update on academia.participants
  for each row execute function academia.set_updated_at();

-- Sin distinguir mayúsculas, por el mismo motivo que buscarUsuario() en el
-- provisioning: "Alejandro@" y "alejandro@" son la misma persona, y duplicarla
-- entre dos eventos rompe la promesa de reconocerla.
--
-- Es un índice sobre lower(email) y no una columna citext porque citext es una
-- extensión y las extensiones no viven en `academia` (Regla Cero).
create unique index participants_email_idx on academia.participants (lower(email));

comment on table academia.participants is
  'La persona detrás de una respuesta, viva entre encuestas. user_id null = contestó como invitado y todavía no tiene cuenta.';

-- ==========================================================================
-- 4. poll_participants — la asistencia a ESTA encuesta
-- ==========================================================================
--
-- `session_token` es un valor opaco de 32 bytes que viaja en una cookie
-- httpOnly. Es lo que reconoce al asistente cuando refresca la página o se le
-- bloquea el teléfono a media dinámica.
--
-- No se firma con HMAC: se valida contra esta tabla. Un token que no está aquí
-- no vale, y eso es más simple y más difícil de equivocar que verificar una
-- firma. Además permite revocarlo borrando una fila.

create table academia.poll_participants (
  id              uuid primary key default gen_random_uuid(),

  poll_id         uuid not null references academia.polls (id) on delete cascade,
  participant_id  uuid not null references academia.participants (id) on delete cascade,

  session_token   text not null unique,

  -- Congelado al entrar. Si la persona cambia su nombre después, lo que se
  -- proyectó aquel día no debe cambiar retroactivamente.
  display_name    text not null default '',

  joined_at       timestamptz not null default now(),

  -- Una persona entra una vez a una encuesta. Volver a escanear el QR la
  -- reconoce, no la duplica.
  unique (poll_id, participant_id)
);

create index poll_participants_poll_idx on academia.poll_participants (poll_id, joined_at);

comment on table academia.poll_participants is
  'Asistencia de una persona a una encuesta concreta. El session_token vive en una cookie httpOnly y se valida contra esta tabla, no por firma.';

-- ==========================================================================
-- 5. poll_answers — las respuestas
-- ==========================================================================
--
-- Tres columnas de valor y exactamente una llena. La alternativa —una columna
-- `value jsonb` -- haría que agregar en SQL fuera un ejercicio de casting en
-- cada consulta, y las agregaciones son justo lo que esta tabla existe para
-- servir.

create table academia.poll_answers (
  id                   uuid primary key default gen_random_uuid(),

  question_id          uuid not null references academia.poll_questions (id) on delete cascade,
  poll_participant_id  uuid not null references academia.poll_participants (id) on delete cascade,

  -- La nube admite varias palabras de la misma persona; los demás tipos usan 0.
  ordinal              smallint not null default 0,

  text_value           text,
  option_id            text,
  numeric_value        smallint,

  -- Para agrupar la nube sin depender de la extensión unaccent, que vive fuera
  -- de `academia`. translate() y lower() son inmutables, así que la columna
  -- puede ser generada y se indexa sola.
  text_norm            text generated always as (
                         translate(
                           lower(coalesce(text_value, '')),
                           'áéíóúüñÁÉÍÓÚÜÑ',
                           'aeiouunAEIOUUN'
                         )
                       ) stored,

  -- El botón de pánico: un QR abierto a internet va a recibir una grosería en
  -- algún momento y hay que poder taparla en vivo. No se borra —el dato se
  -- exporta después— solo deja de proyectarse.
  hidden               boolean not null default false,

  created_at           timestamptz not null default now(),

  -- Reenviar el formulario no duplica: choca aquí.
  unique (question_id, poll_participant_id, ordinal),

  -- Exactamente un valor. Cuál corresponde a cada question_type se valida
  -- server-side, porque desde aquí no se puede mirar la pregunta sin un join.
  constraint poll_answers_un_solo_valor
    check (num_nonnulls(text_value, option_id, numeric_value) = 1)
);

create index poll_answers_pregunta_idx on academia.poll_answers (question_id, created_at desc);
create index poll_answers_nube_idx on academia.poll_answers (question_id, text_norm) where hidden = false;

comment on column academia.poll_answers.hidden is
  'Oculta la respuesta de la proyección sin borrarla. Lo que se exporta después SÍ la incluye, marcada.';

-- ==========================================================================
-- 6. poll_join_attempts — cuota, porque el QR es un endpoint abierto
-- ==========================================================================
--
-- Un QR proyectado frente a una sala es una URL de escritura pública. Sin cuota,
-- el camino de "registrarme" es una fábrica de cuentas y un cañón contra la
-- reputación de envío de Resend, que es compartida con los demás dominios de
-- VADAI.
--
-- POR QUÉ EN UNA TABLA Y NO EN MEMORIA: en Vercel cada petición puede caer en
-- otra instancia. Un contador en RAM no cuenta nada.
--
-- POR QUÉ NO pg_cron PARA LIMPIAR: crearía objetos en el schema `cron`, fuera
-- de `academia`. La limpieza es oportunista, dentro de la misma función que
-- consulta la cuota.
--
-- La IP nunca se guarda en claro: se guarda sha256(ip + ENCUESTAS_IP_SALT).
-- Sirve igual para contar y no convierte esta tabla en un registro de quién
-- estuvo dónde.

create table academia.poll_join_attempts (
  id          bigint generated always as identity primary key,
  poll_id     uuid not null references academia.polls (id) on delete cascade,
  ip_hash     text not null,
  kind        text not null check (kind in ('join', 'account', 'answer')),
  created_at  timestamptz not null default now()
);

create index poll_join_attempts_cuota_idx
  on academia.poll_join_attempts (poll_id, ip_hash, kind, created_at desc);

comment on table academia.poll_join_attempts is
  'Cuota del endpoint público. ip_hash es sha256(ip + sal): sirve para contar sin guardar de quién es la IP.';

-- ==========================================================================
-- 7. Funciones y triggers
-- ==========================================================================
--
-- Mismo criterio que academia_0012_helpers.sql: `set search_path = ''`, cada
-- objeto calificado, y `security definer` solo donde hace falta leer tablas con
-- RLS desde una policy.

-- Resolución de jerarquía, para no repetir el join en cada policy.
create or replace function academia.curso_de_encuesta(p_poll_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.course_id from academia.polls p where p.id = p_poll_id
$$;

create or replace function academia.curso_de_pregunta(p_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select academia.curso_de_encuesta(q.poll_id)
    from academia.poll_questions q
   where q.id = p_question_id
$$;

-- Mueve state_version cuando cambia lo que el asistente necesita saber: qué
-- pregunta está abierta, o si la encuesta terminó.
--
-- Deliberadamente NO se dispara con las respuestas. El celular sondea este
-- número; si subiera con cada respuesta, cada persona que contesta obligaría a
-- todas las demás a volver a pedir. Ver el comentario de polls.state_version.
create or replace function academia.encuesta_mueve_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update academia.polls
     set state_version = state_version + 1
   where id = coalesce(new.poll_id, old.poll_id);
  return coalesce(new, old);
end;
$$;

create trigger poll_questions_mueve_version
  after insert or delete on academia.poll_questions
  for each row execute function academia.encuesta_mueve_version();

create trigger poll_questions_mueve_version_al_cambiar_estado
  after update of status on academia.poll_questions
  for each row
  when (old.status is distinct from new.status)
  execute function academia.encuesta_mueve_version();

-- El estado de una pregunta solo avanza: pending -> open -> closed.
--
-- Reabrir una pregunta cerrada suena inofensivo hasta que alguien lo hace
-- después de proyectar los resultados: las respuestas que lleguen entonces
-- contradicen lo que la sala ya vio. Si de verdad hay que repetirla, se duplica
-- la pregunta.
create or replace function academia.encuesta_valida_transicion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'closed' then
    raise exception 'Una pregunta cerrada no se reabre. Duplícala si hay que repetirla.'
      using errcode = '22023';
  end if;

  if old.status = 'open' and new.status = 'pending' then
    raise exception 'Una pregunta abierta solo puede cerrarse.'
      using errcode = '22023';
  end if;

  if new.status = 'open' then
    new.opened_at = now();
  elsif new.status = 'closed' then
    new.closed_at = now();
  end if;

  return new;
end;
$$;

create trigger poll_questions_valida_transicion
  before update of status on academia.poll_questions
  for each row execute function academia.encuesta_valida_transicion();

-- Permisos de las funciones nuevas.
--
-- El bloque `do $$` de 0012 ya corrió y solo cubrió lo que existía entonces.
-- Estas se conceden a mano, con el mismo criterio: nada para PUBLIC.
revoke all on function academia.curso_de_encuesta(uuid) from public;
grant execute on function academia.curso_de_encuesta(uuid) to authenticated, service_role;

revoke all on function academia.curso_de_pregunta(uuid) from public;
grant execute on function academia.curso_de_pregunta(uuid) to authenticated, service_role;

revoke all on function academia.encuesta_mueve_version() from public;
grant execute on function academia.encuesta_mueve_version() to authenticated, service_role;

revoke all on function academia.encuesta_valida_transicion() from public;
grant execute on function academia.encuesta_valida_transicion() to authenticated, service_role;

-- ==========================================================================
-- 8. RLS
-- ==========================================================================
--
-- Convención de academia_0013_rls.sql: toda policy declara `to authenticated`.
-- `service_role` tiene BYPASSRLS, así que el camino público —unirse, responder—
-- no pasa por aquí: pasa por Server Actions que verifican el join_code y la
-- cookie antes de escribir.
--
-- Una tabla con RLS y CERO policies queda cerrada a todo el mundo salvo service
-- role. Es el caso de participants, poll_participants y poll_join_attempts para
-- todos menos el admin: son datos personales de gente que no es alumno, y ningún
-- usuario final tiene por qué leerlos.

alter table academia.polls              enable row level security;
alter table academia.poll_questions     enable row level security;
alter table academia.participants       enable row level security;
alter table academia.poll_participants  enable row level security;
alter table academia.poll_answers       enable row level security;
alter table academia.poll_join_attempts enable row level security;

-- --- polls ---------------------------------------------------------------
--
-- El alumno inscrito ve las encuestas de su curso: se usa has_enrollment() y no
-- has_active_access() a propósito. Una encuesta es un evento con fecha; que a
-- alguien se le haya vencido el acceso al curso no debe borrarle de la vista la
-- dinámica en la que participó.

create policy polls_select_admin_o_inscrito on academia.polls
  for select to authenticated
  using (academia.is_admin() or academia.has_enrollment(course_id));

create policy polls_insert_admin on academia.polls
  for insert to authenticated with check (academia.is_admin());
create policy polls_update_admin on academia.polls
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy polls_delete_admin on academia.polls
  for delete to authenticated using (academia.is_admin());

-- --- poll_questions ------------------------------------------------------

create policy poll_questions_select_admin_o_inscrito on academia.poll_questions
  for select to authenticated
  using (
    academia.is_admin()
    or academia.has_enrollment(academia.curso_de_encuesta(poll_id))
  );

create policy poll_questions_insert_admin on academia.poll_questions
  for insert to authenticated with check (academia.is_admin());
create policy poll_questions_update_admin on academia.poll_questions
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy poll_questions_delete_admin on academia.poll_questions
  for delete to authenticated using (academia.is_admin());

-- --- participants --------------------------------------------------------
--
-- Solo admin. Son nombres, correos y teléfonos de gente que asistió a un evento:
-- ningún alumno tiene por qué leer el padrón. La única excepción es verse a uno
-- mismo, que sirve para la pantalla de "tus encuestas".

create policy participants_select_admin_o_propio on academia.participants
  for select to authenticated
  using (academia.is_admin() or user_id = (select auth.uid()));

create policy participants_insert_admin on academia.participants
  for insert to authenticated with check (academia.is_admin());
create policy participants_update_admin on academia.participants
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy participants_delete_admin on academia.participants
  for delete to authenticated using (academia.is_admin());

-- --- poll_participants ---------------------------------------------------
--
-- Ojo: sin policy de INSERT ni UPDATE para nadie. Unirse a una encuesta es
-- SIEMPRE server-side con service role, porque quien se une puede no tener
-- sesión. Mismo criterio que academia_0017 con quiz_attempts: si el camino
-- legítimo no pasa por RLS, no se abre una policy "por si acaso".

create policy poll_participants_select_admin on academia.poll_participants
  for select to authenticated
  using (academia.is_admin());

create policy poll_participants_delete_admin on academia.poll_participants
  for delete to authenticated using (academia.is_admin());

-- --- poll_answers --------------------------------------------------------
--
-- Tampoco lleva INSERT: responder va por service role tras verificar que la
-- pregunta está abierta y que la cookie corresponde a un participante de esta
-- encuesta. El UPDATE de admin existe solo para `hidden` (el botón de pánico).

create policy poll_answers_select_admin on academia.poll_answers
  for select to authenticated
  using (academia.is_admin());

create policy poll_answers_update_admin on academia.poll_answers
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());

create policy poll_answers_delete_admin on academia.poll_answers
  for delete to authenticated using (academia.is_admin());

-- --- poll_join_attempts --------------------------------------------------
--
-- Cero policies: es contabilidad interna del limitador. Solo service role la
-- toca, y nadie más tiene por qué verla.
