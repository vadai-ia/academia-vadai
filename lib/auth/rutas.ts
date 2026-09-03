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
  misEncuestas: '/mis-encuestas',
  admin: '/admin',
} as const

/** Rutas que se ven sin haber iniciado sesión. */
const PUBLICAS = [
  RUTAS.inicio,
  RUTAS.login,
  RUTAS.recuperar,
  RUTAS.nuevaContrasena,
]

/**
 * Prefijos públicos: callbacks de auth, verificación de certificados (§3.6) y
 * las superficies de encuestas que MIRA LA SALA.
 *
 * `/e/` no se protege con sesión, y es a propósito: quien escanea un QR en un
 * salón puede no tener cuenta, y pedirle una sería el final de la dinámica. Se
 * protege con el `join_code`, una llave no adivinable verificada en el servidor,
 * que es el mismo criterio que `/certificado/[folio]`.
 *
 * `/proyectar/` NO está aquí (decidido 3-sep-2026). Se protegió un tiempo solo
 * con su token, para poder mandar la pantalla a otra máquina sin iniciar sesión.
 * El problema es que quien proyecta suele hacerlo en una ventana con barra de
 * direcciones a la vista: cualquiera en la sala podía fotografiar el token y,
 * desde su lugar, ver los nombres del muro o —ahora que la pantalla trae
 * controles— manejar la dinámica. Exige sesión de admin.
 *
 * Si alguien quita `/e/` de aquí "por seguridad", la feature entera deja de
 * funcionar: el middleware corre en TODAS las rutas.
 */
const PREFIJOS_PUBLICOS = [
  '/auth/',
  '/certificado/',
  '/api/stripe/',
  '/e/',
  '/api/encuestas/',
]

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

/**
 * A dónde mandar a alguien recién autenticado, según su rol.
 *
 * `invitado` no va a /mis-cursos. Nació contestando una encuesta en un evento y
 * no ha comprado nada: ahí solo vería un estado vacío que le pide escribirnos
 * porque "no aparece su curso", y nunca compró ninguno. Su lugar es la lista de
 * las dinámicas en las que participó.
 */
export function rutaDeInicio(role: string | null | undefined): string {
  if (role === 'admin' || role === 'superadmin') return RUTAS.admin
  if (role === 'invitado') return RUTAS.misEncuestas
  return RUTAS.misCursos
}
