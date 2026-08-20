-- academia_0011_pagos.sql
-- Pagos de Stripe e idempotencia del webhook (§7.1).

create table academia.payments (
  id                    uuid primary key default gen_random_uuid(),

  -- Puede ser null: el webhook registra el pago aunque todavía no exista la
  -- cuenta. El correo es el vínculo hasta que se crea el perfil.
  user_id               uuid references academia.profiles (user_id) on delete set null,
  email                 text not null,

  course_id             uuid not null references academia.courses (id) on delete restrict,

  stripe_session_id     text not null unique,
  stripe_payment_intent text,

  amount                numeric(10, 2) not null check (amount >= 0),
  currency              text not null check (currency in ('mxn', 'usd')),

  status                text not null default 'paid'
                        check (status in ('paid', 'refunded')),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger payments_updated_at
  before update on academia.payments
  for each row execute function academia.set_updated_at();

create index payments_usuario_idx on academia.payments (user_id);
create index payments_email_idx on academia.payments (lower(email));
create index payments_curso_idx on academia.payments (course_id, created_at desc);

-- on delete restrict en course_id: un curso con pagos registrados no se borra.
-- Se archiva (courses.status = 'archived').

-- Idempotencia del webhook: la PK es el propio event.id de Stripe, así que un
-- reenvío del mismo evento choca contra la llave primaria y no se procesa dos
-- veces (§7.1).
create table academia.stripe_events (
  event_id      text primary key,
  event_type    text,
  processed_at  timestamptz not null default now()
);

comment on table academia.stripe_events is
  'Idempotencia del webhook. La PK es el event.id de Stripe: un reenvío choca y no se reprocesa.';
