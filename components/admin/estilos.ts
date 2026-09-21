/**
 * Clases compartidas de los formularios del admin.
 *
 * Antes vivían copiadas en una docena de archivos, cada una con una variante
 * distinta (h-9 aquí, h-11 allá, con `shadow-xs` o sin él). Una sola fuente:
 * cambiar la altura de un select es cambiarla en todos.
 *
 * Los `h-11` de antes buscaban blancos táctiles; eso ya lo da la regla de
 * `@media (pointer: coarse)` en app/globals.css, así que aquí todo es h-9.
 */

export const claseSelect =
  'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none ' +
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

/** Para selects en un renglón: filtros de una tabla, una fila. */
export const claseSelectCompacto = claseSelect.replace('h-9 w-full px-3', 'h-8 w-auto px-2')

/**
 * Un <summary> secundario que NO es botón: subsecciones dentro de un panel ya
 * abierto ("Una persona", "Editar"). Lo que sí es botón usa `Desplegable`.
 */
export const claseResumen =
  'inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 ' +
  'text-sm font-medium transition-colors select-none hover:bg-muted ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ' +
  '[&::-webkit-details-marker]:hidden'

/** Encabezado chico de un bloque dentro de una tarjeta. */
export const claseTituloDeBloque = 'text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase'
