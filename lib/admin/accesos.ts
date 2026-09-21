import 'server-only'

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

export type Pendiente = { userId: string; email: string; nombre: string | null; cursos: string[] }

/**
 * Alumnos activos que nunca han entrado y a los que no se les mandó un enlace
 * en las últimas 24 horas. Es la lista del botón "reenviar acceso a quien
 * falta": la ventana de 24 h es lo que hace que dos clics seguidos no manden
 * dos correos a la misma persona.
 *
 * Fuera quedan el equipo, los invitados de encuestas y las cuentas QA: a esas
 * el correo ni les llega (`lib/correo/resend.ts` las corta) y contarlas
 * inflaría el "quedan N".
 */
export async function alumnosPendientesDeEntrar(): Promise<Pendiente[]> {
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, enrollments(status, created_at, courses(title))')
    .eq('role', 'alumno')
    .eq('status', 'active')
    .is('last_sign_in_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error(JSON.stringify({ operacion: 'alumnosPendientesDeEntrar', error: error.message }))
    return []
  }

  type Anidado = {
    user_id: string
    email: string
    full_name: string | null
    enrollments: Array<{ status: string; created_at: string; courses: { title: string } | null }>
  }

  const perfiles = ((data ?? []) as unknown as Anidado[]).filter(
    (p) => !/^qa-.*@academia\.vadai\.com\.mx$/i.test(p.email)
  )
  const enlaces = await ultimosEnlaces(perfiles.map((p) => p.user_id))
  const hace24h = Date.now() - 24 * 60 * 60 * 1000

  return perfiles
    .filter((p) => {
      const ultimo = enlaces.get(p.user_id)
      return !(ultimo && new Date(ultimo.enviadoEn).getTime() > hace24h)
    })
    .map((p) => {
      // Los cursos con inscripción activa, para que el correo los nombre igual
      // que la bienvenida original y no hable de "la plataforma" a secas.
      const cursos = (p.enrollments ?? [])
        .filter((e) => e.status === 'active' && e.courses?.title)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((e) => e.courses?.title ?? '')
        .filter(Boolean)
      return {
        userId: p.user_id,
        email: p.email,
        nombre: p.full_name?.trim() || null,
        cursos: [...new Set(cursos)],
      }
    })
}
