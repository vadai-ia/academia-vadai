/**
 * Los diplomas de certificación VADAI · Total Coach (15-oct-2026).
 *
 * Uno por GENERACIÓN: todo alumno inscrito en ella lo recibe y lo ve en «Mis
 * certificaciones» a partir de `visibleDesde`. No es el certificado por curso
 * completado (`certificates`, que exige el 100 % de lecciones): es el diploma
 * del programa, que firma el equipo.
 *
 * No hay tabla: quién lo tiene sale de `enrollments` y el folio se calcula
 * (`lib/diplomas/folio.ts`). Una generación nueva es una entrada más aquí.
 */

export type Firmante = { nombre: string; cargo: string }

export type Programa = {
  /** Va dentro del folio: no se cambia una vez emitido. */
  clave: string
  cursoSlug: string
  cohortId: string
  curso: string
  generacion: string
  periodo: string
  /** Fecha de emisión, como se imprime. */
  emitido: string
  /** Desde cuándo lo ven los alumnos (ISO con zona). El equipo lo ve siempre. */
  visibleDesde: string
  firmantes: Firmante[]
}

export const PROGRAMAS: Programa[] = [
  {
    clave: 'CTE1',
    cursoSlug: 'claude-en-tu-empresa',
    cohortId: 'c5a7114a-8a3e-4c58-9fbf-8f8f961ae90d',
    curso: 'Claude en tu Empresa',
    generacion: 'Generación 1',
    periodo: 'Septiembre – octubre de 2026',
    emitido: '15 de octubre de 2026',
    // 8:30 pm en la Ciudad de México (UTC−6 todo el año).
    visibleDesde: '2026-10-15T20:30:00-06:00',
    firmantes: [
      { nombre: 'Alejandro Martínez', cargo: 'VADAI' },
      { nombre: 'Roberto Martínez Licón', cargo: 'Total Coach' },
      { nombre: 'Roberto Martínez Ortiz', cargo: 'Total Coach' },
    ],
  },
]

export function programaPorClave(clave: string): Programa | null {
  return PROGRAMAS.find((p) => p.clave === clave) ?? null
}

export function yaVisible(p: Programa, ahora: Date = new Date()): boolean {
  return ahora.getTime() >= Date.parse(p.visibleDesde)
}
