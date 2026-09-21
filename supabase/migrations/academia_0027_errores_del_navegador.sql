-- academia_0027_errores_del_navegador.sql
-- Los errores que pasan en el navegador de la gente, guardados donde se
-- puedan leer.
--
-- POR QUÉ
-- 21-sep-2026, día del lanzamiento: alumnos con "Algo falló al cargar la
-- página" al crear su contraseña, cuatro veces seguidas. La pantalla de error
-- ya reportaba el mensaje a /api/errores, pero solo al log de Vercel, y ese
-- log no se puede leer desde aquí sin el CLI ni un token. Un error que no se
-- puede leer no se puede arreglar. Ahora también queda en esta tabla.
--
-- Solo escribe el servidor (service role, desde el route handler) y solo lee
-- el equipo. No tiene relación con perfiles: el error puede ocurrir antes de
-- entrar, y el reporte no lleva identidad.

create table academia.client_errors (
  id          uuid primary key default gen_random_uuid(),
  mensaje     text,
  pila        text,
  ruta        text,
  digest      text,
  navegador   text,
  created_at  timestamptz not null default now()
);

comment on table academia.client_errors is
  'Errores reportados por app/error.tsx desde el navegador. Se leen para depurar; se pueden borrar cuando estorben.';

create index client_errors_recientes_idx on academia.client_errors (created_at desc);

alter table academia.client_errors enable row level security;

create policy client_errors_lee_equipo on academia.client_errors
  for select to authenticated using (academia.is_admin());
create policy client_errors_borra_equipo on academia.client_errors
  for delete to authenticated using (academia.is_admin());

grant select, insert, delete on academia.client_errors to authenticated, service_role;
