import { randomBytes } from 'node:crypto'

/**
 * Las dos llaves públicas de una encuesta.
 *
 * Son distintas a propósito y no se pueden intercambiar:
 *
 *   join_code         lo ve la sala proyectado y lo teclea quien no pudo
 *                     escanear. Corto y sin caracteres que se confundan.
 *
 *   projection_token  abre la pantalla que se proyecta. Nunca se dicta ni se
 *                     imprime, así que puede ser largo y feo.
 *
 * Si fueran el mismo valor, el código que la sala lee en la pared abriría
 * también la pantalla de proyección. Por eso hay dos.
 */

/**
 * Alfabeto Crockford, el mismo que el folio del certificado: sin I, L, O ni U.
 * La I y la L se confunden con el 1, la O con el 0, y la U evita groserías
 * accidentales — que en un código proyectado frente a una sala importa más de
 * lo que parece.
 */
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Seis caracteres. Son 32^6 ≈ 1.07e9 combinaciones.
 *
 * Es mucho menos que el folio del certificado (32^10), y está bien: un
 * join_code solo vale mientras la encuesta está en vivo, y lo que protege no es
 * un dato personal sino el derecho a contestar una pregunta proyectada en una
 * pared. La cuota por IP de `poll_join_attempts` es lo que hace inviable
 * barrerlo a fuerza bruta; la longitud solo tiene que evitar la colisión, y el
 * `unique` de la tabla atrapa la improbable.
 *
 * Seis es también lo máximo que alguien teclea en un celular sin equivocarse.
 */
const LARGO_CODIGO = 6

function azar(largo: number): string {
  // 32 divide a 256, así que el módulo no introduce sesgo.
  const bytes = randomBytes(largo)
  let salida = ''
  for (const byte of bytes) salida += ALFABETO[byte % ALFABETO.length]
  return salida
}

export function generarJoinCode(): string {
  return azar(LARGO_CODIGO)
}

/** 32 bytes en hex. No se lee en voz alta, así que no necesita alfabeto amable. */
export function generarProjectionToken(): string {
  return randomBytes(32).toString('hex')
}

/** Normaliza lo que alguien teclea: mayúsculas y sin espacios. */
export function normalizarJoinCode(entrada: string): string {
  return entrada.trim().toUpperCase().replace(/\s+/g, '')
}

const FORMATO = /^[0-9A-HJKMNP-TV-Z]{6}$/

export function pareceJoinCode(entrada: string): boolean {
  return FORMATO.test(normalizarJoinCode(entrada))
}

/** El token opaco que identifica a un participante en su cookie. */
export function generarSessionToken(): string {
  return randomBytes(32).toString('hex')
}
