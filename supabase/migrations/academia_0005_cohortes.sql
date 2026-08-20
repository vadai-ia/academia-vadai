-- academia_0005_cohortes.sql
-- Cohortes y sesiones en vivo por Google Meet (§3.10).

create table academia.cohorts (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references academia.courses (id) on delete cascade,
  name        text not null,
  starts_on   date,
  ends_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint cohorts_fechas_coherentes
    check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

create trigger cohorts_updated_at
  before update on academia.cohorts
  for each row execute function academia.set_updated_at();

create index cohorts_course_idx on academia.cohorts (course_id);

-- La FK quedó pendiente en 0004 porque cohorts no existía todavía.
-- on delete set null: borrar una cohorte no debe borrar la inscripción del
-- alumno; simplemente deja de estar asociada a un grupo.
alter table academia.enrollments
  add constraint enrollments_cohort_fk
  foreign key (cohort_id) references academia.cohorts (id) on delete set null;

create table academia.cohort_sessions (
  id                  uuid primary key default gen_random_uuid(),
  cohort_id           uuid not null references academia.cohorts (id) on delete cascade,
  title               text not null,
  description         text,

  -- timestamptz: se guarda en UTC y la UI convierte a la hora local del
  -- navegador, mostrando CDMX como referencia (§3.10).
  scheduled_at        timestamptz not null,

  meet_url            text,

  -- Se liga después de la sesión: la grabación es una lección de tipo video
  -- creada en el módulo correspondiente (§3.10).
  recording_lesson_id uuid references academia.lessons (id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger cohort_sessions_updated_at
  before update on academia.cohort_sessions
  for each row execute function academia.set_updated_at();

create index cohort_sessions_cohort_idx on academia.cohort_sessions (cohort_id, scheduled_at);

comment on column academia.cohort_sessions.scheduled_at is
  'UTC. La UI convierte a hora local del navegador y muestra CDMX como referencia.';
