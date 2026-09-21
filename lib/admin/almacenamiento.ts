import 'server-only'

import type { crearClienteServiceRole } from '@/lib/supabase/service-role'

type Servicio = ReturnType<typeof crearClienteServiceRole>

/**
 * Los archivos de una persona en Storage.
 *
 * Postgres cascadea al borrar una cuenta; Storage no. Estas son las carpetas
 * donde la app guarda cosas a nombre de un usuario (el prefijo es su id):
 * entregas de tareas, avatar, adjuntos de la comunidad y PDFs de certificados.
 * Lo que quede huérfano lo recoge `pnpm storage:huerfanos`.
 */
const CARPETAS_DE_USUARIO = (uid: string): Array<[bucket: string, prefijo: string]> => [
  ['academia-adjuntos', `entregas/${uid}`],
  ['academia-media', `avatares/${uid}`],
  ['academia-media', `comunidad/${uid}`],
  ['academia-certificados', uid],
]

/**
 * Borra todo lo que cuelga de un prefijo. `remove()` exige rutas exactas, así
 * que primero se lista (paginado de 1000, un nivel de subcarpetas).
 */
export async function borrarCarpeta(
  servicio: Servicio,
  bucket: string,
  prefijo: string
): Promise<{ borrados: number; error?: string }> {
  const rutas: string[] = []
  const carpetas = [prefijo]

  while (carpetas.length > 0) {
    const carpeta = carpetas.pop() as string
    let offset = 0
    for (;;) {
      const { data, error } = await servicio.storage.from(bucket).list(carpeta, { limit: 1000, offset })
      if (error) return { borrados: 0, error: `${bucket}/${carpeta}: ${error.message}` }
      for (const entrada of data ?? []) {
        // Una entrada sin id es una subcarpeta.
        if (entrada.id === null) carpetas.push(`${carpeta}/${entrada.name}`)
        else rutas.push(`${carpeta}/${entrada.name}`)
      }
      if ((data ?? []).length < 1000) break
      offset += 1000
    }
  }

  let borrados = 0
  for (let i = 0; i < rutas.length; i += 100) {
    const lote = rutas.slice(i, i + 100)
    const { error } = await servicio.storage.from(bucket).remove(lote)
    if (error) return { borrados, error: `${bucket}: ${error.message}` }
    borrados += lote.length
  }
  return { borrados }
}

/** Tolerante: cada carpeta que falle se reporta y no detiene a las demás. */
export async function borrarArchivosDeUsuario(
  servicio: Servicio,
  uid: string
): Promise<{ borrados: number; advertencias: string[] }> {
  let borrados = 0
  const advertencias: string[] = []
  for (const [bucket, prefijo] of CARPETAS_DE_USUARIO(uid)) {
    const r = await borrarCarpeta(servicio, bucket, prefijo)
    borrados += r.borrados
    if (r.error) advertencias.push(r.error)
  }
  return { borrados, advertencias }
}
