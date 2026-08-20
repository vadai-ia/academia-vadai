-- academia_0009_social.sql
-- Comentarios por lección (§3.7) y comunidad por curso (§3.8).
--
-- Nada se borra de verdad: el borrado es lógico (status = 'deleted'). Así la
-- moderación es reversible y los hilos no se rompen. Las policies solo dejan
-- ver filas con status = 'visible'.

create table academia.lesson_comments (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid not null references academia.lessons (id) on delete cascade,
  user_id     uuid not null references academia.profiles (user_id) on delete cascade,

  -- Replies de un solo nivel (§3.7).
  parent_id   uuid references academia.lesson_comments (id) on delete cascade,

  content     text not null check (length(trim(content)) > 0),

  status      text not null default 'visible'
              check (status in ('visible', 'hidden', 'deleted')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger lesson_comments_updated_at
  before update on academia.lesson_comments
  for each row execute function academia.set_updated_at();

create index lesson_comments_leccion_idx
  on academia.lesson_comments (lesson_id, created_at);
create index lesson_comments_padre_idx on academia.lesson_comments (parent_id);
create index lesson_comments_autor_idx on academia.lesson_comments (user_id);

-- Un reply no puede colgar de otro reply: solo un nivel.
create or replace function academia.validar_nivel_comentario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  abuelo uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select parent_id into abuelo
    from academia.lesson_comments
   where id = new.parent_id;

  if abuelo is not null then
    raise exception 'Los comentarios admiten un solo nivel de respuesta.';
  end if;

  return new;
end;
$$;

create trigger lesson_comments_un_nivel
  before insert or update on academia.lesson_comments
  for each row execute function academia.validar_nivel_comentario();

create table academia.community_posts (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references academia.courses (id) on delete cascade,
  user_id      uuid not null references academia.profiles (user_id) on delete cascade,

  title        text not null check (length(trim(title)) > 0),
  content_rich jsonb,

  -- [{ "storage_path": "...", "url": "..." }, ...]
  images       jsonb not null default '[]'::jsonb,

  pinned       boolean not null default false,

  status       text not null default 'visible'
               check (status in ('visible', 'hidden', 'deleted')),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint community_posts_images_es_arreglo
    check (jsonb_typeof(images) = 'array')
);

create trigger community_posts_updated_at
  before update on academia.community_posts
  for each row execute function academia.set_updated_at();

-- El feed ordena fijados primero, luego por fecha.
create index community_posts_feed_idx
  on academia.community_posts (course_id, pinned desc, created_at desc);
create index community_posts_autor_idx on academia.community_posts (user_id);

create table academia.community_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references academia.community_posts (id) on delete cascade,
  user_id     uuid not null references academia.profiles (user_id) on delete cascade,

  content     text not null check (length(trim(content)) > 0),

  status      text not null default 'visible'
              check (status in ('visible', 'hidden', 'deleted')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger community_comments_updated_at
  before update on academia.community_comments
  for each row execute function academia.set_updated_at();

create index community_comments_post_idx
  on academia.community_comments (post_id, created_at);
create index community_comments_autor_idx on academia.community_comments (user_id);
