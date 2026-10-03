import { hoyCdmx } from '@/lib/calendario/mes'

/**
 * Vocabulario de generaciones (M16). Sin `server-only`: lo usan el panel, la
 * vista del alumno y el catálogo, y es puro.
 *
 * Una generación es lo que antes se llamaba «cohorte»: un grupo del curso con
 * su propio contenido, calendario y comunidad. En la base la tabla sigue
 * llamándose `cohorts`; en pantalla, nunca.
 */

export type EstadoGeneracion = 'abierta' | 'en_curso' | 'terminada'

export const ETIQUETA_ESTADO: Record<EstadoGeneracion, string> = {
  abierta: 'Abierta a inscripciones',
  en_curso: 'En curso',
  terminada: 'Terminada',
}

/** «Terminada» se deriva de la fecha de fin, igual que lo hace la base. */
export function estadoDeGeneracion(
  g: { open_for_enrollment: boolean; ends_on: string | null },
  hoy: string = hoyCdmx()
): EstadoGeneracion {
  if (g.ends_on !== null && g.ends_on < hoy) return 'terminada'
  return g.open_for_enrollment ? 'abierta' : 'en_curso'
}

export function esPorGeneraciones(courseType: string | null | undefined): boolean {
  return courseType === 'cohort'
}

// Las columnas `date` llegan como 'AAAA-MM-DD'. Se formatean a mediodía UTC
// para que ninguna zona horaria corra el día.
const MES_CORTO = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' })
const DIA_MES = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const DIA_MES_ANIO = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const aMediodia = (fecha: string) => new Date(`${fecha}T12:00:00Z`)
const sinPunto = (s: string) => s.replace(/\./g, '')

/**
 * «sep–oct 2026», «nov 2026–ene 2027», «desde el 3 nov 2026» o '' si no hay
 * fechas. Es la segunda línea de la insignia que ve el alumno.
 */
export function rangoDeGeneracion(startsOn: string | null, endsOn: string | null): string {
  if (startsOn && endsOn) {
    const a = aMediodia(startsOn)
    const b = aMediodia(endsOn)
    const mismoAnio = a.getUTCFullYear() === b.getUTCFullYear()
    const mismoMes = mismoAnio && a.getUTCMonth() === b.getUTCMonth()
    if (mismoMes) return `${sinPunto(MES_CORTO.format(a))} ${a.getUTCFullYear()}`
    if (mismoAnio) {
      return `${sinPunto(MES_CORTO.format(a))}–${sinPunto(MES_CORTO.format(b))} ${a.getUTCFullYear()}`
    }
    return `${sinPunto(MES_CORTO.format(a))} ${a.getUTCFullYear()}–${sinPunto(MES_CORTO.format(b))} ${b.getUTCFullYear()}`
  }
  if (startsOn) return `desde el ${sinPunto(DIA_MES_ANIO.format(aMediodia(startsOn)))}`
  if (endsOn) return `hasta el ${sinPunto(DIA_MES_ANIO.format(aMediodia(endsOn)))}`
  return ''
}

/** «3 nov» para la tarjeta del catálogo. */
export function diaCorto(fecha: string): string {
  return sinPunto(DIA_MES.format(aMediodia(fecha)))
}

/**
 * La generación que se opera por omisión: la abierta a inscripciones; si no
 * hay, la más reciente (la lista llega ordenada así). Es la pestaña con la que
 * abre el panel y la que ve el equipo en «Vista de alumno».
 */
export function generacionPorOmision<T extends { open_for_enrollment: boolean; ends_on: string | null }>(
  lista: T[]
): T | null {
  return lista.find((g) => estadoDeGeneracion(g) === 'abierta') ?? lista[0] ?? null
}
