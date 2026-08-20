-- academia_0007_tareas.sql
-- Tareas con entrega y revisión (§3.5).

create table academia.assignments (
  id                 uuid primary key default gen_random_uuid(),
  lesson_id          uuid not null unique references academia.lessons (id) on delete cascade,

  instructions_rich  jsonb,

  allow_files        boolean not null default true,
  allow_text         boolean not null default true,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Una tarea que no acepta ni texto ni archivos no se puede entregar.
  constraint assignments_acepta_algo
    check (allow_files or allow_text)
);

create trigger assignments_updated_at
  before update on academia.assignments
  for each row execute function academia.set_updated_at();

create table academia.assignment_submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references academia.assignments (id) on delete cascade,
  user_id        uuid not null references academia.profiles (user_id) on delete cascade,

  text_content   text,

  -- [{ "storage_path": "entregas/<user_id>/...", "name": "..." }, ...]
  files          jsonb not null default '[]'::jsonb,

  status         text not null default 'submitted'
                 check (status in ('submitted', 'approved', 'rejected')),

  feedback       text,
  reviewed_by    uuid references academia.profiles (user_id) on delete set null,
  reviewed_at    timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint assignment_submissions_files_es_arreglo
    check (jsonb_typeof(files) = 'array'),

  -- Una entrega revisada tiene que decir quién y cuándo.
  constraint assignment_submissions_revision_completa
    check (
      status = 'submitted'
      or (reviewed_by is not null and reviewed_at is not null)
    ),

  -- Una entrega por alumno y tarea; rechazada permite reentrega editando la misma fila (§3.5).
  unique (assignment_id, user_id)
);

create trigger assignment_submissions_updated_at
  before update on academia.assignment_submissions
  for each row execute function academia.set_updated_at();

-- La bandeja del admin lista pendientes por curso.
create index assignment_submissions_pendientes_idx
  on academia.assignment_submissions (status, created_at);

create index assignment_submissions_usuario_idx
  on academia.assignment_submissions (user_id);
