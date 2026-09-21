import 'server-only'

import { cache } from 'react'

import { opcionesDeAlta } from '@/lib/admin/alumnos'
import { ACTIVIDAD_VACIA, nivelDe, puntosDe, type Actividad, type Nivel } from '@/lib/gamificacion/reglas'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Todo lo de una persona, para su ficha (/admin/alumnos/[userId], M14).
 *
 * Es el "revisar su información y su estatus completo" que Alejandro pidió:
 * un solo lugar con datos, empresa, cursos con avance y puntos, ligas
 * de acceso, actividad y certificados, y desde donde salen TODAS las acciones.
 * Va por el cliente del admin (RLS): las policies ya le dan todo el schema.
 */

export type AccesoDeInscripcion = 'vigente' | 'vencido' | 'revocado'

export type FichaAlumno = {
  userId: string
  email: string
  nombre: string
  rol: string
  estado: string
  creadoEn: string | null
  ultimoAcceso: string | null
  empresa: { id: string; nombre: string } | null
  inscripciones: Array<{
    cursoId: string
    cursoTitulo: string
    cursoSlug: string
    cohorte: string | null
    acceso: AccesoDeInscripcion
    expiraEn: string | null
    inscritoEn: string
    origen: string
    hechas: number
    total: number
    porcentaje: number
    puntos: number
    nivel: Nivel
    actividad: Actividad
  }>
  // Los pagos NO viven aquí (21-sep-2026): la ficha se abre con la pantalla
  // compartida. El dinero va a tener su propio apartado.
  /** Las últimas cinco ligas de 30 días, la más reciente primero. */
  enlaces: Array<{ enviadoEn: string; venceEn: string; vigente: boolean; usos: number; ultimoUso: string | null }>
  certificados: Array<{ folio: string; cursoTitulo: string; emitidoEn: string }>
  conteos: {
    comentarios: number
    publicaciones: number
    entregas: number
    entregasAprobadas: number
    intentosDeQuiz: number
    publicacionesDelBlog: number
  }
  /** Lo que se le puede dar todavía: cursos no archivados que no tiene. */
  cursosDisponibles: Awaited<ReturnType<typeof opcionesDeAlta>>
}

/** Con `cache()`: la página y su `generateMetadata` la piden en la misma petición. */
export const fichaDeAlumno = cache(async function fichaDeAlumno(userId: string): Promise<FichaAlumno | null> {
  const supabase = await crearClienteServidor()

  const { data: perfil, error } = await supabase
    .from('profiles')
    .select(
      'user_id, email, full_name, role, status, created_at, company_id, last_sign_in_at, companies(name), ' +
        'enrollments(course_id, cohort_id, status, expires_at, created_at, source, courses(title, slug), cohorts(name))'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error(JSON.stringify({ operacion: 'fichaDeAlumno', userId, error: error.message }))
    return null
  }
  if (!perfil) return null

  type Perfil = {
    user_id: string
    email: string
    full_name: string | null
    role: string
    status: string
    created_at: string | null
    company_id: string | null
    last_sign_in_at: string | null
    companies: { name: string } | null
    enrollments: Array<{
      course_id: string
      cohort_id: string | null
      status: string
      expires_at: string | null
      created_at: string
      source: string
      courses: { title: string; slug: string } | null
      cohorts: { name: string } | null
    }>
  }
  const p = perfil as unknown as Perfil

  const [progreso, outline, actividad, enlaces, certificados, comentariosL, comentariosC, publicaciones, entregas, intentos, posts, opciones] =
    await Promise.all([
      supabase.from('lesson_progress').select('lesson_id').eq('user_id', userId).eq('completed', true),
      supabase.from('lesson_outline').select('id, course_id'),
      supabase.from('actividad_por_curso').select('*').eq('user_id', userId),
      supabase
        .from('access_links')
        .select('created_at, expires_at, used_count, last_used_at, revoked_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('certificates').select('folio, issued_at, courses(title)').eq('user_id', userId),
      supabase.from('lesson_comments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('community_comments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('assignment_submissions').select('status').eq('user_id', userId),
      supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', userId),
      opcionesDeAlta(),
    ])

  // Lección -> curso, para saber a qué curso cuenta cada avance.
  const cursoDeLeccion = new Map<string, string>()
  const totalPorCurso = new Map<string, number>()
  for (const fila of outline.data ?? []) {
    if (!fila.id || !fila.course_id) continue
    cursoDeLeccion.set(fila.id, fila.course_id)
    totalPorCurso.set(fila.course_id, (totalPorCurso.get(fila.course_id) ?? 0) + 1)
  }
  const hechasPorCurso = new Map<string, number>()
  for (const fila of progreso.data ?? []) {
    const curso = cursoDeLeccion.get(fila.lesson_id)
    if (!curso) continue
    hechasPorCurso.set(curso, (hechasPorCurso.get(curso) ?? 0) + 1)
  }

  const actividadPorCurso = new Map<string, Actividad>()
  for (const f of actividad.data ?? []) {
    if (!f.course_id) continue
    actividadPorCurso.set(f.course_id, {
      lecciones: f.lecciones ?? 0,
      quizzes: f.quizzes ?? 0,
      tareas: f.tareas ?? 0,
      tareasAprobadas: f.tareas_aprobadas ?? 0,
      publicaciones: f.publicaciones ?? 0,
      comentarios: f.comentarios ?? 0,
      certificados: f.certificados ?? 0,
    })
  }

  const ahora = Date.now()
  const inscripciones = (p.enrollments ?? []).map((e) => {
    const total = totalPorCurso.get(e.course_id) ?? 0
    const hechas = hechasPorCurso.get(e.course_id) ?? 0
    const act = actividadPorCurso.get(e.course_id) ?? ACTIVIDAD_VACIA
    const puntos = puntosDe(act)
    const vigente = e.status === 'active' && (!e.expires_at || new Date(e.expires_at).getTime() > ahora)
    return {
      cursoId: e.course_id,
      cursoTitulo: e.courses?.title ?? 'Curso',
      cursoSlug: e.courses?.slug ?? '',
      cohorte: e.cohorts?.name ?? null,
      acceso: (e.status === 'revoked' ? 'revocado' : vigente ? 'vigente' : 'vencido') as AccesoDeInscripcion,
      expiraEn: e.expires_at,
      inscritoEn: e.created_at,
      origen: e.source,
      hechas,
      total,
      porcentaje: total === 0 ? 0 : Math.round((hechas / total) * 100),
      puntos,
      nivel: nivelDe(puntos),
      actividad: act,
    }
  })

  type CertificadoAnidado = { folio: string; issued_at: string; courses: { title: string } | null }

  const tiene = new Set(inscripciones.map((i) => i.cursoId))
  const entregasLista = entregas.data ?? []

  return {
    userId: p.user_id,
    email: p.email,
    nombre: p.full_name?.trim() ?? '',
    rol: p.role,
    estado: p.status,
    creadoEn: p.created_at,
    ultimoAcceso: p.last_sign_in_at,
    empresa: p.company_id ? { id: p.company_id, nombre: p.companies?.name ?? 'Empresa' } : null,
    inscripciones,
    enlaces: (enlaces.data ?? []).map((l) => ({
      enviadoEn: l.created_at,
      venceEn: l.expires_at,
      vigente: !l.revoked_at && new Date(l.expires_at).getTime() > ahora,
      usos: l.used_count,
      ultimoUso: l.last_used_at,
    })),
    certificados: ((certificados.data ?? []) as unknown as CertificadoAnidado[]).map((c) => ({
      folio: c.folio,
      cursoTitulo: c.courses?.title ?? 'Curso',
      emitidoEn: c.issued_at,
    })),
    conteos: {
      comentarios: (comentariosL.count ?? 0) + (comentariosC.count ?? 0),
      publicaciones: publicaciones.count ?? 0,
      entregas: entregasLista.length,
      entregasAprobadas: entregasLista.filter((e) => e.status === 'approved').length,
      intentosDeQuiz: intentos.count ?? 0,
      publicacionesDelBlog: posts.count ?? 0,
    },
    cursosDisponibles: opciones.filter((c) => !tiene.has(c.id)),
  }
})
