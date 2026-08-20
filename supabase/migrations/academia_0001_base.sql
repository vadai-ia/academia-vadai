-- academia_0001_base.sql
-- Fundamentos del schema: creación, permisos y utilidades compartidas.
--
-- Nota sobre nombres: CLAUDE.md pide prefijo `academia_` en funciones y triggers.
-- Dentro del schema `academia` ese prefijo sería redundante (`academia.academia_x`)
-- y el propio master document escribe el helper como `academia.current_role()`.
-- Criterio adoptado: la calificación por schema ES el namespacing dentro de
-- `academia`; el prefijo `academia_` se reserva para lo que vive FUERA del
-- schema, donde sí puede colisionar con otros sistemas: los nombres de archivo
-- de migración y las policies sobre `storage.*`.

create schema if not exists academia;

grant usage on schema academia to anon, authenticated, service_role;

-- Privilegios a nivel tabla. Lo que de verdad restringe es RLS: cada tabla lleva
-- sus policies explícitas. Estos grants solo abren la puerta para que PostgREST
-- pueda intentar la query.
--
-- `anon` queda fuera a propósito: en el MVP no existe ninguna tabla de lectura
-- pública, ni siquiera el catálogo de cursos. La verificación pública de
-- certificados por folio se resuelve server-side con service role (§4).
alter default privileges in schema academia
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema academia
  grant all on tables to service_role;

alter default privileges in schema academia
  grant usage, select on sequences to authenticated, service_role;

-- Mantiene updated_at sin que la app tenga que acordarse.
create or replace function academia.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function academia.set_updated_at() is
  'Trigger BEFORE UPDATE: refresca updated_at. Se aplica en todas las tablas del schema.';
