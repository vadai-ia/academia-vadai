/**
 * Por qué se va alguien de una membresía (M18). Sin `server-only`: la lista la
 * pinta el paso 2 de /perfil/membresia y la lee el webhook.
 *
 * Cada motivo propio tiene su par en el `feedback` de Stripe, para que el que
 * se elige en la plataforma llegue también a Stripe, y el que se elige en el
 * portal de Stripe caiga en el motivo propio más cercano.
 */

export const MOTIVOS = [
  { clave: 'precio', etiqueta: 'Ahorita no me alcanza o se me hace caro', stripe: 'too_expensive' },
  { clave: 'tiempo', etiqueta: 'No tengo tiempo de aprovecharla', stripe: 'unused' },
  { clave: 'contenido', etiqueta: 'No encontré lo que buscaba', stripe: 'missing_features' },
  { clave: 'otra_opcion', etiqueta: 'Me voy con otra opción', stripe: 'switched_service' },
  { clave: 'calidad', etiqueta: 'Esperaba otra calidad', stripe: 'low_quality' },
  { clave: 'otro', etiqueta: 'Otra razón', stripe: 'other' },
] as const

export type ClaveDeMotivo = (typeof MOTIVOS)[number]['clave'] | 'sin_motivo'
export type FeedbackDeStripe = (typeof MOTIVOS)[number]['stripe']

export const esMotivo = (valor: unknown): valor is (typeof MOTIVOS)[number]['clave'] =>
  MOTIVOS.some((m) => m.clave === valor)

export const etiquetaDeMotivo = (clave: string): string =>
  MOTIVOS.find((m) => m.clave === clave)?.etiqueta ?? 'No dijo por qué'

export const feedbackDe = (clave: (typeof MOTIVOS)[number]['clave']): FeedbackDeStripe =>
  MOTIVOS.find((m) => m.clave === clave)?.stripe ?? 'other'

/** El `feedback` del portal de Stripe, en el motivo propio más cercano. */
export function motivoDeStripe(feedback: string | null): ClaveDeMotivo {
  if (!feedback) return 'sin_motivo'
  if (feedback === 'too_complex' || feedback === 'customer_service') return 'calidad'
  return MOTIVOS.find((m) => m.stripe === feedback)?.clave ?? 'otro'
}
