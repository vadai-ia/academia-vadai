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

/**
 * Convierte "2026-09-21" + "19:00" en CDMX al instante UTC correspondiente.
 *
 * Se calcula el desfase real de esa zona EN ESA FECHA, en vez de restar 6 horas
 * fijas: México dejó el horario de verano en 2022, pero la biblioteca de zonas
 * conoce la historia y una fecha pasada podría caer en -5. Restar a mano
 * introduce un error de una hora que nadie nota hasta que alguien llega tarde.
 *
 * Vivía privada en acciones-cohortes.ts; se movió aquí (M13) porque la fecha
 * límite de una dinámica se captura igual: en dos campos, en hora de CDMX.
 */
export function cdmxAUtc(fecha: string, hora: string): string | null {
  const tentativa = new Date(`${fecha}T${hora}:00Z`)
  if (Number.isNaN(tentativa.getTime())) return null

  const formateador = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_CDMX,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const partes = Object.fromEntries(
    formateador.formatToParts(tentativa).map((p) => [p.type, p.value])
  )

  const comoSiFueraUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour === '24' ? '00' : partes.hour),
    Number(partes.minute),
    Number(partes.second)
  )

  const desfase = comoSiFueraUtc - tentativa.getTime()
  return new Date(tentativa.getTime() - desfase).toISOString()
}

/**
 * "jue 24 de sep, 19:00", en CDMX. SIN el literal "(CDMX)": lo pone cada
 * pantalla junto al texto, para que quede fuera de un `tabular-nums` o dentro
 * de un `<span>` más chico según el caso.
 */
export function fechaHoraCdmx(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONA_CDMX,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    // Doce horas con "p.m.", como lo ve el alumno en su lista y en mis-cursos:
    // el admin y el alumno tienen que leer la misma hora de la misma forma.
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
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
