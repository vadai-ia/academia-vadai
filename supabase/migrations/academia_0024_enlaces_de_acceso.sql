-- academia_0024_enlaces_de_acceso.sql
-- Enlaces de acceso que valen 30 días y no se gastan con una previsualización.
--
-- POR QUÉ
-- El correo de bienvenida llevaba un enlace de `recovery` de Supabase. Ese
-- token dura lo que diga "Email OTP expiration" en el dashboard —una hora por
-- default, un día como máximo— y es de UN solo uso. La víspera del lanzamiento
-- (20-sep-2026) 75 de 106 alumnos no habían entrado nunca, y sus correos
-- tenían dos días: todas esas ligas estaban muertas. Y hay algo peor que la
-- caducidad: los escáneres de enlaces de Outlook y de Gmail hacen GET a cada
-- liga antes de que la persona la vea, y un GET a /auth/confirmar consumía el
-- token. La persona daba clic sobre un enlace que su propio antivirus ya había
-- gastado.
--
-- QUÉ CAMBIA
-- El correo lleva ahora una liga NUESTRA: /acceso/<token>. El token es
-- aleatorio de 256 bits y aquí se guarda solo su sha256, como una contraseña.
-- La página de /acceso muestra un botón, y es el POST del botón el que pide a
-- Supabase un token de recovery fresco y lo canjea. Un GET nunca gasta nada,
-- así que los escáneres no pueden romperla, y la liga vale 30 días. No es de
-- un solo uso: quien la abre dos veces entra dos veces, como con cualquier
-- liga mágica.
--
-- SEGURIDAD
-- Otorga exactamente lo que otorgaba el correo de recuperación: quien tiene el
-- buzón, entra. Sigue sin haber sign-up público: la fila solo la crea el
-- servidor con service role para una cuenta que ya existe, y nadie la escribe
-- desde el cliente. El equipo sí la LEE, para ver en el panel cuándo se mandó
-- el último acceso a cada persona.

create table academia.access_links (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references academia.profiles (user_id) on delete cascade,
  -- sha256 en hex del token que va en la URL. El token mismo no se guarda.
  token_hash    text not null unique,
  expires_at    timestamptz not null,
  used_count    integer not null default 0,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_by    uuid references academia.profiles (user_id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table academia.access_links is
  'Enlace de acceso de 30 días que va en el correo de bienvenida. Guarda el hash del token; canjearlo genera un recovery de Supabase fresco en el momento del clic.';

create index access_links_usuario_idx
  on academia.access_links (user_id, created_at desc);

alter table academia.access_links enable row level security;

-- Solo lectura, y solo para el equipo. Crear y canjear van por service role.
create policy access_links_lee_equipo on academia.access_links
  for select to authenticated using (academia.is_admin());
