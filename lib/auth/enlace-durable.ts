import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Enlaces de acceso que valen 30 días.
 *
 * El correo de bienvenida llevaba un token de `recovery` de Supabase: dura
 * una hora por default y es de un solo uso. La víspera del lanzamiento 75 de
 * 106 alumnos tenían en el buzón una liga de dos días —muerta— y, peor, los
 * escáneres de enlaces de Outlook y Gmail la habían "abierto" antes que ellos
 * y gastado el token. Ver la migración academia_0024.
 *
 * Aquí el enlace es nuestro: `/acceso/<token>`. El token es aleatorio, se
 * guarda solo su hash, y canjearlo es un POST —nunca un GET— que pide a
 * Supabase un recovery fresco en ese instante. El resto del camino es el que
 * ya existía: /auth/confirmar deja la sesión y manda a poner contraseña.
 *
 * Todo con service role: la tabla no tiene policies de escritura para nadie.
 */

export const DIAS_DE_VIGENCIA = 30

function hashDe(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function registrar(operacion: string, detalle: Record<string, unknown>) {
  console.error(JSON.stringify({ operacion, ...detalle }))
}

/**
 * Crea un enlace para una cuenta que YA existe y devuelve la URL completa.
 *
 * Devuelve null si el correo no tiene perfil: un enlace para alguien que no
 * está en la academia no tiene sentido, y el llamador ya reporta ese caso.
 */
export async function crearEnlaceDurable(opciones: {
  email: string
  creadoPor?: string | null
  dias?: number
}): Promise<string | null> {
  const supabase = crearClienteServiceRole()
  const email = opciones.email.trim().toLowerCase()

  const { data: perfil } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('email', email)
    .maybeSingle()

  if (!perfil) {
    registrar('crearEnlaceDurable:sinPerfil', { email })
    return null
  }

  const token = randomBytes(32).toString('base64url')
  const dias = opciones.dias ?? DIAS_DE_VIGENCIA

  const { error } = await supabase.from('access_links').insert({
    user_id: perfil.user_id,
    token_hash: hashDe(token),
    expires_at: new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString(),
    created_by: opciones.creadoPor ?? null,
  })

  if (error) {
    registrar('crearEnlaceDurable:fallo', { email, error: error.message })
    return null
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  return `${base}/acceso/${token}`
}

/**
 * Un enlace por persona, para muchas personas, en un solo viaje a la base.
 *
 * Es la mitad del "mandar recordatorio a todos": ochenta inserts de uno en
 * uno cabrían, pero uno solo cabe seguro en el tiempo de una server action.
 * Devuelve correo -> URL; quien no tiene perfil simplemente no aparece.
 */
export async function crearEnlacesDurables(opciones: {
  emails: string[]
  creadoPor?: string | null
  dias?: number
}): Promise<Map<string, string>> {
  const supabase = crearClienteServiceRole()
  const emails = [...new Set(opciones.emails.map((e) => e.trim().toLowerCase()))]
  const resultado = new Map<string, string>()
  if (emails.length === 0) return resultado

  const { data: perfiles, error: errorPerfiles } = await supabase
    .from('profiles')
    .select('user_id, email')
    .in('email', emails)

  if (errorPerfiles || !perfiles) {
    registrar('crearEnlacesDurables:perfiles', { error: errorPerfiles?.message ?? 'sin datos' })
    return resultado
  }

  const dias = opciones.dias ?? DIAS_DE_VIGENCIA
  const expira = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')

  const filas = perfiles.map((p) => {
    const token = randomBytes(32).toString('base64url')
    resultado.set(p.email, `${base}/acceso/${token}`)
    return {
      user_id: p.user_id,
      token_hash: hashDe(token),
      expires_at: expira,
      created_by: opciones.creadoPor ?? null,
    }
  })

  const { error } = await supabase.from('access_links').insert(filas)
  if (error) {
    registrar('crearEnlacesDurables:fallo', { cuantos: filas.length, error: error.message })
    return new Map()
  }

  return resultado
}

export type EnlaceResuelto =
  | { ok: true; userId: string; email: string; nombre: string | null }
  | { ok: false }

/**
 * ¿Este token abre a alguien? Solo lee: un GET a la página pasa por aquí y no
 * puede dejar rastro ni gastar nada, porque los escáneres de correo también
 * hacen ese GET.
 */
export async function resolverEnlaceDurable(token: string): Promise<EnlaceResuelto> {
  if (!token || token.length < 32 || token.length > 128) return { ok: false }

  const supabase = crearClienteServiceRole()
  const { data } = await supabase
    .from('access_links')
    .select('user_id, expires_at, revoked_at')
    .eq('token_hash', hashDe(token))
    .maybeSingle()

  if (!data || data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false }
  }

  // Dos viajes y no un join: los tipos generados no conocen la relación con
  // profiles y el embebido sale como `never`. Es un token por clic; no importa.
  const { data: perfil } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('user_id', data.user_id)
    .maybeSingle()

  if (!perfil?.email) return { ok: false }

  return {
    ok: true,
    userId: data.user_id,
    email: perfil.email,
    nombre: perfil.full_name?.trim() || null,
  }
}

/** Cuenta un uso. Se llama solo desde el POST, nunca desde la página. */
export async function marcarUsoDeEnlace(token: string): Promise<void> {
  const supabase = crearClienteServiceRole()
  const hash = hashDe(token)

  const { data } = await supabase
    .from('access_links')
    .select('used_count')
    .eq('token_hash', hash)
    .maybeSingle()

  await supabase
    .from('access_links')
    .update({ used_count: (data?.used_count ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq('token_hash', hash)
}
