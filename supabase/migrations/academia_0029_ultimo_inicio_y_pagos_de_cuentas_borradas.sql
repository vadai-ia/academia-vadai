-- academia_0029_ultimo_inicio_y_pagos_de_cuentas_borradas.sql
-- (a) El último inicio de sesión, espejado en el perfil.
-- (b) Una marca en los pagos cuya cuenta se eliminó.
--
-- POR QUÉ
-- 21-sep-2026, M14 Fase 1. "¿Ya entró?" es la pregunta del panel la mañana de
-- un lanzamiento, y hasta hoy se contestaba barriendo la Admin API de Auth con
-- service role: hasta 20 llamadas, DOS veces por cada carga de /admin/alumnos.
-- Con la columna en el perfil, "nunca ha entrado" es un filtro de Postgres:
-- se pagina, se ordena y no necesita service role para leerse.
--
-- La escribe la app en los cuatro puntos donde nace una sesión
-- (lib/auth/inicio-de-sesion.ts). NO es un trigger sobre auth.users: la Regla
-- Cero lo prohíbe. El respaldo inicial de abajo LEE auth.users una sola vez;
-- leer no crea ni altera nada ahí.
--
-- Y los pagos: al eliminar una cuenta de verdad, la FK deja payments.user_id
-- en null. Sin una marca, ese pago aparecería en /admin/alumnos como "pago sin
-- cuenta", que significa otra cosa (un webhook que no terminó el alta).

alter table academia.profiles
  add column last_sign_in_at timestamptz;

comment on column academia.profiles.last_sign_in_at is
  'Último inicio de sesión, escrito por la app al abrir sesión (contraseña, liga de 30 días, enlace de correo, Google). Null = nunca ha entrado. Espejo de auth.users.last_sign_in_at para filtrar y paginar sin la Admin API.';

create index profiles_last_sign_in_idx
  on academia.profiles (last_sign_in_at);

-- Respaldo inicial: lo que Auth ya sabe de cada cuenta existente.
update academia.profiles p
   set last_sign_in_at = u.last_sign_in_at
  from auth.users u
 where u.id = p.user_id
   and u.last_sign_in_at is not null;

alter table academia.payments
  add column account_deleted_at timestamptz;

comment on column academia.payments.account_deleted_at is
  'La cuenta dueña del pago se eliminó ese día. user_id queda null por la FK (on delete set null); esta marca evita que el pago se reporte como "pago sin cuenta" en /admin/alumnos.';
