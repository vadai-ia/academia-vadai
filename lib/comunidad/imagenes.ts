import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Las imágenes del muro (M24), un solo lugar para subirlas.
 *
 * El tipo se decide por los PRIMEROS BYTES del archivo, no por lo que dice el
 * navegador ni por la extensión: un SVG (que puede llevar código) renombrado a
 * .png no pasa. Solo JPEG, PNG, WebP y GIF.
 */

export const BUCKET_DEL_MURO = 'academia-media'

export type ImagenDelMuro = { url: string; storage_path: string }

type TipoDeImagen = { tipo: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; extension: string }

export function tipoDeImagen(bytes: Uint8Array): TipoDeImagen | null {
  const b = (i: number) => bytes[i] ?? -1
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return { tipo: 'image/png', extension: 'png' }
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { tipo: 'image/jpeg', extension: 'jpg' }
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) return { tipo: 'image/gif', extension: 'gif' }
  const riff = b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46
  const webp = b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50
  if (riff && webp) return { tipo: 'image/webp', extension: 'webp' }
  return null
}

// El cliente que llega es el del servidor o el del agente; aquí solo se usa storage.
type ConStorage = Pick<SupabaseClient, 'storage'>

/** Sube bytes ya revisados. Regresa la imagen o el motivo del error. */
export async function subirImagen(
  db: ConStorage,
  bytes: Uint8Array,
  carpeta: string,
  nombre: string
): Promise<ImagenDelMuro | { error: string }> {
  const tipo = tipoDeImagen(bytes)
  if (!tipo) return { error: 'Solo se aceptan imágenes JPG, PNG, WebP o GIF.' }
  const ruta = `${carpeta.replace(/\/+$/, '')}/${nombre.replace(/[^\w.-]+/g, '_').slice(0, 80)}.${tipo.extension}`
  const { error } = await db.storage.from(BUCKET_DEL_MURO).upload(ruta, bytes, { contentType: tipo.tipo, upsert: true })
  if (error) {
    console.error(JSON.stringify({ operacion: 'imagenes:subir', ruta, error: error.message }))
    return { error: /exceeded|maximum/i.test(error.message) ? 'La imagen es demasiado grande.' : 'No se pudo subir la imagen.' }
  }
  const { data } = db.storage.from(BUCKET_DEL_MURO).getPublicUrl(ruta)
  return { url: data.publicUrl, storage_path: ruta }
}

/**
 * Los archivos de un formulario (`<input type="file" name="…" multiple>`):
 * revisa cuántos, cuánto pesan y qué son, y los sube. Si uno falla, borra los
 * que ya había subido.
 */
export async function subirArchivos(
  db: ConStorage,
  archivos: File[],
  carpeta: string,
  o: { maximo: number; maxBytes: number }
): Promise<ImagenDelMuro[] | { error: string }> {
  const validos = archivos.filter((a) => a.size > 0)
  if (validos.length > o.maximo) return { error: `Puedes subir hasta ${o.maximo} imágenes.` }
  const subidas: ImagenDelMuro[] = []
  for (const archivo of validos) {
    if (archivo.size > o.maxBytes) {
      await borrarImagenes(db, subidas)
      return { error: `Cada imagen puede pesar hasta ${Math.round(o.maxBytes / 1_000_000)} MB.` }
    }
    const bytes = new Uint8Array(await archivo.arrayBuffer())
    const r = await subirImagen(db, bytes, carpeta, `${Date.now()}-${subidas.length + 1}`)
    if ('error' in r) {
      await borrarImagenes(db, subidas)
      return r
    }
    subidas.push(r)
  }
  return subidas
}

export async function borrarImagenes(db: ConStorage, imagenes: ImagenDelMuro[]): Promise<void> {
  if (imagenes.length === 0) return
  await db.storage.from(BUCKET_DEL_MURO).remove(imagenes.map((i) => i.storage_path))
}
