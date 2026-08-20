import 'server-only'

import { redirect } from 'next/navigation'

import { crearClienteServidor } from '@/lib/supabase/server'
import type { Tabla } from '@/lib/supabase/types'

import { RUTAS, rutaDeInicio } from './rutas'

export type Perfil = Tabla<'profiles'>

/**
 * Los cuatro estados posibles de quien pide una página.
 *
 * `sinPerfil` no es un error: `auth.users` puede ser compartido y estar
 * autenticado NO significa pertenecer a la academia. La pertenencia la da la
 * fila en `academia.profiles` (Regla Cero).
 */
export type Sesion =
  | { tipo: 'anonimo' }
  | { tipo: 'sinPerfil'; email: string | null }
  | { tipo: 'suspendido'; perfil: Perfil }
  | { tipo: 'activo'; perfil: Perfil }

/**
 * Resuelve quién está pidiendo la página.
 *
 * Usa getUser() y no getSession(): getSession lee la cookie sin validarla contra
 * el servidor de Auth, así que una cookie manipulada pasaría. getUser verifica.
 */
export async function obtenerSesion(): Promise<Sesion> {
  const supabase = await crearClienteServidor()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { tipo: 'anonimo' }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!perfil) return { tipo: 'sinPerfil', email: user.email ?? null }
  if (perfil.status === 'suspended') return { tipo: 'suspendido', perfil }

  return { tipo: 'activo', perfil }
}

/**
 * Para páginas que exigen pertenecer a la academia.
 * Devuelve el perfil o corta la ejecución con un redirect.
 */
export async function exigirPerfil(): Promise<Perfil> {
  const sesion = await obtenerSesion()

  switch (sesion.tipo) {
    case 'activo':
      return sesion.perfil
    case 'anonimo':
      redirect(RUTAS.login)
    case 'sinPerfil':
    case 'suspendido':
      redirect(RUTAS.sinAcceso)
  }
}

/** Para el área de admin. Un alumno que llegue aquí vuelve a lo suyo. */
export async function exigirAdmin(): Promise<Perfil> {
  const perfil = await exigirPerfil()

  if (perfil.role !== 'admin' && perfil.role !== 'superadmin') {
    redirect(rutaDeInicio(perfil.role))
  }

  return perfil
}

export function esEquipo(perfil: Perfil): boolean {
  return perfil.role === 'admin' || perfil.role === 'superadmin'
}

/** Nombre para saludar, con el correo como respaldo. */
export function nombreVisible(perfil: Perfil): string {
  const limpio = perfil.full_name.trim()
  if (limpio) return limpio
  const [usuario] = perfil.email.split('@')
  return usuario ?? perfil.email
}
