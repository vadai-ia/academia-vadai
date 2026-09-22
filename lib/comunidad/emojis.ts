/**
 * Las reacciones que existen, y su forma.
 *
 * Vive APARTE de `reacciones.ts` porque ese archivo es `server-only` —hace
 * consultas— y esta lista la necesita también el componente de cliente que
 * pinta la fila de emojis. Importar el otro desde el cliente reventaría el
 * build, y duplicar la lista sería peor: la que manda es el constraint de
 * `academia_0030`, y tener dos copias en el código es cómo se desincronizan.
 */

export const EMOJIS = [
  { emoji: '👍', etiqueta: 'Me gusta' },
  { emoji: '👏', etiqueta: 'Aplausos' },
  { emoji: '🚀', etiqueta: 'Esto va a volar' },
  { emoji: '❤️', etiqueta: 'Me encanta' },
  { emoji: '💡', etiqueta: 'Buena idea' },
  { emoji: '🔥', etiqueta: 'Está ardiendo' },
] as const

/** El emoji como tipo cerrado: la columna de la base también lo es. */
export type Emoji = (typeof EMOJIS)[number]['emoji']

const VALIDOS: ReadonlySet<string> = new Set<string>(EMOJIS.map((e) => e.emoji))

/**
 * Estrecha un texto cualquiera a un emoji de la lista.
 *
 * Es un type guard y no un `includes` suelto porque la columna `emoji` está
 * tipada con la union cerrada: sin estrechar, TypeScript no deja ni consultarla
 * ni escribirla, y forzarlo con `as` desactivaría justo la comprobación que
 * hace falta.
 */
export function esEmoji(valor: string): valor is Emoji {
  return VALIDOS.has(valor)
}

/**
 * Cuántas de cada emoji y cuáles puse yo.
 *
 * `mias` es un arreglo y no un `Set` a propósito: estos datos cruzan del
 * servidor al componente de cliente que pinta el feed, y React no serializa un
 * `Set` en las props. Con `Set` el feed se cae al renderizar.
 */
export type ReaccionesDe = {
  conteo: Record<string, number>
  mias: string[]
  total: number
}

export const SIN_REACCIONES: ReaccionesDe = { conteo: {}, mias: [], total: 0 }
