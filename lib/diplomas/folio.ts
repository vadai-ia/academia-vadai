import 'server-only'

import { createHash, createHmac } from 'node:crypto'

/**
 * El folio de un diploma: `VT-<programa>-XXXX-XXXX`.
 *
 * Se calcula, no se guarda: HMAC del programa y la persona con una sal del
 * servidor. Es estable (siempre el mismo para la misma persona), no se adivina
 * y se verifica recalculándolo en /diploma/[folio].
 */

const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function sal(): string {
  const propia = process.env.DIPLOMAS_SALT
  if (propia) return propia
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return createHash('sha256').update(`diplomas:${llave}`).digest('hex')
}

export function folioDeDiploma(clave: string, userId: string): string {
  const bytes = createHmac('sha256', sal()).update(`${clave}:${userId}`).digest()
  let codigo = ''
  for (let i = 0; i < 8; i += 1) codigo += ALFABETO[bytes[i]! % ALFABETO.length]
  return `VT-${clave}-${codigo.slice(0, 4)}-${codigo.slice(4)}`
}

/** La clave del programa dentro de un folio, o null si no tiene la forma. */
export function claveDelFolio(folio: string): string | null {
  const m = /^VT-([A-Z0-9]+)-[A-Z0-9]{4}-[A-Z0-9]{4}$/.exec(folio.trim().toUpperCase())
  return m?.[1] ?? null
}
