-- academia_0037_atendida_sin_responder.sql
-- El equipo puede dar por atendido un hilo de la comunidad sin escribir una
-- respuesta.
--
-- POR QUÉ
-- La bandeja de Comunidad del panel (3-oct-2026) calcula sola si un hilo
-- espera respuesta: sí, si el último mensaje visible no es del equipo. Al
-- abrirla había 54 hilos de más de 12 horas, casi todos del 21-sep, muchos ya
-- resueltos en la sesión en vivo. Para sacarlos de la lista había que
-- contestar algo de relleno u ocultarlos, y ocultar se los quita a los alumnos.
--
-- CÓMO
-- `attended_at` / `attended_by` en la raíz del hilo: la publicación del muro o
-- el comentario raíz de una lección. El estado se sigue calculando, no se
-- guarda: un hilo está atendido si `attended_at` es posterior al último
-- mensaje del alumno. Si el alumno vuelve a escribir, regresa solo a «Sin
-- respuesta»; no hay que acordarse de reabrirlo.
--
-- Solo el equipo escribe estas columnas. El alumno puede editar su propia
-- publicación o comentario durante 15 minutos (`*_update_propio`), y esa
-- política no distingue columnas: el trigger impide que se marque atendido a
-- sí mismo, ni al editar ni al publicar.

alter table academia.community_posts
  add column attended_at timestamptz,
  add column attended_by uuid references academia.profiles (user_id) on delete set null;

alter table academia.lesson_comments
  add column attended_at timestamptz,
  add column attended_by uuid references academia.profiles (user_id) on delete set null;

create or replace function academia.academia_atencion_solo_equipo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if academia.es_servicio() or academia.is_equipo() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.attended_at is not null or new.attended_by is not null then
      raise exception 'Solo el equipo marca un hilo como atendido.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.attended_at is distinct from old.attended_at
     or new.attended_by is distinct from old.attended_by then
    raise exception 'Solo el equipo marca un hilo como atendido.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function academia.academia_atencion_solo_equipo() from public;
grant execute on function academia.academia_atencion_solo_equipo() to authenticated, service_role;

create trigger community_posts_atencion_solo_equipo
  before insert or update on academia.community_posts
  for each row execute function academia.academia_atencion_solo_equipo();

create trigger lesson_comments_atencion_solo_equipo
  before insert or update on academia.lesson_comments
  for each row execute function academia.academia_atencion_solo_equipo();
