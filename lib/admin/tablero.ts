import 'server-only'

import {
  cohortesParaAgendar,
  proximasSesiones,
  type CohorteAgendable,
  type SesionProxima,
} from '@/lib/admin/cohortes'
import { estaAbierta } from '@/lib/dinamicas/comun'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * El panel principal del admin: lo que se quiere saber al abrirlo.
 *
 * Reemplaza a `resumen.ts`, que daba cuatro cifras y una línea. Lo que pidió
 * Alejandro la víspera del lanzamiento (20-sep-2026) fue lo que ya daba la
 * pantalla de alumnos, pero para toda la academia: quién ha entrado, cómo van
 * avanzando por curso y qué sesión toca, con un botón para
 * agendar la siguiente sin ir a buscar la generación.
 *
 * Todo sale de la base en un solo `Promise.all`. Son consultas planas
 * que se cruzan aquí; con doscientos alumnos y veinte lecciones son unas
 * miles de filas, que es nada. Cuando sean cientos de miles, esto se
 * convierte en vistas materializadas; hoy sería optimizar lo que no duele.
 *
 * Va por el cliente del admin, con su RLS: aquí no hay service role.
 */

export type CursoEnTablero = {
  id: string
  slug: string
  titulo: string
  status: string
  inscritos: number
  lecciones: number
  empezaron: number
  terminaron: number
  avancePromedio: number
}

export type Tablero = {
  personas: number
  conAccesoVigente: number
  entraron: number
  nuncaEntraron: number
  activosSemana: number
  cursos: CursoEnTablero[]
  cursosBorrador: number
  // El dinero NO vive aquí (21-sep-2026). El panel se proyecta en sala y en
  // pantalla compartida: los ingresos y los correos de quien pagó no se
  // enseñan de paso. Van a tener su propio apartado, con Stripe conectado.
  entregasPendientes: number
  certificadosEmitidos: number
  encuestas: { enVivo: number; total: number; padron: number }
  /** `abiertas` es el estado efectivo: una abierta con fecha límite vencida no cuenta. */
  dinamicas: { abiertas: number; total: number; tableros: number }
  sesiones: SesionProxima[]
  cohortes: CohorteAgendable[]
}

export async function tableroAdmin(): Promise<Tablero> {
  const supabase = await crearClienteServidor()
  const ahora = Date.now()
  const haceSieteDias = ahora - 7 * 24 * 60 * 60 * 1000

  const [
    perfiles,
    inscripciones,
    cursos,
    outline,
    progreso,
    entregas,
    certificados,
    encuestas,
    padron,
    dinamicas,
    tablerosDeDinamicas,
    sesiones,
    cohortes,
  ] = await Promise.all([
    supabase.from('profiles').select('user_id, role, status, last_sign_in_at'),
    supabase.from('enrollments').select('user_id, course_id, status, expires_at'),
    supabase.from('courses').select('id, slug, title, status'),
    supabase.from('lesson_outline').select('id, course_id'),
    supabase.from('lesson_progress').select('user_id, lesson_id, completed'),
    supabase.from('assignment_submissions').select('id').eq('status', 'submitted'),
    supabase.from('certificates').select('id'),
    supabase.from('polls').select('status'),
    supabase.from('participants').select('id'),
    supabase.from('dynamics').select('status, closes_at'),
    supabase.from('dynamic_boards').select('id'),
    proximasSesiones(5),
    cohortesParaAgendar(),
  ])

  for (const [nombre, r] of Object.entries({ perfiles, inscripciones, cursos, outline, progreso })) {
    if (r.error) console.error(JSON.stringify({ operacion: 'tableroAdmin', consulta: nombre, error: r.error.message }))
  }

  // --- personas y accesos --------------------------------------------------
  // Los `invitado` son leads de encuestas, no alumnos: no cuentan aquí, igual
  // que no salen en /admin/alumnos.
  const alumnado = (perfiles.data ?? []).filter((p) => p.role !== 'invitado' && p.status === 'active')
  const vigente = (e: { status: string; expires_at: string | null }) =>
    e.status === 'active' && (!e.expires_at || new Date(e.expires_at).getTime() > ahora)

  const conVigente = new Set((inscripciones.data ?? []).filter(vigente).map((e) => e.user_id))
  let entraron = 0
  let activosSemana = 0
  for (const p of alumnado) {
    const ultimo = p.last_sign_in_at
    if (!ultimo) continue
    entraron += 1
    if (new Date(ultimo).getTime() >= haceSieteDias) activosSemana += 1
  }

  // --- avance por curso ----------------------------------------------------
  const leccionesDe = new Map<string, Set<string>>()
  for (const l of outline.data ?? []) {
    if (!l.id || !l.course_id) continue
    if (!leccionesDe.has(l.course_id)) leccionesDe.set(l.course_id, new Set())
    leccionesDe.get(l.course_id)?.add(l.id)
  }
  const cursoDeLeccion = new Map<string, string>()
  for (const [cursoId, ids] of leccionesDe) for (const id of ids) cursoDeLeccion.set(id, cursoId)

  // (usuario, curso) -> lecciones hechas
  const hechas = new Map<string, number>()
  for (const f of progreso.data ?? []) {
    if (!f.completed) continue
    const cursoId = cursoDeLeccion.get(f.lesson_id)
    if (!cursoId) continue
    const llave = `${f.user_id}::${cursoId}`
    hechas.set(llave, (hechas.get(llave) ?? 0) + 1)
  }

  const cursosVivos = (cursos.data ?? []).filter((c) => c.status !== 'archived')
  const cursosEnTablero: CursoEnTablero[] = cursosVivos
    .filter((c) => c.status === 'published')
    .map((c) => {
      const lecciones = leccionesDe.get(c.id)?.size ?? 0
      const inscritos = (inscripciones.data ?? []).filter(
        (e) => e.course_id === c.id && e.status === 'active'
      )
      let empezaron = 0
      let terminaron = 0
      let suma = 0
      for (const e of inscritos) {
        const n = hechas.get(`${e.user_id}::${c.id}`) ?? 0
        if (n > 0) empezaron += 1
        if (lecciones > 0 && n >= lecciones) terminaron += 1
        suma += lecciones > 0 ? n / lecciones : 0
      }
      return {
        id: c.id,
        slug: c.slug,
        titulo: c.title,
        status: c.status,
        inscritos: inscritos.length,
        lecciones,
        empezaron,
        terminaron,
        avancePromedio: inscritos.length > 0 ? Math.round((suma / inscritos.length) * 100) : 0,
      }
    })
    .sort((a, b) => b.inscritos - a.inscritos)

  // --- encuestas -------------------------------------------------------------
  const listaEncuestas = encuestas.data ?? []

  // --- dinámicas -------------------------------------------------------------
  // "Abierta" es la misma regla que academia.dinamica_abierta(): el cierre por
  // fecha es perezoso y se evalúa al leer.
  const listaDinamicas = dinamicas.data ?? []

  return {
    personas: alumnado.length,
    conAccesoVigente: alumnado.filter((p) => conVigente.has(p.user_id)).length,
    entraron,
    nuncaEntraron: alumnado.length - entraron,
    activosSemana,
    cursos: cursosEnTablero,
    cursosBorrador: cursosVivos.filter((c) => c.status === 'draft').length,
    entregasPendientes: entregas.data?.length ?? 0,
    certificadosEmitidos: certificados.data?.length ?? 0,
    encuestas: {
      enVivo: listaEncuestas.filter((e) => e.status === 'live').length,
      total: listaEncuestas.length,
      padron: padron.data?.length ?? 0,
    },
    dinamicas: {
      abiertas: listaDinamicas.filter((d) => estaAbierta(d, ahora)).length,
      total: listaDinamicas.length,
      tableros: tablerosDeDinamicas.data?.length ?? 0,
    },
    sesiones,
    cohortes,
  }
}
