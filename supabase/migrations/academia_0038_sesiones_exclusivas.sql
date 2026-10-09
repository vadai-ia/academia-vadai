-- academia_0038_sesiones_exclusivas.sql
-- Sesiones exclusivas: un módulo que solo abre para una lista de personas que
-- elige el equipo.
--
-- POR QUÉ
-- Alejandro (9-oct-2026), al salir de la Sesión 6 con directivos y dueños:
-- "poder ponerlas como ocultas desde el portal de admin y yo manualmente elegir
-- quiénes sí pueden tener acceso… únicamente ellos verían esa sesión dentro del
-- curso. Posteriormente puedo guardarlo y regresar a modificar, agregar o
-- quitar a cualquier integrante en cualquier momento". Sus decisiones:
--   - Quien no está en la lista la ve CON CANDADO: sabe que existe, no la abre.
--   - Solo se elige entre los ya inscritos en la generación del módulo.
--   - La lista la manejan admin y community manager.
--
-- CÓMO
--   - `modules.is_restricted`: el módulo es exclusivo.
--   - `module_members`: quién entra. Una fila por persona; quitarla quita el
--     acceso al instante.
--   - `ve_modulo()` —de la que cuelgan lecciones, video, adjuntos, quizzes,
--     tareas, avance y comentarios (diez políticas)— exige además estar en la
--     lista. Con eso la protección es una sola y vive en la base.
--   - La ESTRUCTURA sigue visible para todo inscrito (`modules_select_inscrito`
--     no cambia): el título del módulo es lo que se pinta con candado.
--   - `lesson_outline` suma `exclusiva` y `para_mi`, y `desbloqueada` ya exige
--     `para_mi`: el avance y el certificado de quien no está en la lista no
--     cuentan lecciones que no puede ver.
--   - El community manager puede marcar un módulo como exclusivo, pero no
--     editarlo: `modules_update_admin` pasa a «equipo» con un trigger que, para
--     el CM, solo deja cambiar `is_restricted` (mismo patrón que la grabación
--     en `lessons_solo_grabacion`, 0036).

-- ==========================================================================
-- 1. Datos
-- ==========================================================================

alter table academia.modules
  add column is_restricted boolean not null default false;

create table academia.module_members (
  module_id uuid not null references academia.modules (id) on delete cascade,
  user_id uuid not null references academia.profiles (user_id) on delete cascade,
  added_by uuid references academia.profiles (user_id) on delete set null,
  added_at timestamptz not null default now(),
  -- Cuándo se le avisó por correo; null = no se le avisó.
  notified_at timestamptz,
  primary key (module_id, user_id)
);

create index module_members_user_idx on academia.module_members (user_id);

alter table academia.module_members enable row level security;

grant select, insert, update, delete on academia.module_members to authenticated;
grant all on academia.module_members to service_role;

-- El alumno lee solo su propia fila (para saber que entra); el equipo, todas.
create policy module_members_select on academia.module_members
  for select to authenticated
  using ((select academia.is_equipo()) or user_id = (select auth.uid()));

create policy module_members_insert_equipo on academia.module_members
  for insert to authenticated
  with check ((select academia.is_equipo()));

create policy module_members_update_equipo on academia.module_members
  for update to authenticated
  using ((select academia.is_equipo())) with check ((select academia.is_equipo()));

create policy module_members_delete_equipo on academia.module_members
  for delete to authenticated
  using ((select academia.is_equipo()));

-- Solo entra a la lista quien está inscrito en la generación del módulo
-- (o en el curso, si no es por generaciones). Lo valida la acción del panel;
-- esto es para que ningún otro camino lo salte.
create or replace function academia.academia_miembro_inscrito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from academia.modules m
      join academia.courses c on c.id = m.course_id
      join academia.enrollments e on e.course_id = m.course_id and e.user_id = new.user_id
     where m.id = new.module_id
       and case when c.course_type = 'cohort'
                then e.cohort_id is not distinct from m.cohort_id
                else true
           end
  ) then
    raise exception 'Solo entra a la lista quien está inscrito en la generación de la sesión.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger module_members_inscrito
  before insert or update on academia.module_members
  for each row execute function academia.academia_miembro_inscrito();

-- ==========================================================================
-- 2. Quién ve el contenido: también la lista
-- ==========================================================================

create or replace function academia.ve_modulo(p_module_id uuid, p_exige_vigencia boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.inscrito_en_generacion(m.course_id, m.cohort_id, p_exige_vigencia)
         and (
           not m.is_restricted
           or exists (
             select 1
               from academia.module_members mm
              where mm.module_id = m.id
                and mm.user_id = (select auth.uid())
           )
         )
    from academia.modules m
   where m.id = p_module_id
$$;

-- ==========================================================================
-- 3. El temario: candado y avance
-- ==========================================================================
-- Mismas columnas y mismo orden; `exclusiva` y `para_mi` van al final, que es
-- lo único que `create or replace view` permite.

create or replace view academia.lesson_outline with (security_invoker = false) as
select l.id,
    l.module_id,
    m.course_id,
    l.title,
    l."position",
    l.lesson_type,
    l.is_required,
    l.bunny_video_id is not null as tiene_video,
    l.video_duration_sec,
    (exists (
      select 1
        from academia.enrollments x
        join academia.courses c on c.id = x.course_id
       where x.user_id = (select auth.uid())
         and x.status = 'active'
         and (x.expires_at is null or x.expires_at > now())
         and x.course_id = m.course_id
         and case when c.course_type = 'cohort' then x.cohort_id = m.cohort_id
                  else m.cohort_id is null
             end
    ) and (
      not m.is_restricted
      or exists (select 1 from academia.module_members mm
                  where mm.module_id = m.id and mm.user_id = (select auth.uid()))
    )) as desbloqueada,
    m.cohort_id,
    m.is_restricted as exclusiva,
    ((select academia.is_equipo())
      or not m.is_restricted
      or exists (select 1 from academia.module_members mm
                  where mm.module_id = m.id and mm.user_id = (select auth.uid()))) as para_mi
  from academia.lessons l
  join academia.modules m on m.id = l.module_id
 where l.status = 'published'
   and ((select academia.is_equipo()) or exists (
     select 1
       from academia.enrollments x
       join academia.courses c on c.id = x.course_id
      where x.user_id = (select auth.uid())
        and x.status = 'active'
        and x.course_id = m.course_id
        and case when c.course_type = 'cohort' then x.cohort_id = m.cohort_id
                 else m.cohort_id is null
            end
   ));

-- ==========================================================================
-- 4. El community manager marca exclusiva, no edita el módulo
-- ==========================================================================

alter policy "modules_update_admin" on academia.modules
  using ((select academia.is_equipo()))
  with check ((select academia.is_equipo()));

create or replace function academia.academia_modulo_solo_exclusiva()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if academia.es_servicio() or academia.is_admin() then
    return new;
  end if;

  -- Solo el equipo llega aquí (modules_update_admin): quien no es admin es
  -- un community manager.
  if (to_jsonb(new) - array['is_restricted', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['is_restricted', 'updated_at']) then
    raise exception 'De un módulo, el community manager solo cambia si es exclusivo.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger modules_solo_exclusiva
  before update on academia.modules
  for each row execute function academia.academia_modulo_solo_exclusiva();

revoke all on function academia.academia_miembro_inscrito() from public;
revoke all on function academia.academia_modulo_solo_exclusiva() from public;
grant execute on function academia.academia_miembro_inscrito() to authenticated, service_role;
grant execute on function academia.academia_modulo_solo_exclusiva() to authenticated, service_role;
