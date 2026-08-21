import { randomBytes } from 'node:crypto'

/**
 * Folio público del certificado (§3.6).
 *
 * El folio es la única llave de `/certificado/[folio]`, una página sin login.
 * Eso le impone dos condiciones que se contradicen a medias:
 *
 *   - Se dicta, se teclea y se lee en voz alta desde un PDF impreso. Tiene que
 *     ser corto y sin caracteres que se confundan.
 *   - Es lo único que separa a un curioso de los datos de un alumno. No puede
 *     ser una secuencia ni derivarse de nada.
 *
 * Se resuelve con un alfabeto Crockford (sin I, L, O ni U: se confunden con 1,
 * 0 y entre sí, y la U evita groserías accidentales) y 10 caracteres de azar
 * criptográfico. Son 32^10 ≈ 1.1e15 combinaciones: adivinar uno a fuerza bruta
 * no es viable, y el `unique` de la tabla atrapa la colisión improbable.
 *
 *   VADAI-2026-8FK3ZQ9M2X
 *
 * El año va en claro porque es lo primero que alguien quiere saber de un
 * certificado, y no revela nada que el propio documento no diga.
 */

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const LARGO = 10

export function generarFolio(fecha = new Date()): string {
  // rejection sampling: 256 no es múltiplo de 32, pero 32 sí divide a 256,
  // así que el módulo aquí no introduce sesgo.
  const bytes = randomBytes(LARGO)
  let azar = ''
  for (const byte of bytes) azar += ALFABETO[byte % ALFABETO.length]

  return `VADAI-${fecha.getFullYear()}-${azar}`
}

/** Normaliza lo que alguien teclea: mayúsculas, sin espacios. */
export function normalizarFolio(entrada: string): string {
  return entrada.trim().toUpperCase().replace(/\s+/g, '')
}

const FORMATO = /^VADAI-\d{4}-[0-9A-HJKMNP-TV-Z]{10}$/

export function pareceFolio(entrada: string): boolean {
  return FORMATO.test(normalizarFolio(entrada))
}
