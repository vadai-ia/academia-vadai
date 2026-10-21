/**
 * Dónde vive cada cosa de V-AI-P por dentro (M26, 21-oct-2026).
 *
 * Una grabación y una herramienta son lecciones de la casa, pero nunca se abren
 * como lección de un curso (`/curso/<casa>/<id>` redirige aquí): V-AI-P no es
 * un curso. Puro, sin `server-only`: lo usan páginas, acciones y suites.
 */

export const RUTA_CLASES = '/vaip/clases'
export const RUTA_HERRAMIENTAS = '/vaip/herramientas'
export const PANEL_CLASES = '/admin/vaip/clases'
export const PANEL_HERRAMIENTAS = '/admin/vaip/herramientas'

export type TipoDeContenido = 'mes' | 'herramientas'

/** La página del miembro. Una herramienta puede llevar la etiqueta por la que llegó. */
export function rutaDeContenido(tipo: TipoDeContenido, leccionId: string, etiqueta?: string | null): string {
  if (tipo === 'mes') return `${RUTA_CLASES}/${leccionId}`
  return `${RUTA_HERRAMIENTAS}/${leccionId}${etiqueta ? `?etiqueta=${encodeURIComponent(etiqueta)}` : ''}`
}

/** El editor del panel. */
export function rutaEnElPanel(tipo: TipoDeContenido, leccionId: string): string {
  return `${tipo === 'mes' ? PANEL_CLASES : PANEL_HERRAMIENTAS}/${leccionId}`
}

/** Una etiqueta en la URL: minúsculas, números y guiones. Lo demás se ignora. */
export function etiquetaValida(valor: string | null | undefined): string | null {
  return valor && /^[a-z0-9-]{2,40}$/.test(valor) ? valor : null
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * Las partes de una fecha de calendario (`YYYY-MM-DD`, la columna `date` de la
 * grabación). Se lee a mediodía UTC: así ninguna zona horaria la mueve de día.
 */
export function partesDeFecha(fecha: string): { dia: number; mes: string; mesCorto: string; diaDeLaSemana: string; anio: number } {
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00Z`)
  const mes = MESES[d.getUTCMonth()] ?? ''
  return {
    dia: d.getUTCDate(),
    mes,
    mesCorto: mes.slice(0, 3),
    diaDeLaSemana: DIAS[d.getUTCDay()] ?? '',
    anio: d.getUTCFullYear(),
  }
}

/** «Lunes 26 de octubre» (con el año si no es el actual). */
export function fechaDeClase(fecha: string, anioActual = new Date().getUTCFullYear()): string {
  const p = partesDeFecha(fecha)
  const dia = p.diaDeLaSemana.charAt(0).toUpperCase() + p.diaDeLaSemana.slice(1)
  return `${dia} ${p.dia} de ${p.mes}${p.anio === anioActual ? '' : ` de ${p.anio}`}`
}

/** «Octubre 2026», a partir del día 1 del mes. */
export function nombreDeMes(mes: string): string {
  const p = partesDeFecha(mes)
  return `${p.mes.charAt(0).toUpperCase()}${p.mes.slice(1)} ${p.anio}`
}

/** «12 min», «1 h 5 min»; null si no se sabe. */
export function duracionCorta(segundos: number | null): string | null {
  if (!segundos || segundos <= 0) return null
  const minutos = Math.max(1, Math.round(segundos / 60))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

/** El slug de una etiqueta a partir de su nombre: «RH y nómina» → «rh-y-nomina». */
export function slugDeEtiqueta(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
