-- academia_0021_invitado_ve_lo_suyo.sql
-- Un participante puede ver las encuestas en las que estuvo.
--
-- POR QUÉ HACÍA FALTA
-- `academia_0020` dejó `poll_participants` y `polls` visibles solo para admin y
-- para alumnos con inscripción. Es correcto para las dos audiencias que existían
-- entonces, pero deja fuera a la tercera: alguien que se registró desde el QR en
-- un evento, tiene rol `invitado` y no está inscrito a ningún curso.
--
-- Ese es justo el usuario que la etapa 2 crea a docenas. Al volver a entrar,
-- `rutaDeInicio()` lo manda a /mis-encuestas, y sin estas policies vería una
-- lista vacía: no porque no haya participado, sino porque RLS le corta lo suyo.
--
-- LA ALTERNATIVA QUE SE DESCARTÓ: resolver esa página con service role, como se
-- hace en el camino público del QR. Ahí es inevitable —quien contesta puede no
-- tener sesión—, pero aquí la persona SÍ está autenticada, y usar service role
-- para leer datos propios de un usuario autenticado es exactamente el "bypass de
-- RLS en queries de usuario" que prohíbe CLAUDE.md. Se resuelve con dos policies.

-- --------------------------------------------------------------------------
-- Helper
--
-- `security definer` por lo de siempre (ver academia_0012): la policy de `polls`
-- necesita leer `poll_participants`, que a su vez tiene RLS. Sin definer, cada
-- policy dispararía la otra.
-- --------------------------------------------------------------------------

create or replace function academia.participo_en_encuesta(p_poll_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from academia.poll_participants pp
      join academia.participants p on p.id = pp.participant_id
     where pp.poll_id = p_poll_id
       and p.user_id = (select auth.uid())
  )
$$;

comment on function academia.participo_en_encuesta(uuid) is
  'true si el usuario actual contestó esta encuesta con su cuenta. Un invitado que respondió sin cuenta no tiene user_id, así que no aplica: su participación solo la ve el admin.';

revoke all on function academia.participo_en_encuesta(uuid) from public;
grant execute on function academia.participo_en_encuesta(uuid) to authenticated, service_role;

-- --------------------------------------------------------------------------
-- Policies
-- --------------------------------------------------------------------------

-- Ve la encuesta en la que participó: su título y su estado, nada más. Las
-- preguntas siguen requiriendo inscripción, y las respuestas de los demás
-- siguen siendo solo del admin.
create policy polls_select_participante on academia.polls
  for select to authenticated
  using (academia.participo_en_encuesta(id));

-- Y ve su propia asistencia. No la de nadie más: el filtro es sobre SU user_id,
-- no sobre la encuesta, así que no puede listar quién más estuvo en la sala.
create policy poll_participants_select_propio on academia.poll_participants
  for select to authenticated
  using (
    exists (
      select 1
        from academia.participants p
       where p.id = participant_id
         and p.user_id = (select auth.uid())
    )
  );
