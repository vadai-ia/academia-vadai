/**
 * Fechas de sesión en CDMX, para pintar formularios.
 *
 * Sin `server-only` a propósito: es aritmética de fechas, sin secretos, y así
 * la pueden usar componentes de cliente si hace falta.
 */

export const ZONA_CDMX = 'America/Mexico_City'

/**
 * Un instante UTC → ("2026-09-21", "19:00") en CDMX.
 *
 * Es lo que llena el formulario de editar una sesión: la fecha y la hora que
 * el equipo capturó, no las del navegador de quien edita. Sin esto el
 * formulario salía vacío y "no se guardaba lo que ya tenía la sesión".
 */
export function utcACdmx(iso: string): { fecha: string; hora: string } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_CDMX,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  )
  const hora = partes.hour === '24' ? '00' : partes.hour
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${hora}:${partes.minute}` }
}

/** 0 = domingo … 6 = sábado, de una fecha "YYYY-MM-DD" como día de calendario. */
export function diaDeLaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay()
}

/** "YYYY-MM-DD" + n días. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const
