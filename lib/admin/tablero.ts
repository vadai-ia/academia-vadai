import 'server-only'

import { ultimosInicios } from '@/lib/admin/accesos'
import {
  cohortesParaAgendar,
  proximasSesiones,
  type CohorteAgendable,
  type SesionProxima,
} from '@/lib/admin/cohortes'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * El panel principal del admin: lo que se quiere saber al abrirlo.
 *
 * Reemplaza a `resumen.ts`, que daba cuatro cifras y una línea. Lo que pidió
 * Alejandro la víspera del lanzamiento (20-sep-2026) fue lo que ya daba la
 * pantalla de alumnos, pero para toda la academia: quién ha entrado, cómo van
 * avanzando por curso, qué se ha cobrado y qué sesión toca, con un botón para
 * agendar la siguiente sin ir a buscar la cohorte.
 *
 * Todo sale de la base en un solo `Promise.all`. Son ocho consultas planas
 * que se cruzan aquí; con doscientos alumnos y veinte lecciones son unas
 * miles de filas, que es nada. Cuando sean cientos de miles, esto se
 * convierte en vistas materializadas; hoy sería optimizar lo que no duele.
 *
 * Va por el cliente del admin, con su RLS. Lo único con service role es
 * `ultimosInicios()`, porque `auth.users` no se puede leer de otra forma.
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

export type PagoEnTablero = {
  email: string
  cursoTitulo: string
  monto: number
  moneda: string
  fecha: string
}

export type Tablero = {
  personas: number
  conAccesoVigente: number
  entraron: number
  nuncaEntraron: number
  activosSemana: number
  cursos: CursoEnTablero[]
  cursosBorrador: number
  ingresos: {
    pagos: number
    totalPorMoneda: Array<{ moneda: string; total: number; esteMes: number }>
    ultimos: PagoEnTablero[]
  }
  entregasPendientes: number
  certificadosEmitidos: number
  encuestas: { enVivo: number; total: number; padron: number }
  sesiones: SesionProxima[]
  cohortes: CohorteAgendable[]
}

export async function tableroAdmin(): Promise<Tablero> {
  const supabase = await crearClienteServidor()
  const ahora = Date.now()
  const haceSieteDias = ahora - 7 * 24 * 60 * 60 * 1000
  const inicioDeMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()

  const [
    perfiles,
    inscripciones,
    cursos,
    outline,
    progreso,
    pagos,
    entregas,
    certificados,
    encuestas,
    padron,
    inicios,
    sesiones,
    cohortes,
  ] = await Promise.all([
    supabase.from('profiles').select('user_id, role, status'),
    supabase.from('enrollments').select('user_id, course_id, status, expires_at'),
    supabase.from('courses').select('id, slug, title, status'),
    supabase.from('lesson_outline').select('id, course_id'),
    supabase.from('lesson_progress').select('user_id, lesson_id, completed'),
    supabase
      .from('payments')
      .select('email, amount, currency, status, created_at, course_id')
      .order('created_at', { ascending: false }),
    supabase.from('assignment_submissions').select('id').eq('status', 'submitted'),
    supabase.from('certificates').select('id'),
    supabase.from('polls').select('status'),
    supabase.from('participants').select('id'),
    ultimosInicios(),
    proximasSesiones(5),
    cohortesParaAgendar(),
  ])

  for (const [nombre, r] of Object.entries({ perfiles, inscripciones, cursos, outline, progreso, pagos })) {
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
    const ultimo = inicios.get(p.user_id)
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

  // --- ingresos --------------------------------------------------------------
  // `amount` viene en unidades de la moneda: el webhook divide entre 100 al
  // guardar (app/api/stripe/webhook/route.ts).
  const tituloDeCurso = new Map((cursos.data ?? []).map((c) => [c.id, c.title]))
  const cobrados = (pagos.data ?? []).filter((p) => p.status === 'paid')
  const porMoneda = new Map<string, { total: number; esteMes: number }>()
  for (const p of cobrados) {
    const m = p.currency.toUpperCase()
    const acumulado = porMoneda.get(m) ?? { total: 0, esteMes: 0 }
    acumulado.total += Number(p.amount)
    if (new Date(p.created_at).getTime() >= inicioDeMes) acumulado.esteMes += Number(p.amount)
    porMoneda.set(m, acumulado)
  }

  // --- encuestas -------------------------------------------------------------
  const listaEncuestas = encuestas.data ?? []

  return {
    personas: alumnado.length,
    conAccesoVigente: alumnado.filter((p) => conVigente.has(p.user_id)).length,
    entraron,
    nuncaEntraron: alumnado.length - entraron,
    activosSemana,
    cursos: cursosEnTablero,
    cursosBorrador: cursosVivos.filter((c) => c.status === 'draft').length,
    ingresos: {
      pagos: cobrados.length,
      totalPorMoneda: [...porMoneda.entries()]
        .map(([moneda, v]) => ({ moneda, ...v }))
        .sort((a, b) => b.total - a.total),
      ultimos: cobrados.slice(0, 5).map((p) => ({
        email: p.email,
        cursoTitulo: tituloDeCurso.get(p.course_id) ?? 'Curso',
        monto: Number(p.amount),
        moneda: p.currency.toUpperCase(),
        fecha: p.created_at,
      })),
    },
    entregasPendientes: entregas.data?.length ?? 0,
    certificadosEmitidos: certificados.data?.length ?? 0,
    encuestas: {
      enVivo: listaEncuestas.filter((e) => e.status === 'live').length,
      total: listaEncuestas.length,
      padron: padron.data?.length ?? 0,
    },
    sesiones,
    cohortes,
  }
}
