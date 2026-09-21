-- academia_0026_empresas.sql
-- La empresa de cada alumno.
--
-- POR QUÉ
-- Los alumnos llegan por empresa —Innovaglass manda a doce, Aztlán a trece— y
-- Alejandro quiere verlos, puntuarlos y, más adelante, correr dinámicas por
-- empresa: las encuestas en vivo pero segmentadas por quién es de dónde. Quien
-- no viene de ninguna es "General": su dinámica es personal. Eso pide una
-- tabla de empresas que el admin da de alta ANTES y elige después, no un texto
-- libre que cada quien escribe distinto ("Aztlán", "Grupo Aztlan", "aztlan").
--
-- QUÉ
-- `companies` con el nombre único sin distinguir mayúsculas ni acentos de
-- espacio, y `profiles.company_id` opcional (null = General). Si se borra la
-- empresa, sus alumnos quedan en General, no se borran.
--
-- QUIÉN
-- Todo miembro puede LEER las empresas (un alumno verá la suya y las de su
-- ranking cuando haya dinámicas). Solo el equipo las crea, renombra y borra,
-- y solo el equipo cambia la empresa de un alumno: el trigger de perfil ya
-- protege rol, estado e identidad, y ahora también la empresa.

create table academia.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint companies_name_no_vacio check (length(trim(name)) > 0)
);

comment on table academia.companies is
  'Empresas de las que vienen los alumnos. Null en profiles.company_id = "General" (sin empresa).';

create unique index companies_name_unico on academia.companies (lower(trim(name)));

create trigger companies_updated_at
  before update on academia.companies
  for each row execute function academia.set_updated_at();

alter table academia.profiles
  add column company_id uuid references academia.companies (id) on delete set null;

create index profiles_company_idx
  on academia.profiles (company_id) where company_id is not null;

alter table academia.companies enable row level security;

create policy companies_select_miembros on academia.companies
  for select to authenticated using (academia.current_role() is not null);
create policy companies_insert_admin on academia.companies
  for insert to authenticated with check (academia.is_admin());
create policy companies_update_admin on academia.companies
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy companies_delete_admin on academia.companies
  for delete to authenticated using (academia.is_admin());

grant select, insert, update, delete on academia.companies to authenticated, service_role;

-- La empresa la pone el equipo, no la persona: se suma a lo que el trigger ya
-- protegía. Misma función, un `if` más.
create or replace function academia.proteger_campos_de_perfil()
  returns trigger
  language plpgsql
  set search_path to ''
as $function$
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

  if new.company_id is distinct from old.company_id then
    raise exception 'La empresa la asigna el equipo.' using errcode = '42501';
  end if;

  return new;
end;
$function$;
