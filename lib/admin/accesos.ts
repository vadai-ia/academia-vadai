import 'server-only'

import { crearClienteServiceRole } from '@/lib/supabase/service-role'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * ¿Quién ya entró y a quién le falta su acceso?
 *
 * Es la pregunta del panel la mañana de un lanzamiento: de cien personas
 * dadas de alta, ¿cuántas han abierto la puerta? Antes no se podía saber sin
 * entrar al dashboard de Supabase y leer `last_sign_in_at` fila por fila.
 *
 * Ese dato vive en `auth.users`, que PostgREST no expone y que la Regla Cero
 * prohíbe replicar con un trigger propio. Se lee por la Admin API de Auth con
 * service role, que es su uso legítimo: no salta ninguna policy de `academia`
 * —la página que lo pide ya pasó por `exigirAdmin()`—, solo lee metadatos de
 * cuentas que el equipo administra.
 */

/** user_id -> último inicio de sesión, o null si nunca ha entrado. */
export async function ultimosInicios(): Promise<Map<string, string | null>> {
  const supabase = crearClienteServiceRole()
  const mapa = new Map<string, string | null>()

  // 1000 por página es el tope de la API. Con 200 alumnos es un viaje.
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 1000 })
    if (error) {
      console.error(JSON.stringify({ operacion: 'ultimosInicios', pagina, error: error.message }))
      break
    }
    for (const usuario of data.users) mapa.set(usuario.id, usuario.last_sign_in_at ?? null)
    if (data.users.length < 1000) break
  }

  return mapa
}

export type UltimoEnlace = {
  enviadoEn: string
  venceEn: string
  vigente: boolean
  usos: number
}

/**
 * user_id -> el enlace de acceso más reciente que se le mandó.
 *
 * Va por el cliente del admin, con su RLS: la policy de `access_links` deja
 * leer al equipo y a nadie más.
 */
export async function ultimosEnlaces(): Promise<Map<string, UltimoEnlace>> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('access_links')
    .select('user_id, created_at, expires_at, used_count, revoked_at')
    .order('created_at', { ascending: false })

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

export type Pendiente = { userId: string; email: string; nombre: string | null; curso: string }

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
  const [inicios, enlaces, perfiles] = await Promise.all([
    ultimosInicios(),
    ultimosEnlaces(),
    supabase
      .from('profiles')
      .select('user_id, email, full_name, enrollments(status, created_at, courses(title))')
      .eq('role', 'alumno')
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
  ])

  type Anidado = {
    user_id: string
    email: string
    full_name: string | null
    enrollments: Array<{ status: string; created_at: string; courses: { title: string } | null }>
  }

  const hace24h = Date.now() - 24 * 60 * 60 * 1000

  return ((perfiles.data ?? []) as unknown as Anidado[])
    .filter((p) => {
      if (/^qa-.*@academia\.vadai\.com\.mx$/i.test(p.email)) return false
      if (inicios.get(p.user_id)) return false
      const ultimo = enlaces.get(p.user_id)
      if (ultimo && new Date(ultimo.enviadoEn).getTime() > hace24h) return false
      return true
    })
    .map((p) => {
      // El curso más reciente con inscripción activa, para que el correo diga
      // "tu acceso a Claude en tu Empresa" y no "a la academia".
      const activa = (p.enrollments ?? [])
        .filter((e) => e.status === 'active' && e.courses?.title)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      return {
        userId: p.user_id,
        email: p.email,
        nombre: p.full_name?.trim() || null,
        curso: activa?.courses?.title ?? 'la academia',
      }
    })
}
