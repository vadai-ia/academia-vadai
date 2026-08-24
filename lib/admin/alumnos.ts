import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

export type AlumnoEnLista = {
  userId: string
  email: string
  nombre: string
  rol: string
  estado: string
  creadoEn: string | null
  inscripciones: Array<{
    cursoId: string
    cursoTitulo: string
    cohorte: string | null
    vigente: boolean
    expiraEn: string | null
    revocada: boolean
    /** Avance en ese curso, para la fila desplegable. */
    hechas: number
    total: number
    porcentaje: number
  }>
  pagos: Array<{ cursoTitulo: string; monto: number; moneda: string; fecha: string }>
}

export type PagoEnLista = {
  id: string
  email: string
  cursoTitulo: string
  monto: number
  moneda: string
  estado: string
  fecha: string
  tieneCuenta: boolean
}

/**
 * Listado de alumnos con sus inscripciones.
 *
 * Va por el cliente de servidor con la llave del admin, no con service role:
 * las policies ya le dan acceso total al schema y así el listado respeta RLS
 * como todo lo demás.
 */
export async function listarAlumnos(busqueda?: string): Promise<AlumnoEnLista[]> {
  const supabase = await crearClienteServidor()

  // Las cuatro son independientes: en serie serían cuatro viajes encadenados.
  //
  // El progreso se pide COMPLETO y se agrupa aquí, en vez de una consulta por
  // persona. Con 40 alumnos eso serían 40 viajes de red para pintar una tabla;
  // así es uno. `lesson_outline` da el total de lecciones por curso.
  const [perfiles, progreso, outline, pagos] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'user_id, email, full_name, role, status, created_at, enrollments(course_id, expires_at, status, courses(title), cohorts(name))'
      )
      .order('created_at', { ascending: false }),
    supabase.from('lesson_progress').select('user_id, lesson_id, completed'),
    supabase.from('lesson_outline').select('id, course_id'),
    supabase.from('payments').select('email, amount, currency, created_at, courses(title)'),
  ])

  if (perfiles.error) {
    console.error(JSON.stringify({ operacion: 'listarAlumnos', error: perfiles.error.message }))
    return []
  }

  type Anidado = {
    user_id: string
    email: string
    full_name: string
    role: string
    status: string
    created_at: string | null
    enrollments: Array<{
      course_id: string
      expires_at: string | null
      status: string
      courses: { title: string } | null
      cohorts: { name: string } | null
    }>
  }

  // Lección -> curso, para saber a qué curso cuenta cada avance.
  const cursoDeLeccion = new Map<string, string>()
  const totalPorCurso = new Map<string, number>()
  for (const fila of outline.data ?? []) {
    if (!fila.id || !fila.course_id) continue
    cursoDeLeccion.set(fila.id, fila.course_id)
    totalPorCurso.set(fila.course_id, (totalPorCurso.get(fila.course_id) ?? 0) + 1)
  }

  // (usuario, curso) -> lecciones hechas.
  const hechasPor = new Map<string, number>()
  for (const fila of progreso.data ?? []) {
    if (!fila.completed) continue
    const curso = cursoDeLeccion.get(fila.lesson_id)
    if (!curso) continue
    const llave = `${fila.user_id}::${curso}`
    hechasPor.set(llave, (hechasPor.get(llave) ?? 0) + 1)
  }

  type PagoAnidado = {
    email: string
    amount: number
    currency: string
    created_at: string
    courses: { title: string } | null
  }

  const pagosPor = new Map<string, AlumnoEnLista['pagos']>()
  for (const fila of (pagos.data ?? []) as unknown as PagoAnidado[]) {
    const correo = (fila.email ?? '').toLowerCase()
    const lista = pagosPor.get(correo) ?? []
    lista.push({
      cursoTitulo: fila.courses?.title ?? 'Curso',
      monto: fila.amount,
      moneda: fila.currency,
      fecha: fila.created_at,
    })
    pagosPor.set(correo, lista)
  }

  const termino = (busqueda ?? '').trim().toLowerCase()

  return (perfiles.data as unknown as Anidado[])
    .filter((p) => {
      if (termino === '') return true
      // Se busca por nombre Y por correo a la vez: quien busca "ana" no sabe si
      // la registró como Ana Pérez o como ana@empresa.com.
      return (
        (p.full_name ?? '').toLowerCase().includes(termino) ||
        (p.email ?? '').toLowerCase().includes(termino)
      )
    })
    .map((p) => ({
      userId: p.user_id,
      email: p.email,
      nombre: p.full_name,
      rol: p.role,
      estado: p.status,
      creadoEn: p.created_at,
      pagos: pagosPor.get((p.email ?? '').toLowerCase()) ?? [],
      inscripciones: (p.enrollments ?? []).map((e) => {
        const total = totalPorCurso.get(e.course_id) ?? 0
        const hechas = hechasPor.get(`${p.user_id}::${e.course_id}`) ?? 0

        return {
          cursoId: e.course_id,
          cursoTitulo: e.courses?.title ?? 'Curso',
          cohorte: e.cohorts?.name ?? null,
          revocada: e.status === 'revoked',
          vigente:
            e.status === 'active' &&
            (!e.expires_at || new Date(e.expires_at).getTime() > Date.now()),
          expiraEn: e.expires_at,
          hechas,
          total,
          porcentaje: total === 0 ? 0 : Math.round((hechas / total) * 100),
        }
      }),
    }))
}

/**
 * Pagos recibidos.
 *
 * `tieneCuenta` es lo que hace útil esta pantalla: un pago sin cuenta significa
 * que el webhook registró el dinero pero el alta no se completó. Es el caso que
 * §11 manda resolver a mano, y aquí se ve de un vistazo.
 */
export async function listarPagos(): Promise<PagoEnLista[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('payments')
    .select('id, email, amount, currency, status, created_at, user_id, courses(title)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error(JSON.stringify({ operacion: 'listarPagos', error: error.message }))
    return []
  }

  type Anidado = {
    id: string
    email: string
    amount: number
    currency: string
    status: string
    created_at: string
    user_id: string | null
    courses: { title: string } | null
  }

  return (data as unknown as Anidado[]).map((p) => ({
    id: p.id,
    email: p.email,
    cursoTitulo: p.courses?.title ?? 'Curso',
    monto: p.amount,
    moneda: p.currency.toUpperCase(),
    estado: p.status,
    fecha: p.created_at,
    tieneCuenta: Boolean(p.user_id),
  }))
}

/** Cursos y cohortes publicados, para el formulario de alta manual. */
export async function opcionesDeAlta(): Promise<
  Array<{ id: string; titulo: string; cohortes: Array<{ id: string; nombre: string }> }>
> {
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('courses')
    .select('id, title, status, cohorts(id, name)')
    .neq('status', 'archived')
    .order('title')

  type Anidado = {
    id: string
    title: string
    cohorts: Array<{ id: string; name: string }>
  }

  return ((data ?? []) as unknown as Anidado[]).map((c) => ({
    id: c.id,
    titulo: c.title,
    cohortes: (c.cohorts ?? []).map((h) => ({ id: h.id, nombre: h.name })),
  }))
}
