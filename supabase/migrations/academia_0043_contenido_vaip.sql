-- academia_0043_contenido_vaip.sql
-- M19: lo que el portal de V-AI-P necesita guardar.
--
-- POR QUÉ
-- Alejandro (16-oct-2026) pidió dentro de la comunidad una sección de
-- Herramientas (creativas, administrativas y comerciales, cada una con sus
-- videos), noticias casi diarias con comentarios, y eventos además de clases.
--
-- QUÉ CAMBIA
--   1. `courses.category`: una herramienta es un curso (con sus lecciones en
--      video), marcado con su categoría. Null = curso normal.
--   2. `cohort_sessions.kind` y `location`: una sesión puede ser una clase
--      (Meet) o un evento externo (con su lugar). Todas las sesiones que ya
--      existen son clases.
--   3. `community_topics.solo_equipo` y el tema «Noticias» en la casa de
--      V-AI-P: las noticias son publicaciones del muro —con comentarios y
--      reacciones, como pidió Alejandro— que solo publica el equipo. Lo cierra
--      un trigger que mira el ROL DEL AUTOR (no la sesión): así vale igual para
--      la app, para la API (M20) y para el agente (M21), que publican con
--      service role a nombre del perfil del equipo.
--   4. Los textos de V-AI-P sin «cada quince días» (16-oct-2026): las clases
--      son personalizadas y la venta habla de acompañamiento.

-- ==========================================================================
-- 1. Herramientas
-- ==========================================================================

alter table academia.courses
  add column category text check (category in ('creativas', 'administrativas', 'comerciales'));

create index courses_categoria_idx on academia.courses (category) where category is not null;

-- ==========================================================================
-- 2. Clases y eventos
-- ==========================================================================

alter table academia.cohort_sessions
  add column kind text not null default 'clase' check (kind in ('clase', 'evento')),
  add column location text check (location is null or char_length(location) <= 200);

-- ==========================================================================
-- 3. Noticias: un tema donde solo publica el equipo
-- ==========================================================================

alter table academia.community_topics
  add column solo_equipo boolean not null default false;

create or replace function academia.academia_tema_solo_equipo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.topic_id is not null
     and exists (select 1 from academia.community_topics t where t.id = new.topic_id and t.solo_equipo)
     and not exists (
       select 1 from academia.profiles p
        where p.user_id = new.user_id and p.role in ('admin', 'superadmin', 'community_manager')
     )
  then
    raise exception 'En este tema solo publica el equipo.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger community_posts_tema_solo_equipo
  before insert or update of topic_id, user_id on academia.community_posts
  for each row execute function academia.academia_tema_solo_equipo();

revoke all on function academia.academia_tema_solo_equipo() from public;
grant execute on function academia.academia_tema_solo_equipo() to authenticated, service_role;

-- El tema en la casa de V-AI-P, primero en la lista.
insert into academia.community_topics (course_id, name, slug, position, solo_equipo)
select p.hub_course_id, 'Noticias', 'noticias', -1, true
  from academia.membership_plans p
 where p.slug = 'v-ai-p' and p.hub_course_id is not null
on conflict (course_id, slug) do update set solo_equipo = true;

-- ==========================================================================
-- 4. Los textos de V-AI-P (solo si nadie los cambió desde el panel)
-- ==========================================================================

update academia.membership_plans
   set description = 'La comunidad de la academia VADAI: el equipo te acompaña mes con mes con clases en vivo '
                     || 'personalizadas, lo nuevo de todas las plataformas de IA, herramientas con su video y '
                     || 'negocios que ya la usan en su día a día.'
 where slug = 'v-ai-p'
   and description like '%cada quince días%';

update academia.courses
   set description = 'La comunidad de la academia: clases en vivo personalizadas, noticias de IA, herramientas '
                     || 'con su video y un muro para compartir lo que ya te funciona.'
 where slug = 'v-ai-p'
   and description like '%cada quince días%';
