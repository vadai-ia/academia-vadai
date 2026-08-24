import 'server-only'

import { filasDeCsv, filasDeXlsx, type FilasLeidas } from './padron'

export { interpretar, type Interpretacion, type PersonaImportada } from './padron'
export type { FilasLeidas }

/**
 * Puente entre el `File` que llega del formulario y el lector de padrones.
 *
 * Se separa de `padron.ts` para que ese quede probable sin la app: aquí es
 * donde entra el mundo real —tamaño, extensión, bytes— y allá vive la lógica.
 *
 * Se aceptan CSV y XLSX a propósito. Pedir "guárdalo como CSV" justo cuando
 * alguien va a dar de alta a 40 alumnos es fricción en el peor momento.
 */

/** Tope de tamaño. Un padrón de 40 alumnos pesa kilobytes, no megas. */
const LIMITE_BYTES = 4 * 1024 * 1024

export async function filasDeArchivo(archivo: File): Promise<FilasLeidas> {
  if (archivo.size === 0) return { ok: false, motivo: 'El archivo está vacío.' }
  if (archivo.size > LIMITE_BYTES) {
    return { ok: false, motivo: 'El archivo pesa más de 4 MB. Divide el padrón.' }
  }

  const nombre = archivo.name.toLowerCase()
  const bytes = Buffer.from(await archivo.arrayBuffer())

  if (nombre.endsWith('.xls') && !nombre.endsWith('.xlsx')) {
    return {
      ok: false,
      motivo: 'El formato .xls antiguo no se puede leer. Guárdalo como .xlsx o .csv.',
    }
  }

  // Un .xlsx siempre empieza con "PK": es la firma del ZIP. Se comprueba el
  // CONTENIDO y no solo la extensión, porque renombrar un archivo es gratis.
  const esZip = bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4b

  if (esZip) {
    try {
      return filasDeXlsx(bytes)
    } catch {
      return {
        ok: false,
        motivo: 'No se pudo leer el Excel. Ábrelo y guárdalo como CSV UTF-8.',
      }
    }
  }

  return { ok: true, filas: filasDeCsv(bytes.toString('utf8')) }
}
