-- academia_0040_membresia.sql
-- VADAI V-AI-P: la membresía mensual de la academia (M17).
--
-- POR QUÉ
-- Alejandro (15-oct-2026): "una comunidad evergreen donde cada persona paga,
-- puede ver su suscripción y cancelarla y en esa comunidad voy a subir nuevos
-- cursos, clases, videos, anuncios… que puedan tener interacciones entre los
-- alumnos, ganar puntos, mostrar sus logros". Sus decisiones: $349 MXN al mes,
-- sin prueba; incluye solo lo que se suba a V-AI-P, no los cursos que se venden
-- aparte.
--
-- CÓMO
--   - V-AI-P es UN CURSO (`cohort`, una sola generación «Miembros» que no
--     cierra). Así el muro, el ranking, las sesiones en vivo, el .ics, los
--     anuncios y la bandeja del equipo funcionan sin tocarlos.
--   - `membership_plans`: el plan, con lo que el script de Stripe llena
--     (precio, Payment Link, portal). `courses.plan_id` marca qué cursos entran.
--   - `memberships`: una fila por SUSCRIPCIÓN de Stripe, no por persona. Una
--     persona que cancela y vuelve tiene dos filas; gana la de mayor acceso.
--   - El acceso son INSCRIPCIONES con `source = 'membresia'` que la app
--     sincroniza con `memberships.access_until`. Ninguna política ni vista
--     cambia: cuando la membresía vence, aplica "estructura sí, contenido no"
--     como en cualquier curso vencido.
--   - Pagos: quien NO es admin no los ve. Por eso las políticas usan
--     `is_admin()` y nunca `is_equipo()`: el community manager no ve pagos.
--     Escribe solo el service role (el webhook).

-- ==========================================================================
-- 1. El plan
-- ==========================================================================

create table academia.membership_plans (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  name                 text not null,
  price_mxn            numeric(10, 2) not null check (price_mxn > 0),

  -- El curso que hace de casa: muro, en vivo, anuncios.
  hub_course_id        uuid references academia.courses (id) on delete set null,

  -- Los llena `scripts/stripe-vaip.mjs`. Hasta entonces la página de venta
  -- dice que la suscripción abre pronto.
  stripe_product_id    text,
  stripe_price_id      text,
  stripe_payment_link  text,
  portal_login_url     text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger membership_plans_updated_at
  before update on academia.membership_plans
  for each row execute function academia.set_updated_at();

alter table academia.membership_plans enable row level security;

-- El plan es información de venta: lo lee cualquiera con sesión. La página
-- pública /vaip lo lee en el servidor.
create policy membership_plans_select on academia.membership_plans
  for select to authenticated
  using (true);

create policy membership_plans_write_admin on academia.membership_plans
  for all to authenticated
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

-- Qué cursos entran en el plan. El de la casa también lleva su plan_id.
alter table academia.courses
  add column plan_id uuid references academia.membership_plans (id) on delete set null;

create index courses_plan_idx on academia.courses (plan_id) where plan_id is not null;

-- ==========================================================================
-- 2. Las suscripciones
-- ==========================================================================

create table academia.memberships (
  id                      uuid primary key default gen_random_uuid(),
  plan_id                 uuid not null references academia.membership_plans (id) on delete restrict,

  -- Null mientras llega el evento que trae el correo (el orden de los eventos
  -- de Stripe no está garantizado). `set null`: borrar la cuenta no borra la
  -- historia de cobro.
  user_id                 uuid references academia.profiles (user_id) on delete set null,
  email                   text,

  stripe_customer_id      text,
  stripe_subscription_id  text not null unique,

  status                  text not null
                          check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active',
                                            'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  ended_at                timestamptz,

  -- Hasta cuándo da acceso esta suscripción. Lo calcula la app
  -- (`lib/membresia/acceso.ts`) en un solo lugar; null = ninguno.
  access_until            timestamptz,

  -- `created` del último evento aplicado: uno más viejo que llegue tarde no
  -- regresa el estado.
  last_event_at           timestamptz,

  started_at              timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger memberships_updated_at
  before update on academia.memberships
  for each row execute function academia.set_updated_at();

create index memberships_usuario_idx on academia.memberships (user_id);
create index memberships_email_idx on academia.memberships (lower(email));
create index memberships_plan_idx on academia.memberships (plan_id, status);

alter table academia.memberships enable row level security;

-- Cada quien ve la suya; el admin, todas. Nadie escribe salvo el service role.
create policy memberships_select_propio_o_admin on academia.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or (select academia.is_admin()));

-- ==========================================================================
-- 3. La bitácora de cobros
-- ==========================================================================

create table academia.membership_invoices (
  stripe_invoice_id       text primary key,
  stripe_subscription_id  text not null,
  plan_id                 uuid not null references academia.membership_plans (id) on delete restrict,
  user_id                 uuid references academia.profiles (user_id) on delete set null,
  email                   text,
  amount                  numeric(10, 2) not null check (amount >= 0),
  currency                text not null,
  -- El periodo que se cobra (de `lines[].period`, no de `invoice.period_*`,
  -- que en una renovación habla del periodo que terminó).
  period_start            timestamptz,
  period_end              timestamptz,
  status                  text not null check (status in ('paid', 'failed')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger membership_invoices_updated_at
  before update on academia.membership_invoices
  for each row execute function academia.set_updated_at();

create index membership_invoices_suscripcion_idx on academia.membership_invoices (stripe_subscription_id);
create index membership_invoices_fecha_idx on academia.membership_invoices (created_at desc);

alter table academia.membership_invoices enable row level security;

create policy membership_invoices_select_propio_o_admin on academia.membership_invoices
  for select to authenticated
  using (user_id = (select auth.uid()) or (select academia.is_admin()));

-- ==========================================================================
-- 4. Las inscripciones de la membresía
-- ==========================================================================

alter table academia.enrollments drop constraint enrollments_source_check;
alter table academia.enrollments
  add constraint enrollments_source_check
  check (source in ('stripe', 'manual', 'catalogo', 'membresia'));

-- ==========================================================================
-- 5. Semilla: el plan y su casa
-- ==========================================================================
-- El curso nace en BORRADOR: Alejandro lo publica cuando quiera abrir. No va
-- al catálogo (se vende en /vaip) ni da certificado (es una comunidad).

insert into academia.membership_plans (slug, name, price_mxn)
values ('v-ai-p', 'VADAI V-AI-P', 349)
on conflict (slug) do nothing;

insert into academia.courses (slug, title, description, course_type, status, certificate_enabled,
                              in_catalog, is_free, is_default, plan_id)
select 'v-ai-p',
       'VADAI V-AI-P',
       'La comunidad de la academia: clases en vivo cada quince días, cursos nuevos y un muro para '
         || 'compartir lo que ya te funciona con IA.',
       'cohort', 'draft', false, false, false, false, p.id
  from academia.membership_plans p
 where p.slug = 'v-ai-p'
on conflict (slug) do nothing;

insert into academia.cohorts (course_id, name, starts_on, ends_on, open_for_enrollment)
select c.id, 'Miembros', current_date, null, true
  from academia.courses c
 where c.slug = 'v-ai-p'
   and not exists (select 1 from academia.cohorts g where g.course_id = c.id);

update academia.membership_plans p
   set hub_course_id = c.id
  from academia.courses c
 where p.slug = 'v-ai-p' and c.slug = 'v-ai-p' and p.hub_course_id is null;
