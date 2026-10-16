import type { Actividad } from '@/lib/gamificacion/reglas'

/**
 * Los logros (M17, V-AI-P). Como los puntos, NO se guardan: se calculan de lo
 * que la persona ya hizo (`actividad_por_curso`), de cuánto lleva en V-AI-P y
 * de su lugar en el ranking. Si mañana cambia una regla, cambia para todos y
 * nadie queda con un logro que ya no se explica.
 *
 * Puro y sin `server-only`: lo usan el perfil de miembro, /puntos y el espacio.
 */

export type Logro = {
  clave: string
  nombre: string
  detalle: string
  ganado: boolean
  /** Para los que se cuentan: cuánto lleva y cuánto pide. */
  avance: { actual: number; meta: number } | null
}

export type DatosDeLogros = {
  actividad: Actividad
  /** Desde cuándo es miembro de V-AI-P (la primera suscripción), o null. */
  miembroDesde: string | null
  /** Su lugar en el ranking de V-AI-P (1 = primero), o null si no aparece. */
  lugar: number | null
  ahora?: Date
}

/** Hasta esta fecha, quien se une es «miembro fundador» (decisión de M17). */
export const FIN_DE_FUNDADORES = '2026-11-30T23:59:59-06:00'

const DIA = 24 * 60 * 60 * 1000

function contado(clave: string, nombre: string, detalle: string, actual: number, meta: number): Logro {
  return { clave, nombre, detalle, ganado: actual >= meta, avance: { actual: Math.min(actual, meta), meta } }
}

export function logrosDe(d: DatosDeLogros): Logro[] {
  const ahora = (d.ahora ?? new Date()).getTime()
  const desde = d.miembroDesde ? Date.parse(d.miembroDesde) : null
  const meses = desde === null ? 0 : Math.floor((ahora - desde) / (30 * DIA))
  const a = d.actividad

  return [
    contado('primera-leccion', 'Primer paso', 'Completó su primera lección.', a.lecciones, 1),
    contado('primera-publicacion', 'Rompió el hielo', 'Publicó por primera vez en el muro.', a.publicaciones, 1),
    contado('conversador', 'Conversador', 'Comentó 10 veces en el muro.', a.comentarios, 10),
    contado('constante', 'Constante', 'Completó 25 lecciones.', a.lecciones, 25),
    contado('certificado', 'Certificado', 'Ganó su primer certificado de curso.', a.certificados, 1),
    {
      clave: 'fundador',
      nombre: 'Miembro fundador',
      detalle: 'Se unió a V-AI-P en su primer mes.',
      ganado: desde !== null && desde <= Date.parse(FIN_DE_FUNDADORES),
      avance: null,
    },
    contado('3-meses', '3 meses en V-AI-P', 'Lleva tres meses como miembro.', meses, 3),
    contado('6-meses', '6 meses en V-AI-P', 'Lleva seis meses como miembro.', meses, 6),
    contado('12-meses', 'Un año en V-AI-P', 'Lleva un año como miembro.', meses, 12),
    {
      clave: 'top-10',
      nombre: 'Top 10',
      detalle: 'Está entre los diez primeros del ranking de V-AI-P.',
      ganado: d.lugar !== null && d.lugar <= 10,
      avance: null,
    },
  ]
}
