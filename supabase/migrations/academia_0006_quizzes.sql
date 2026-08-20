-- academia_0006_quizzes.sql
-- Quizzes autocalificables (§3.4).
--
-- OJO con `correct_option_id`: RLS filtra FILAS, no COLUMNAS. Si el alumno
-- pudiera leer quiz_questions, leería también la respuesta correcta antes de
-- contestar. Por eso la tabla queda reservada a admin y el alumno consume la
-- vista `academia.quiz_questions_public` (ver 0014). La calificación ocurre
-- server-side.

create table academia.quizzes (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid not null unique references academia.lessons (id) on delete cascade,

  passing_score   integer not null default 80 check (passing_score between 0 and 100),

  -- Si es false, al reprobar no se le dice cuál era la correcta (§3.4).
  reveal_answers  boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger quizzes_updated_at
  before update on academia.quizzes
  for each row execute function academia.set_updated_at();

create table academia.quiz_questions (
  id                uuid primary key default gen_random_uuid(),
  quiz_id           uuid not null references academia.quizzes (id) on delete cascade,
  question          text not null,

  -- [{ "id": "a", "text": "..." }, ...]
  options           jsonb not null default '[]'::jsonb,

  correct_option_id text not null,
  position          integer not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint quiz_questions_options_es_arreglo
    check (jsonb_typeof(options) = 'array')
);

create trigger quiz_questions_updated_at
  before update on academia.quiz_questions
  for each row execute function academia.set_updated_at();

create index quiz_questions_quiz_idx on academia.quiz_questions (quiz_id, position);

create table academia.quiz_attempts (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references academia.quizzes (id) on delete cascade,
  user_id     uuid not null references academia.profiles (user_id) on delete cascade,

  -- { "<question_id>": "<option_id>", ... }
  answers     jsonb not null default '{}'::jsonb,

  score       integer not null default 0 check (score between 0 and 100),
  passed      boolean not null default false,

  created_at  timestamptz not null default now()
);

-- Reintentos ilimitados por default (§3.4): sin unique, un alumno acumula intentos.
create index quiz_attempts_usuario_idx on academia.quiz_attempts (user_id, quiz_id, created_at desc);

comment on column academia.quiz_questions.correct_option_id is
  'NUNCA se expone al cliente. El alumno lee academia.quiz_questions_public, que no incluye esta columna.';
