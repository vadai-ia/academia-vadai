-- ============================================================================
-- academia_0047_correos_de_acceso.sql — M25: cada alta manda su acceso, y queda escrito
--
-- Pedido de Alejandro (20-oct-2026), con la Generación 2 a punto de llenarse:
--   «aseguremos que siempre mande el correo cuando yo cree nuevos alumnos ya
--   sea individuales o de forma masiva… que todos reciban sus accesos», y que
--   el recordatorio a quien no ha entrado «solo lo mande a los de cursos o
--   generaciones activas».
--
-- Hasta hoy un correo que fallaba solo quedaba en el log del servidor: nadie
-- en el panel sabía a quién no le había llegado. Y el recordatorio le escribía
-- a todo alumno que nunca entró, aunque su generación hubiera terminado.
--
--   1. `access_emails`: una fila por correo de acceso (bienvenida, recordatorio,
--      curso nuevo, nueva generación) con su estado. La escribe solo el
--      servidor; el equipo la lee para ver y reenviar lo que falló.
--   2. `academia_por_activar(p_qa)`: quién recibe el recordatorio. Nunca entró
--      y tiene un curso o generación ACTIVA: en curso, por empezar, o V-AI-P
--      vigente. El curso base solo no cuenta; una generación terminada tampoco.
--   3. `academia_correos_por_reintentar(p_qa)`: a quién no le salió su último
--      correo de acceso.
--   4. `academia_purgar_correos()`: la bitácora no crece para siempre.
--
-- `p_qa` separa los dos mundos de la base de producción: un admin real nunca
-- ve cuentas `qa-*`, y el admin QA de las suites solo ve esas (el mismo patrón
-- que `es_qa` del agente). Solo schema `academia`. La aplica Alejandro con
-- `pnpm db:migrate`.
-- ============================================================================

-- ==========================================================================
-- 1. La bitácora
-- ==========================================================================

create table academia.access_emails (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references academia.profiles (user_id) on delete cascade,
  -- La dirección a la que salió en ese momento: el correo de la cuenta puede
  -- cambiar después, y la bitácora tiene que decir a dónde fue.
  email           text not null check (char_length(email) between 3 and 320),
  tipo            text not null
                    check (tipo in ('bienvenida', 'recordatorio', 'nuevo_curso', 'nueva_generacion')),
  origen          text not null
                    check (origen in (
                      'alta_manual', 'alta_masiva', 'curso', 'ficha', 'stripe', 'membresia',
                      'encuesta', 'equipo', 'recordatorio', 'reenvio', 'reenvio_fallidos',
                      'cambio_correo', 'cambio_generacion'
                    )),
  con_enlace      boolean not null default false,
  access_link_id  uuid references academia.access_links (id) on delete set null,
  course_ids      uuid[] not null default '{}',
  cohort_id       uuid references academia.cohorts (id) on delete set null,
  -- pendiente: se escribió antes de intentar; si se queda así, el envío no
  -- terminó (un timeout) y cuenta como fallido. omitido: no se manda a
  -- propósito (cuenta QA, buzón del equipo sin correo).
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'enviado', 'fallido', 'omitido')),
  motivo          text check (motivo is null or char_length(motivo) <= 500),
  resend_id       text check (resend_id is null or char_length(resend_id) <= 200),
  -- Lo que salió de un mismo clic (un Excel, un «Reenviar a los N»).
  lote_id         uuid,
  es_qa           boolean not null default false,
  creado_por      uuid references academia.profiles (user_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table academia.access_emails is
  'Cada correo de acceso que mandó la academia (bienvenida, recordatorio, curso nuevo, nueva generación) y si salió. Nunca guarda el cuerpo del correo. La escribe el servidor; el equipo la lee.';

create index access_emails_usuario_idx
  on academia.access_emails (user_id, created_at desc);

create index access_emails_por_reintentar_idx
  on academia.access_emails (es_qa, created_at desc)
  where estado in ('fallido', 'pendiente');

create trigger access_emails_updated_at
  before update on academia.access_emails
  for each row execute function academia.set_updated_at();

alter table academia.access_emails enable row level security;

-- Solo lectura, y para todo el equipo: el community manager atiende a los
-- alumnos (menos alta y eliminar) y ya reenvía accesos. Escribir va por
-- service role, como en `access_links`.
create policy access_emails_lee_equipo on academia.access_emails
  for select to authenticated using ((select academia.is_equipo()));

-- ==========================================================================
-- 2. Quién recibe el recordatorio
-- ==========================================================================

-- Una persona entra si nunca ha abierto sesión y tiene al menos una
-- inscripción vigente en un curso que todavía se está dando:
--   - inscripción activa y sin vencer;
--   - curso publicado y que NO es base (el curso base lo tiene todo el mundo:
--     tenerlo no es razón para insistirle a nadie);
--   - si va por generación, que la generación no haya terminado (`ends_on`
--     nula o de hoy en adelante, en la Ciudad de México): entran la que está
--     en curso, la que no ha empezado y «Miembros» de V-AI-P, que no termina;
--   - si no va por generación, que el curso tampoco sea por generaciones.
-- `cursos` trae TODOS sus cursos vigentes (base incluido), en el orden en que
-- los recibió, para que el correo los nombre como la bienvenida original.
create or replace function academia.academia_por_activar(p_qa boolean default false)
returns table (
  user_id        uuid,
  email          text,
  full_name      text,
  cursos         text[],
  ultimo_enlace  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoy as (
    select (now() at time zone 'America/Mexico_City')::date as d
  ),
  candidatos as (
    select p.user_id, p.email, p.full_name, p.created_at
    from academia.profiles p
    where (select academia.is_equipo())
      and p.role = 'alumno'
      and p.status = 'active'
      and p.last_sign_in_at is null
      and not p.es_bot
      and (p.email ~* '^qa-.*@academia\.vadai\.com\.mx$') = p_qa
      and exists (
        select 1
        from academia.enrollments e
        join academia.courses c on c.id = e.course_id
        left join academia.cohorts h on h.id = e.cohort_id
        where e.user_id = p.user_id
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
          and c.status = 'published'
          and not c.is_default
          and (p_qa or c.slug not like 'qa-%')
          and (
            (e.cohort_id is null and c.course_type <> 'cohort')
            or (e.cohort_id is not null and (h.ends_on is null or h.ends_on >= (select d from hoy)))
          )
      )
  )
  select
    k.user_id,
    k.email,
    k.full_name,
    coalesce((
      select array_agg(t.title order by t.desde)
      from (
        select c.title, min(e.created_at) as desde
        from academia.enrollments e
        join academia.courses c on c.id = e.course_id
        where e.user_id = k.user_id
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
          and c.status = 'published'
          and (p_qa or c.slug not like 'qa-%')
        group by c.title
      ) t
    ), '{}'::text[]) as cursos,
    (select max(l.created_at) from academia.access_links l where l.user_id = k.user_id) as ultimo_enlace
  from candidatos k
  order by k.created_at;
$$;

comment on function academia.academia_por_activar(boolean) is
  'Alumnos que nunca entraron y tienen un curso o generación activa (en curso, por empezar o V-AI-P vigente). Sin curso base solo ni generaciones terminadas. p_qa: solo cuentas qa-* (las suites) o solo reales.';

revoke all on function academia.academia_por_activar(boolean) from public, anon;
grant execute on function academia.academia_por_activar(boolean) to authenticated, service_role;

-- ==========================================================================
-- 3. A quién no le salió su último correo de acceso
-- ==========================================================================

-- El ÚLTIMO correo de acceso de cada persona, si falló o se quedó pendiente
-- más de 15 minutos (el envío no terminó). Si después salió otro, ya no
-- cuenta; si la persona ya entró después de la falla, tampoco: ya tiene lo que
-- el correo le iba a dar.
create or replace function academia.academia_correos_por_reintentar(p_qa boolean default false)
returns table (
  id          uuid,
  user_id     uuid,
  email       text,
  full_name   text,
  tipo        text,
  origen      text,
  course_ids  uuid[],
  cohort_id   uuid,
  motivo      text,
  created_at  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ultimos as (
    select distinct on (a.user_id) a.*
    from academia.access_emails a
    where (select academia.is_equipo())
      and a.es_qa = p_qa
    order by a.user_id, a.created_at desc
  )
  select u.id, u.user_id, p.email, p.full_name, u.tipo, u.origen, u.course_ids, u.cohort_id, u.motivo, u.created_at
  from ultimos u
  join academia.profiles p on p.user_id = u.user_id
  where (u.estado = 'fallido' or (u.estado = 'pendiente' and u.created_at < now() - interval '15 minutes'))
    and (p.last_sign_in_at is null or p.last_sign_in_at < u.created_at)
    and p.status = 'active'
    and p.role <> 'invitado'
  order by u.created_at;
$$;

comment on function academia.academia_correos_por_reintentar(boolean) is
  'El último correo de acceso de cada persona cuando falló (o se quedó pendiente más de 15 min) y no ha entrado desde entonces. Es la lista de «Reenviar a los N».';

revoke all on function academia.academia_correos_por_reintentar(boolean) from public, anon;
grant execute on function academia.academia_correos_por_reintentar(boolean) to authenticated, service_role;

-- ==========================================================================
-- 4. La bitácora no crece para siempre
-- ==========================================================================

-- Las filas de las pruebas, a los 7 días; las reales, a los 24 meses. Al
-- borrar una cuenta, las suyas se van en cascada. La llama el cron diario.
create or replace function academia.academia_purgar_correos()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with borradas as (
    delete from academia.access_emails
    where (es_qa and created_at < now() - interval '7 days')
       or created_at < now() - interval '24 months'
    returning 1
  )
  select count(*)::integer from borradas;
$$;

revoke all on function academia.academia_purgar_correos() from public, anon, authenticated;
grant execute on function academia.academia_purgar_correos() to service_role;
