import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

export type Curso = Tabla<'courses'>
export type Modulo = Tabla<'modules'>
export type Leccion = Tabla<'lessons'>
export type Adjunto = Tabla<'lesson_attachments'>

export type ModuloConLecciones = Modulo & { lecciones: Leccion[] }
export type CursoCompleto = Curso & { modulos: ModuloConLecciones[] }

export type CursoEnLista = Curso & {
  totalModulos: number
  totalLecciones: number
  totalInscritos: number
}

/**
 * Lecturas del admin.
 *
 * Todas usan el cliente de servidor con la llave anónima, o sea que pasan por
 * RLS: si un alumno llegara aquí no vería nada. El service role se reserva para
 * provisioning, webhooks y PDFs (CLAUDE.md).
 */

export async function listarCursos(): Promise<CursoEnLista[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('courses')
    .select('*, modules(id, lessons(id)), enrollments(id)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(JSON.stringify({ operacion: 'listarCursos', error: error.message }))
    return []
  }

  type Anidado = Curso & {
    modules: Array<{ id: string; lessons: Array<{ id: string }> }>
    enrollments: Array<{ id: string }>
  }

  return (data as unknown as Anidado[]).map((curso) => {
    const { modules, enrollments, ...resto } = curso
    return {
      ...resto,
      totalModulos: modules?.length ?? 0,
      totalLecciones: modules?.reduce((suma, m) => suma + (m.lessons?.length ?? 0), 0) ?? 0,
      totalInscritos: enrollments?.length ?? 0,
    }
  })
}

/** Curso con su árbol completo, ya ordenado por `position`. */
export async function obtenerCurso(id: string): Promise<CursoCompleto | null> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('courses')
    .select('*, modules(*, lessons(*))')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error(JSON.stringify({ operacion: 'obtenerCurso', id, error: error.message }))
    return null
  }
  if (!data) return null

  type Anidado = Curso & { modules: Array<Modulo & { lessons: Leccion[] }> }
  const curso = data as unknown as Anidado
  const { modules, ...resto } = curso

  const modulos: ModuloConLecciones[] = (modules ?? [])
    .map((m) => {
      const { lessons, ...moduloSolo } = m
      return {
        ...moduloSolo,
        lecciones: [...(lessons ?? [])].sort((a, b) => a.position - b.position),
      }
    })
    .sort((a, b) => a.position - b.position)

  return { ...resto, modulos }
}

export async function obtenerLeccion(
  id: string
): Promise<(Leccion & { adjuntos: Adjunto[]; curso_id: string; curso_titulo: string }) | null> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('lessons')
    .select('*, lesson_attachments(*), modules!inner(course_id, courses!inner(title))')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error(JSON.stringify({ operacion: 'obtenerLeccion', id, error: error.message }))
    return null
  }
  if (!data) return null

  type Anidado = Leccion & {
    lesson_attachments: Adjunto[]
    modules: { course_id: string; courses: { title: string } }
  }
  const leccion = data as unknown as Anidado
  const { lesson_attachments, modules, ...resto } = leccion

  return {
    ...resto,
    adjuntos: [...(lesson_attachments ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    ),
    curso_id: modules.course_id,
    curso_titulo: modules.courses.title,
  }
}

/** ¿El slug ya lo usa otro curso? */
export async function slugOcupado(slug: string, exceptoId?: string): Promise<boolean> {
  const supabase = await crearClienteServidor()

  let consulta = supabase.from('courses').select('id').eq('slug', slug)
  if (exceptoId) consulta = consulta.neq('id', exceptoId)

  const { data } = await consulta.limit(1)
  return (data?.length ?? 0) > 0
}
