import type { MiMembresia } from '@/lib/membresia/consultas'

/**
 * Lo que la página de venta necesita saber de quien la abre (M23, 20-oct-2026).
 *
 *   - `nueva`: nunca ha pagado. «Unirme a V-AI-P».
 *   - `vencida`: fue miembro y su acceso terminó. «Volver a V-AI-P», con la
 *     fecha en que terminó.
 *   - `sinTerminar`: empezó a pagar y no terminó (Stripe la deja en
 *     `incomplete`). «Terminar mi suscripción».
 *
 * Un miembro vigente nunca llega aquí: /vaip le muestra el muro.
 */
export type SituacionDeVenta = 'nueva' | 'vencida' | 'sinTerminar'

export function situacionDeVenta(membresia: MiMembresia | null): SituacionDeVenta {
  if (!membresia) return 'nueva'
  if (membresia.estado === 'incomplete') return 'sinTerminar'
  if (!membresia.vigente) return 'vencida'
  return 'nueva'
}

/**
 * El tope entero de lo que cuesta al día, para decir «menos de $X al día» sin
 * prometer de menos: $349 al mes son $11.47 al día en promedio → «menos de
 * $12». Si el promedio diera exacto ($12.00), el tope sube a $13: «menos de»
 * tiene que ser verdad. Reemplaza «más barato que 3 cafés», que exigía cafés
 * de $116.
 */
export function costoDiario(precioMensualMxn: number): number {
  return Math.floor((precioMensualMxn * 12) / 365) + 1
}
