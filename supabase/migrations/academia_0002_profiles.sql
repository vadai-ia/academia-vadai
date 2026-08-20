-- academia_0002_profiles.sql
-- Perfiles: la pertenencia a la academia.
--
-- `auth.users` es compartido por diseño. Estar autenticado NO significa
-- pertenecer a la academia: la pertenencia la da EXISTIR en esta tabla.
-- El middleware rechaza a cualquier usuario autenticado sin fila aquí.
--
-- La FK a auth.users es la que manda el master document (§4). No altera
-- auth.users: solo agrega una restricción sobre nuestra propia tabla.

create table academia.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,

  -- Denormalizado a propósito: el webhook de Stripe resuelve al usuario por
  -- correo (§3.1-B) y el admin lista alumnos por correo. PostgREST no puede
  -- hacer join con auth.users desde el schema academia.
  email       text not null unique,

  full_name   text not null default '',
  avatar_url  text,

  role        text not null default 'alumno'
              check (role in ('superadmin', 'admin', 'alumno')),

  status      text not null default 'active'
              check (status in ('active', 'suspended')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on academia.profiles
  for each row execute function academia.set_updated_at();

-- Los helpers de RLS consultan por rol en cada policy.
create index profiles_role_idx on academia.profiles (role);
create index profiles_email_idx on academia.profiles (lower(email));

comment on table academia.profiles is
  'Pertenencia a la academia. Sin fila aquí, un usuario autenticado no tiene acceso a nada.';
