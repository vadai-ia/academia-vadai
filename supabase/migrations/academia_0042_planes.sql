-- academia_0042_planes.sql
-- M18: los planes se crean y se cobran desde el panel.
--
-- POR QUÉ
-- Alejandro (16-oct-2026): "conectado con Stripe para poder crear desde aquí,
-- desde el frontend, suscripciones y membresías", con la página de pago en
-- $349 y los $499 tachados, y una forma de cancelar dentro de la plataforma.
--
-- QUÉ CAMBIA
--   1. `membership_plans` gana lo que la página de venta necesita (precio
--      tachado, frase, descripción, imagen) y un estado: un plan en borrador no
--      lo ve nadie fuera del admin. El slug se congela en cuanto el plan existe
--      en Stripe: va en la metadata de cada suscripción.
--   2. Qué cursos da cada plan pasa a `membership_plan_courses` (muchos a
--      muchos) y `courses.plan_id` desaparece. M17 nunca salió a producción,
--      así que no hay código vivo que lo lea. La casa del plan siempre está en
--      su lista (trigger).
--   3. `membership_plan_prices`: cada precio que el plan ha tenido en Stripe.
--      Si el precio cambia, quien ya paga sigue con el suyo, y el webhook lo
--      tiene que seguir reconociendo como nuestro.
--   4. `membership_cancellations`: por qué se va cada quien, con el motivo
--      elegido en la plataforma o el que dejó en el portal de Stripe.
--
-- Pagos y cancelaciones: solo `is_admin()`. El community manager no ve cobros.

-- ==========================================================================
-- 1. El plan
-- ==========================================================================

alter table academia.membership_plans
  add column price_compare_mxn       numeric(10, 2),
  add column tagline                 text check (tagline is null or char_length(tagline) <= 140),
  add column description             text check (description is null or char_length(description) <= 2000),
  add column image_url               text check (image_url is null or image_url ~ '^(https://|/)'),
  add column status                  text not null default 'draft'
                                     check (status in ('draft', 'active', 'archived')),
  add column stripe_payment_link_id  text,
  add column stripe_portal_config_id text,
  add constraint membership_plans_tachado_mayor
    check (price_compare_mxn is null or price_compare_mxn > price_mxn),
  add constraint membership_plans_slug_valido
    check (slug ~ '^[a-z0-9-]{2,40}$');

-- V-AI-P ya se vende en /vaip: nace activo, con su precio de graduado.
update academia.membership_plans
   set status = 'active',
       price_compare_mxn = 499,
       tagline = 'Precio de graduado',
       description = 'La comunidad de la academia: una clase en vivo cada quince días, los cursos y '
                     || 'herramientas que se publican para miembros, noticias de IA casi a diario y un '
                     || 'muro para compartir lo que ya te funciona.'
 where slug = 'v-ai-p';

-- Un plan en borrador o archivado solo lo ve el admin.
drop policy membership_plans_select on academia.membership_plans;
create policy membership_plans_select on academia.membership_plans
  for select to authenticated
  using (status = 'active' or (select academia.is_admin()));

-- El slug va en la metadata de cada suscripción y de cada link de pago: una
-- vez en Stripe, cambiarlo dejaría a los miembros sin plan. V-AI-P además está
-- escrito en el código y en academia_perfil_de_miembro().
create or replace function academia.academia_slug_de_plan_fijo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug <> old.slug and (old.stripe_product_id is not null or old.slug = 'v-ai-p') then
    raise exception 'El slug de un plan publicado no cambia.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger membership_plans_slug_fijo
  before update of slug on academia.membership_plans
  for each row execute function academia.academia_slug_de_plan_fijo();

-- ==========================================================================
-- 2. Los cursos de cada plan
-- ==========================================================================

create table academia.membership_plan_courses (
  plan_id     uuid not null references academia.membership_plans (id) on delete cascade,
  course_id   uuid not null references academia.courses (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (plan_id, course_id)
);

create index membership_plan_courses_curso_idx on academia.membership_plan_courses (course_id);

alter table academia.membership_plan_courses enable row level security;

-- Qué cursos trae un plan es información de venta, como el plan mismo.
create policy membership_plan_courses_select on academia.membership_plan_courses
  for select to authenticated
  using (true);

create policy membership_plan_courses_write_admin on academia.membership_plan_courses
  for all to authenticated
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

insert into academia.membership_plan_courses (plan_id, course_id)
select plan_id, id from academia.courses where plan_id is not null
on conflict do nothing;

insert into academia.membership_plan_courses (plan_id, course_id)
select id, hub_course_id from academia.membership_plans where hub_course_id is not null
on conflict do nothing;

alter table academia.courses drop column plan_id;

-- La casa de un plan siempre es uno de sus cursos.
create or replace function academia.academia_casa_en_su_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.hub_course_id is not null then
    insert into academia.membership_plan_courses (plan_id, course_id)
    values (new.id, new.hub_course_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger membership_plans_casa_en_su_plan
  after insert or update of hub_course_id on academia.membership_plans
  for each row execute function academia.academia_casa_en_su_plan();

revoke all on function academia.academia_casa_en_su_plan() from public;
revoke all on function academia.academia_slug_de_plan_fijo() from public;
grant execute on function academia.academia_casa_en_su_plan() to authenticated, service_role;
grant execute on function academia.academia_slug_de_plan_fijo() to authenticated, service_role;

-- ==========================================================================
-- 3. El historial de precios
-- ==========================================================================

create table academia.membership_plan_prices (
  stripe_price_id  text primary key,
  plan_id          uuid not null references academia.membership_plans (id) on delete cascade,
  amount_mxn       numeric(10, 2) not null check (amount_mxn > 0),
  created_at       timestamptz not null default now()
);

create index membership_plan_prices_plan_idx on academia.membership_plan_prices (plan_id);

alter table academia.membership_plan_prices enable row level security;

create policy membership_plan_prices_admin on academia.membership_plan_prices
  for all to authenticated
  using ((select academia.is_admin()))
  with check ((select academia.is_admin()));

insert into academia.membership_plan_prices (stripe_price_id, plan_id, amount_mxn)
select stripe_price_id, id, price_mxn from academia.membership_plans where stripe_price_id is not null
on conflict do nothing;

-- ==========================================================================
-- 4. Las cancelaciones
-- ==========================================================================

create table academia.membership_cancellations (
  id                      uuid primary key default gen_random_uuid(),
  plan_id                 uuid not null references academia.membership_plans (id) on delete restrict,
  stripe_subscription_id  text not null,
  user_id                 uuid references academia.profiles (user_id) on delete set null,
  reason                  text not null
                          check (reason in ('precio', 'tiempo', 'contenido', 'otra_opcion', 'calidad',
                                            'otro', 'sin_motivo')),
  comment                 text check (comment is null or char_length(comment) <= 1000),
  -- 'plataforma': los pasos de /perfil/membresia. 'portal': el portal de Stripe.
  origin                  text not null check (origin in ('plataforma', 'portal')),
  created_at              timestamptz not null default now(),
  -- Si la persona vuelve atrás («Seguir con mi membresía») antes de que termine el mes.
  reverted_at             timestamptz
);

-- Una sola cancelación abierta por suscripción: el webhook y la acción de la
-- plataforma pueden llegar a la vez.
create unique index membership_cancellations_abierta_idx
  on academia.membership_cancellations (stripe_subscription_id)
  where reverted_at is null;

create index membership_cancellations_fecha_idx on academia.membership_cancellations (created_at desc);

alter table academia.membership_cancellations enable row level security;

-- Las lee el admin. Las escribe solo el service role (webhook y la acción de
-- cancelar, después de verificar la suscripción en Stripe).
create policy membership_cancellations_select_admin on academia.membership_cancellations
  for select to authenticated
  using ((select academia.is_admin()));
