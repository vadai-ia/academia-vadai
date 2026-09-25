-- academia_0032_volver_a_borrador.sql
-- Una dinámica abierta por error puede volver a borrador.
--
-- POR QUÉ
-- El 25-sep-2026 Alejandro abrió "Hoja de decisión" sin querer y la cerró
-- cuatro segundos después. Cerrarla NO la esconde: una cerrada se sigue viendo
-- en /dinamicas y en la pestaña del curso, así que una alumna preguntó en la
-- comunidad si la iban a reabrir. Lo que él quería era volverla a borrador, y
-- el panel no tenía esa puerta: `dinamica_valida_transicion` (0028) solo
-- permitía draft -> open -> closed -> open. Hubo que devolverla a borrador
-- desde fuera, borrándola y volviéndola a sembrar.
--
-- QUÉ
-- El trigger acepta ahora `open -> draft` y `closed -> draft`, y limpia
-- `opened_at` y `closed_at` para que la dinámica quede como si no se hubiera
-- abierto nunca (al reabrirla, `opened_at` vuelve a ponerse y la campana avisa
-- de nuevo). `closes_at` NO se toca: es configuración, no estado.
--
-- LA REGLA, BIEN DICHA
-- Es el mismo aprendizaje de `academia_0022` con las encuestas: lo que hace
-- peligroso retroceder nunca fue el ESTADO, son las CALIFICACIONES. Volver a
-- borrador esconde la dinámica de todos los alumnos; hacerlo con trabajo
-- adentro le quitaría a las empresas lo que ya llenaron, sin avisar. Sin una
-- sola calificación no hay nada que quitarle a nadie.
--
--   se puede volver a borrador si y solo si no queda ninguna calificación
--
-- Un tablero vacío no estorba: se queda donde está y la empresa lo encuentra
-- igual cuando la dinámica se reabra. Con calificaciones, el camino sigue
-- siendo cerrarla (o borrarla, que sí avisa de lo que se pierde).
--
-- QUIÉN
-- Solo el equipo: las policies de `dynamics` ya limitan el UPDATE a
-- `is_admin()`. Esta migración no toca permisos, solo la máquina de estados.

create or replace function academia.dinamica_valida_transicion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_criterios integer;
  v_suma      numeric;
  v_celdas    integer;
begin
  if old.status = new.status then
    return new;
  end if;

  -- Volver a BORRADOR, desde abierta o desde cerrada. La condición no es de
  -- qué estado viene, sino si alguien ya calificó: esconder la dinámica con
  -- trabajo adentro sería quitárselo a las empresas sin decirles nada.
  if new.status = 'draft' then
    select count(*) into v_celdas
      from academia.dynamic_cells c
      join academia.dynamic_boards b on b.id = c.board_id
     where b.dynamic_id = new.id;

    if v_celdas > 0 then
      raise exception
        'Ya hay % calificaciones puestas: ciérrala en vez de volverla a borrador.', v_celdas
        using errcode = '22023';
    end if;

    -- Como si no se hubiera abierto nunca. Al reabrirla se vuelven a poner.
    new.opened_at = null;
    new.closed_at = null;
    return new;
  end if;

  if not (
       (old.status = 'draft'  and new.status = 'open')
    or (old.status = 'open'   and new.status = 'closed')
    or (old.status = 'closed' and new.status = 'open')
  ) then
    raise exception 'Una dinámica no pasa de % a %.', old.status, new.status
      using errcode = '22023';
  end if;

  if new.status = 'open' then
    select count(*), coalesce(sum(weight), 0)
      into v_criterios, v_suma
      from academia.dynamic_rows
     where dynamic_id = new.id
       and row_kind = 'criterio';

    if v_criterios = 0 then
      raise exception 'Agrega al menos un criterio con peso antes de abrirla.'
        using errcode = '22023';
    end if;

    if abs(v_suma - 100) > 0.001 then
      raise exception 'Los pesos suman %, no 100.', v_suma
        using errcode = '22023';
    end if;

    if new.closes_at is not null and new.closes_at <= now() then
      raise exception 'La fecha límite ya pasó. Quítala o muévela antes de abrir.'
        using errcode = '22023';
    end if;

    new.opened_at = now();
    new.closed_at = null;
  else
    new.closed_at = now();
  end if;

  return new;
end;
$function$;

comment on function academia.dinamica_valida_transicion() is
  'Máquina de estados de una dinámica: draft <-> open <-> closed. Volver a draft solo mientras no haya ninguna calificación (academia_0032).';

-- El `do $$` de 0012 y el bloque de 0028 ya corrieron; esta función se
-- reemplaza, así que hay que volver a conceder lo suyo.
revoke all on function academia.dinamica_valida_transicion() from public;
grant execute on function academia.dinamica_valida_transicion() to authenticated, service_role;
