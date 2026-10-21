import 'server-only'

import { faltaFuncion, type LlamadaRpc } from '@/lib/alumno/catalogo'
import type { EstadoCorreo, OrigenCorreoAcceso, TipoCorreoAcceso } from '@/lib/correo/decision'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * ¿Quién ya entró y a quién le falta su acceso?
 *
 * Es la pregunta del panel la mañana de un lanzamiento: de cien personas
 * dadas de alta, ¿cuántas han abierto la puerta?
 *
 * "¿Ya entró?" sale de `profiles.last_sign_in_at`, que la app sella al abrir
 * sesión (lib/auth/inicio-de-sesion.ts). Hasta M14 se leía barriendo la Admin
 * API de Auth con service role —hasta veinte llamadas por pregunta, y la lista
 * de alumnos la hacía dos veces por carga—. Ahora es una columna: se filtra,
 * se pagina y se ordena en Postgres, con el cliente del admin y su RLS.
 */

export type UltimoEnlace = {
  enviadoEn: string
  venceEn: string
  vigente: boolean
  usos: number
}

/**
 * user_id -> el enlace de acceso más reciente que se le mandó.
 *
 * Con `userIds` solo trae los de esas personas (la página de la lista, la
 * ficha); sin él, todos. Va por el cliente del admin, con su RLS: la policy
 * de `access_links` deja leer al equipo y a nadie más.
 */
export async function ultimosEnlaces(userIds?: string[]): Promise<Map<string, UltimoEnlace>> {
  if (userIds && userIds.length === 0) return new Map()

  const supabase = await crearClienteServidor()
  let consulta = supabase
    .from('access_links')
    .select('user_id, created_at, expires_at, used_count, revoked_at')
    .order('created_at', { ascending: false })
  if (userIds) consulta = consulta.in('user_id', userIds)

  const { data, error } = await consulta
  if (error) {
    console.error(JSON.stringify({ operacion: 'ultimosEnlaces', error: error.message }))
    return new Map()
  }

  const mapa = new Map<string, UltimoEnlace>()
  for (const fila of data ?? []) {
    if (mapa.has(fila.user_id)) continue // viene ordenado: el primero es el último
    mapa.set(fila.user_id, {
      enviadoEn: fila.created_at,
      venceEn: fila.expires_at,
      vigente: !fila.revoked_at && new Date(fila.expires_at).getTime() > Date.now(),
      usos: fila.used_count,
    })
  }
  return mapa
}

/** La tabla todavía no existe (migración 0047 sin aplicar): la pantalla se pinta igual. */
function faltaTabla(error: { code?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205'
}

export type Pendiente = { userId: string; email: string; nombre: string | null; cursos: string[] }

/**
 * A quién le toca el recordatorio «Mandar a quien falta» (M25, 20-oct-2026).
 *
 * Decisión de Alejandro, con la Generación 2 por empezar: «si ellos estaban
 * ligados a un curso o generación que ya terminó… no les reenvíe… y que solo
 * lo mande a los de cursos o generaciones activas». La regla vive en la base,
 * en `academia_por_activar` (migración 0047): nunca entró y tiene al menos una
 * inscripción vigente en un curso que NO es base y cuya generación no ha
 * terminado —en curso, por empezar, o V-AI-P vigente—.
 *
 * Además se salta a quien recibió una liga en las últimas 24 horas: es lo que
 * hace que dos clics seguidos no le manden dos correos a la misma persona.
 *
 * `qa`: un admin real nunca ve cuentas `qa-*` y el admin QA de las suites solo
 * ve esas. Va por el cliente del admin, con su RLS.
 */
export async function alumnosPorActivar(opciones: {
  qa: boolean
}): Promise<{ porEnviar: Pendiente[]; recibieronHoy: number }> {
  const supabase = await crearClienteServidor()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { data, error } = await rpc('academia_por_activar', { p_qa: opciones.qa })

  if (error) {
    if (!faltaFuncion(error)) console.error(JSON.stringify({ operacion: 'alumnosPorActivar', error: error.message }))
    return { porEnviar: [], recibieronHoy: 0 }
  }

  type Fila = { user_id: string; email: string; full_name: string | null; cursos: string[] | null; ultimo_enlace: string | null }
  const hace24h = Date.now() - 24 * 60 * 60 * 1000
  const filas = (data ?? []) as Fila[]
  const recientes = filas.filter((f) => f.ultimo_enlace && new Date(f.ultimo_enlace).getTime() > hace24h)

  return {
    porEnviar: filas
      .filter((f) => !recientes.includes(f))
      .map((f) => ({
        userId: f.user_id,
        email: f.email,
        nombre: f.full_name?.trim() || null,
        cursos: f.cursos ?? [],
      })),
    recibieronHoy: recientes.length,
  }
}

// ==========================================================================
// La bitácora de correos de acceso (M25)
// ==========================================================================

export type CorreoQueNoSalio = {
  id: string
  userId: string
  email: string
  nombre: string | null
  tipo: TipoCorreoAcceso
  courseIds: string[]
  cohorteId: string | null
  motivo: string | null
  fecha: string
}

/**
 * A quién no le salió su último correo de acceso y todavía no ha entrado.
 * Es la tarjeta «N correos de acceso no salieron · Reenviar» de Alumnos.
 */
export async function correosQueNoSalieron(opciones: { qa: boolean }): Promise<CorreoQueNoSalio[]> {
  const supabase = await crearClienteServidor()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { data, error } = await rpc('academia_correos_por_reintentar', { p_qa: opciones.qa })

  if (error) {
    if (!faltaFuncion(error)) console.error(JSON.stringify({ operacion: 'correosQueNoSalieron', error: error.message }))
    return []
  }

  type Fila = {
    id: string
    user_id: string
    email: string
    full_name: string | null
    tipo: TipoCorreoAcceso
    course_ids: string[] | null
    cohort_id: string | null
    motivo: string | null
    created_at: string
  }
  return ((data ?? []) as Fila[]).map((f) => ({
    id: f.id,
    userId: f.user_id,
    email: f.email,
    nombre: f.full_name?.trim() || null,
    tipo: f.tipo,
    courseIds: f.course_ids ?? [],
    cohorteId: f.cohort_id,
    motivo: f.motivo,
    fecha: f.created_at,
  }))
}

export type CorreoDeAcceso = {
  id: string
  fecha: string
  email: string
  tipo: TipoCorreoAcceso
  origen: OrigenCorreoAcceso
  estado: EstadoCorreo
  motivo: string | null
  conEnlace: boolean
  cursos: string[]
  generacion: string | null
  porQuien: string | null
}

/** Los últimos correos de acceso de una persona, para su ficha. */
export async function correosDeAcceso(userId: string, limite = 10): Promise<CorreoDeAcceso[]> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('access_emails')
    .select('id, created_at, email, tipo, origen, estado, motivo, con_enlace, course_ids, cohort_id, creado_por')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) {
    // Sin la migración 0047 la tabla no existe: la ficha se pinta igual.
    if (!faltaTabla(error)) console.error(JSON.stringify({ operacion: 'correosDeAcceso', userId, error: error.message }))
    return []
  }

  const filas = data ?? []
  const cursoIds = [...new Set(filas.flatMap((f) => f.course_ids))]
  const cohorteIds = [...new Set(filas.map((f) => f.cohort_id).filter((v): v is string => v !== null))]
  const autores = [...new Set(filas.map((f) => f.creado_por).filter((v): v is string => v !== null))]

  const [cursos, cohortes, perfiles] = await Promise.all([
    cursoIds.length ? supabase.from('courses').select('id, title').in('id', cursoIds) : Promise.resolve({ data: [] }),
    cohorteIds.length ? supabase.from('cohorts').select('id, name').in('id', cohorteIds) : Promise.resolve({ data: [] }),
    autores.length ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', autores) : Promise.resolve({ data: [] }),
  ])
  const titulo = new Map((cursos.data ?? []).map((c) => [c.id, c.title]))
  const generacion = new Map((cohortes.data ?? []).map((g) => [g.id, g.name]))
  const autor = new Map((perfiles.data ?? []).map((p) => [p.user_id, p.full_name?.trim() || p.email]))

  return filas.map((f) => ({
    id: f.id,
    fecha: f.created_at,
    email: f.email,
    tipo: f.tipo,
    origen: f.origen,
    // Pendiente de más de 15 minutos: el envío no terminó. Se dice como falla.
    estado:
      f.estado === 'pendiente' && Date.now() - new Date(f.created_at).getTime() > 15 * 60 * 1000 ? 'fallido' : f.estado,
    motivo: f.estado === 'pendiente' && Date.now() - new Date(f.created_at).getTime() > 15 * 60 * 1000
      ? 'El envío no terminó.'
      : f.motivo,
    conEnlace: f.con_enlace,
    cursos: f.course_ids.map((id) => titulo.get(id)).filter((t): t is string => Boolean(t)),
    generacion: f.cohort_id ? (generacion.get(f.cohort_id) ?? null) : null,
    porQuien: f.creado_por ? (autor.get(f.creado_por) ?? null) : null,
  }))
}

/**
 * user_id → el estado de su último correo de acceso, para la insignia de la
 * lista («Correo falló»). Solo los de la página que se está viendo.
 */
export async function ultimosCorreos(userIds: string[]): Promise<Map<string, EstadoCorreo>> {
  if (userIds.length === 0) return new Map()
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('access_emails')
    .select('user_id, estado, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })

  if (error) {
    if (!faltaTabla(error)) console.error(JSON.stringify({ operacion: 'ultimosCorreos', error: error.message }))
    return new Map()
  }

  const mapa = new Map<string, EstadoCorreo>()
  for (const f of data ?? []) {
    if (mapa.has(f.user_id)) continue // viene ordenado: el primero es el último
    const atorado = f.estado === 'pendiente' && Date.now() - new Date(f.created_at).getTime() > 15 * 60 * 1000
    mapa.set(f.user_id, atorado ? 'fallido' : f.estado)
  }
  return mapa
}
