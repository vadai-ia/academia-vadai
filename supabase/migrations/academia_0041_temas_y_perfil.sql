-- academia_0041_temas_y_perfil.sql
-- V-AI-P, fase 2 (M17): temas en el muro y el perfil que ven los demás miembros.
--
-- POR QUÉ
-- Alejandro (15-oct-2026): «todo en un muro, pero poder filtrar por temas o
-- grupos, para que la gente pueda entrar pero haya un muro principal». Y del
-- perfil: «nombre, foto, bio, nivel, puntos y logros, más su empresa».
--
-- CÓMO
--   - `community_topics`: los temas de un curso, que crea el equipo. Una
--     publicación lleva a lo más uno (`community_posts.topic_id`); el muro
--     principal sigue mostrando todo y el tema solo filtra.
--   - `profiles.bio`: una línea, la escribe la persona. La foto ya tenía
--     columna (`avatar_url`); faltaba subirla.
--   - `academia_perfil_de_miembro()`: lo que un miembro ve de otro (nombre,
--     foto, bio, empresa). Security definer y con su propia regla: solo si
--     los dos tienen acceso vigente a la casa de V-AI-P, o si quien pregunta
--     es del equipo. La política de `profiles` no se abre: un alumno sigue sin
--     poder leer la fila de otro.

-- ==========================================================================
-- 1. Temas del muro
-- ==========================================================================

create table academia.community_topics (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references academia.courses (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 40),
  slug        text not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  position    integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (course_id, slug)
);

create index community_topics_curso_idx on academia.community_topics (course_id, position);

alter table academia.community_topics enable row level security;

-- Los temas son estructura: los ve quien ve el curso.
create policy community_topics_select on academia.community_topics
  for select to authenticated
  using ((select academia.is_equipo()) or academia.has_enrollment(course_id));

create policy community_topics_write_equipo on academia.community_topics
  for all to authenticated
  using ((select academia.is_equipo()))
  with check ((select academia.is_equipo()));

alter table academia.community_posts
  add column topic_id uuid references academia.community_topics (id) on delete set null;

create index community_posts_tema_idx on academia.community_posts (topic_id) where topic_id is not null;

-- El tema tiene que ser del mismo curso que la publicación.
create or replace function academia.academia_tema_del_curso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.topic_id is not null and not exists (
    select 1 from academia.community_topics t
     where t.id = new.topic_id and t.course_id = new.course_id
  ) then
    raise exception 'Ese tema no es de este curso.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger community_posts_tema_del_curso
  before insert or update of topic_id, course_id on academia.community_posts
  for each row execute function academia.academia_tema_del_curso();

-- ==========================================================================
-- 2. El perfil de miembro
-- ==========================================================================

alter table academia.profiles
  add column bio text check (bio is null or char_length(bio) <= 160);

create or replace function academia.academia_perfil_de_miembro(p_user uuid)
returns table (user_id uuid, full_name text, avatar_url text, bio text, empresa text, es_equipo boolean,
               miembro_desde timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with casa as (
    select hub_course_id as id from academia.membership_plans where slug = 'v-ai-p'
  ),
  vigentes as (
    select e.user_id
      from academia.enrollments e, casa
     where e.course_id = casa.id
       and e.status = 'active'
       and (e.expires_at is null or e.expires_at > now())
  )
  select p.user_id, p.full_name, p.avatar_url, p.bio, c.name,
         p.role in ('admin', 'superadmin', 'community_manager'),
         -- Para los logros de antigüedad: la RLS de `memberships` no deja leer las de otro.
         (select min(m.started_at) from academia.memberships m
           join academia.membership_plans mp on mp.id = m.plan_id and mp.slug = 'v-ai-p'
          where m.user_id = p.user_id)
    from academia.profiles p
    left join academia.companies c on c.id = p.company_id
   where p.user_id = p_user
     and p.status = 'active'
     and (
       (select academia.is_equipo())
       or (
         exists (select 1 from vigentes v where v.user_id = (select auth.uid()))
         and (exists (select 1 from vigentes v where v.user_id = p_user)
              or p.role in ('admin', 'superadmin', 'community_manager'))
       )
     )
$$;

revoke all on function academia.academia_perfil_de_miembro(uuid) from public;
revoke all on function academia.academia_tema_del_curso() from public;
grant execute on function academia.academia_perfil_de_miembro(uuid) to authenticated, service_role;
grant execute on function academia.academia_tema_del_curso() to authenticated, service_role;
