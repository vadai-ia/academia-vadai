import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

export type AlumnoEnLista = {
  userId: string
  email: string
  nombre: string
  rol: string
  estado: string
  inscripciones: Array<{
    cursoId: string
    cursoTitulo: string
    cohorte: string | null
    vigente: boolean
    expiraEn: string | null
    revocada: boolean
  }>
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
export async function listarAlumnos(): Promise<AlumnoEnLista[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, role, status, enrollments(course_id, expires_at, status, courses(title), cohorts(name))')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(JSON.stringify({ operacion: 'listarAlumnos', error: error.message }))
    return []
  }

  type Anidado = {
    user_id: string
    email: string
    full_name: string
    role: string
    status: string
    enrollments: Array<{
      course_id: string
      expires_at: string | null
      status: string
      courses: { title: string } | null
      cohorts: { name: string } | null
    }>
  }

  return (data as unknown as Anidado[]).map((p) => ({
    userId: p.user_id,
    email: p.email,
    nombre: p.full_name,
    rol: p.role,
    estado: p.status,
    inscripciones: (p.enrollments ?? []).map((e) => ({
      cursoId: e.course_id,
      cursoTitulo: e.courses?.title ?? 'Curso',
      cohorte: e.cohorts?.name ?? null,
      revocada: e.status === 'revoked',
      vigente:
        e.status === 'active' &&
        (!e.expires_at || new Date(e.expires_at).getTime() > Date.now()),
      expiraEn: e.expires_at,
    })),
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
