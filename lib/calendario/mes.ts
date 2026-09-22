import { DIAS, diaDeLaSemana, sumarDias, utcACdmx, ZONA_CDMX } from '@/lib/admin/fechas'
import { terminaEn } from '@/lib/calendario/estado'

/**
 * Lo que necesita una rejilla de mes, en hora de la Ciudad de México.
 *
 * Todo se calcula sobre cadenas 'YYYY-MM-DD' de CDMX, nunca sobre `Date` en la
 * zona del servidor: una sesión de las 11 de la noche cae en su día de México,
 * no en el del UTC del día siguiente (CLAUDE.md, decisión del 21-sep-2026).
 */

/** Null = relleno antes del día 1 o después del último. */
export type Celda = { fecha: string; dia: number } | null

/** La semana empieza en lunes, como se lee un calendario en México. */
export const ENCABEZADO_SEMANA = [1, 2, 3, 4, 5, 6, 0].map((i) => DIAS[i])

export const hoyCdmx = (ahora: number = Date.now()): string =>
  utcACdmx(new Date(ahora).toISOString()).fecha

/** 'YYYY-MM' del día de una fecha. */
export const mesDe = (fecha: string): string => fecha.slice(0, 7)

/** Los meses entre dos, inclusive. `tope` corta por si algo viene disparatado. */
export function mesesEntre(desde: string, hasta: string, tope = 6): string[] {
  const lista: string[] = []
  let anio = Number(desde.slice(0, 4))
  let mes = Number(desde.slice(5, 7))
  const fin = hasta
  for (let i = 0; i < 120; i += 1) {
    const actual = `${anio}-${String(mes).padStart(2, '0')}`
    if (actual > fin) break
    lista.push(actual)
    mes += 1
    if (mes > 12) {
      mes = 1
      anio += 1
    }
  }
  return lista.slice(0, tope)
}

/** El mes de al lado, en cualquier dirección. 'YYYY-MM' → 'YYYY-MM'. */
export function mesVecino(anioMes: string, pasos: number): string {
  let anio = Number(anioMes.slice(0, 4))
  let mes = Number(anioMes.slice(5, 7)) + pasos
  while (mes > 12) {
    mes -= 12
    anio += 1
  }
  while (mes < 1) {
    mes += 12
    anio -= 1
  }
  return `${anio}-${String(mes).padStart(2, '0')}`
}

/** Un 'YYYY-MM' de verdad, o null. Para no confiar en lo que venga en la URL. */
export function mesValido(valor: string | undefined | null): string | null {
  if (!valor || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) return null
  return valor
}

/** Las filas de un mes: 4 a 6 semanas, con relleno a los lados. */
export function celdasDelMes(anioMes: string): Celda[][] {
  const primero = `${anioMes}-01`
  const anio = Number(anioMes.slice(0, 4))
  const mes = Number(anioMes.slice(5, 7))
  // El día 0 del mes siguiente es el último de este.
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  // diaDeLaSemana da 0=domingo; la rejilla empieza en lunes.
  const desfase = (diaDeLaSemana(primero) + 6) % 7

  const celdas: Celda[] = Array.from({ length: desfase }, () => null)
  for (let i = 0; i < dias; i += 1) celdas.push({ fecha: sumarDias(primero, i), dia: i + 1 })
  while (celdas.length % 7 !== 0) celdas.push(null)

  const filas: Celda[][] = []
  for (let i = 0; i < celdas.length; i += 7) filas.push(celdas.slice(i, i + 7))
  return filas
}

/** "Septiembre de 2026". */
export function nombreMes(anioMes: string): string {
  const texto = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${anioMes}-15T12:00:00Z`))
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Días de calendario entre dos fechas 'YYYY-MM-DD'. */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000)
}

/** "Hoy", "Mañana", "En 3 días", "Ya pasó". */
export function etiquetaRelativa(fechaSesion: string, hoy: string): string {
  const n = diasEntre(hoy, fechaSesion)
  if (n < 0) return 'Ya pasó'
  if (n === 0) return 'Hoy'
  if (n === 1) return 'Mañana'
  return `En ${n} días`
}

/** Las piezas de una fecha, ya en CDMX, para armar bloques y renglones. */
export function partesCdmx(iso: string) {
  const f = (opciones: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-MX', { timeZone: ZONA_CDMX, ...opciones }).format(new Date(iso))

  return {
    fecha: utcACdmx(iso).fecha,
    diaNumero: f({ day: 'numeric' }),
    diaSemanaCorto: f({ weekday: 'short' }),
    diaSemanaLargo: f({ weekday: 'long' }),
    mesCorto: f({ month: 'short' }),
    mesLargo: f({ month: 'long' }),
    hora: f({ hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

/** "6:00 p.m. a 8:30 p.m." */
export function rangoHorario(iso: string): string {
  const inicio = partesCdmx(iso).hora
  const fin = partesCdmx(terminaEn(iso)).hora
  return `${inicio} a ${fin}`
}

/** "6 pm", para las celdas angostas del calendario en el teléfono. */
export function horaCorta(iso: string): string {
  return partesCdmx(iso)
    .hora.replace(':00', '')
    .replace(/\s?p\.\s?m\./i, ' pm')
    .replace(/\s?a\.\s?m\./i, ' am')
}
