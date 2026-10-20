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
 * El café más barato que se compra en México (el de la tienda de la esquina)
 * cuesta más de $20. Es el piso de la comparación.
 */
const CAFE_MAS_BARATO_MXN = 20

/**
 * ¿Se puede decir «menos que un café al día»? (M23, 20-oct-2026)
 *
 * Alejandro pidió comparar con un gasto hormiga que casi todos pagan, no con
 * una cifra: «aquí realmente es una inversión en su nueva educación». $349 al
 * mes son $11.47 al día, menos que cualquier café, así que la frase es verdad.
 * Va calculada y no escrita a mano: si el precio sube a más de $608 al mes,
 * deja de pintarse sola en vez de mentir. Reemplaza «más barato que 3 cafés»
 * (exigía cafés de $116) y «menos de $12 al día» (no le gustó).
 */
export function menosQueUnCafe(precioMensualMxn: number): boolean {
  return (precioMensualMxn * 12) / 365 < CAFE_MAS_BARATO_MXN
}
