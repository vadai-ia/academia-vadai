-- academia_0030_comunidad_reacciones_y_canales.sql
-- (a) El equipo puede publicar y comentar en la comunidad de cualquier curso.
-- (b) Reacciones con emoji en publicaciones y comentarios de comunidad.
-- (c) Una marca de "visto" por canal, para el contador de Blog y Comunidad.
--
-- POR QUÉ
-- 21-sep-2026, noche del lanzamiento. Alejandro intentó contestarle a un alumno
-- en la comunidad del curso y la plataforma le dijo "No se pudo publicar tu
-- comentario". No era un fallo pasajero: las policies de INSERT de
-- `community_posts` y `community_comments` solo tenían un camino,
-- `has_active_access(curso)`, que exige inscripción vigente. El equipo NO está
-- inscrito en los cursos que vende, así que podía LEER la comunidad —el SELECT
-- sí contempla `is_admin()`— y moderarla —fijar, ocultar, borrar—, pero no
-- podía decir una palabra dentro de ella. La comunidad de un curso sin su
-- instructor no es una comunidad.
--
-- Las reacciones son lo segundo que pidió, y con la misma razón de fondo: hoy
-- la única forma de responder a una publicación es escribir un comentario, que
-- para "me gustó" es demasiado trabajo. Con emoji, participar cuesta un toque.
--
-- La lista de emojis es CERRADA y vive en el constraint, no en el cliente. Un
-- campo de texto libre aquí es una puerta abierta a que alguien guarde
-- cualquier cosa en una tabla que se pinta sin escapar en todas las pantallas
-- de la comunidad.

-- ---------------------------------------------------------------------------
-- (a) El equipo escribe en la comunidad
-- ---------------------------------------------------------------------------
-- `is_admin()` se suma como camino alterno, exactamente como ya estaba en el
-- SELECT de las dos tablas. Lo demás del CHECK no se toca: se sigue exigiendo
-- que la fila sea tuya y que nazca visible, y en las publicaciones que nazca
-- sin fijar (fijar es una acción aparte, de moderación).

drop policy if exists community_posts_insert_propio on academia.community_posts;

create policy community_posts_insert_propio
  on academia.community_posts for insert
  with check (
    user_id = (select auth.uid())
    and status = 'visible'
    and pinned = false
    and (academia.is_admin() or academia.has_active_access(course_id))
  );

drop policy if exists community_comments_insert_propio on academia.community_comments;

create policy community_comments_insert_propio
  on academia.community_comments for insert
  with check (
    user_id = (select auth.uid())
    and status = 'visible'
    and (academia.is_admin() or academia.has_active_access(academia.curso_de_post(post_id)))
  );

-- ---------------------------------------------------------------------------
-- (b) Reacciones
-- ---------------------------------------------------------------------------
-- Una sola tabla para los dos objetos que se pueden reaccionar. La alternativa
-- —dos tablas gemelas— duplicaría policies e índices para ahorrarse un check.
-- `num_nonnulls` garantiza que cada fila apunte a exactamente uno.

create table academia.community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references academia.community_posts(id) on delete cascade,
  comment_id uuid references academia.community_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),

  constraint community_reactions_una_diana
    check (num_nonnulls(post_id, comment_id) = 1),

  -- Cerrada a propósito. Son las seis que cubren lo que una sala quiere decir
  -- sin escribir: de acuerdo, bien hecho, esto va a volar, me encanta, qué
  -- buena idea, esto está ardiendo.
  constraint community_reactions_emoji_permitido
    check (emoji in ('👍', '👏', '🚀', '❤️', '💡', '🔥'))
);

comment on table academia.community_reactions is
  'Reacciones con emoji a publicaciones y comentarios de la comunidad. Cada fila apunta a uno u otro, nunca a los dos. La lista de emojis es cerrada por constraint.';

-- Una persona, una reacción de cada emoji por objeto. Volver a tocar el mismo
-- emoji lo quita (lo hace la acción, borrando la fila).
create unique index community_reactions_post_unica
  on academia.community_reactions (post_id, user_id, emoji)
  where post_id is not null;

create unique index community_reactions_comment_unica
  on academia.community_reactions (comment_id, user_id, emoji)
  where comment_id is not null;

-- Para contar las de una publicación o un comentario sin recorrer la tabla.
create index community_reactions_post_idx
  on academia.community_reactions (post_id) where post_id is not null;

create index community_reactions_comment_idx
  on academia.community_reactions (comment_id) where comment_id is not null;

alter table academia.community_reactions enable row level security;

-- Se ven las reacciones de lo que puedes ver. La condición es la misma que
-- gobierna la publicación o el comentario: si no deberías estar viendo el hilo,
-- tampoco quién le puso corazón.
create policy community_reactions_select_visible
  on academia.community_reactions for select
  using (
    academia.is_admin()
    or (
      post_id is not null
      and academia.has_active_access(
        (select course_id from academia.community_posts p where p.id = post_id)
      )
    )
    or (
      comment_id is not null
      and academia.has_active_access(
        academia.curso_de_post(
          (select post_id from academia.community_comments c where c.id = comment_id)
        )
      )
    )
  );

-- Reaccionar es tuyo y solo tuyo, y solo donde tienes acceso. El equipo también
-- puede, por la misma razón que ahora puede comentar.
create policy community_reactions_insert_propio
  on academia.community_reactions for insert
  with check (
    user_id = (select auth.uid())
    and (
      academia.is_admin()
      or (
        post_id is not null
        and academia.has_active_access(
          (select course_id from academia.community_posts p where p.id = post_id)
        )
      )
      or (
        comment_id is not null
        and academia.has_active_access(
          academia.curso_de_post(
            (select post_id from academia.community_comments c where c.id = comment_id)
          )
        )
      )
    )
  );

-- Quitar la propia. El admin puede quitar cualquiera, que es moderación.
create policy community_reactions_delete_propio
  on academia.community_reactions for delete
  using (user_id = (select auth.uid()) or academia.is_admin());

-- ---------------------------------------------------------------------------
-- (c) "Visto" por canal
-- ---------------------------------------------------------------------------
-- La campana ya usa `notifications_seen_at` para TODO junto. Blog y Comunidad
-- pasan a ser dos destinos de la navegación principal, cada uno con su propio
-- contador de pendientes, así que cada uno necesita su propia marca: abrir el
-- blog no debe apagar el contador de la comunidad.
--
-- Sigue sin haber tabla de notificaciones: "nuevo" es lo publicado después de
-- esta marca, igual que en la campana.

alter table academia.profiles
  add column blog_seen_at timestamptz,
  add column community_seen_at timestamptz;

comment on column academia.profiles.blog_seen_at is
  'Última vez que abrió el Blog. Lo publicado después cuenta como nuevo en la pastilla de navegación. Null = nunca lo ha abierto.';

comment on column academia.profiles.community_seen_at is
  'Última vez que abrió la Comunidad. Lo publicado después cuenta como nuevo en la pastilla de navegación. Null = nunca la ha abierto.';
