import { NextResponse } from 'next/server'

import { esEquipo, obtenerSesion } from '@/lib/auth/sesion'
import {
  datosParaExportar,
  libroDeEncuesta,
  nombreDeArchivo,
} from '@/lib/encuestas/exportacion'

export const dynamic = 'force-dynamic'

/**
 * Descarga del `.xlsx` de una encuesta.
 *
 * Vive bajo `/api/reportes/` y NO bajo `/api/encuestas/` a propósito: ese
 * prefijo está en `PREFIJOS_PUBLICOS` para que el celular de la sala pueda
 * sondear el estado sin sesión, y colgar de ahí una descarga con nombres,
 * correos y teléfonos de todos los asistentes la dejaría abierta a internet.
 *
 * Aquí el middleware ya exige sesión —una ruta `/api/` sin sesión recibe 401, no
 * un redirect— y este handler exige además que sea del equipo.
 *
 * A diferencia del certificado, no pasa por bucket ni por URL firmada: el
 * archivo se arma al vuelo y se manda en la respuesta. Un reporte de encuesta
 * cambia cada vez que alguien contesta, así que guardarlo solo serviría para
 * repartir una versión vieja.
 */
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 })
  }
  // Mismo 404 que si no existiera: a quien no le toca, no se le confirma que la
  // encuesta existe.
  if (!esEquipo(sesion.perfil)) {
    return NextResponse.json({ error: 'Encuesta no encontrada.' }, { status: 404 })
  }

  const { id } = await params
  const datos = await datosParaExportar(id)
  if (!datos) {
    return NextResponse.json({ error: 'Encuesta no encontrada.' }, { status: 404 })
  }

  const ahora = new Date()
  const libro = libroDeEncuesta(datos, ahora)

  return new NextResponse(new Uint8Array(libro), {
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${nombreDeArchivo(datos, 'xlsx', ahora)}"`,
      'content-length': String(libro.length),
      'cache-control': 'no-store',
    },
  })
}
