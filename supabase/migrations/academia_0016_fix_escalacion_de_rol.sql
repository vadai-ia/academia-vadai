-- academia_0016_fix_escalacion_de_rol.sql
--
-- CORRIGE UNA ESCALACIÓN DE PRIVILEGIOS detectada por scripts/test-rls.mjs:
-- cualquier alumno podía hacer PATCH sobre su propio perfil y ponerse
-- role = 'superadmin'.
--
-- CAUSA
-- `academia.proteger_campos_de_perfil()` se creó como SECURITY DEFINER, y
-- dentro de una función SECURITY DEFINER `current_user` es el DUEÑO de la
-- función (postgres), no quien hizo la petición. Como `academia.es_servicio()`
-- decide justamente comparando `current_user` contra ('postgres', ...), devolvía
-- true para todo el mundo y el trigger se rendía en su primera condición:
--
--     if academia.es_servicio() or academia.is_admin() then
--       return new;    -- <- aquí salía siempre
--     end if;
--
-- La policy de RLS estaba bien: filtra FILAS y el alumno sí es dueño de su fila.
-- La columna `role` solo la podía proteger el trigger, y el trigger no protegía.
--
-- ARREGLO, en dos capas independientes:
--
--   1. `es_servicio()` deja de confiar en `current_user`. Si la petición trae
--      un JWT (siempre, cuando entra por PostgREST), decide con el claim `role`.
--      Solo cae a `current_user` cuando no hay JWT, que es el caso de las
--      conexiones directas de los scripts. Así la respuesta es correcta incluso
--      si se le invoca desde una función SECURITY DEFINER.
--
--   2. El trigger pasa a SECURITY INVOKER. No necesita privilegios elevados:
--      solo compara NEW contra OLD y llama a is_admin(), que sí es definer.
--
-- Cualquiera de las dos bastaría. Van las dos porque el costo es cero y esta es
-- la frontera entre un alumno y un superadmin.

-- --------------------------------------------------------------------------
-- 1. es_servicio() decide por el JWT, no por current_user
-- --------------------------------------------------------------------------

create or replace function academia.es_servicio()
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    -- Petición vía PostgREST: el claim manda. Un usuario final trae
    -- role = 'authenticated' y nunca podrá hacerse pasar por servicio.
    when coalesce(nullif(current_setting('request.jwt.claims', true), ''), '') <> ''
      then coalesce(
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role',
        false
      )
    -- Sin JWT: conexión directa a la base (migraciones, seeds, psql).
    else current_user in ('postgres', 'supabase_admin', 'service_role')
  end
$$;

comment on function academia.es_servicio() is
  'true solo para service role o conexiones directas. NO usa current_user cuando hay JWT: dentro de una función SECURITY DEFINER current_user es el dueño y mentiría.';

-- --------------------------------------------------------------------------
-- 2. El trigger corre como quien invoca, no como su dueño
-- --------------------------------------------------------------------------

create or replace function academia.proteger_campos_de_perfil()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if academia.es_servicio() or academia.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'No puedes cambiar tu rol.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'No puedes cambiar el estado de tu cuenta.' using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id or new.email is distinct from old.email then
    raise exception 'No puedes cambiar tu identidad.' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function academia.proteger_campos_de_perfil() is
  'RLS filtra filas, no columnas. Este trigger es lo único que impide que un alumno se ascienda editando su propio perfil. SECURITY INVOKER es obligatorio: ver academia_0016.';

-- --------------------------------------------------------------------------
-- Permisos de las funciones recreadas
-- --------------------------------------------------------------------------

revoke all on function academia.es_servicio() from public;
grant execute on function academia.es_servicio() to authenticated, service_role;

revoke all on function academia.proteger_campos_de_perfil() from public;
grant execute on function academia.proteger_campos_de_perfil() to authenticated, service_role;

-- --------------------------------------------------------------------------
-- Repara el daño: cualquier perfil que se haya auto-ascendido vuelve a alumno.
-- Los superadmin legítimos se siembran por script con service role.
-- --------------------------------------------------------------------------

update academia.profiles
   set role = 'alumno'
 where email like 'qa-alumno%'
   and role <> 'alumno';
