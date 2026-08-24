import 'server-only'

import { cache } from 'react'

import { esEquipo, obtenerSesion } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json, Tabla, Vista } from '@/lib/supabase/types'

export type FilaOutline = Vista<'lesson_outline'>
export type Progreso = Tabla<'lesson_progress'>

export type LeccionEnIndice = {
  id: string
  titulo: string
  tipo: string
  moduloId: string
  posicion: number
  obligatoria: boolean
  duracionSeg: number | null
  tieneVideo: boolean
  desbloqueada: boolean
  completada: boolean
}

export type ModuloEnIndice = {
  id: string
  titulo: string
  posicion: number
  lecciones: LeccionEnIndice[]
}

export type CursoDelAlumno = {
  id: string
  slug: string
  titulo: string
  descripcion: string | null
  portada: string | null
  vigente: boolean
  expiraEn: string | null
  diasRestantes: number | null
  totalLecciones: number
  completadas: number
  porcentaje: number
  modulos: ModuloEnIndice[]
  /** Enlaces de recompra, para el CTA de §6.3 cuando el acceso venció. */
  linkRecompraMxn: string | null
  linkRecompraUsd: string | null
}

/**
 * Lecturas del alumno.
 *
 * El índice del curso SIEMPRE sale de la vista `lesson_outline`, nunca de
 * `lessons`. Es lo que hace que el alumno con acceso vencido siga viendo la
 * estructura con candados (§3.3) mientras el contenido queda bloqueado: la vista
 * usa `has_enrollment` y la tabla usa `has_active_access`.
 *
 * `lesson_outline` ya trae `desbloqueada`, así que la UI no tiene que preguntar
 * aparte si pintar candado.
 */

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null
  const ms = new Date(fecha).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

function armarModulos(
  filas: FilaOutline[],
  titulosDeModulo: Map<string, { titulo: string; posicion: number }>,
  completadas: Set<string>
): ModuloEnIndice[] {
  const porModulo = new Map<string, LeccionEnIndice[]>()

  for (const fila of filas) {
    if (!fila.id || !fila.module_id) continue
    const lista = porModulo.get(fila.module_id) ?? []
    lista.push({
      id: fila.id,
      titulo: fila.title ?? 'Lección',
      tipo: fila.lesson_type ?? 'video',
      moduloId: fila.module_id,
      posicion: fila.position ?? 0,
      obligatoria: fila.is_required ?? true,
      duracionSeg: fila.video_duration_sec,
      tieneVideo: fila.tiene_video ?? false,
      desbloqueada: fila.desbloqueada ?? false,
      completada: completadas.has(fila.id),
    })
    porModulo.set(fila.module_id, lista)
  }

  return [...porModulo.entries()]
    .map(([moduloId, lecciones]) => {
      const meta = titulosDeModulo.get(moduloId)
      return {
        id: moduloId,
        titulo: meta?.titulo ?? 'Módulo',
        posicion: meta?.posicion ?? 0,
        lecciones: lecciones.sort((a, b) => a.posicion - b.posicion),
      }
    })
    .sort((a, b) => a.posicion - b.posicion)
}

/** Todo lo que el alumno necesita para /mis-cursos. */
export async function misCursos(): Promise<CursoDelAlumno[]> {
  const supabase = await crearClienteServidor()

  const { data: inscripciones, error } = await supabase
    .from('enrollments')
    .select('course_id, expires_at, status, courses(*)')
    .eq('status', 'active')

  if (error) {
    console.error(JSON.stringify({ operacion: 'misCursos', error: error.message }))
    return []
  }

  type Inscripcion = {
    course_id: string
    expires_at: string | null
    courses: Tabla<'courses'> | null
  }

  const filas = (inscripciones ?? []) as unknown as Inscripcion[]
  if (filas.length === 0) return []

  const { data: outline } = await supabase.from('lesson_outline').select('*')
  const { data: progreso } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed')

  const completadas = new Set(
    (progreso ?? []).filter((p) => p.completed).map((p) => p.lesson_id)
  )

  return filas
    .filter((fila) => fila.courses !== null)
    .map((fila) => {
      const curso = fila.courses as Tabla<'courses'>
      const suyas = (outline ?? []).filter((l) => l.course_id === curso.id)
      const hechas = suyas.filter((l) => l.id && completadas.has(l.id)).length
      const vigente = !fila.expires_at || new Date(fila.expires_at).getTime() > Date.now()

      return {
        id: curso.id,
        slug: curso.slug,
        titulo: curso.title,
        descripcion: curso.description,
        portada: curso.cover_url,
        vigente,
        expiraEn: fila.expires_at,
        diasRestantes: diasHasta(fila.expires_at),
        totalLecciones: suyas.length,
        completadas: hechas,
        porcentaje: suyas.length === 0 ? 0 : Math.round((hechas / suyas.length) * 100),
        modulos: [],
        linkRecompraMxn: curso.stripe_payment_link_mxn,
        linkRecompraUsd: curso.stripe_payment_link_usd,
      }
    })
    .sort((a, b) => Number(b.vigente) - Number(a.vigente) || a.titulo.localeCompare(b.titulo))
}

/**
 * Curso con su índice completo, para la vista de reproducción.
 *
 * Memorizado por petición: ahora lo piden el layout —que dibuja el encabezado
 * y las pestañas— y la página. Sin `cache()` serían dos rondas completas de
 * consultas para pintar una sola pantalla.
 */
export const cursoDelAlumno = cache(async function cursoDelAlumno(
  slug: string
): Promise<CursoDelAlumno | null> {
  const supabase = await crearClienteServidor()

  const { data: curso } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!curso) return null

  const { data: inscripcion } = await supabase
    .from('enrollments')
    .select('expires_at, status')
    .eq('course_id', curso.id)
    .eq('status', 'active')
    .maybeSingle()

  // El equipo entra sin estar inscrito, y esto no es una excepción cosmética:
  // sin ella un admin no puede abrir una lección para moderar su hilo (§6.4) ni
  // revisar el curso como lo ve el alumno. RLS ya se lo permite (`is_admin() or
  // has_active_access()`); lo que faltaba era que la consulta no lo cortara.
  const sesion = await obtenerSesion()
  const equipo = sesion.tipo === 'activo' && esEquipo(sesion.perfil)

  // Sin inscripción activa el curso no existe para este alumno. RLS ya lo
  // habría escondido, pero el chequeo explícito evita depender de eso.
  if (!inscripcion && !equipo) return null

  // Las tres son independientes entre sí: en serie son tres viajes de red
  // encadenados, en paralelo es uno solo de larga. Desde México eso son
  // decenas de milisegundos por consulta, y aquí se notan.
  const [{ data: modulos }, { data: outline }, { data: progreso }] = await Promise.all([
    supabase.from('modules').select('id, title, position').eq('course_id', curso.id),
    supabase.from('lesson_outline').select('*').eq('course_id', curso.id),
    supabase.from('lesson_progress').select('lesson_id, completed'),
  ])

  const completadas = new Set(
    (progreso ?? []).filter((p) => p.completed).map((p) => p.lesson_id)
  )

  const titulos = new Map(
    (modulos ?? []).map((m) => [m.id, { titulo: m.title, posicion: m.position }])
  )

  const filas = (outline ?? []) as FilaOutline[]
  const hechas = filas.filter((l) => l.id && completadas.has(l.id)).length
  const vigente =
    equipo || !inscripcion?.expires_at || new Date(inscripcion.expires_at).getTime() > Date.now()

  return {
    id: curso.id,
    slug: curso.slug,
    titulo: curso.title,
    descripcion: curso.description,
    portada: curso.cover_url,
    vigente,
    expiraEn: inscripcion?.expires_at ?? null,
    diasRestantes: diasHasta(inscripcion?.expires_at ?? null),
    totalLecciones: filas.length,
    completadas: hechas,
    porcentaje: filas.length === 0 ? 0 : Math.round((hechas / filas.length) * 100),
    modulos: armarModulos(filas, titulos, completadas),
    linkRecompraMxn: curso.stripe_payment_link_mxn,
    linkRecompraUsd: curso.stripe_payment_link_usd,
  }
})

export type ContenidoDeLeccion = {
  id: string
  titulo: string
  tipo: string
  descripcion: Json | null
  bunnyVideoId: string | null
  duracionSeg: number | null
  adjuntos: Array<{ id: string; nombre: string; ruta: string; bytes: number | null }>
  segundosVistos: number
  completada: boolean
}

/**
 * Contenido protegido de una lección.
 *
 * Devuelve null si el acceso venció: la policy de `lessons` exige
 * `has_active_access`, así que la consulta sencillamente no trae filas. La
 * página lo traduce a la pantalla de acceso vencido.
 */
export async function contenidoDeLeccion(leccionId: string): Promise<ContenidoDeLeccion | null> {
  const supabase = await crearClienteServidor()

  const { data: leccion } = await supabase
    .from('lessons')
    .select('*, lesson_attachments(id, file_name, storage_path, size_bytes)')
    .eq('id', leccionId)
    .maybeSingle()

  if (!leccion) return null

  const { data: progreso } = await supabase
    .from('lesson_progress')
    .select('completed, seconds_watched')
    .eq('lesson_id', leccionId)
    .maybeSingle()

  type Anidado = Tabla<'lessons'> & {
    lesson_attachments: Array<{
      id: string
      file_name: string
      storage_path: string
      size_bytes: number | null
    }>
  }
  const fila = leccion as unknown as Anidado

  return {
    id: fila.id,
    titulo: fila.title,
    tipo: fila.lesson_type,
    descripcion: fila.description_rich,
    bunnyVideoId: fila.bunny_video_id,
    duracionSeg: fila.video_duration_sec,
    adjuntos: (fila.lesson_attachments ?? []).map((a) => ({
      id: a.id,
      nombre: a.file_name,
      ruta: a.storage_path,
      bytes: a.size_bytes,
    })),
    segundosVistos: progreso?.seconds_watched ?? 0,
    completada: progreso?.completed ?? false,
  }
}

/** Lección anterior y siguiente, para navegar sin volver al índice. */
export function vecinas(curso: CursoDelAlumno, leccionId: string) {
  const planas = curso.modulos.flatMap((m) => m.lecciones)
  const i = planas.findIndex((l) => l.id === leccionId)
  return {
    anterior: i > 0 ? planas[i - 1] : null,
    siguiente: i >= 0 && i < planas.length - 1 ? planas[i + 1] : null,
    indice: i,
    total: planas.length,
  }
}
