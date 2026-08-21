-- academia_0019_imagenes_de_comunidad.sql
--
-- Permite que el alumno suba imágenes a sus publicaciones de comunidad (§3.8,
-- "posts (título + contenido rich + imágenes)").
--
-- Las policies de M1 sobre `academia-media` solo dejaban al alumno escribir bajo
-- `avatares/<user_id>/`. La comunidad necesita su propio prefijo, con la misma
-- disciplina: cada quien en su carpeta.
--
-- `academia-media` es el bucket PÚBLICO (§1.B), y aquí eso es lo correcto: una
-- imagen dentro de un post del feed la ven todos los del curso, y servirla por
-- CDN sin firmar es más rápido y más simple. Lo privado —material del curso,
-- entregas, certificados— vive en los otros dos buckets.
--
-- Ojo con lo que esto NO permite: subir no es publicar. La imagen solo aparece
-- si el alumno la referencia desde un post suyo, y ese post lo sigue gobernando
-- la policy de `community_posts`, que exige acceso vigente al curso.

drop policy if exists academia_media_comunidad_insert on storage.objects;
drop policy if exists academia_media_comunidad_update on storage.objects;
drop policy if exists academia_media_comunidad_delete on storage.objects;

create policy academia_media_comunidad_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'academia-media'
    and (storage.foldername(name))[1] = 'comunidad'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy academia_media_comunidad_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'academia-media'
    and (storage.foldername(name))[1] = 'comunidad'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'academia-media'
    and (storage.foldername(name))[1] = 'comunidad'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy academia_media_comunidad_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'academia-media'
    and (storage.foldername(name))[1] = 'comunidad'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
