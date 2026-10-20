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

// Sin comparación de precio (decidido por Alejandro el 20-oct-2026): ni «3
// cafés», ni «menos de $12 al día», ni «menos que un café al día». El precio
// va solo, con el tachado.
