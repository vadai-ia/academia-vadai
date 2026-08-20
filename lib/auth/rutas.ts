/**
 * Mapa de rutas y quién puede entrar a cada una.
 *
 * El middleware lee esto; no toma decisiones por su cuenta. Así el criterio de
 * acceso vive en un solo archivo y se puede leer de corrido.
 */

export const RUTAS = {
  inicio: '/',
  login: '/login',
  recuperar: '/recuperar',
  nuevaContrasena: '/nueva-contrasena',
  sinAcceso: '/sin-acceso',
  misCursos: '/mis-cursos',
  admin: '/admin',
} as const

/** Rutas que se ven sin haber iniciado sesión. */
const PUBLICAS = [
  RUTAS.inicio,
  RUTAS.login,
  RUTAS.recuperar,
  RUTAS.nuevaContrasena,
]

/** Prefijos públicos: callbacks de auth y verificación de certificados (§3.6). */
const PREFIJOS_PUBLICOS = ['/auth/', '/certificado/', '/api/stripe/']

export function esPublica(ruta: string): boolean {
  if (PUBLICAS.includes(ruta as (typeof PUBLICAS)[number])) return true
  return PREFIJOS_PUBLICOS.some((prefijo) => ruta.startsWith(prefijo))
}

/** Rutas de autenticación: quien ya entró no debería volver aquí. */
export function esDeAutenticacion(ruta: string): boolean {
  return ruta === RUTAS.login || ruta === RUTAS.recuperar
}

export function esDeAdmin(ruta: string): boolean {
  return ruta === RUTAS.admin || ruta.startsWith(`${RUTAS.admin}/`)
}

/** A dónde mandar a alguien recién autenticado, según su rol. */
export function rutaDeInicio(role: string | null | undefined): string {
  return role === 'admin' || role === 'superadmin' ? RUTAS.admin : RUTAS.misCursos
}
