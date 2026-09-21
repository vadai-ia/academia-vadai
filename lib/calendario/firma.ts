import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Firma de la URL del .ics de una cohorte, para que "Agregar todas a mi
 * calendario" funcione desde el CORREO sin sesión (21-sep-2026).
 *
 * Quien abre el correo en el teléfono casi nunca tiene sesión en el navegador
 * del correo: sin esto, el botón devolvía un 401 en JSON. Las fechas y la liga
 * de la sesión no son secreto —van en el mismo correo—, pero la firma evita
 * que cualquiera recorra ids de cohortes al azar. Es determinista por cohorte
 * (no caduca) y va con la misma sal que la cuota de encuestas.
 */

function sal(): string {
  return process.env.ENCUESTAS_IP_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'sin-sal'
}

export function firmaDeCohorte(cohorteId: string): string {
  return createHash('sha256').update(`ics-cohorte|${cohorteId}|${sal()}`).digest('hex').slice(0, 32)
}

export function firmaValida(cohorteId: string, firma: string | null | undefined): boolean {
  if (!firma) return false
  const esperada = Buffer.from(firmaDeCohorte(cohorteId))
  const recibida = Buffer.from(firma)
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
}

/** La URL completa que va en el correo. */
export function urlIcsDeCohorte(base: string, cohorteId: string): string {
  return `${base.replace(/\/+$/, '')}/api/calendario/cohorte/${cohorteId}?t=${firmaDeCohorte(cohorteId)}`
}
