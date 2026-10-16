import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Las llaves de la API (M20): `vadai_<id>_<secreto>`.
 *
 *   - `id`: 12 letras y números. Es público: sirve para encontrar la llave.
 *   - `secreto`: 32 bytes al azar (base64url). Se muestra UNA vez, al crearla.
 *
 * En la base va el id y `HMAC-SHA256(API_KEYS_PEPPER, secreto)`. Sin el pepper
 * —que vive solo en el servidor— una copia de la base no sirve para entrar, y
 * sin él ninguna llave entra: no hay valor por defecto.
 */

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789'
const FORMATO = /^Bearer vadai_([a-z0-9]{12})_([A-Za-z0-9_-]{43})$/

function pepper(): string {
  const valor = process.env.API_KEYS_PEPPER ?? ''
  if (valor.length < 32) throw new Error('Falta API_KEYS_PEPPER (32 caracteres o más) en el servidor.')
  return valor
}

export function apiConfigurada(): boolean {
  return (process.env.API_KEYS_PEPPER ?? '').length >= 32
}

export function hashDeSecreto(secreto: string): string {
  return createHmac('sha256', pepper()).update(secreto).digest('hex')
}

export function nuevaLlave(): { completa: string; keyId: string; hash: string } {
  const bytes = randomBytes(12)
  const keyId = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')
  const secreto = randomBytes(32).toString('base64url')
  return { completa: `vadai_${keyId}_${secreto}`, keyId, hash: hashDeSecreto(secreto) }
}

/** El encabezado `Authorization`, si trae una llave bien formada. */
export function leerLlave(encabezado: string | null): { keyId: string; secreto: string } | null {
  const m = encabezado?.trim().match(FORMATO)
  return m ? { keyId: m[1]!, secreto: m[2]! } : null
}

/** Compara dos hashes hex sin filtrar por tiempo cuánto coinciden. */
export function mismoHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

/** Una huella de la IP para la bitácora: ve abusos sin guardar la IP. */
export function huellaDeIp(ip: string | null): string | null {
  if (!ip || !apiConfigurada()) return null
  return createHmac('sha256', pepper()).update(`ip:${ip}`).digest('hex').slice(0, 16)
}
