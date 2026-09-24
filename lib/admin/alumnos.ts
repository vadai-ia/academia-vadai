import 'server-only'

import { ultimosEnlaces, type UltimoEnlace } from '@/lib/admin/accesos'
import { crearClienteServidor } from '@/lib/supabase/server'

export type AlumnoEnLista = {
  userId: string
  email: string
  nombre: string
  rol: string
  estado: string
  creadoEn: string | null
  /** Último inicio de sesión (profiles.last_sign_in_at). null = nunca ha entrado. */
  ultimoAcceso: string | null
  /** De dónde viene. null = General. */
  empresa: { id: string; nombre: string } | null
  /** El último enlace de 30 días que se le mandó, si alguno. */
  enlace: UltimoEnlace | null
  inscripciones: Array<{
    cursoId: string
    cursoTitulo: string
    cohorte: string | null
    vigente: boolean
    expiraEn: string | null
    revocada: boolean
    hechas: number
    total: number
    porcentaje: number
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
  /** La cuenta se eliminó a propósito: no es un alta que quedó a medias. */
  cuentaEliminada: boolean
}

export const POR_PAGINA = 25

export type CorteDeAcceso = 'todos' | 'nunca' | 'entraron'

export type FiltrosAlumnos = {
  /** Nombre, correo o empresa. */
  q?: string
  /** uuid de la empresa, 'general' (sin empresa) o vacío (todas). */
  empresa?: string
  ver?: 'activos' | 'suspendidos'
  acceso?: CorteDeAcceso
  pagina?: number
}

export type PaginaDeAlumnos = {
  filas: AlumnoEnLista[]
  /** Cuántos cumplen los filtros, en todas las páginas. */
  total: number
  /** Ya acotada a [1, paginas]. */
  pagina: number
  paginas: number
  porPagina: number
}

/** Para las pestañas y las pastillas: respetan búsqueda y empresa, no el corte. */
export type ConteosDeAlumnos = {
  activos: number
  suspendidos: number
  /** Sobre las cuentas activas. */
  entraron: number
  nunca: number
}

// --- filtros comunes ---------------------------------------------------------

/**
 * PostgREST separa un `or=` por comas y paréntesis, y el `%` es el comodín de
 * `ilike`: lo que la persona teclea no puede colarse con esos caracteres.
 */
function limpiarTermino(q: string | undefined): string {
  return (q ?? '')
    .trim()
    .replace(/[,()"'\\%]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>

async function empresasQueCoinciden(supabase: Cliente, termino: string): Promise<string[]> {
  if (!termino) return []
  const { data } = await supabase.from('companies').select('id').ilike('name', `%${termino}%`).limit(20)
  return (data ?? []).map((e) => e.id)
}

/** La expresión `or=` de la búsqueda, o null si no hay término. */
function expresionDeBusqueda(termino: string, empresas: string[]): string | null {
  if (!termino) return null
  const partes = [`full_name.ilike.%${termino}%`, `email.ilike.%${termino}%`]
  if (empresas.length > 0) partes.push(`company_id.in.(${empresas.join(',')})`)
  return partes.join(',')
}

// --- listado -----------------------------------------------------------------

/**
 * Una página de alumnos con sus inscripciones.
 *
 * M14: búsqueda, empresa, estado y "¿ya entró?" se filtran en Postgres —antes
 * la lista traía a TODOS con TODO su progreso y TODOS los pagos y filtraba en
 * memoria— y solo se enriquecen (avance, pagos, ligas) los 25 de la página.
 *
 * Va por el cliente de servidor con la llave del admin, no con service role:
 * las policies ya le dan acceso total al schema y así el listado respeta RLS
 * como todo lo demás.
 */
export async function listarAlumnos(filtros: FiltrosAlumnos = {}): Promise<PaginaDeAlumnos> {
  const supabase = await crearClienteServidor()
  const termino = limpiarTermino(filtros.q)
  const empresasBuscadas = await empresasQueCoinciden(supabase, termino)
  const busqueda = expresionDeBusqueda(termino, empresasBuscadas)
  const paginaPedida = Math.max(1, Math.floor(filtros.pagina ?? 1))

  const consultar = async (pagina: number) => {
    const desde = (pagina - 1) * POR_PAGINA
    let c = supabase
      .from('profiles')
      // Sin las inscripciones anidadas (24-sep-2026): con `enrollments(...,
      // courses(title), cohorts(name))` dentro, PostgREST tardaba cinco veces
      // más en el servidor que pedir los 25 perfiles y luego sus inscripciones
      // en una consulta aparte, en paralelo con el resto de esta página.
      .select('user_id, email, full_name, role, status, created_at, company_id, last_sign_in_at', {
        count: 'exact',
      })
      // Los `invitado` NO son alumnos: son gente que contestó una encuesta en un
      // evento y dejó su correo. Mezclarlos aquí llenaría el padrón de leads.
      // En cuanto uno compra o se le da de alta deja de ser invitado y aparece
      // aquí solo: lo asciende `darDeAlta()`.
      .neq('role', 'invitado')
      .eq('status', filtros.ver === 'suspendidos' ? 'suspended' : 'active')
    if (busqueda) c = c.or(busqueda)
    if (filtros.empresa === 'general') c = c.is('company_id', null)
    else if (filtros.empresa) c = c.eq('company_id', filtros.empresa)
    if (filtros.acceso === 'nunca') c = c.is('last_sign_in_at', null)
    else if (filtros.acceso === 'entraron') c = c.not('last_sign_in_at', 'is', null)
    return c.order('created_at', { ascending: false }).range(desde, desde + POR_PAGINA - 1)
  }

  // Solo para caer de pie: PostgREST contesta 416 cuando el rango queda fuera
  // de la tabla (una URL vieja, gente borrada), así que ahí se cuenta y se
  // pide la última página. El caso normal sigue siendo una sola consulta.
  const contar = async () => {
    let c = supabase
      .from('profiles')
      .select('user_id', { count: 'exact', head: true })
      .neq('role', 'invitado')
      .eq('status', filtros.ver === 'suspendidos' ? 'suspended' : 'active')
    if (busqueda) c = c.or(busqueda)
    if (filtros.empresa === 'general') c = c.is('company_id', null)
    else if (filtros.empresa) c = c.eq('company_id', filtros.empresa)
    if (filtros.acceso === 'nunca') c = c.is('last_sign_in_at', null)
    else if (filtros.acceso === 'entraron') c = c.not('last_sign_in_at', 'is', null)
    const { count } = await c
    return count ?? 0
  }

  // Estas dos no dependen de qué página se pida: arrancan junto con la lista
  // y no esperan a que termine (24-sep-2026). Antes eran una ola aparte.
  const outlineP = supabase.from('lesson_outline').select('id, course_id')
  const empresasP = supabase.from('companies').select('id, name')

  let pagina = paginaPedida
  let respuesta = await consultar(pagina)
  if (respuesta.error && pagina > 1) {
    pagina = Math.max(1, Math.ceil((await contar()) / POR_PAGINA))
    respuesta = await consultar(pagina)
  }
  const { data, count, error } = respuesta
  const total = count ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  if (error) {
    console.error(JSON.stringify({ operacion: 'listarAlumnos', filtros, error: error.message }))
    return { filas: [], total: 0, pagina: 1, paginas: 1, porPagina: POR_PAGINA }
  }

  type Anidado = {
    user_id: string
    email: string
    full_name: string
    role: string
    status: string
    created_at: string | null
    company_id: string | null
    last_sign_in_at: string | null
  }

  type Inscripcion = {
    user_id: string
    course_id: string
    expires_at: string | null
    status: string
    courses: { title: string } | null
    cohorts: { name: string } | null
  }

  const perfiles = (data ?? []) as unknown as Anidado[]
  const ids = perfiles.map((p) => p.user_id)

  // Solo lo de esta página. `lesson_outline` (lecciones publicadas por curso)
  // es chica y da el total contra el que se mide el avance.
  const vacio = Promise.resolve({ data: [] as never[] })
  const [progreso, outline, enlaces, empresas, inscripciones] = await Promise.all([
    ids.length
      ? supabase.from('lesson_progress').select('user_id, lesson_id').eq('completed', true).in('user_id', ids)
      : vacio,
    outlineP,
    ultimosEnlaces(ids),
    empresasP,
    ids.length
      ? supabase
          .from('enrollments')
          .select('user_id, course_id, expires_at, status, courses(title), cohorts(name)')
          .in('user_id', ids)
      : vacio,
  ])

  const inscripcionesDe = new Map<string, Inscripcion[]>()
  for (const e of ((inscripciones.data ?? []) as unknown as Inscripcion[])) {
    inscripcionesDe.set(e.user_id, [...(inscripcionesDe.get(e.user_id) ?? []), e])
  }

  const cursoDeLeccion = new Map<string, string>()
  const totalPorCurso = new Map<string, number>()
  for (const fila of outline.data ?? []) {
    if (!fila.id || !fila.course_id) continue
    cursoDeLeccion.set(fila.id, fila.course_id)
    totalPorCurso.set(fila.course_id, (totalPorCurso.get(fila.course_id) ?? 0) + 1)
  }

  const hechasPor = new Map<string, number>()
  for (const fila of (progreso.data ?? []) as Array<{ user_id: string; lesson_id: string }>) {
    const curso = cursoDeLeccion.get(fila.lesson_id)
    if (!curso) continue
    const llave = `${fila.user_id}::${curso}`
    hechasPor.set(llave, (hechasPor.get(llave) ?? 0) + 1)
  }

  const nombreDeEmpresa = new Map((empresas.data ?? []).map((e) => [e.id, e.name]))
  const ahora = Date.now()

  const filas = perfiles.map((p) => ({
    userId: p.user_id,
    email: p.email,
    nombre: p.full_name,
    rol: p.role,
    estado: p.status,
    creadoEn: p.created_at,
    ultimoAcceso: p.last_sign_in_at ?? null,
    empresa: p.company_id
      ? { id: p.company_id, nombre: nombreDeEmpresa.get(p.company_id) ?? 'Empresa' }
      : null,
    enlace: enlaces.get(p.user_id) ?? null,
    inscripciones: (inscripcionesDe.get(p.user_id) ?? []).map((e) => {
      const total = totalPorCurso.get(e.course_id) ?? 0
      const hechas = hechasPor.get(`${p.user_id}::${e.course_id}`) ?? 0
      return {
        cursoId: e.course_id,
        cursoTitulo: e.courses?.title ?? 'Curso',
        cohorte: e.cohorts?.name ?? null,
        revocada: e.status === 'revoked',
        vigente: e.status === 'active' && (!e.expires_at || new Date(e.expires_at).getTime() > ahora),
        expiraEn: e.expires_at,
        hechas,
        total,
        porcentaje: total === 0 ? 0 : Math.round((hechas / total) * 100),
      }
    }),
  }))

  return { filas, total, pagina, paginas, porPagina: POR_PAGINA }
}

/**
 * Cuántos hay en cada pestaña y en cada corte, con la misma búsqueda y empresa
 * que la lista. Una consulta chica: tres columnas por perfil.
 */
export async function conteosDeAlumnos(filtros: Pick<FiltrosAlumnos, 'q' | 'empresa'>): Promise<ConteosDeAlumnos> {
  const supabase = await crearClienteServidor()
  const termino = limpiarTermino(filtros.q)
  const busqueda = expresionDeBusqueda(termino, await empresasQueCoinciden(supabase, termino))

  let c = supabase.from('profiles').select('user_id, status, last_sign_in_at').neq('role', 'invitado')
  if (busqueda) c = c.or(busqueda)
  if (filtros.empresa === 'general') c = c.is('company_id', null)
  else if (filtros.empresa) c = c.eq('company_id', filtros.empresa)

  const { data, error } = await c
  if (error) {
    console.error(JSON.stringify({ operacion: 'conteosDeAlumnos', error: error.message }))
    return { activos: 0, suspendidos: 0, entraron: 0, nunca: 0 }
  }

  const activos = (data ?? []).filter((p) => p.status === 'active')
  const entraron = activos.filter((p) => p.last_sign_in_at).length
  return {
    activos: activos.length,
    suspendidos: (data ?? []).length - activos.length,
    entraron,
    nunca: activos.length - entraron,
  }
}

/** Las cifras de arriba de la lista. Solo se piden en la primera página sin filtros. */
export async function resumenDeAlumnos(): Promise<{
  personas: number
  conAccesoVigente: number
  entraron: number
  nunca: number
}> {
  const supabase = await crearClienteServidor()
  const [perfiles, inscripciones] = await Promise.all([
    supabase.from('profiles').select('user_id, last_sign_in_at').neq('role', 'invitado').eq('status', 'active'),
    supabase.from('enrollments').select('user_id, expires_at').eq('status', 'active'),
  ])

  const ahora = Date.now()
  const activos = perfiles.data ?? []
  const conVigente = new Set(
    (inscripciones.data ?? [])
      .filter((e) => !e.expires_at || new Date(e.expires_at).getTime() > ahora)
      .map((e) => e.user_id)
  )
  const entraron = activos.filter((p) => p.last_sign_in_at).length

  return {
    personas: activos.length,
    conAccesoVigente: activos.filter((p) => conVigente.has(p.user_id)).length,
    entraron,
    nunca: activos.length - entraron,
  }
}

/**
 * Pagos recibidos.
 *
 * NO la llama ninguna pantalla desde el 21-sep-2026: el dinero salió del panel
 * y de la lista de alumnos, que se proyectan. Se queda porque es la consulta
 * del apartado de Ingresos que viene, con Stripe conectado.
 *
 * `tieneCuenta` es lo que la hace útil: un pago sin cuenta significa que el
 * webhook registró el dinero pero el alta no se completó. Es el caso que §11
 * manda resolver a mano. `cuentaEliminada` separa el otro caso: la cuenta
 * existió y el equipo la borró a propósito.
 */
export async function listarPagos(): Promise<PagoEnLista[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('payments')
    .select('id, email, amount, currency, status, created_at, user_id, account_deleted_at, courses(title)')
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
    account_deleted_at: string | null
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
    cuentaEliminada: Boolean(p.account_deleted_at),
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
