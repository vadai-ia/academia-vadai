-- academia_0039_diplomas.sql
-- Quién abrió y quién descargó su diploma de generación (VADAI · Total Coach).
--
-- POR QUÉ
-- Alejandro (15-oct-2026), la noche en que se publicaron los diplomas de la
-- Generación 1: «¿Puedo revisar en el panel de admin quién ya lo abrió y quién
-- ya lo descargó? Eso por generación, para tener ese control de certificados y
-- poder buscar personas o certificados individuales en caso de que lo pidan».
--
-- CÓMO
--   - El diploma no tiene tabla (quién lo tiene sale de `enrollments`, el folio
--     se calcula; ver lib/diplomas/). Esto guarda solo lo que la persona HIZO:
--     una fila por persona y programa, con la primera y la última vez que lo
--     abrió y lo descargó, y cuántas veces.
--   - Lo escribe la propia persona, por una función: así nadie marca a otro,
--     el contador sube sin carreras y no hay política de escritura abierta.
--   - Lo lee la persona (lo suyo) y el equipo, community manager incluido: un
--     diploma no es un pago.
--   - «Descargado» es el clic en «Descargar en PDF»: el navegador no avisa si
--     al final guardó el archivo.

create table academia.diploma_events (
  user_id             uuid not null references academia.profiles (user_id) on delete cascade,
  -- La clave del programa (lib/diplomas/programas.ts), la misma del folio.
  clave               text not null check (clave ~ '^[A-Z0-9]{2,12}$'),
  abierto_primero     timestamptz,
  abierto_ultimo      timestamptz,
  aperturas           integer not null default 0,
  descargado_primero  timestamptz,
  descargado_ultimo   timestamptz,
  descargas           integer not null default 0,
  primary key (user_id, clave)
);

create index diploma_events_clave_idx on academia.diploma_events (clave);

alter table academia.diploma_events enable row level security;

create policy diploma_events_select on academia.diploma_events
  for select to authenticated
  using (user_id = (select auth.uid()) or (select academia.is_equipo()));

-- La única forma de escribir: cada quien marca lo suyo.
create or replace function academia.academia_marcar_diploma(p_clave text, p_evento text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
begin
  if v_usuario is null then
    raise exception 'Sin sesión.' using errcode = '42501';
  end if;
  if p_evento not in ('abierto', 'descargado') then
    raise exception 'Evento desconocido.' using errcode = '22023';
  end if;

  insert into academia.diploma_events as d (user_id, clave,
      abierto_primero, abierto_ultimo, aperturas,
      descargado_primero, descargado_ultimo, descargas)
  values (v_usuario, p_clave,
      case when p_evento = 'abierto' then now() end,
      case when p_evento = 'abierto' then now() end,
      case when p_evento = 'abierto' then 1 else 0 end,
      case when p_evento = 'descargado' then now() end,
      case when p_evento = 'descargado' then now() end,
      case when p_evento = 'descargado' then 1 else 0 end)
  on conflict (user_id, clave) do update set
    abierto_primero    = coalesce(d.abierto_primero, excluded.abierto_primero),
    abierto_ultimo     = coalesce(excluded.abierto_ultimo, d.abierto_ultimo),
    aperturas          = d.aperturas + excluded.aperturas,
    descargado_primero = coalesce(d.descargado_primero, excluded.descargado_primero),
    descargado_ultimo  = coalesce(excluded.descargado_ultimo, d.descargado_ultimo),
    descargas          = d.descargas + excluded.descargas;
end;
$$;

revoke all on function academia.academia_marcar_diploma(text, text) from public;
grant execute on function academia.academia_marcar_diploma(text, text) to authenticated, service_role;
