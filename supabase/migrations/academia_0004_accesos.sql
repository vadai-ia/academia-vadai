-- academia_0004_accesos.sql
-- Inscripciones y progreso: el corazón del control de acceso.
--
-- La distinción que rige toda la RLS del proyecto:
--   status = 'active' y expires_at vigente  -> ve CONTENIDO (video, adjuntos, quizzes)
--   status = 'active' y expires_at vencida  -> ve ESTRUCTURA (curso, módulos, títulos)
--   status = 'revoked'                      -> no ve NADA
--
-- El caso vencido existe porque §3.3 pinta candados en las lecciones y §6.3 pide
-- un CTA de recompra: para eso el alumno tiene que seguir viendo su curso.

create table academia.enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references academia.profiles (user_id) on delete cascade,
  course_id   uuid not null references academia.courses (id) on delete cascade,
  cohort_id   uuid,  -- FK se agrega en 0005, cuando ya existe la tabla cohorts

  source      text not null default 'manual'
              check (source in ('stripe', 'manual')),

  starts_at   timestamptz not null default now(),

  -- null = sin expiración (acceso de por vida).
  expires_at  timestamptz,

  -- 'revoked' lo pone el webhook de charge.refunded (§7.1).
  status      text not null default 'active'
              check (status in ('active', 'revoked')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, course_id)
);

create trigger enrollments_updated_at
  before update on academia.enrollments
  for each row execute function academia.set_updated_at();

-- Índice pensado para los helpers de RLS, que se ejecutan en CADA fila evaluada
-- de courses, modules, lessons, etc. Sin esto cada policy hace seq scan.
create index enrollments_acceso_idx
  on academia.enrollments (user_id, course_id, status, expires_at);

create index enrollments_course_idx on academia.enrollments (course_id);
create index enrollments_cohort_idx on academia.enrollments (cohort_id);

create table academia.lesson_progress (
  user_id         uuid not null references academia.profiles (user_id) on delete cascade,
  lesson_id       uuid not null references academia.lessons (id) on delete cascade,

  completed       boolean not null default false,
  seconds_watched integer not null default 0 check (seconds_watched >= 0),
  completed_at    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  primary key (user_id, lesson_id)
);

create trigger lesson_progress_updated_at
  before update on academia.lesson_progress
  for each row execute function academia.set_updated_at();

create index lesson_progress_lesson_idx on academia.lesson_progress (lesson_id);

comment on table academia.lesson_progress is
  'El progreso NUNCA se borra al expirar el acceso (§6.3). Su policy de SELECT no depende de la vigencia.';
