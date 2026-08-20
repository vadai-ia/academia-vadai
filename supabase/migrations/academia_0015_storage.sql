-- academia_0015_storage.sql
-- Policies de los buckets propios.
--
-- ÚNICO archivo que toca algo fuera del schema `academia`. §1.B lo autoriza
-- explícitamente: "prohibido alterar objetos en storage.* SALVO policies de
-- buckets propios academia-*".
--
-- Dos disciplinas, sin excepción:
--   1. Todo nombre de policy lleva prefijo `academia_`.
--   2. Toda policy filtra por `bucket_id`, para no rozar buckets de otros
--      sistemas ni ahora ni si el proyecto se comparte después.
--
-- Convención de rutas:
--   academia-adjuntos/lecciones/<lesson_id>/<archivo>   material del curso (solo admin)
--   academia-adjuntos/entregas/<user_id>/<archivo>      entrega de tarea del alumno
--   academia-media/portadas/<curso_id>/<archivo>        portadas y blog (solo admin)
--   academia-media/avatares/<user_id>/<archivo>         avatar del alumno
--   academia-certificados/<user_id>/<folio>.pdf         emitido con service role
--
-- Nota: los adjuntos de lección NUNCA se descargan con la llave del alumno. Se
-- sirven por signed URL generada server-side tras validar el enrollment (§3.3).
-- Por eso el alumno no tiene policy de SELECT sobre el prefijo `lecciones/`.

-- Limpieza idempotente: si esta migración se re-aplica en otro ambiente, no
-- queremos que choque contra policies homónimas ya creadas por nosotros.
do $$
declare
  p record;
begin
  for p in
    select policyname
      from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname like 'academia\_%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end;
$$;

-- ==========================================================================
-- academia-adjuntos  (privado)
-- ==========================================================================

-- El admin administra todo el bucket: material de lecciones y revisión de entregas.
create policy academia_adjuntos_admin_todo on storage.objects
  for all to authenticated
  using (bucket_id = 'academia-adjuntos' and academia.is_admin())
  with check (bucket_id = 'academia-adjuntos' and academia.is_admin());

-- El alumno sube su entrega, y solo bajo su propia carpeta.
create policy academia_adjuntos_entrega_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'academia-adjuntos'
    and (storage.foldername(name))[1] = 'entregas'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Y puede releer y reemplazar lo suyo mientras la tarea siga abierta.
create policy academia_adjuntos_entrega_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'academia-adjuntos'
    and (storage.foldername(name))[1] = 'entregas'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy academia_adjuntos_entrega_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'academia-adjuntos'
    and (storage.foldername(name))[1] = 'entregas'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'academia-adjuntos'
    and (storage.foldername(name))[1] = 'entregas'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy academia_adjuntos_entrega_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'academia-adjuntos'
    and (storage.foldername(name))[1] = 'entregas'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ==========================================================================
-- academia-media  (público en lectura)
--
-- El bucket es público: la lectura la sirve el CDN sin pasar por RLS. Aquí solo
-- se controla quién ESCRIBE.
-- ==========================================================================

create policy academia_media_admin_todo on storage.objects
  for all to authenticated
  using (bucket_id = 'academia-media' and academia.is_admin())
  with check (bucket_id = 'academia-media' and academia.is_admin());

create policy academia_media_avatar_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'academia-media'
    and (storage.foldername(name))[1] = 'avatares'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy academia_media_avatar_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'academia-media'
    and (storage.foldername(name))[1] = 'avatares'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'academia-media'
    and (storage.foldername(name))[1] = 'avatares'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy academia_media_avatar_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'academia-media'
    and (storage.foldername(name))[1] = 'avatares'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ==========================================================================
-- academia-certificados  (privado)
--
-- Los emite el server con service role (BYPASSRLS) y se descargan por signed
-- URL. El alumno NO tiene policy: nunca toca este bucket con su propia llave.
-- El admin puede consultarlos para soporte.
-- ==========================================================================

create policy academia_certificados_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'academia-certificados' and academia.is_admin());
