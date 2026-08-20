/**
 * Traducción de los errores de Supabase Auth.
 *
 * El alumno es dueño de negocio, no técnico (§0): nunca debe leer
 * "Invalid login credentials". Y los mensajes no distinguen entre "no existe la
 * cuenta" y "la contraseña no coincide", para no confirmar qué correos están
 * dados de alta.
 */

const TRADUCCIONES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Tu cuenta aún no está confirmada. Revisa tu correo.'],
  [/user not found/i, 'Correo o contraseña incorrectos.'],
  [/invalid or expired/i, 'Ese enlace ya venció. Pide uno nuevo.'],
  [/token has expired/i, 'Ese enlace ya venció. Pide uno nuevo.'],
  [/same as the old password/i, 'La contraseña nueva no puede ser igual a la anterior.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
  [/over_email_send_rate_limit|rate limit/i,
    'Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.'],
  [/signups not allowed|signup is disabled/i,
    'No es posible crear cuentas por tu cuenta. Si compraste un curso, contáctanos.'],
]

export function traducirError(mensaje: string | undefined): string {
  if (!mensaje) return 'Algo salió mal. Vuelve a intentar.'
  for (const [patron, texto] of TRADUCCIONES) {
    if (patron.test(mensaje)) return texto
  }
  return 'Algo salió mal. Vuelve a intentar.'
}
