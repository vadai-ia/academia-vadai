-- academia_0033_catalogo.sql
-- El catálogo de cursos: lo que el alumno ya tiene, separado de lo que puede
-- comprar o empezar gratis.
--
-- POR QUÉ
-- El 3-oct-2026 Alejandro pidió un menú «Cursos» en la vista de alumno: ver los
-- cursos que ya tiene y, aparte, los que la academia va dando de alta, para
-- comprarlos o iniciarlos si son gratis. Hasta hoy el alumno solo podía leer
-- los cursos en los que está inscrito (`courses_select_inscrito`, 0031) y no
-- había forma de inscribirse solo: todo acceso nacía del webhook de Stripe o
-- del panel.
--
-- DECISIONES (Alejandro, 3-oct-2026)
--   * Solo se ofrecen los cursos MARCADOS: una casilla «Mostrar en el catálogo»
--     en el panel. Un curso publicado sin marcar (uno hecho para una sola
--     empresa, por ejemplo) no se ofrece a nadie.
--   * Gratis es una casilla «Curso gratis», no un precio en cero: un curso al
--     que se le olvide el precio no se regala.
--
-- QUÉ
--   1. `courses.in_catalog` y `courses.is_free`, apagadas por default: nada
--      cambia hasta que el equipo marque un curso.
--   2. `enrollments.source` admite 'catalogo': la inscripción que el alumno se
--      da solo a un curso gratis, distinguible de la de Stripe y la manual.
--   3. `academia_catalogo()`: los cursos del catálogo con lo que hace falta para
--      la tarjeta (sin contenido) y si quien pregunta ya está inscrito. Es
--      SECURITY DEFINER porque la RLS de `courses` no deja leer un curso ajeno;
--      devuelve solo columnas de vitrina, nunca lecciones ni videos.
--   4. `academia_inscribirme_gratis(curso)`: inscribe a quien llama en un curso
--      del catálogo marcado como gratis. Nada más: la RLS de `enrollments`
--      sigue sin dejar insertar a un alumno.
--
-- Comprar no cambia: el botón abre el Payment Link del curso y el webhook de
-- Stripe da el acceso como siempre (`metadata.course_id`).

alter table academia.courses
  add column in_catalog boolean not null default false,
  add column is_free    boolean not null default false;

alter table academia.enrollments drop constraint enrollments_source_check;
alter table academia.enrollments
  add constraint enrollments_source_check check (source in ('stripe', 'manual', 'catalogo'));

-- ---------------------------------------------------------------------------
-- La vitrina
-- ---------------------------------------------------------------------------

create or replace function academia.academia_catalogo()
returns table (
  id                       uuid,
  slug                     text,
  title                    text,
  description              text,
  cover_url                text,
  price_mxn                numeric,
  price_usd                numeric,
  stripe_payment_link_mxn  text,
  stripe_payment_link_usd  text,
  access_days              integer,
  course_type              text,
  is_free                  boolean,
  lecciones                integer,
  modulos                  integer,
  inscrito                 boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select c.id, c.slug, c.title, c.description, c.cover_url,
         c.price_mxn, c.price_usd, c.stripe_payment_link_mxn, c.stripe_payment_link_usd,
         c.access_days, c.course_type, c.is_free,
         (select count(*)::integer
            from academia.lessons l
            join academia.modules m on m.id = l.module_id
           where m.course_id = c.id and l.status = 'published'),
         (select count(*)::integer from academia.modules m where m.course_id = c.id),
         -- Inscrito de verdad (no «es del equipo»): así el equipo ve el catálogo
         -- como lo verá un alumno.
         exists (
           select 1 from academia.enrollments e
            where e.course_id = c.id
              and e.user_id = (select auth.uid())
              and e.status = 'active'
         )
    from academia.courses c
   where (select auth.uid()) is not null
     and c.status = 'published'
     and c.in_catalog
   order by c.is_free desc, c.title;
$function$;

-- ---------------------------------------------------------------------------
-- Empezar un curso gratis
-- ---------------------------------------------------------------------------

-- Devuelve el slug del curso para llevar al alumno directo a él.
create or replace function academia.academia_inscribirme_gratis(curso uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid    uuid := (select auth.uid());
  v_curso  academia.courses;
  v_estado text;
begin
  if v_uid is null then
    raise exception 'Inicia sesión para empezar el curso' using errcode = 'insufficient_privilege';
  end if;

  select status into v_estado from academia.profiles where user_id = v_uid;
  if v_estado is null or v_estado <> 'active' then
    raise exception 'Tu cuenta no está activa' using errcode = 'insufficient_privilege';
  end if;

  select * into v_curso from academia.courses where id = curso;
  if not found or v_curso.status <> 'published' or not v_curso.in_catalog or not v_curso.is_free then
    raise exception 'Ese curso no se puede empezar gratis' using errcode = 'check_violation';
  end if;

  -- Si ya estaba (vencido o revocado), vuelve a quedar activo con su vigencia.
  insert into academia.enrollments (user_id, course_id, source, starts_at, expires_at, status)
  values (
    v_uid, v_curso.id, 'catalogo', now(),
    case when v_curso.access_days is null then null else now() + make_interval(days => v_curso.access_days) end,
    'active'
  )
  on conflict (user_id, course_id) do update
    set status = 'active',
        expires_at = excluded.expires_at;

  return v_curso.slug;
end;
$function$;

revoke all on function academia.academia_catalogo() from public, anon;
revoke all on function academia.academia_inscribirme_gratis(uuid) from public, anon;
grant execute on function academia.academia_catalogo() to authenticated;
grant execute on function academia.academia_inscribirme_gratis(uuid) to authenticated;
