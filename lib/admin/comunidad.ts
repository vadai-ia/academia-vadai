import 'server-only'

import { cache } from 'react'

import { exigirAdmin } from '@/lib/auth/sesion'
import { esCuentaQa, esCursoQa } from '@/lib/qa'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

/**
 * La bandeja de Comunidad del panel (3-oct-2026).
 *
 * Alejandro: "desde el portal de admin en comunidades deberíamos de poder
 * interactuar, contestar y dar seguimiento controlado sin necesidad de entrar
 * a simular el portal de alumnos". Y antes: "yo al abrir la comunidad, ¿cómo
 * sé de qué generación están escribiendo?".
 *
 * Un HILO es lo que abre un alumno y espera respuesta:
 *   - una publicación del muro de un curso (con sus comentarios), o
 *   - una pregunta en una lección (comentario raíz con sus respuestas).
 * Cada uno llega con su contexto completo —curso, generación, lección, autor y
 * empresa— para contestar sin abrir nada más.
 *
 * El ESTADO no se guarda (como los puntos y las notificaciones): un hilo está
 * «sin respuesta» si el último mensaje visible no es del equipo, y
 * «respondido» si lo es. Contestar lo mueve solo; que el alumno vuelva a
 * escribir lo regresa solo. No hay botón de «resuelto» que alguien olvide.
 *
 * Volumen: el 3-oct había 40 publicaciones, 46 comentarios y 38 preguntas en
 * lecciones. Se lee todo en una ronda y se cruza en memoria, como el ranking.
 * Si un día son miles, el corte natural es leer solo lo de los últimos 90 días.
 *
 * Lo de pruebas no se mezcla con lo real: a una cuenta real no le salen los
 * cursos `qa-…` ni lo que escribió una cuenta `qa-*` (las suites corren contra
 * producción). A una cuenta QA sí, porque las suites prueban la bandeja.
 */

/** Pasadas estas horas sin respuesta, la campana del panel lo cuenta. */
export const HORAS_DE_ESPERA = 12

export const POR_PAGINA_COMUNIDAD = 20

export type FiltrosComunidad = {
  estado?: string
  curso?: string
  gen?: string
  tipo?: string
  ocultas?: string
  pagina?: string
}

export type EstadoDeHilo = 'sin' | 'respondida'

export type AutorEnHilo = {
  userId: string
  nombre: string
  equipo: boolean
  empresa: string | null
}

export type MensajeDeHilo = {
  id: string
  autor: AutorEnHilo
  texto: string
  creadoEn: string
  oculto: boolean
}

export type Hilo = {
  tipo: 'muro' | 'leccion'
  /** El id de la publicación o del comentario raíz. */
  id: string
  curso: { id: string; titulo: string; slug: string }
  generacion: { id: string; nombre: string } | null
  leccion: { id: string; titulo: string } | null
  /** Solo las publicaciones del muro tienen título. */
  titulo: string | null
  /** Publicación: documento de Tiptap. Pregunta de lección: texto plano. */
  rico: Json | null
  texto: string | null
  autor: AutorEnHilo
  creadoEn: string
  ultimaActividad: string
  estado: EstadoDeHilo
  /** Desde cuándo espera: el primer mensaje sin contestar después del último del equipo. */
  esperaDesde: string | null
  oculto: boolean
  fijado: boolean
  respuestas: MensajeDeHilo[]
  /** Dónde lo ve el alumno, para quien quiera verlo en contexto. */
  hrefPortal: string
}

export type OpcionCurso = {
  id: string
  titulo: string
  generaciones: Array<{ id: string; nombre: string }>
}

export type Bandeja = {
  filtros: {
    estado: 'sin' | 'respondidas' | 'todas'
    curso: string
    gen: string
    tipo: '' | 'muro' | 'leccion'
    ocultas: boolean
  }
  hilos: Hilo[]
  total: number
  pagina: number
  paginas: number
  porPagina: number
  /** Conteos por estado con los demás filtros puestos: las pestañas. */
  conteos: { sin: number; respondidas: number; todas: number }
  /** Sin respuesta hace más de HORAS_DE_ESPERA, con los demás filtros. */
  vencidas: number
  /** Los cursos que tienen algo en la bandeja: el filtro. */
  cursos: OpcionCurso[]
  /** Todos los cursos vigentes con sus generaciones: dónde se puede publicar. */
  destinos: OpcionCurso[]
  /** Cambia al publicar: la `key` que limpia el formulario de publicar. */
  publicaciones: number
  fallo: boolean
}

type Crudo = {
  hilos: Hilo[]
  cursos: OpcionCurso[]
  destinos: OpcionCurso[]
  fallo: boolean
}

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

/**
 * Todos los hilos que el equipo puede atender, ya armados. `cache`: la
 * campana del encabezado y la página de la bandeja piden lo mismo en la misma
 * petición, y así es una sola lectura.
 */
const hilosDeLaAcademia = cache(async (): Promise<Crudo> => {
  const perfil = await exigirAdmin()
  const veQa = esCuentaQa(perfil.email)
  const supabase = await crearClienteServidor()

  const [posts, comentarios, preguntas, cursos, generaciones, lecciones, modulos, perfiles, empresas] = await Promise.all([
    supabase
      .from('community_posts')
      .select('id, course_id, cohort_id, user_id, title, content_rich, pinned, status, created_at')
      .neq('status', 'deleted'),
    supabase
      .from('community_comments')
      .select('id, post_id, user_id, content, status, created_at')
      .neq('status', 'deleted'),
    supabase
      .from('lesson_comments')
      .select('id, lesson_id, user_id, parent_id, content, status, created_at')
      .neq('status', 'deleted'),
    supabase.from('courses').select('id, title, slug, status').neq('status', 'archived'),
    supabase.from('cohorts').select('id, name, course_id, starts_on').order('starts_on', { ascending: false, nullsFirst: false }),
    supabase.from('lessons').select('id, title, module_id'),
    supabase.from('modules').select('id, course_id, cohort_id'),
    supabase.from('profiles').select('user_id, full_name, email, role, company_id'),
    supabase.from('companies').select('id, name'),
  ])

  const error =
    posts.error ??
    comentarios.error ??
    preguntas.error ??
    cursos.error ??
    generaciones.error ??
    lecciones.error ??
    modulos.error ??
    perfiles.error ??
    empresas.error
  if (error) {
    registrar('hilosDeLaAcademia', { error: error.message })
    return { hilos: [], cursos: [], destinos: [], fallo: true }
  }

  const cursoPorId = new Map(
    (cursos.data ?? []).filter((c) => veQa || !esCursoQa(c.slug)).map((c) => [c.id, { id: c.id, titulo: c.title, slug: c.slug }])
  )
  const generacionPorId = new Map((generaciones.data ?? []).map((g) => [g.id, { id: g.id, nombre: g.name }]))
  const empresaPorId = new Map((empresas.data ?? []).map((e) => [e.id, e.name]))
  const moduloPorId = new Map((modulos.data ?? []).map((m) => [m.id, m]))
  const leccionPorId = new Map(
    (lecciones.data ?? []).map((l) => {
      const modulo = moduloPorId.get(l.module_id)
      return [l.id, { id: l.id, titulo: l.title, cursoId: modulo?.course_id ?? null, cohortId: modulo?.cohort_id ?? null }]
    })
  )

  const qa = new Set<string>()
  const autorPorId = new Map<string, AutorEnHilo>()
  for (const p of perfiles.data ?? []) {
    if (esCuentaQa(p.email)) qa.add(p.user_id)
    autorPorId.set(p.user_id, {
      userId: p.user_id,
      nombre: p.full_name.trim() || p.email.split('@')[0] || 'Alguien',
      equipo: p.role === 'admin' || p.role === 'superadmin',
      empresa: p.company_id ? (empresaPorId.get(p.company_id) ?? null) : null,
    })
  }
  const autor = (userId: string): AutorEnHilo =>
    autorPorId.get(userId) ?? { userId, nombre: 'Cuenta eliminada', equipo: false, empresa: null }

  // Lo que escribió una cuenta de pruebas no es una pregunta real.
  const cuenta = (userId: string) => veQa || !qa.has(userId)

  const hilos: Hilo[] = []

  // --- muro ---------------------------------------------------------------
  const comentariosPorPost = new Map<string, MensajeDeHilo[]>()
  for (const c of comentarios.data ?? []) {
    if (!cuenta(c.user_id)) continue
    const lista = comentariosPorPost.get(c.post_id) ?? []
    lista.push({ id: c.id, autor: autor(c.user_id), texto: c.content, creadoEn: c.created_at, oculto: c.status === 'hidden' })
    comentariosPorPost.set(c.post_id, lista)
  }

  for (const p of posts.data ?? []) {
    const curso = cursoPorId.get(p.course_id)
    if (!curso || !cuenta(p.user_id)) continue
    const generacion = p.cohort_id ? (generacionPorId.get(p.cohort_id) ?? null) : null
    const portal = new URLSearchParams()
    if (generacion) portal.set('gen', generacion.id)
    const consulta = portal.toString()
    hilos.push(
      armar({
        tipo: 'muro',
        id: p.id,
        curso,
        generacion,
        leccion: null,
        titulo: p.title,
        rico: p.content_rich,
        texto: null,
        autor: autor(p.user_id),
        creadoEn: p.created_at,
        oculto: p.status === 'hidden',
        fijado: p.pinned,
        respuestas: comentariosPorPost.get(p.id) ?? [],
        hrefPortal: `/curso/${curso.slug}/comunidad${consulta ? `?${consulta}` : ''}#publicacion-${p.id}`,
      })
    )
  }

  // --- preguntas en lecciones ---------------------------------------------
  const respuestasPorRaiz = new Map<string, MensajeDeHilo[]>()
  for (const c of preguntas.data ?? []) {
    if (!c.parent_id || !cuenta(c.user_id)) continue
    const lista = respuestasPorRaiz.get(c.parent_id) ?? []
    lista.push({ id: c.id, autor: autor(c.user_id), texto: c.content, creadoEn: c.created_at, oculto: c.status === 'hidden' })
    respuestasPorRaiz.set(c.parent_id, lista)
  }

  for (const c of preguntas.data ?? []) {
    if (c.parent_id || !cuenta(c.user_id)) continue
    const leccion = leccionPorId.get(c.lesson_id)
    const curso = leccion?.cursoId ? cursoPorId.get(leccion.cursoId) : undefined
    if (!leccion || !curso) continue
    hilos.push(
      armar({
        tipo: 'leccion',
        id: c.id,
        curso,
        generacion: leccion.cohortId ? (generacionPorId.get(leccion.cohortId) ?? null) : null,
        leccion: { id: leccion.id, titulo: leccion.titulo },
        titulo: null,
        rico: null,
        texto: c.content,
        autor: autor(c.user_id),
        creadoEn: c.created_at,
        oculto: c.status === 'hidden',
        fijado: false,
        respuestas: respuestasPorRaiz.get(c.id) ?? [],
        hrefPortal: `/curso/${curso.slug}/${leccion.id}#comentario-${c.id}`,
      })
    )
  }

  // Dónde se puede publicar: todo curso vigente, con sus generaciones. El
  // filtro solo ofrece los que tienen algo en la bandeja.
  const destinos: OpcionCurso[] = [...cursoPorId.values()]
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      generaciones: (generaciones.data ?? []).filter((g) => g.course_id === c.id).map((g) => ({ id: g.id, nombre: g.name })),
    }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))
  const conHilos = new Set(hilos.map((h) => h.curso.id))
  const opciones = destinos.filter((c) => conHilos.has(c.id))

  return { hilos, cursos: opciones, destinos, fallo: false }
})

/** Deriva el estado de un hilo de quién habló al último. */
function armar(base: Omit<Hilo, 'estado' | 'esperaDesde' | 'ultimaActividad'>): Hilo {
  const respuestas = [...base.respuestas].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
  const visibles = [
    { autor: base.autor, creadoEn: base.creadoEn },
    ...respuestas.filter((r) => !r.oculto),
  ]
  const ultimo = visibles[visibles.length - 1] ?? visibles[0]

  // Espera desde el primer mensaje que llegó después de la última palabra
  // del equipo: si el alumno escribió tres veces seguidas, cuenta la primera.
  let esperaDesde: string | null = null
  for (const m of visibles) {
    if (m.autor.equipo) esperaDesde = null
    else esperaDesde ??= m.creadoEn
  }

  return {
    ...base,
    respuestas,
    estado: ultimo?.autor.equipo ? 'respondida' : 'sin',
    esperaDesde,
    ultimaActividad: ultimo?.creadoEn ?? base.creadoEn,
  }
}

function vencida(h: Hilo, ahora: number): boolean {
  return h.estado === 'sin' && h.esperaDesde !== null && ahora - Date.parse(h.esperaDesde) > HORAS_DE_ESPERA * 3_600_000
}

export async function bandejaDeComunidad(crudos: FiltrosComunidad): Promise<Bandeja> {
  const { hilos: todos, cursos, destinos, fallo } = await hilosDeLaAcademia()

  const estado = crudos.estado === 'respondidas' || crudos.estado === 'todas' ? crudos.estado : 'sin'
  const curso = cursos.some((c) => c.id === crudos.curso) ? (crudos.curso ?? '') : ''
  const gen = curso && cursos.find((c) => c.id === curso)?.generaciones.some((g) => g.id === crudos.gen) ? (crudos.gen ?? '') : ''
  const tipo = crudos.tipo === 'muro' || crudos.tipo === 'leccion' ? crudos.tipo : ''
  const ocultas = crudos.ocultas === 'si'

  const ahora = Date.now()
  const enAlcance = todos.filter(
    (h) =>
      (!curso || h.curso.id === curso) &&
      (!gen || h.generacion?.id === gen) &&
      (!tipo || h.tipo === tipo) &&
      (ocultas || !h.oculto)
  )

  const conteos = {
    sin: enAlcance.filter((h) => h.estado === 'sin').length,
    respondidas: enAlcance.filter((h) => h.estado === 'respondida').length,
    todas: enAlcance.length,
  }

  const filtrados = enAlcance.filter((h) =>
    estado === 'sin' ? h.estado === 'sin' : estado === 'respondidas' ? h.estado === 'respondida' : true
  )
  // Lo que espera, de lo más viejo a lo más nuevo: primero quien lleva más
  // tiempo sin respuesta. Lo demás, por actividad reciente.
  filtrados.sort((a, b) =>
    estado === 'sin'
      ? (a.esperaDesde ?? a.creadoEn).localeCompare(b.esperaDesde ?? b.creadoEn)
      : b.ultimaActividad.localeCompare(a.ultimaActividad)
  )

  const total = filtrados.length
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_COMUNIDAD))
  const pagina = Math.min(Math.max(1, Number(crudos.pagina) || 1), paginas)
  const desde = (pagina - 1) * POR_PAGINA_COMUNIDAD

  return {
    filtros: { estado, curso, gen, tipo, ocultas },
    hilos: filtrados.slice(desde, desde + POR_PAGINA_COMUNIDAD),
    total,
    pagina,
    paginas,
    porPagina: POR_PAGINA_COMUNIDAD,
    conteos,
    vencidas: enAlcance.filter((h) => vencida(h, ahora)).length,
    cursos,
    destinos,
    publicaciones: todos.filter((h) => h.tipo === 'muro').length,
    fallo,
  }
}

export type PendientesDeComunidad = {
  sinRespuesta: number
  vencidas: number
  /** Los que más llevan esperando, para la campana. */
  primeros: Hilo[]
}

/** Para la campana del panel: cuánto espera y qué es lo más viejo. */
export async function pendientesDeComunidad(): Promise<PendientesDeComunidad> {
  const { hilos } = await hilosDeLaAcademia()
  const ahora = Date.now()
  const pendientes = hilos
    .filter((h) => h.estado === 'sin' && !h.oculto)
    .sort((a, b) => (a.esperaDesde ?? a.creadoEn).localeCompare(b.esperaDesde ?? b.creadoEn))
  return {
    sinRespuesta: pendientes.length,
    vencidas: pendientes.filter((h) => vencida(h, ahora)).length,
    primeros: pendientes.slice(0, 5),
  }
}
