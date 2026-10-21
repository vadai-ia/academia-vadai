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

const DIA_DEL_MES = new Intl.DateTimeFormat('es-MX', { day: 'numeric', timeZone: 'UTC' })
const MES_LARGO = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' })

/**
 * «del 5 al 23 de noviembre de 2026», con las palabras completas: es como lo
 * dice el correo de «Ya estás en la Generación 2» (M25). '' si no hay fechas.
 */
export function fechasDeGeneracion(startsOn: string | null, endsOn: string | null): string {
  const partes = (fecha: string) => {
    const d = aMediodia(fecha)
    return { dia: DIA_DEL_MES.format(d), mes: MES_LARGO.format(d), anio: d.getUTCFullYear() }
  }
  if (startsOn && endsOn) {
    const a = partes(startsOn)
    const b = partes(endsOn)
    if (a.anio !== b.anio) return `del ${a.dia} de ${a.mes} de ${a.anio} al ${b.dia} de ${b.mes} de ${b.anio}`
    if (a.mes !== b.mes) return `del ${a.dia} de ${a.mes} al ${b.dia} de ${b.mes} de ${b.anio}`
    return `del ${a.dia} al ${b.dia} de ${b.mes} de ${b.anio}`
  }
  if (startsOn) {
    const a = partes(startsOn)
    return `a partir del ${a.dia} de ${a.mes} de ${a.anio}`
  }
  if (endsOn) {
    const b = partes(endsOn)
    return `hasta el ${b.dia} de ${b.mes} de ${b.anio}`
  }
  return ''
}

/** «Generación 2» de «Generación 2 · nov–dic 2026»: el nombre sin las fechas. */
export function nombreCortoDeGeneracion(nombre: string): string {
  return nombre.split(' · ')[0]?.trim() || nombre
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
