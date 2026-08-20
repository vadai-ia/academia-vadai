-- academia_0008_certificados.sql
-- Certificados con folio verificable públicamente (§3.6).
--
-- La página /certificado/[folio] NO consulta esta tabla con la llave anónima:
-- lo hace server-side con service role. Por eso aquí no hay ninguna policy
-- pública, y el folio no es adivinable.

create table academia.certificates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references academia.profiles (user_id) on delete cascade,
  course_id   uuid not null references academia.courses (id) on delete cascade,

  folio       text not null unique,

  issued_at   timestamptz not null default now(),
  pdf_path    text,

  created_at  timestamptz not null default now(),

  unique (user_id, course_id)
);

create index certificates_usuario_idx on academia.certificates (user_id);

comment on column academia.certificates.folio is
  'Identificador público del certificado. Se consulta sin login en /certificado/[folio], siempre server-side con service role.';
