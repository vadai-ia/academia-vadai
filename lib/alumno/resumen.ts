import 'server-only'

import { misCursos, type CursoDelAlumno, type LeccionEnIndice } from '@/lib/alumno/consultas'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { sesionesDelAlumno, type SesionDelAlumno } from '@/lib/alumno/sesiones'
import { obtenerSesion } from '@/lib/auth/sesion'
import { misCertificados, type CertificadoDelAlumno } from '@/lib/certificados/consultas'
import { publicacionesParaAlumno, type AnuncioParaAlumno } from '@/lib/comunidad/posts'
import { miNivel, type MiNivel } from '@/lib/gamificacion/consultas'

export type Retomar = {
  curso: CursoDelAlumno
  leccion: LeccionEnIndice
  /** true si todavía no ha empezado ninguna lección. */
  empezando: boolean
}

export type ResumenAlumno = {
  cursos: CursoDelAlumno[]
  retomar: Retomar | null
  anuncio: AnuncioParaAlumno | null
  entradas: AnuncioParaAlumno[]
  proximaSesion: SesionDelAlumno | null
  certificados: CertificadoDelAlumno[]
  leccionesHechas: number
  leccionesTotales: number
  /** Puntos, nivel y lugar en cada grupo (lib/gamificacion). */
  nivel: MiNivel
}

/**
 * Todo lo que necesita el tablero del alumno, en un solo lugar.
 *
 * El tablero reemplaza a la lista de tarjetas de cursos que había antes. La
 * diferencia no es de adorno: con solo la lista, el alumno tenía que entrar a un
 * curso para enterarse de que había una sesión en vivo mañana, o de que había
 * una entrada nueva en el blog. Todo lo que no estaba en esa pantalla,
 * simplemente no existía.
 *
 * La pieza central es `retomar`. En un curso de ocho semanas, casi toda visita
 * es para seguir donde se quedó, y esa acción merecía estar arriba y sola en vez
 * de a dos clics.
 *
 * Se consulta todo en paralelo: son cinco viajes independientes a Supabase y
 * encadenarlos costaría medio segundo de más en la pantalla que más se abre.
 */
export async function resumenDelAlumno(): Promise<ResumenAlumno> {
  const sesion = await obtenerSesion()
  const userId = sesion.tipo === 'activo' ? sesion.perfil.user_id : ''

  const [cursos, anuncios, entradas, sesiones, certificados, nivel] = await Promise.all([
    misCursos(),
    publicacionesParaAlumno('announcement'),
    publicacionesParaAlumno('blog'),
    sesionesDelAlumno(),
    misCertificados(),
    miNivel(userId),
  ])

  const leccionesHechas = cursos.reduce((n, c) => n + c.completadas, 0)
  const leccionesTotales = cursos.reduce((n, c) => n + c.totalLecciones, 0)

  const ahora = Date.now()
  const proximaSesion =
    sesiones.find((s) => new Date(s.programadaEn).getTime() > ahora) ?? null

  return {
    cursos,
    retomar: await siguientePaso(cursos),
    anuncio: anuncios[0] ?? null,
    entradas: entradas.slice(0, 3),
    proximaSesion,
    certificados,
    leccionesHechas,
    leccionesTotales,
    nivel,
  }
}

/**
 * La lección con la que conviene seguir.
 *
 * Se elige el curso vigente con más avance pero sin terminar: es el que la
 * persona tiene fresco. Empezar por el que lleva 0% cuando hay otro al 80%
 * obliga a cambiar de contexto sin motivo.
 *
 * `misCursos()` no trae el índice —serían todas las lecciones de todos los
 * cursos para pintar una tarjeta—, así que el detalle se pide solo del curso
 * elegido. Es un viaje más, y solo uno.
 */
async function siguientePaso(cursos: CursoDelAlumno[]): Promise<Retomar | null> {
  const candidatos = cursos
    .filter((c) => c.vigente && c.totalLecciones > 0 && c.porcentaje < 100)
    .sort((a, b) => b.porcentaje - a.porcentaje)

  const elegido = candidatos[0]
  if (!elegido) return null

  const completo = await cursoDelAlumno(elegido.slug)
  if (!completo) return null

  const planas = completo.modulos.flatMap((m) => m.lecciones)
  const leccion =
    planas.find((l) => l.desbloqueada && !l.completada) ?? planas.find((l) => l.desbloqueada)

  if (!leccion) return null

  return { curso: completo, leccion, empezando: completo.completadas === 0 }
}
