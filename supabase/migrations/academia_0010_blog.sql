-- academia_0010_blog.sql
-- Blog y anuncios (§3.9). Solo los crea el admin.

create table academia.posts (
  id                 uuid primary key default gen_random_uuid(),
  author_id          uuid not null references academia.profiles (user_id) on delete cascade,

  post_type          text not null default 'blog'
                     check (post_type in ('announcement', 'blog')),

  title              text not null check (length(trim(title)) > 0),
  content_rich       jsonb,
  cover_url          text,

  -- null = todos los alumnos. Con valor, solo los inscritos a ese curso.
  audience_course_id uuid references academia.courses (id) on delete cascade,

  -- null = borrador. Con fecha futura, programado.
  published_at       timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger posts_updated_at
  before update on academia.posts
  for each row execute function academia.set_updated_at();

create index posts_publicados_idx
  on academia.posts (post_type, published_at desc)
  where published_at is not null;

create index posts_audiencia_idx on academia.posts (audience_course_id);

comment on column academia.posts.published_at is
  'null = borrador. La policy del alumno exige published_at <= now(), así que una fecha futura queda programada.';
