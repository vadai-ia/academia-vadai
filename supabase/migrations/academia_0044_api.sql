-- academia_0044_api.sql
-- M20: la API de la academia, para automatizar noticias, eventos y seguimiento.
--
-- POR QUÉ
-- Alejandro (16-oct-2026): «completamente apificado» para mandar eventos y
-- noticias a otras plataformas y automatizar la comunidad (noticias diarias
-- con Claude, seguimiento).
--
-- QUÉ CAMBIA
--   1. `api_keys`: una llave por integración. En la base nunca va la llave:
--      va su id público y el HMAC del secreto con un pepper que vive solo en
--      el servidor (API_KEYS_PEPPER). Permisos por llave; `cobros:leer` exige
--      vencimiento a 90 días o menos.
--   2. `api_uso`: la cuota, una fila por llave y por hora, contada con un
--      upsert atómico (`academia_api_contar`).
--   3. `api_bitacora`: método, ruta, status y duración de cada llamada, sin
--      cuerpos ni datos personales. Se borra a los 30 días (cron).
--   4. `webhooks_salientes` y `webhook_entregas`: avisos firmados a otras
--      plataformas, con cola y reintentos. El secreto NO se guarda: se deriva
--      de WEBHOOKS_MASTER y del id (y su versión, para rotarlo).
--   5. `profiles.es_bot` y `community_posts/comments.via` + `api_key_id`: lo
--      que escribe la API (o, en M21, el agente) va a nombre del perfil
--      «Equipo VADAI», queda marcado y se sabe con qué llave.
--
-- Todo con RLS de admin; la API escribe con service role (cuarta excepción
-- de CLAUDE.md), y lo de varios pasos en funciones `academia_api_*` que solo
-- el service role puede ejecutar.

-- ==========================================================================
-- 1. Llaves
-- ==========================================================================

create table academia.api_keys (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (char_length(nombre) between 2 and 80),
  -- La parte pública de la llave (`vadai_<key_id>_<secreto>`), para encontrarla.
  key_id        text not null unique check (key_id ~ '^[a-z0-9]{12}$'),
  -- HMAC-SHA256(API_KEYS_PEPPER, secreto) en hex. Sin el pepper no sirve.
  hash          text not null check (hash ~ '^[0-9a-f]{64}$'),
  permisos      text[] not null default '{}'
                check (permisos <@ array['noticias:leer', 'noticias:escribir', 'eventos:leer', 'eventos:escribir',
                                         'comunidad:leer', 'comunidad:escribir', 'miembros:leer', 'miembros:pii',
                                         'metricas:leer', 'cobros:leer']::text[]),
  creada_por    uuid references academia.profiles (user_id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  -- Ver cobros es delicado: vence pronto o no existe.
  constraint api_keys_cobros_vencen check (
    not ('cobros:leer' = any (permisos))
    or (expires_at is not null and expires_at <= created_at + interval '90 days')
  )
);

alter table academia.api_keys enable row level security;

create policy api_keys_admin on academia.api_keys
  for all to authenticated
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

-- ==========================================================================
-- 2. Cuota
-- ==========================================================================

create table academia.api_uso (
  key_id  uuid not null references academia.api_keys (id) on delete cascade,
  hora    timestamptz not null,
  cuenta  integer not null default 0,
  primary key (key_id, hora)
);

alter table academia.api_uso enable row level security;

create policy api_uso_admin on academia.api_uso
  for select to authenticated
  using ((select academia.is_admin()));

-- Suma una llamada a la hora en curso y devuelve cuántas lleva. Atómica: dos
-- llamadas a la vez no se pisan.
create or replace function academia.academia_api_contar(p_key uuid)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  insert into academia.api_uso (key_id, hora, cuenta)
  values (p_key, date_trunc('hour', now()), 1)
  on conflict (key_id, hora) do update set cuenta = academia.api_uso.cuenta + 1
  returning cuenta;
$$;

revoke all on function academia.academia_api_contar(uuid) from public, anon, authenticated;
grant execute on function academia.academia_api_contar(uuid) to service_role;

-- ==========================================================================
-- 3. Bitácora
-- ==========================================================================

create table academia.api_bitacora (
  id           bigint generated always as identity primary key,
  key_id       uuid references academia.api_keys (id) on delete set null,
  metodo       text not null,
  ruta         text not null,
  status       integer not null,
  duracion_ms  integer not null,
  -- HMAC de la IP con el pepper: sirve para ver abusos, no identifica a nadie.
  ip_huella    text,
  created_at   timestamptz not null default now()
);

create index api_bitacora_fecha_idx on academia.api_bitacora (created_at);
create index api_bitacora_llave_idx on academia.api_bitacora (key_id, created_at desc);

alter table academia.api_bitacora enable row level security;

create policy api_bitacora_admin on academia.api_bitacora
  for select to authenticated
  using ((select academia.is_admin()));

-- ==========================================================================
-- 4. Webhooks salientes
-- ==========================================================================

create table academia.webhooks_salientes (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (char_length(nombre) between 2 and 80),
  url              text not null check (url ~ '^https://' and char_length(url) <= 500),
  eventos          text[] not null
                   check (cardinality(eventos) > 0
                          and eventos <@ array['noticia.publicada', 'miembro.entro', 'miembro.salio',
                                               'sesion.creada']::text[]),
  activo           boolean not null default true,
  -- Al rotar el secreto sube la versión; el secreto es HMAC(WEBHOOKS_MASTER, id:version).
  secreto_version  integer not null default 1,
  fallas_seguidas  integer not null default 0,
  creado_por       uuid references academia.profiles (user_id) on delete set null,
  created_at       timestamptz not null default now(),
  desactivado_en   timestamptz
);

alter table academia.webhooks_salientes enable row level security;

create policy webhooks_salientes_admin on academia.webhooks_salientes
  for all to authenticated
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

create table academia.webhook_entregas (
  id               uuid primary key default gen_random_uuid(),
  webhook_id       uuid not null references academia.webhooks_salientes (id) on delete cascade,
  -- El id del evento: el mismo en cada reintento, para que el receptor no lo procese dos veces.
  evento_id        text not null,
  tipo             text not null,
  datos            jsonb not null,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'entregada', 'fallida')),
  intentos         integer not null default 0,
  proximo_intento  timestamptz not null default now(),
  ultimo_error     text,
  created_at       timestamptz not null default now(),
  entregada_at     timestamptz,
  unique (webhook_id, evento_id)
);

create index webhook_entregas_pendientes_idx on academia.webhook_entregas (proximo_intento)
  where estado = 'pendiente';

alter table academia.webhook_entregas enable row level security;

create policy webhook_entregas_admin on academia.webhook_entregas
  for select to authenticated
  using ((select academia.is_admin()));

-- ==========================================================================
-- 5. Quién escribió: la API, el agente o una persona
-- ==========================================================================

-- La cuenta «Equipo VADAI» (un bot: no inicia sesión). Fuera de las listas del
-- equipo y de los alumnos.
alter table academia.profiles
  add column es_bot boolean not null default false;

alter table academia.community_posts
  add column via text not null default 'humano' check (via in ('humano', 'api', 'agente', 'agente_revisado')),
  add column api_key_id uuid references academia.api_keys (id) on delete set null;

alter table academia.community_comments
  add column via text not null default 'humano' check (via in ('humano', 'api', 'agente', 'agente_revisado')),
  add column api_key_id uuid references academia.api_keys (id) on delete set null;

-- Solo el servidor (`academia.es_servicio()`: service role o conexión directa)
-- escribe `via`, `api_key_id` y `es_bot`. Sin
-- esto, un alumno podría marcar su publicación como del agente y llevarse su
-- firma, o esconderse de las listas marcándose como bot. Con cualquier otro
-- rol, `via` queda en 'humano' y la llave en null, venga lo que venga.
create or replace function academia.academia_via_solo_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not academia.es_servicio() then
    new.via := 'humano';
    new.api_key_id := null;
  end if;
  return new;
end;
$$;

create trigger community_posts_via_solo_servidor
  before insert or update of via, api_key_id on academia.community_posts
  for each row execute function academia.academia_via_solo_servidor();

create trigger community_comments_via_solo_servidor
  before insert or update of via, api_key_id on academia.community_comments
  for each row execute function academia.academia_via_solo_servidor();

create or replace function academia.academia_bot_solo_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not academia.es_servicio() and new.es_bot is distinct from old.es_bot then
    raise exception 'Solo el servidor marca una cuenta como bot.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_bot_solo_servidor
  before update of es_bot on academia.profiles
  for each row execute function academia.academia_bot_solo_servidor();

revoke all on function academia.academia_via_solo_servidor() from public;
revoke all on function academia.academia_bot_solo_servidor() from public;
grant execute on function academia.academia_via_solo_servidor() to authenticated, service_role;
grant execute on function academia.academia_bot_solo_servidor() to authenticated, service_role;

-- ==========================================================================
-- 6. La actividad, también para el servidor
-- ==========================================================================

-- `actividad_por_curso` enseña la actividad del equipo (is_equipo) o de los
-- grupos de quien pregunta (auth.uid). La API corre con service role, sin
-- usuario: veía puntos en cero. Se le suma esa tercera condición sin reescribir
-- la vista a mano: se toma su definición vigente y se inserta la cláusula. Si
-- el texto esperado no está (alguien cambió la vista), la migración se detiene
-- en vez de seguir sin el cambio.
do $$
declare
  definicion text := pg_get_viewdef('academia.actividad_por_curso'::regclass, true);
  buscado text := '( SELECT academia.is_equipo() AS is_equipo) OR';
  nueva text;
begin
  if position(buscado in definicion) = 0 then
    raise exception 'actividad_por_curso cambió: no se encontró la cláusula de is_equipo.';
  end if;
  nueva := replace(definicion, buscado, buscado || ' (( SELECT auth.role() AS role) = ''service_role''::text) OR');
  execute 'create or replace view academia.actividad_por_curso with (security_invoker=false) as ' || nueva;
end;
$$;
