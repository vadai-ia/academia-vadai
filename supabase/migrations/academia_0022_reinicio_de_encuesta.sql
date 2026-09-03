-- academia_0022_reinicio_de_encuesta.sql
-- Deja volver una pregunta a "sin abrir" cuando no tiene respuestas.
--
-- POR QUÉ
-- `academia_0020` puso un trigger que impide reabrir una pregunta cerrada y
-- devolver una abierta a pendiente. La razón sigue siendo buena: reabrir una
-- pregunta después de proyectar su resultado haría que las respuestas nuevas
-- contradijeran lo que la sala ya vio.
--
-- Pero esa regla también bloqueaba algo legítimo: **reiniciar una encuesta**
-- para volver a correrla desde cero —el ensayo antes del evento, o el mismo
-- juego con otro grupo—. El reinicio borra las respuestas y devuelve todas las
-- preguntas a `pending`, y el trigger lo rechazaba.
--
-- EL ARREGLO NO ES UNA EXCEPCIÓN, ES LA REGLA BIEN DICHA
-- Lo que hacía peligroso retroceder no era el estado: eran las RESPUESTAS. Una
-- pregunta sin una sola respuesta no puede contradecir nada, porque no hay nada
-- que contradecir. Así que la condición pasa a ser esa, que es la que de verdad
-- importaba desde el principio:
--
--     se puede volver a `pending` si y solo si no queda ninguna respuesta.
--
-- Con respuestas, sigue prohibido igual que antes. No hace falta ninguna
-- bandera de sesión ni desactivar el trigger: el reinicio borra primero y
-- retrocede después, así que pasa por la puerta de enfrente.

-- --------------------------------------------------------------------------
-- Helper
--
-- `security definer` porque el trigger corre como quien invoca y
-- `poll_answers` tiene RLS: sin esto, la respuesta dependería de quién esté
-- preguntando, y una condición de integridad no puede depender de eso.
-- --------------------------------------------------------------------------

create or replace function academia.pregunta_sin_respuestas(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from academia.poll_answers a where a.question_id = p_question_id
  )
$$;

comment on function academia.pregunta_sin_respuestas(uuid) is
  'true si a la pregunta no le queda ninguna respuesta. Es lo que habilita el reinicio de una encuesta.';

revoke all on function academia.pregunta_sin_respuestas(uuid) from public;
grant execute on function academia.pregunta_sin_respuestas(uuid) to authenticated, service_role;

-- --------------------------------------------------------------------------
-- El trigger, con la condición correcta
-- --------------------------------------------------------------------------

create or replace function academia.encuesta_valida_transicion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  -- Volver a "sin abrir" es el reinicio. Solo si ya no queda nada que
  -- contradecir; el reinicio borra las respuestas antes de llegar aquí.
  if new.status = 'pending' then
    if not academia.pregunta_sin_respuestas(new.id) then
      raise exception 'No se puede reiniciar una pregunta que todavía tiene respuestas.'
        using errcode = '22023';
    end if;
    new.opened_at = null;
    new.closed_at = null;
    return new;
  end if;

  if old.status = 'closed' then
    raise exception 'Una pregunta cerrada no se reabre. Duplícala si hay que repetirla.'
      using errcode = '22023';
  end if;

  if new.status = 'open' then
    new.opened_at = now();
  elsif new.status = 'closed' then
    new.closed_at = now();
  end if;

  return new;
end;
$$;

comment on function academia.encuesta_valida_transicion() is
  'pending -> open -> closed, y de vuelta a pending solo cuando la pregunta se quedó sin respuestas (reinicio). Ver academia_0022.';

revoke all on function academia.encuesta_valida_transicion() from public;
grant execute on function academia.encuesta_valida_transicion() to authenticated, service_role;
