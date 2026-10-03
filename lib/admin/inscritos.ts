import 'server-only'

import { ACTIVIDAD_VACIA, nivelDe, puntosDe, type Actividad, type Nivel } from '@/lib/gamificacion/reglas'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

/**
 * Los inscritos de UN curso, con todo lo que el admin quiere ver de cada uno:
 * acceso, empresa, generación, si ya entró, cuánto lleva y cuántos puntos tiene.
 *
 * Reemplaza a la lista plana de nombres de `alumnosDelCurso()`. Con 118
 * inscritos esa lista ya no se podía recorrer; con mil sería inservible. Aquí
 * todo se filtra y ordena en el servidor con parámetros de la URL, y la tabla
 * se desplaza dentro de su propia caja.
 *
 * Son siete consultas planas cruzadas en memoria; con mil inscritos y treinta
 * lecciones son decenas de miles de filas de progreso, que todavía es poco.
 * Los puntos salen de la vista `actividad_por_curso`, que al admin le enseña
 * a todos.
 */

export type Acceso = 'vigente' | 'vencido' | 'revocado'

export type Inscrito = {
  userId: string
  nombre: string
  email: string
  empresa: { id: string; nombre: string } | null
  generacion: string | null
  cohorteId: string | null
  acceso: Acceso
  expiraEn: string | null
  inscritoEn: string
  ultimoAcceso: string | null
  hechas: number
  total: number
  porcentaje: number
  puntos: number
  nivel: Nivel
  actividad: Actividad
}

export type PorEmpresa = {
  id: string | null
  nombre: string
  n: number
  entraron: number
  avance: number
  puntos: number
}

export type ResumenInscritos = {
  total: number
  vigentes: number
  entraron: number
  avancePromedio: number
  terminaron: number
  puntosPromedio: number
  lecciones: number
  porEmpresa: PorEmpresa[]
  /** Inscritos activos sin generación en un curso por generaciones (M16). */
  sinGeneracion: number
  /** Inscritos por generación, para la insignia de cada pestaña. */
  porGeneracion: Map<string, number>
}

export type FiltrosInscritos = {
  q?: string
  acceso?: string
  empresa?: string
  orden?: string
  /** Una generación por id, o `sin` para los que no tienen (M16). */
  gen?: string
}

export const ORDENES = {
  nombre: 'Nombre',
  avance: 'Más avance',
  puntos: 'Más puntos',
  reciente: 'Entró hace menos',
} as const

export async function inscritosDelCurso(
  cursoId: string,
  filtros: FiltrosInscritos = {}
): Promise<{ visibles: Inscrito[]; resumen: ResumenInscritos }> {
  const supabase = await crearClienteServidor()

  // Una sola ola (24-sep-2026). Antes eran dos: primero las inscripciones y,
  // con sus ids, los perfiles y el progreso. El perfil ahora viene embebido
  // por la FK de `enrollments.user_id`, y el progreso se pide por curso con
  // un join a `lessons → modules`: ninguna consulta espera a otra.
  const [inscripciones, cohortes, empresas, outline, actividad, progreso] = await Promise.all([
    supabase
      .from('enrollments')
      .select(
        'user_id, status, expires_at, cohort_id, created_at, profiles(user_id, full_name, email, company_id, role, last_sign_in_at)'
      )
      .eq('course_id', cursoId),
    supabase.from('cohorts').select('id, name').eq('course_id', cursoId),
    supabase.from('companies').select('id, name'),
    supabase.from('lesson_outline').select('id, cohort_id').eq('course_id', cursoId),
    supabase.from('actividad_por_curso').select('*').eq('course_id', cursoId),
    supabase
      .from('lesson_progress')
      .select('user_id, lesson_id, lessons!inner(modules!inner(course_id))')
      .eq('completed', true)
      .eq('lessons.modules.course_id', cursoId),
  ])

  const fallo =
    inscripciones.error ??
    cohortes.error ??
    empresas.error ??
    outline.error ??
    actividad.error ??
    progreso.error
  if (fallo) {
    console.error(JSON.stringify({ operacion: 'inscritosDelCurso', cursoId, error: fallo.message }))
    return { visibles: [], resumen: resumenVacio() }
  }

  // Solo cuentan las lecciones publicadas (las del outline), y cada quien se
  // mide contra las de SU generación (M16). Al equipo el outline le enseña las
  // de todas, así que dividir entre el total del curso bajaba el avance de
  // todos en cuanto la Generación 2 publicara su primera lección. En un curso
  // sin generaciones todas van bajo `null`, como antes.
  const leccionesDe = new Map<string | null, Set<string>>()
  for (const l of outline.data ?? []) {
    if (!l.id) continue
    const clave = l.cohort_id ?? null
    const delGrupo = leccionesDe.get(clave) ?? new Set<string>()
    delGrupo.add(l.id)
    leccionesDe.set(clave, delGrupo)
  }
  const NINGUNA = new Set<string>()

  const nombreDeEmpresa = new Map((empresas.data ?? []).map((e) => [e.id, e.name]))
  const nombreDeGeneracion = new Map((cohortes.data ?? []).map((c) => [c.id, c.name]))
  // Lo completado por persona, como conjunto: quien cambió de generación
  // conserva el avance de la anterior (M16), y ese no cuenta en la nueva.
  const completadasDe = new Map<string, Set<string>>()
  // Los tipos generados no describen los joins: se tipan a mano, como en el
  // resto del panel.
  type Hecha = Pick<Tabla<'lesson_progress'>, 'user_id' | 'lesson_id'>
  for (const f of (progreso.data ?? []) as unknown as Hecha[]) {
    const suyas = completadasDe.get(f.user_id) ?? new Set<string>()
    suyas.add(f.lesson_id)
    completadasDe.set(f.user_id, suyas)
  }
  const actividadDe = new Map<string, Actividad>()
  for (const f of actividad.data ?? []) {
    if (!f.user_id) continue
    actividadDe.set(f.user_id, {
      ...ACTIVIDAD_VACIA,
      lecciones: f.lecciones ?? 0,
      quizzes: f.quizzes ?? 0,
      tareas: f.tareas ?? 0,
      tareasAprobadas: f.tareas_aprobadas ?? 0,
      publicaciones: f.publicaciones ?? 0,
      comentarios: f.comentarios ?? 0,
      certificados: f.certificados ?? 0,
      dinamicas: f.dinamicas ?? 0,
    })
  }

  const ahora = Date.now()
  const vacia: Actividad = ACTIVIDAD_VACIA

  type InscripcionConPerfil = Pick<
    Tabla<'enrollments'>,
    'user_id' | 'status' | 'expires_at' | 'cohort_id' | 'created_at'
  > & {
    profiles: Pick<
      Tabla<'profiles'>,
      'user_id' | 'full_name' | 'email' | 'company_id' | 'role' | 'last_sign_in_at'
    > | null
  }
  const filas = (inscripciones.data ?? []) as unknown as InscripcionConPerfil[]

  const todos: Inscrito[] = filas.flatMap((e) => {
    const p = e.profiles
    // Sin perfil no es de la academia (Regla Cero); el equipo no es alumno.
    if (!p || p.role !== 'alumno') return []
    const vigente = e.status === 'active' && (!e.expires_at || new Date(e.expires_at).getTime() > ahora)
    const deSuGeneracion = leccionesDe.get(e.cohort_id ?? null) ?? NINGUNA
    const total = deSuGeneracion.size
    let hechas = 0
    for (const id of completadasDe.get(e.user_id) ?? NINGUNA) if (deSuGeneracion.has(id)) hechas++
    const act = actividadDe.get(e.user_id) ?? vacia
    const puntos = puntosDe(act)
    return [
      {
        userId: e.user_id,
        nombre: p.full_name?.trim() || '',
        email: p.email,
        empresa: p.company_id
          ? { id: p.company_id, nombre: nombreDeEmpresa.get(p.company_id) ?? 'Empresa' }
          : null,
        generacion: e.cohort_id ? (nombreDeGeneracion.get(e.cohort_id) ?? null) : null,
        cohorteId: e.cohort_id,
        acceso: e.status === 'revoked' ? 'revocado' : vigente ? 'vigente' : 'vencido',
        expiraEn: e.expires_at,
        inscritoEn: e.created_at,
        ultimoAcceso: p.last_sign_in_at ?? null,
        hechas,
        total,
        porcentaje: total === 0 ? 0 : Math.round((hechas / total) * 100),
        puntos,
        nivel: nivelDe(puntos),
        actividad: act,
      },
    ]
  })

  // --- resumen (sobre TODOS, no sobre lo filtrado) ---------------------------
  const porEmpresaMapa = new Map<string | null, PorEmpresa>()
  for (const i of todos) {
    const clave = i.empresa?.id ?? null
    const acumulado = porEmpresaMapa.get(clave) ?? {
      id: clave,
      nombre: i.empresa?.nombre ?? 'General',
      n: 0,
      entraron: 0,
      avance: 0,
      puntos: 0,
    }
    acumulado.n += 1
    if (i.ultimoAcceso) acumulado.entraron += 1
    acumulado.avance += i.porcentaje
    acumulado.puntos += i.puntos
    porEmpresaMapa.set(clave, acumulado)
  }
  const porEmpresa = [...porEmpresaMapa.values()]
    .map((e) => ({ ...e, avance: Math.round(e.avance / e.n), puntos: Math.round(e.puntos / e.n) }))
    .sort((a, b) => b.n - a.n)

  const resumen: ResumenInscritos = {
    total: todos.length,
    vigentes: todos.filter((i) => i.acceso === 'vigente').length,
    entraron: todos.filter((i) => i.ultimoAcceso).length,
    avancePromedio:
      todos.length === 0 ? 0 : Math.round(todos.reduce((n, i) => n + i.porcentaje, 0) / todos.length),
    terminaron: todos.filter((i) => i.total > 0 && i.hechas >= i.total).length,
    puntosPromedio:
      todos.length === 0 ? 0 : Math.round(todos.reduce((n, i) => n + i.puntos, 0) / todos.length),
    // Las de la generación que se está viendo (en un curso sin generaciones,
    // todas): es el número que acompaña al avance en la cabecera.
    lecciones: leccionesDe.get(filtros.gen && filtros.gen !== 'sin' ? filtros.gen : null)?.size ?? 0,
    porEmpresa,
    sinGeneracion: todos.filter((i) => i.cohorteId === null && i.acceso !== 'revocado').length,
    porGeneracion: todos.reduce((m, i) => {
      if (i.cohorteId) m.set(i.cohorteId, (m.get(i.cohorteId) ?? 0) + 1)
      return m
    }, new Map<string, number>()),
  }

  // --- filtros y orden ----------------------------------------------------------
  const termino = (filtros.q ?? '').trim().toLowerCase()
  let visibles = todos.filter((i) => {
    if (termino && !i.nombre.toLowerCase().includes(termino) && !i.email.toLowerCase().includes(termino)) {
      return false
    }
    switch (filtros.acceso) {
      case 'vigente':
      case 'vencido':
      case 'revocado':
        if (i.acceso !== filtros.acceso) return false
        break
      case 'nunca':
        if (i.ultimoAcceso) return false
        break
      case 'entraron':
        if (!i.ultimoAcceso) return false
        break
    }
    if (filtros.empresa === 'general' && i.empresa) return false
    if (filtros.empresa && filtros.empresa !== 'general' && i.empresa?.id !== filtros.empresa) return false
    if (filtros.gen === 'sin' && i.cohorteId !== null) return false
    if (filtros.gen && filtros.gen !== 'sin' && i.cohorteId !== filtros.gen) return false
    return true
  })

  const porNombre = (a: Inscrito, b: Inscrito) =>
    (a.nombre || a.email).localeCompare(b.nombre || b.email, 'es')
  switch (filtros.orden) {
    case 'avance':
      visibles = visibles.sort((a, b) => b.porcentaje - a.porcentaje || porNombre(a, b))
      break
    case 'puntos':
      visibles = visibles.sort((a, b) => b.puntos - a.puntos || porNombre(a, b))
      break
    case 'reciente':
      visibles = visibles.sort(
        (a, b) =>
          new Date(b.ultimoAcceso ?? 0).getTime() - new Date(a.ultimoAcceso ?? 0).getTime() || porNombre(a, b)
      )
      break
    default:
      visibles = visibles.sort(porNombre)
  }

  return { visibles, resumen }
}

function resumenVacio(): ResumenInscritos {
  return {
    total: 0,
    vigentes: 0,
    entraron: 0,
    avancePromedio: 0,
    terminaron: 0,
    puntosPromedio: 0,
    lecciones: 0,
    porEmpresa: [],
    sinGeneracion: 0,
    porGeneracion: new Map(),
  }
}

export type Candidato = { userId: string; nombre: string; email: string; empresa: string | null }

/** Tope de la lista de candidatos: se busca, no se recorre. */
const TOPE_CANDIDATOS = 30

/**
 * Personas con cuenta que NO tienen este curso, para agregarlas. Se filtra
 * por lo que se escribió: con mil cuentas una lista completa es inservible y
 * pesa; treinta que coinciden con "aztlan" es lo que se necesita.
 */
export async function candidatosParaCurso(cursoId: string, buscar: string): Promise<Candidato[]> {
  const supabase = await crearClienteServidor()
  const [inscripciones, perfiles, empresas] = await Promise.all([
    supabase.from('enrollments').select('user_id').eq('course_id', cursoId),
    supabase
      .from('profiles')
      .select('user_id, full_name, email, company_id')
      .neq('role', 'invitado')
      .eq('status', 'active')
      .order('full_name'),
    supabase.from('companies').select('id, name'),
  ])

  const yaTienen = new Set((inscripciones.data ?? []).map((e) => e.user_id))
  const nombreDeEmpresa = new Map((empresas.data ?? []).map((e) => [e.id, e.name]))
  const termino = buscar.trim().toLowerCase()

  return (perfiles.data ?? [])
    .filter((p) => !yaTienen.has(p.user_id))
    .map((p) => ({
      userId: p.user_id,
      nombre: p.full_name?.trim() || '',
      email: p.email,
      empresa: p.company_id ? (nombreDeEmpresa.get(p.company_id) ?? null) : null,
    }))
    .filter(
      (c) =>
        !termino ||
        c.nombre.toLowerCase().includes(termino) ||
        c.email.toLowerCase().includes(termino) ||
        (c.empresa ?? '').toLowerCase().includes(termino)
    )
    .slice(0, TOPE_CANDIDATOS)
}
