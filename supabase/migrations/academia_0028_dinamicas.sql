-- academia_0028_dinamicas.sql
-- Dinámicas empresariales (M13): la matriz de decisión ponderada, por empresa.
--
-- POR QUÉ
-- En la sesión 1 cada empresa llena una hoja de Excel: criterios en las filas
-- con un peso en %, proyectos en las columnas, una calificación por celda y la
-- suma ponderada al pie. Se quiere dentro de la academia, entre sesiones, y
-- que TODA la empresa la llene junta en el mismo tablero — no cada quien la
-- suya. Quien no viene de ninguna empresa (company_id null, "General") trabaja
-- un tablero personal.
--
-- QUÉ
-- Cinco tablas, una vista ampliada y los helpers y triggers que sostienen las
-- reglas que la aplicación no puede garantizar sola:
--
--   dynamics         la dinámica: cuelga de un curso, tiene escala y ciclo
--                    draft -> open -> closed (reabrible) y fecha límite opcional
--   dynamic_rows     las filas que fija el admin: criterios con peso, o filas
--                    informativas sin peso (texto corto por proyecto)
--   dynamic_boards   UN tablero por empresa y dinámica, o uno por persona de
--                    General. Se crea cuando el primer miembro entra
--   dynamic_columns  los proyectos que agrega la empresa
--   dynamic_cells    una calificación compartida por celda: gana el último
--                    que escribe, y queda firmado con updated_by
--
-- Tres cosas de este diseño no son obvias:
--
--   1. EL CIERRE POR FECHA ES PEREZOSO. No hay pg_cron (viviría fuera de
--      `academia`, Regla Cero). "Abierta" se evalúa al leer: status = 'open'
--      y closes_at nula o futura. Vive en UNA función, dinamica_abierta(), y
--      la usan RLS, la vista de puntos y el servidor. Nadie más la redefine.
--
--   2. LA VERSIÓN DEL TABLERO SÍ SE MUEVE CON LAS CELDAS, al revés que en las
--      encuestas (0020). Ahí cien teléfonos sondean y una respuesta no debía
--      despertar a las otras noventa y nueve; aquí son a lo mucho quince
--      personas de la misma empresa y lo que se colabora es justamente la
--      celda: ver el 8 que puso el compañero es la feature.
--
--   3. LA CELDA COHERENTE ES SEGURIDAD, no solo integridad. dynamic_cells
--      lleva board_id denormalizado para que las policies no hagan joins. Sin
--      el trigger, un miembro podría mandar board_id = su tablero y column_id
--      = una columna de OTRA empresa, y RLS lo dejaría pasar.
--
-- QUIÉN
-- El admin arma filas y ciclo, ve y edita cualquier tablero (aun cerrado:
-- "cerrada" es el candado del alumno, no del equipo; los puntos se calculan al
-- leer, así que una corrección posterior fluye sola). El alumno inscrito lee
-- lo que no es borrador (estructura: has_enrollment) y escribe solo con acceso
-- vigente y la dinámica abierta (contenido: has_active_access).
--
-- Los puntos de gamificación NO se guardan (doctrina de 0025 y de
-- lib/gamificacion/reglas.ts): la vista actividad_por_curso gana una columna
-- `dinamicas` que cuenta, por alumno y curso, las dinámicas cerradas donde su
-- tablero tiene al menos un proyecto con todos los criterios calificados.

-- ==========================================================================
-- 1. dynamics — la dinámica
-- ==========================================================================
--
-- `kind` existe desde hoy aunque solo haya un tipo: van a venir otras
-- dinámicas por empresa, y agregar un tipo será ampliar este check en una
-- migración nueva, no rehacer el modelo.

create table academia.dynamics (
  id           uuid primary key default gen_random_uuid(),

  course_id    uuid not null references academia.courses (id) on delete cascade,
  cohort_id    uuid references academia.cohorts (id) on delete set null,

  kind         text not null default 'matriz_ponderada'
               check (kind in ('matriz_ponderada')),

  title        text not null,
  description  text,

  -- Escala de calificación de las celdas de criterio. Enteros.
  scale_min    smallint not null default 1,
  scale_max    smallint not null default 10,

  status       text not null default 'draft'
               check (status in ('draft', 'open', 'closed')),

  -- Fecha límite opcional. Ver dinamica_abierta(): se evalúa al leer.
  closes_at    timestamptz,

  created_by   uuid references academia.profiles (user_id) on delete set null,

  -- La campana lee opened_at: lo abierto después de notifications_seen_at es
  -- "nuevo". Reabrir lo vuelve a poner, así que vuelve a avisar.
  opened_at    timestamptz,
  closed_at    timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint dynamics_titulo_no_vacio check (length(trim(title)) between 1 and 160),
  constraint dynamics_escala_valida
    check (scale_min >= 0 and scale_max > scale_min and scale_max <= 100)
);

create trigger dynamics_updated_at
  before update on academia.dynamics
  for each row execute function academia.set_updated_at();

create index dynamics_curso_idx    on academia.dynamics (course_id, created_at desc);
create index dynamics_cohorte_idx  on academia.dynamics (cohort_id) where cohort_id is not null;
create index dynamics_abiertas_idx on academia.dynamics (opened_at desc) where status = 'open';

comment on table academia.dynamics is
  'Dinámica empresarial. Cuelga de un curso. "Abierta de verdad" = status open y closes_at nula o futura (academia.dinamica_abierta).';

-- ==========================================================================
-- 2. dynamic_rows — las filas que fija el admin
-- ==========================================================================
--
-- `position` sin unique, igual que poll_questions: mover una fila son dos
-- updates y un unique los haría chocar a mitad de camino.

create table academia.dynamic_rows (
  id          uuid primary key default gen_random_uuid(),
  dynamic_id  uuid not null references academia.dynamics (id) on delete cascade,

  -- criterio    -> lleva peso y entra al ponderado; la celda es un entero
  -- informativa -> sin peso; la celda es texto corto (inversión, horas…)
  row_kind    text not null check (row_kind in ('criterio', 'informativa')),

  label       text not null,
  weight      numeric(5,2),
  position    integer not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint dynamic_rows_label_no_vacio check (length(trim(label)) between 1 and 120),
  constraint dynamic_rows_peso_segun_tipo check (
    (row_kind = 'criterio' and weight is not null and weight > 0)
    or (row_kind = 'informativa' and weight is null)
  )
);

create trigger dynamic_rows_updated_at
  before update on academia.dynamic_rows
  for each row execute function academia.set_updated_at();

create index dynamic_rows_dinamica_idx on academia.dynamic_rows (dynamic_id, position);

comment on table academia.dynamic_rows is
  'Filas de la matriz. Criterio = peso en % (suman 100 al abrir); informativa = texto libre por proyecto, no pondera.';

-- ==========================================================================
-- 3. dynamic_boards — un tablero por empresa (o por persona de General)
-- ==========================================================================
--
-- `company_id` es `on delete restrict` a propósito: borrar una empresa con
-- tableros sería perder la matriz de un equipo en silencio. eliminarEmpresa()
-- mapea el 23503 a un mensaje que dice qué hacer antes.
--
-- Índices ÚNICOS PARCIALES: null nunca colisiona con null, así que la garantía
-- "un tablero por empresa" tiene que llevar `where company_id is not null`.

create table academia.dynamic_boards (
  id             uuid primary key default gen_random_uuid(),
  dynamic_id     uuid not null references academia.dynamics (id) on delete cascade,

  company_id     uuid references academia.companies (id) on delete restrict,
  owner_user_id  uuid references academia.profiles (user_id) on delete cascade,

  -- Lo sondea el tablero del alumno. Solo lo mueve el trigger.
  version        bigint not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint dynamic_boards_un_dueno check (num_nonnulls(company_id, owner_user_id) = 1)
);

create trigger dynamic_boards_updated_at
  before update on academia.dynamic_boards
  for each row execute function academia.set_updated_at();

create unique index dynamic_boards_por_empresa
  on academia.dynamic_boards (dynamic_id, company_id) where company_id is not null;
create unique index dynamic_boards_por_persona
  on academia.dynamic_boards (dynamic_id, owner_user_id) where owner_user_id is not null;
create index dynamic_boards_dinamica_idx on academia.dynamic_boards (dynamic_id);

comment on table academia.dynamic_boards is
  'El tablero que llena una empresa (company_id) o una persona sin empresa (owner_user_id). Exactamente un dueño. Se crea cuando el primer miembro entra.';

-- ==========================================================================
-- 4. dynamic_columns — los proyectos que agrega la empresa
-- ==========================================================================

create table academia.dynamic_columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references academia.dynamic_boards (id) on delete cascade,

  label       text not null,
  -- Sin unique: dos miembros agregan a la vez y max+1 compite. El orden
  -- estable es (position, created_at, id).
  position    integer not null default 0,

  created_by  uuid references academia.profiles (user_id) on delete set null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint dynamic_columns_label_no_vacio check (length(trim(label)) between 1 and 80)
);

create trigger dynamic_columns_updated_at
  before update on academia.dynamic_columns
  for each row execute function academia.set_updated_at();

create index dynamic_columns_tablero_idx
  on academia.dynamic_columns (board_id, position, created_at);

comment on table academia.dynamic_columns is
  'Un proyecto (columna) del tablero. Solo quien lo creó o el equipo lo borra.';

-- ==========================================================================
-- 5. dynamic_cells — una calificación compartida por celda
-- ==========================================================================
--
-- Exactamente un valor: número para criterio, texto para informativa. Vaciar
-- una celda es BORRAR la fila, no dejarla en null: una fila sin valor no es
-- una calificación y solo confundiría el conteo de "columna completa".
--
-- `unique (column_id, row_id)` es el árbitro del upsert: la columna ya fija el
-- tablero, y board_id queda como denormalización para RLS (ver trigger 7f).

create table academia.dynamic_cells (
  id             uuid primary key default gen_random_uuid(),

  board_id       uuid not null references academia.dynamic_boards (id) on delete cascade,
  column_id      uuid not null references academia.dynamic_columns (id) on delete cascade,
  row_id         uuid not null references academia.dynamic_rows (id) on delete cascade,

  numeric_value  smallint,
  text_value     text,

  updated_by     uuid references academia.profiles (user_id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint dynamic_cells_una_por_celda unique (column_id, row_id),
  constraint dynamic_cells_un_solo_valor check (num_nonnulls(numeric_value, text_value) = 1),
  constraint dynamic_cells_texto_corto check (text_value is null or length(text_value) <= 80)
);

create trigger dynamic_cells_updated_at
  before update on academia.dynamic_cells
  for each row execute function academia.set_updated_at();

create index dynamic_cells_tablero_idx on academia.dynamic_cells (board_id);
create index dynamic_cells_fila_idx    on academia.dynamic_cells (row_id);

comment on table academia.dynamic_cells is
  'Una calificación por (proyecto, fila). Gana el último que escribe; updated_by dice quién fue.';

-- ==========================================================================
-- 6. Helpers (patrón 0012: sql stable security definer, search_path vacío)
-- ==========================================================================

-- La empresa de quien pregunta. Null = General, suspendido o sin perfil.
create or replace function academia.mi_empresa()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id
    from academia.profiles p
   where p.user_id = (select auth.uid())
     and p.status = 'active'
$$;

create or replace function academia.curso_de_dinamica(p_dynamic_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.course_id from academia.dynamics d where d.id = p_dynamic_id
$$;

create or replace function academia.dinamica_del_tablero(p_board_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.dynamic_id from academia.dynamic_boards b where b.id = p_board_id
$$;

create or replace function academia.curso_de_tablero(p_board_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select academia.curso_de_dinamica(academia.dinamica_del_tablero(p_board_id))
$$;

-- "Abierta de verdad": la fecha límite se evalúa AQUÍ y en ningún otro lado.
create or replace function academia.dinamica_abierta(p_dynamic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from academia.dynamics d
     where d.id = p_dynamic_id
       and d.status = 'open'
       and (d.closes_at is null or d.closes_at > now())
  )
$$;

-- Lo que un alumno puede VER: no borrador + inscripción. Estructura, así que
-- sobrevive al vencimiento del acceso (decisión "estructura sí, contenido no").
create or replace function academia.dinamica_visible(p_dynamic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.is_admin() or exists (
    select 1
      from academia.dynamics d
     where d.id = p_dynamic_id
       and d.status <> 'draft'
       and academia.has_enrollment(d.course_id)
  )
$$;

-- Ojo con null = null: un tablero de empresa nunca casa con mi_empresa() nula.
create or replace function academia.es_miembro_de_tablero(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from academia.dynamic_boards b
     where b.id = p_board_id
       and (
         (b.company_id is not null and b.company_id = academia.mi_empresa())
         or b.owner_user_id = (select auth.uid())
       )
  )
$$;

-- ESCRIBIR: el equipo siempre; un miembro solo si la dinámica está abierta y
-- su acceso al curso sigue vigente (contenido).
create or replace function academia.puede_editar_tablero(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select academia.is_admin() or (
    academia.es_miembro_de_tablero(p_board_id)
    and academia.dinamica_abierta(academia.dinamica_del_tablero(p_board_id))
    and academia.has_active_access(academia.curso_de_tablero(p_board_id))
  )
$$;

-- ==========================================================================
-- 7. Triggers
-- ==========================================================================

-- 7a. La versión del tablero. Columnas y celdas mueven la de SU tablero; las
--     filas y la dinámica mueven la de TODOS sus tableros (si el admin agrega
--     un criterio o cierra, cada tablero abierto tiene que enterarse).
create or replace function academia.tablero_mueve_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name in ('dynamic_columns', 'dynamic_cells') then
    update academia.dynamic_boards
       set version = version + 1
     where id = coalesce(new.board_id, old.board_id);
  elsif tg_table_name = 'dynamic_rows' then
    update academia.dynamic_boards
       set version = version + 1
     where dynamic_id = coalesce(new.dynamic_id, old.dynamic_id);
  else
    update academia.dynamic_boards
       set version = version + 1
     where dynamic_id = new.id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger dynamic_columns_mueve_version
  after insert or update or delete on academia.dynamic_columns
  for each row execute function academia.tablero_mueve_version();

create trigger dynamic_cells_mueve_version
  after insert or update or delete on academia.dynamic_cells
  for each row execute function academia.tablero_mueve_version();

create trigger dynamic_rows_mueve_version
  after insert or update or delete on academia.dynamic_rows
  for each row execute function academia.tablero_mueve_version();

create trigger dynamics_mueve_version
  after update of status, closes_at, scale_min, scale_max on academia.dynamics
  for each row execute function academia.tablero_mueve_version();

-- 7b. Transición de estado: draft -> open, open -> closed, closed -> open.
--     Abrir exige al menos un criterio, pesos = 100 y fecha límite futura o
--     nula. La regla vive donde no se puede esquivar; la server action la
--     repite solo para dar un mensaje amable antes de tocar la base.
create or replace function academia.dinamica_valida_transicion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_criterios integer;
  v_suma      numeric;
begin
  if old.status = new.status then
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
$$;

create trigger dynamics_valida_transicion
  before update of status on academia.dynamics
  for each row execute function academia.dinamica_valida_transicion();

-- 7c. La escala se congela en cuanto hay una celda: un 8 puesto en escala 1-5
--     sería un dato mudo que nadie sabría leer.
create or replace function academia.dinamica_congela_escala()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.scale_min, new.scale_max) is distinct from (old.scale_min, old.scale_max)
     and exists (
       select 1
         from academia.dynamic_cells c
         join academia.dynamic_boards b on b.id = c.board_id
        where b.dynamic_id = new.id
     ) then
    raise exception 'La escala no se cambia: ya hay calificaciones puestas con la anterior.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger dynamics_congela_escala
  before update of scale_min, scale_max on academia.dynamics
  for each row execute function academia.dinamica_congela_escala();

-- 7d. Una fila no cambia de dinámica, y su TIPO se congela con celdas: pasar
--     de criterio a informativa dejaría numeric_value en una fila que se lee
--     por text_value. No daría error: la matriz mostraría huecos.
create or replace function academia.fila_protegida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.dynamic_id <> old.dynamic_id then
    raise exception 'Una fila no se mueve de dinámica.' using errcode = '22023';
  end if;

  if new.row_kind is distinct from old.row_kind
     and exists (select 1 from academia.dynamic_cells where row_id = old.id) then
    raise exception 'Esta fila ya tiene calificaciones: no cambies su tipo.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger dynamic_rows_protegida
  before update on academia.dynamic_rows
  for each row execute function academia.fila_protegida();

-- 7e. Una columna no cambia de tablero ni de autor. Lo segundo cierra la
--     puerta a "adoptar" la columna de otro para poder borrarla.
create or replace function academia.columna_protegida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.board_id <> old.board_id then
    raise exception 'Un proyecto no se mueve de tablero.' using errcode = '22023';
  end if;

  if new.created_by is distinct from old.created_by
     and not (academia.is_admin() or academia.es_servicio()) then
    raise exception 'Quién creó el proyecto no se cambia.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger dynamic_columns_protegida
  before update on academia.dynamic_columns
  for each row execute function academia.columna_protegida();

-- 7f. Celda coherente. ES SEGURIDAD (ver el encabezado): la columna es de
--     este tablero, la fila es de esta dinámica, y el valor tiene la forma
--     que pide la fila y cabe en la escala.
create or replace function academia.celda_coherente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board_de_columna uuid;
  v_dinamica_tablero uuid;
  v_dinamica_fila    uuid;
  v_tipo             text;
  v_min              smallint;
  v_max              smallint;
begin
  select c.board_id into v_board_de_columna
    from academia.dynamic_columns c
   where c.id = new.column_id;

  if v_board_de_columna is distinct from new.board_id then
    raise exception 'El proyecto no es de este tablero.' using errcode = '22023';
  end if;

  select b.dynamic_id, d.scale_min, d.scale_max
    into v_dinamica_tablero, v_min, v_max
    from academia.dynamic_boards b
    join academia.dynamics d on d.id = b.dynamic_id
   where b.id = new.board_id;

  select r.dynamic_id, r.row_kind
    into v_dinamica_fila, v_tipo
    from academia.dynamic_rows r
   where r.id = new.row_id;

  if v_dinamica_fila is distinct from v_dinamica_tablero then
    raise exception 'La fila no es de esta dinámica.' using errcode = '22023';
  end if;

  if v_tipo = 'criterio' and (
       new.numeric_value is null
    or new.numeric_value < v_min
    or new.numeric_value > v_max
  ) then
    raise exception 'Califica con un entero entre % y %.', v_min, v_max
      using errcode = '22023';
  end if;

  if v_tipo = 'informativa' and new.text_value is null then
    raise exception 'Esta fila lleva texto, no número.' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger dynamic_cells_coherente
  before insert or update on academia.dynamic_cells
  for each row execute function academia.celda_coherente();

-- --------------------------------------------------------------------------
-- Permisos de las funciones nuevas. El bloque de 0012 solo cubrió lo que
-- existía entonces; se conceden a mano con el mismo criterio: nada para PUBLIC.
-- --------------------------------------------------------------------------

do $$
declare
  firma text;
begin
  foreach firma in array array[
    'academia.mi_empresa()',
    'academia.curso_de_dinamica(uuid)',
    'academia.dinamica_del_tablero(uuid)',
    'academia.curso_de_tablero(uuid)',
    'academia.dinamica_abierta(uuid)',
    'academia.dinamica_visible(uuid)',
    'academia.es_miembro_de_tablero(uuid)',
    'academia.puede_editar_tablero(uuid)',
    'academia.tablero_mueve_version()',
    'academia.dinamica_valida_transicion()',
    'academia.dinamica_congela_escala()',
    'academia.fila_protegida()',
    'academia.columna_protegida()',
    'academia.celda_coherente()'
  ]
  loop
    execute format('revoke all on function %s from public', firma);
    execute format('grant execute on function %s to authenticated, service_role', firma);
  end loop;
end;
$$;

-- ==========================================================================
-- 8. RLS
-- ==========================================================================
--
-- Convención de 0013: toda policy declara `to authenticated`. La lógica vive
-- en los helpers de arriba; las policies solo los invocan.

alter table academia.dynamics        enable row level security;
alter table academia.dynamic_rows    enable row level security;
alter table academia.dynamic_boards  enable row level security;
alter table academia.dynamic_columns enable row level security;
alter table academia.dynamic_cells   enable row level security;

-- --- dynamics --------------------------------------------------------------
--
-- El alumno no ve borradores. Ve abiertas y cerradas (cerrada = solo lectura).
-- has_enrollment y no has_active_access: una dinámica cerrada es parte de la
-- historia del curso, y verla no es consumir contenido.

create policy dynamics_select_admin_o_inscrito on academia.dynamics
  for select to authenticated
  using (academia.is_admin() or (status <> 'draft' and academia.has_enrollment(course_id)));

create policy dynamics_insert_admin on academia.dynamics
  for insert to authenticated with check (academia.is_admin());
create policy dynamics_update_admin on academia.dynamics
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy dynamics_delete_admin on academia.dynamics
  for delete to authenticated using (academia.is_admin());

-- --- dynamic_rows ----------------------------------------------------------

create policy dynamic_rows_select_visible on academia.dynamic_rows
  for select to authenticated
  using (academia.dinamica_visible(dynamic_id));

create policy dynamic_rows_insert_admin on academia.dynamic_rows
  for insert to authenticated with check (academia.is_admin());
create policy dynamic_rows_update_admin on academia.dynamic_rows
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy dynamic_rows_delete_admin on academia.dynamic_rows
  for delete to authenticated using (academia.is_admin());

-- --- dynamic_boards --------------------------------------------------------
--
-- Leer: el miembro, mientras siga inscrito. Crear: el primer miembro que entra
-- (perezoso), solo con la dinámica abierta y acceso vigente, y solo SU tablero:
-- el de su empresa, o el personal si no tiene empresa. Quien tiene empresa
-- jamás obtiene tablero personal: sin esa condición podría abrirse uno aparte.
-- Update/delete solo admin: la versión la mueve el trigger como definer.

create policy dynamic_boards_select_miembro on academia.dynamic_boards
  for select to authenticated
  using (
    academia.is_admin()
    or (academia.es_miembro_de_tablero(id)
        and academia.has_enrollment(academia.curso_de_tablero(id)))
  );

create policy dynamic_boards_insert_miembro on academia.dynamic_boards
  for insert to authenticated
  with check (
    academia.is_admin()
    or (
      academia.dinamica_abierta(dynamic_id)
      and academia.has_active_access(academia.curso_de_dinamica(dynamic_id))
      and (
        (company_id is not null
         and company_id = academia.mi_empresa()
         and owner_user_id is null)
        or (owner_user_id = (select auth.uid())
            and company_id is null
            and academia.mi_empresa() is null)
      )
    )
  );

create policy dynamic_boards_update_admin on academia.dynamic_boards
  for update to authenticated using (academia.is_admin()) with check (academia.is_admin());
create policy dynamic_boards_delete_admin on academia.dynamic_boards
  for delete to authenticated using (academia.is_admin());

-- --- dynamic_columns -------------------------------------------------------
--
-- Leer como el tablero. Crear y renombrar: quien puede editar el tablero, y la
-- columna nace firmada por quien la crea. Borrar: su autor o el equipo.

create policy dynamic_columns_select_miembro on academia.dynamic_columns
  for select to authenticated
  using (
    academia.is_admin()
    or (academia.es_miembro_de_tablero(board_id)
        and academia.has_enrollment(academia.curso_de_tablero(board_id)))
  );

create policy dynamic_columns_insert_miembro on academia.dynamic_columns
  for insert to authenticated
  with check (academia.puede_editar_tablero(board_id) and created_by = (select auth.uid()));

create policy dynamic_columns_update_miembro on academia.dynamic_columns
  for update to authenticated
  using (academia.puede_editar_tablero(board_id))
  with check (academia.puede_editar_tablero(board_id));

create policy dynamic_columns_delete_creador_o_admin on academia.dynamic_columns
  for delete to authenticated
  using (
    academia.is_admin()
    or (created_by = (select auth.uid()) and academia.puede_editar_tablero(board_id))
  );

-- --- dynamic_cells ---------------------------------------------------------
--
-- Una calificación compartida: el último que escribe gana y firma con
-- updated_by, que la policy obliga a ser quien escribe.

create policy dynamic_cells_select_miembro on academia.dynamic_cells
  for select to authenticated
  using (
    academia.is_admin()
    or (academia.es_miembro_de_tablero(board_id)
        and academia.has_enrollment(academia.curso_de_tablero(board_id)))
  );

create policy dynamic_cells_insert_miembro on academia.dynamic_cells
  for insert to authenticated
  with check (academia.puede_editar_tablero(board_id) and updated_by = (select auth.uid()));

create policy dynamic_cells_update_miembro on academia.dynamic_cells
  for update to authenticated
  using (academia.puede_editar_tablero(board_id))
  with check (academia.puede_editar_tablero(board_id) and updated_by = (select auth.uid()));

create policy dynamic_cells_delete_miembro on academia.dynamic_cells
  for delete to authenticated
  using (academia.puede_editar_tablero(board_id));

grant select, insert, update, delete
  on academia.dynamics, academia.dynamic_rows, academia.dynamic_boards,
     academia.dynamic_columns, academia.dynamic_cells
  to authenticated, service_role;

-- ==========================================================================
-- 9. Vista actividad_por_curso: la columna `dinamicas`, al final
-- ==========================================================================
--
-- `create or replace view` solo admite AÑADIR columnas al final: las nueve de
-- 0025 van idénticas y en el mismo orden. La nueva cuenta DINÁMICAS, no
-- columnas: diez proyectos completos valen lo mismo que uno (sin farmeo).
--
-- "Cerrada de verdad" repite aquí la definición de dinamica_abierta() en
-- negativo, porque una vista no puede llamar a una función que lee auth.uid()
-- por cada fila sin volverse ilegible; la condición es la misma.

create or replace view academia.actividad_por_curso
with (security_invoker = false)
as
select
  e.user_id,
  e.course_id,
  (select count(*)::int
     from academia.lesson_progress lp
    where lp.user_id = e.user_id
      and lp.completed
      and academia.curso_de_leccion(lp.lesson_id) = e.course_id) as lecciones,
  (select count(distinct qa.quiz_id)::int
     from academia.quiz_attempts qa
    where qa.user_id = e.user_id
      and qa.passed
      and academia.curso_del_quiz(qa.quiz_id) = e.course_id) as quizzes,
  (select count(distinct s.assignment_id)::int
     from academia.assignment_submissions s
    where s.user_id = e.user_id
      and s.status in ('submitted', 'approved')
      and academia.curso_de_tarea(s.assignment_id) = e.course_id) as tareas,
  (select count(distinct s.assignment_id)::int
     from academia.assignment_submissions s
    where s.user_id = e.user_id
      and s.status = 'approved'
      and academia.curso_de_tarea(s.assignment_id) = e.course_id) as tareas_aprobadas,
  (select count(*)::int
     from academia.community_posts cp
    where cp.user_id = e.user_id
      and cp.status = 'visible'
      and cp.course_id = e.course_id) as publicaciones,
  (select count(*)::int
     from academia.community_comments cc
     join academia.community_posts cp on cp.id = cc.post_id
    where cc.user_id = e.user_id
      and cc.status = 'visible'
      and cp.course_id = e.course_id)
  + (select count(*)::int
       from academia.lesson_comments lc
      where lc.user_id = e.user_id
        and lc.status = 'visible'
        and academia.curso_de_leccion(lc.lesson_id) = e.course_id) as comentarios,
  (select count(*)::int
     from academia.certificates c
    where c.user_id = e.user_id
      and c.course_id = e.course_id) as certificados,
  (select count(*)::int
     from academia.dynamics d
    where d.course_id = e.course_id
      and (d.status = 'closed'
           or (d.status = 'open' and d.closes_at is not null and d.closes_at <= now()))
      and exists (
        select 1 from academia.dynamic_rows r
         where r.dynamic_id = d.id and r.row_kind = 'criterio')
      and exists (
        select 1
          from academia.dynamic_boards b
          join academia.dynamic_columns c on c.board_id = b.id
         where b.dynamic_id = d.id
           and ((p.company_id is not null and b.company_id = p.company_id)
                or b.owner_user_id = e.user_id)
           -- el proyecto está completo: ningún criterio sin número
           and not exists (
             select 1
               from academia.dynamic_rows r
              where r.dynamic_id = d.id
                and r.row_kind = 'criterio'
                and not exists (
                  select 1
                    from academia.dynamic_cells x
                   where x.column_id = c.id
                     and x.row_id = r.id
                     and x.numeric_value is not null)))) as dinamicas
from academia.enrollments e
join academia.profiles p on p.user_id = e.user_id
where e.status = 'active'
  and p.role = 'alumno'
  and p.status = 'active'
  and (academia.has_enrollment(e.course_id) or academia.is_admin());

comment on view academia.actividad_por_curso is
  'Conteos por (alumno, curso) para puntos y ranking. Solo alumnos activos con inscripción activa; solo visible a quien comparte el curso o al equipo. Los pesos están en lib/gamificacion/reglas.ts. `dinamicas` = dinámicas cerradas con un proyecto completo en el tablero del alumno (M13).';

grant select on academia.actividad_por_curso to authenticated, service_role;
