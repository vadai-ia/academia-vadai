-- academia_0003_contenido.sql
-- Cursos, módulos, lecciones y adjuntos.

create table academia.courses (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique,
  title                     text not null,
  description               text,
  cover_url                 text,

  price_mxn                 numeric(10, 2),
  price_usd                 numeric(10, 2),
  stripe_payment_link_mxn   text,
  stripe_payment_link_usd   text,

  -- null = acceso de por vida. El curso 1 promete "para siempre" (§0.B).
  access_days               integer check (access_days is null or access_days > 0),

  course_type               text not null default 'cohort'
                            check (course_type in ('cohort', 'evergreen')),

  status                    text not null default 'draft'
                            check (status in ('draft', 'published', 'archived')),

  certificate_enabled       boolean not null default true,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger courses_updated_at
  before update on academia.courses
  for each row execute function academia.set_updated_at();

create index courses_status_idx on academia.courses (status);

create table academia.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references academia.courses (id) on delete cascade,
  title       text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger modules_updated_at
  before update on academia.modules
  for each row execute function academia.set_updated_at();

-- Las policies de lessons resuelven el curso subiendo por module_id.
create index modules_course_idx on academia.modules (course_id, position);

create table academia.lessons (
  id                 uuid primary key default gen_random_uuid(),
  module_id          uuid not null references academia.modules (id) on delete cascade,
  title              text not null,

  -- Tiptap persiste JSON (§5). jsonb permite consultarlo si algún día hace falta.
  description_rich   jsonb,

  position           integer not null default 0,

  lesson_type        text not null default 'video'
                     check (lesson_type in ('video', 'text', 'quiz', 'assignment')),

  bunny_video_id     text,
  video_duration_sec integer check (video_duration_sec is null or video_duration_sec >= 0),

  -- Cuenta para el 100% que habilita el certificado (§3.6).
  is_required        boolean not null default true,

  status             text not null default 'published'
                     check (status in ('draft', 'published')),

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger lessons_updated_at
  before update on academia.lessons
  for each row execute function academia.set_updated_at();

create index lessons_module_idx on academia.lessons (module_id, position);
create index lessons_status_idx on academia.lessons (status);

create table academia.lesson_attachments (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     uuid not null references academia.lessons (id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  created_at    timestamptz not null default now()
);

create index lesson_attachments_lesson_idx on academia.lesson_attachments (lesson_id);

comment on column academia.courses.access_days is
  'null = acceso de por vida. Si trae valor, enrollments.expires_at se calcula al inscribir.';
comment on column academia.lessons.bunny_video_id is
  'GUID del video en Bunny Stream. La URL de reproducción se firma server-side, nunca se expone.';
