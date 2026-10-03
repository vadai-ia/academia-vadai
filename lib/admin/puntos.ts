import 'server-only'

import { cache } from 'react'

import {
  ACTIVIDAD_VACIA,
  NIVELES,
  nivelDe,
  puntosDe,
  sumarActividad,
  type Actividad,
  type Nivel,
} from '@/lib/gamificacion/reglas'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * El ranking de puntos visto desde el equipo (26-sep-2026).
 *
 * Alejandro: "quiero ver cómo va cada alumno y el top 5 con más puntos, que
 * van avanzando para los premios", con la tabla completa, filtros y paginado
 * para "tomar decisiones asertivas".
 *
 * Los puntos NO se guardan (CLAUDE.md): salen de la vista
 * `actividad_por_curso` con los pesos de `lib/gamificacion/reglas.ts`, igual
 * que los ve el alumno. Al equipo la vista le enseña a todos. Son cinco
 * consultas en una sola ronda y el resto se cruza en memoria: con doscientos
 * alumnos y dos cursos son cuatrocientas filas.
 *
 * Qué entra: alumnos activos con inscripción activa (lo que ya decide la
 * vista), en cursos que no están archivados, y nunca las cuentas de prueba
 * `qa-*`: no compiten por un premio.
 *
 * El lugar (#) se calcula sobre el curso elegido ANTES de buscar o filtrar
 * por empresa o nivel: filtrar a una empresa enseña en qué lugar va cada uno
 * en el ranking completo, no un ranking nuevo de esa empresa. Con un curso
 * elegido el lugar coincide con el que ve el alumno en su comunidad.
 */


export const ORDENES_PUNTOS = {
  puntos: 'Más puntos',
  avance: 'Más avance',
  participacion: 'Más participación',
  reciente: 'Entró hace menos',
  nombre: 'Nombre',
} as const
export type OrdenPuntos = keyof typeof ORDENES_PUNTOS

export const POR_PAGINA_PUNTOS = [10, 25, 50, 100] as const
const POR_PAGINA_DEFAULT = 25

export type AlumnoEnPuntos = {
  userId: string
  nombre: string
  empresa: { id: string; nombre: string } | null
  ultimoAcceso: string | null
  actividad: Actividad
  puntos: number
  nivel: Nivel
  /** Lecciones completadas y publicadas en los cursos del alcance. */
  hechas: number
  total: number
  porcentaje: number
  /** Comentarios + publicaciones: lo que aporta a la conversación. */
  participacion: number
  /** Lugar por puntos dentro del curso elegido (o de la academia). */
  posicion: number
}

export type FiltrosPuntos = {
  q?: string
  curso?: string
  empresa?: string
  nivel?: string
  orden?: string
  por?: string
  pagina?: string
}

type Base = {
  /** La lectura falló: la pantalla lo dice en vez de enseñar un ranking vacío. */
  fallo: boolean
  cursos: Array<{ id: string; titulo: string; lecciones: number }>
  /** Lecciones publicadas por curso y generación ('curso::gen'; sin generaciones, 'curso::'). */
  leccionesPorGrupo: Map<string, number>
  empresas: Array<{ id: string; nombre: string }>
  alumnos: Array<{
    userId: string
    nombre: string
    email: string
    empresaId: string | null
    ultimoAcceso: string | null
    porCurso: Map<string, { actividad: Actividad; cohortId: string | null }>
  }>
}

const BASE_VACIA: Base = { fallo: false, cursos: [], leccionesPorGrupo: new Map(), empresas: [], alumnos: [] }

/** La llave de un curso y una generación. Sin generaciones, la generación es ''. */
const grupo = (cursoId: string, cohortId: string | null) => `${cursoId}::${cohortId ?? ''}`

/** Una lectura por petición: el panel y su tabla la piden dos veces. */
const datosDePuntos = cache(async function datosDePuntos(): Promise<Base> {
  const supabase = await crearClienteServidor()

  const [actividad, perfiles, empresas, cursos, outline] = await Promise.all([
    supabase.from('actividad_por_curso').select('*'),
    supabase
      .from('profiles')
      .select('user_id, full_name, email, company_id, last_sign_in_at')
      .eq('role', 'alumno')
      .eq('status', 'active'),
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('courses').select('id, slug, title, status').neq('status', 'archived').order('created_at'),
    supabase.from('lesson_outline').select('course_id, cohort_id'),
  ])

  const fallo = actividad.error ?? perfiles.error ?? empresas.error ?? cursos.error ?? outline.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'datosDePuntos', error: fallo.message }))
    return { ...BASE_VACIA, fallo: true }
  }

  // Por curso (la etiqueta del filtro) y por curso y generación (contra lo
  // que se mide el avance de cada quien, M16): al equipo el outline le enseña
  // las lecciones de todas las generaciones.
  const leccionesDe = new Map<string, number>()
  const leccionesPorGrupo = new Map<string, number>()
  for (const l of outline.data ?? []) {
    if (!l.course_id) continue
    leccionesDe.set(l.course_id, (leccionesDe.get(l.course_id) ?? 0) + 1)
    const g = grupo(l.course_id, l.cohort_id)
    leccionesPorGrupo.set(g, (leccionesPorGrupo.get(g) ?? 0) + 1)
  }
  // Ni archivados ni de pruebas: durante una corrida de las suites los QA
  // están publicados y no tienen nada que hacer en un ranking de premios.
  const reales = (cursos.data ?? []).filter((c) => !esCursoQa(c.slug))
  const vivos = new Set(reales.map((c) => c.id))

  const porAlumno = new Map<string, Map<string, { actividad: Actividad; cohortId: string | null }>>()
  for (const f of actividad.data ?? []) {
    if (!f.user_id || !f.course_id || !vivos.has(f.course_id)) continue
    const mapa = porAlumno.get(f.user_id) ?? new Map<string, { actividad: Actividad; cohortId: string | null }>()
    mapa.set(f.course_id, { cohortId: f.cohort_id ?? null, actividad: {
      lecciones: f.lecciones ?? 0,
      quizzes: f.quizzes ?? 0,
      tareas: f.tareas ?? 0,
      tareasAprobadas: f.tareas_aprobadas ?? 0,
      publicaciones: f.publicaciones ?? 0,
      comentarios: f.comentarios ?? 0,
      certificados: f.certificados ?? 0,
      dinamicas: f.dinamicas ?? 0,
    } })
    porAlumno.set(f.user_id, mapa)
  }

  return {
    fallo: false,
    cursos: reales.map((c) => ({ id: c.id, titulo: c.title, lecciones: leccionesDe.get(c.id) ?? 0 })),
    leccionesPorGrupo,
    empresas: (empresas.data ?? []).map((e) => ({ id: e.id, nombre: e.name })),
    alumnos: (perfiles.data ?? []).flatMap((p) => {
      const porCurso = porAlumno.get(p.user_id)
      if (!porCurso || esCuentaQa(p.email)) return []
      return [
        {
          userId: p.user_id,
          nombre: p.full_name?.trim() || p.email,
          email: p.email,
          empresaId: p.company_id,
          ultimoAcceso: p.last_sign_in_at ?? null,
          porCurso,
        },
      ]
    }),
  }
})

/** El mismo orden que el ranking del alumno: puntos, luego lecciones, luego nombre. */
function porPuntos(a: AlumnoEnPuntos, b: AlumnoEnPuntos): number {
  return b.puntos - a.puntos || b.actividad.lecciones - a.actividad.lecciones || a.nombre.localeCompare(b.nombre, 'es')
}

/** Todos los alumnos del alcance (un curso o la academia), ya con su lugar. */
function ranking(base: Base, cursoId?: string): AlumnoEnPuntos[] {
  const lecciones = new Map(base.cursos.map((c) => [c.id, c.lecciones]))
  const alcance = cursoId && lecciones.has(cursoId) ? [cursoId] : [...lecciones.keys()]
  const nombreDeEmpresa = new Map(base.empresas.map((e) => [e.id, e.nombre]))

  const filas: AlumnoEnPuntos[] = []
  for (const a of base.alumnos) {
    let actividad = ACTIVIDAD_VACIA
    let total = 0
    let inscrito = false
    for (const id of alcance) {
      const delCurso = a.porCurso.get(id)
      if (!delCurso) continue
      inscrito = true
      actividad = sumarActividad(actividad, delCurso.actividad)
      // Contra las lecciones de SU generación en ese curso, no las del curso.
      total += base.leccionesPorGrupo.get(grupo(id, delCurso.cohortId)) ?? 0
    }
    if (!inscrito) continue

    const puntos = puntosDe(actividad)
    const hechas = Math.min(actividad.lecciones, total)
    filas.push({
      userId: a.userId,
      nombre: a.nombre,
      empresa: a.empresaId ? { id: a.empresaId, nombre: nombreDeEmpresa.get(a.empresaId) ?? 'Empresa' } : null,
      ultimoAcceso: a.ultimoAcceso,
      actividad,
      puntos,
      nivel: nivelDe(puntos),
      hechas,
      total,
      porcentaje: total === 0 ? 0 : Math.round((hechas / total) * 100),
      participacion: actividad.comentarios + actividad.publicaciones,
      posicion: 0,
    })
  }

  return filas.sort(porPuntos).map((f, i) => ({ ...f, posicion: i + 1 }))
}

/** Sin acentos ni mayúsculas: "garcia" encuentra a "García". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Los primeros N de la academia, para el panel. */
export async function topDePuntos(
  n: number
): Promise<{ alumnos: AlumnoEnPuntos[]; total: number; fallo: boolean }> {
  const base = await datosDePuntos()
  const todos = ranking(base)
  return { alumnos: todos.slice(0, n), total: todos.length, fallo: base.fallo }
}

export type TablaDePuntos = {
  fallo: boolean
  filas: AlumnoEnPuntos[]
  total: number
  pagina: number
  paginas: number
  porPagina: number
  /** Cuántos hay en cada nivel, con la búsqueda y la empresa aplicadas pero no el nivel. */
  porNivel: Array<{ numero: number; nombre: string; minimo: number; alumnos: number }>
  resumen: { enRanking: number; sumaron: number; promedio: number; lider: AlumnoEnPuntos | null }
  cursos: Base['cursos']
  empresas: Base['empresas']
  filtros: { q: string; curso: string; empresa: string; nivel: number | null; orden: OrdenPuntos; por: number }
}

export async function tablaDePuntos(filtros: FiltrosPuntos): Promise<TablaDePuntos> {
  const base = await datosDePuntos()

  const curso = base.cursos.some((c) => c.id === filtros.curso) ? (filtros.curso as string) : ''
  const empresa =
    filtros.empresa === 'general' || base.empresas.some((e) => e.id === filtros.empresa)
      ? (filtros.empresa as string)
      : ''
  const nivelPedido = Number(filtros.nivel)
  const nivel = Number.isInteger(nivelPedido) && nivelPedido >= 1 && nivelPedido <= NIVELES.length ? nivelPedido : null
  const orden: OrdenPuntos = filtros.orden && filtros.orden in ORDENES_PUNTOS ? (filtros.orden as OrdenPuntos) : 'puntos'
  const porPedido = Number(filtros.por)
  const por = (POR_PAGINA_PUNTOS as readonly number[]).includes(porPedido) ? porPedido : POR_PAGINA_DEFAULT
  const q = (filtros.q ?? '').trim().slice(0, 80)

  const todos = ranking(base, curso || undefined)

  // Búsqueda y empresa: recortan a quién se ve, no su lugar.
  const termino = normalizar(q)
  const buscados = todos.filter((a) => {
    if (empresa === 'general' && a.empresa) return false
    if (empresa && empresa !== 'general' && a.empresa?.id !== empresa) return false
    if (!termino) return true
    const email = base.alumnos.find((x) => x.userId === a.userId)?.email ?? ''
    return [a.nombre, email, a.empresa?.nombre ?? 'general'].some((t) => normalizar(t).includes(termino))
  })

  const porNivel = NIVELES.map((n, i) => ({
    numero: i + 1,
    nombre: n.nombre,
    minimo: n.minimo,
    alumnos: buscados.filter((a) => a.nivel.numero === i + 1).length,
  }))

  const filtrados = nivel ? buscados.filter((a) => a.nivel.numero === nivel) : buscados

  const ordenados = [...filtrados].sort((a, b) => {
    switch (orden) {
      case 'avance':
        return b.porcentaje - a.porcentaje || porPuntos(a, b)
      case 'participacion':
        return b.participacion - a.participacion || porPuntos(a, b)
      case 'reciente':
        return (b.ultimoAcceso ?? '').localeCompare(a.ultimoAcceso ?? '') || porPuntos(a, b)
      case 'nombre':
        return a.nombre.localeCompare(b.nombre, 'es')
      default:
        return a.posicion - b.posicion
    }
  })

  const paginas = Math.max(1, Math.ceil(ordenados.length / por))
  const paginaPedida = Math.max(1, Number.parseInt(filtros.pagina ?? '1', 10) || 1)
  const pagina = Math.min(paginaPedida, paginas)

  const sumaron = buscados.filter((a) => a.puntos > 0).length
  return {
    fallo: base.fallo,
    filas: ordenados.slice((pagina - 1) * por, pagina * por),
    total: ordenados.length,
    pagina,
    paginas,
    porPagina: por,
    porNivel,
    resumen: {
      enRanking: buscados.length,
      sumaron,
      promedio: buscados.length === 0 ? 0 : Math.round(buscados.reduce((n, a) => n + a.puntos, 0) / buscados.length),
      lider: buscados[0] ?? null,
    },
    cursos: base.cursos,
    empresas: base.empresas,
    filtros: { q, curso, empresa, nivel, orden, por },
  }
}
