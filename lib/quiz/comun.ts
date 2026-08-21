/**
 * Piezas de quiz que necesitan tanto el servidor como el navegador.
 *
 * Vive aparte de `lib/admin/quizzes.ts` porque ese módulo lleva `server-only`:
 * el formulario de alta de preguntas es un client component y necesita `LETRAS`
 * para pintar los campos. Importar un valor desde un módulo server-only rompe
 * el build, y con razón.
 *
 * Aquí no hay nada sensible: son las letras de las opciones y un lector de
 * jsonb. `correct_option_id` nunca pasa por este archivo.
 */

export type Opcion = { id: string; text: string }

/** Ids de opción: estables, legibles y suficientes para opción múltiple. */
export const LETRAS = ['a', 'b', 'c', 'd', 'e'] as const

/**
 * Lee las opciones de una pregunta, que en la base son jsonb.
 *
 * Se valida la forma en vez de confiar: el jsonb pudo escribirse desde otra
 * parte, y una opción sin `id` rompería la calificación en silencio.
 */
export function leerOpciones(crudo: unknown): Opcion[] {
  if (!Array.isArray(crudo)) return []
  return crudo.flatMap((o) => {
    if (typeof o !== 'object' || o === null) return []
    const { id, text } = o as { id?: unknown; text?: unknown }
    if (typeof id !== 'string' || typeof text !== 'string') return []
    return [{ id, text }]
  })
}
