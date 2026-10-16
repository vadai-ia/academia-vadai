/**
 * Hasta cuándo da acceso una suscripción (M17). Es la ÚNICA regla: la usan el
 * webhook al guardar `memberships.access_until`, la sincronización de
 * inscripciones y las pantallas que dicen «tienes acceso hasta…».
 *
 * Se basa en la suscripción, no en las facturas: cuando una renovación falla,
 * Stripe igual avanza el periodo. Si el acceso siguiera a `current_period_end`,
 * un pago atrasado regalaría el mes completo.
 *
 * Puro y sin `server-only`: lo prueban las suites.
 */

export type EstadoSuscripcion =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

/** Margen tras el fin del periodo pagado, para que una renovación que tarda no corte a nadie. */
export const GRACIA_ACTIVA_DIAS = 2
/** Días de acceso, desde que empezó el periodo, mientras Stripe reintenta un cobro fallido. */
export const GRACIA_ATRASO_DIAS = 5

const DIA = 24 * 60 * 60 * 1000

export type DatosDeAcceso = {
  status: EstadoSuscripcion
  current_period_start: string | null
  current_period_end: string | null
  ended_at: string | null
}

const fecha = (iso: string | null): number | null => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : t
}

/**
 * La fecha límite de acceso, o null si esta suscripción no da ninguno.
 *
 * `ahora` solo importa cuando el periodo todavía no se conoce (la fila nació
 * del checkout antes de que llegara la suscripción): se da un acceso
 * provisional de `GRACIA_ACTIVA_DIAS`, que el siguiente evento corrige.
 */
export function accesoHasta(m: DatosDeAcceso, ahora: Date = new Date()): string | null {
  const inicio = fecha(m.current_period_start)
  const fin = fecha(m.current_period_end)
  const terminada = fecha(m.ended_at)

  switch (m.status) {
    case 'active':
    case 'trialing': {
      const base = fin ?? ahora.getTime()
      return new Date(base + GRACIA_ACTIVA_DIAS * DIA).toISOString()
    }
    case 'past_due': {
      if (inicio === null) return null
      const limite = inicio + GRACIA_ATRASO_DIAS * DIA
      return new Date(fin !== null ? Math.min(limite, fin + GRACIA_ACTIVA_DIAS * DIA) : limite).toISOString()
    }
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired': {
      // Cancelar al fin del periodo conserva lo pagado; cancelar de inmediato
      // (o un reembolso con cancelación) corta en `ended_at`.
      const candidatos = [fin, terminada].filter((t): t is number => t !== null)
      if (candidatos.length === 0) return null
      return new Date(Math.min(...candidatos)).toISOString()
    }
    case 'incomplete':
    case 'paused':
      return null
  }
}

/** La mayor de varias fechas de acceso: quien cancela y vuelve tiene dos suscripciones. */
export function accesoMayor(fechas: (string | null)[]): string | null {
  const validas = fechas.map(fecha).filter((t): t is number => t !== null)
  if (validas.length === 0) return null
  return new Date(Math.max(...validas)).toISOString()
}

/** ¿Esa fecha de acceso sigue vigente? */
export function vigente(hasta: string | null, ahora: Date = new Date()): boolean {
  const t = fecha(hasta)
  return t !== null && t > ahora.getTime()
}
