-- academia_0018_adjuntos_del_alumno.sql
--
-- Permite que el alumno con acceso vigente firme la descarga de los adjuntos de
-- sus lecciones (§3.3: "adjuntos descargables (signed URLs)").
--
-- POR QUÉ NO CON SERVICE ROLE
-- La alternativa era generar la URL firmada en una server action con service
-- role tras validar el enrollment a mano. Funcionaría, pero mueve la decisión de
-- acceso fuera de la base: cualquier bug en esa validación se convierte en una
-- fuga, y RLS ya no sería la última palabra. CLAUDE.md además reserva el service
-- role para provisioning, webhooks y PDFs.
--
-- Con esta policy el alumno usa su propia llave y es Postgres quien decide.
--
-- La ruta es `lecciones/<lesson_id>/<archivo>`, según la convención de
-- academia_0015_storage.sql. El prefijo `entregas/` ya lo cubre otra policy y
-- sigue siendo cosa de cada quien con su propia carpeta.

-- El segundo segmento de la ruta viene del nombre del archivo, o sea de fuera:
-- castearlo a uuid sin más reventaría con cualquier ruta rara. Y en una policy
-- no se puede confiar en el cortocircuito de `and`, porque el planner reordena
-- las condiciones como le convenga. Por eso la validación va dentro de una
-- función, donde el orden sí está garantizado.
create or replace function academia.puede_descargar_adjunto(p_ruta text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  partes  text[];
  leccion uuid;
begin
  partes := string_to_array(p_ruta, '/');

  if array_length(partes, 1) is null
     or array_length(partes, 1) < 3
     or partes[1] <> 'lecciones'
  then
    return false;
  end if;

  begin
    leccion := partes[2]::uuid;
  exception
    when others then
      return false;
  end;

  -- has_active_access, no has_enrollment: el material descargable es contenido,
  -- y el acceso vencido no da contenido. El alumno vencido ve el título de la
  -- lección con candado, no sus archivos.
  return academia.has_active_access(academia.curso_de_leccion(leccion));
end;
$$;

comment on function academia.puede_descargar_adjunto(text) is
  'Decide si el usuario actual puede leer un objeto bajo lecciones/<lesson_id>/. Valida el uuid dentro de la función porque en una policy el orden de evaluación no está garantizado.';

revoke all on function academia.puede_descargar_adjunto(text) from public;
grant execute on function academia.puede_descargar_adjunto(text) to authenticated, service_role;

drop policy if exists academia_adjuntos_leccion_select on storage.objects;

create policy academia_adjuntos_leccion_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'academia-adjuntos'
    and academia.puede_descargar_adjunto(name)
  );
