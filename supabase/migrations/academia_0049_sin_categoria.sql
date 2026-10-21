-- ============================================================================
-- academia_0049_sin_categoria.sql — M26, después del deploy
--
-- Las «herramientas como curso» de M19 (0043: `courses.category`, un área fija
-- entre creativas, administrativas y comerciales) se reemplazaron en M26 por
-- videos de la casa con etiquetas libres (0048: `tool_tags`). La columna nunca
-- tuvo datos y desde M26 ningún código la lee ni la escribe. Va en su propia
-- migración, aplicada DESPUÉS del deploy de M26 (21-oct-2026): borrarla antes
-- habría roto el editor de cursos que seguía en producción.
--
-- Con la columna se van su restricción (`courses_category_check`) y su índice
-- (`courses_categoria_idx`). Ninguna vista, función ni política la usa
-- (revisado en la base el 21-oct-2026). Solo schema `academia`. La aplica
-- Alejandro con `pnpm db:migrate`.
-- ============================================================================

-- Si alguien le hubiera puesto un área a un curso, no se borra a ciegas.
do $$
begin
  if exists (select 1 from academia.courses where category is not null) then
    raise exception 'Hay cursos con área (courses.category): revísalos antes de borrar la columna.';
  end if;
end $$;

drop index if exists academia.courses_categoria_idx;
alter table academia.courses drop column category;
