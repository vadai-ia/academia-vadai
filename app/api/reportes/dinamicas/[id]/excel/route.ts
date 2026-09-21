import { NextResponse } from 'next/server'

import { esEquipo, obtenerSesion } from '@/lib/auth/sesion'
import {
  datosDeDinamica,
  libroDeDinamica,
  nombreDeArchivoDinamica,
} from '@/lib/dinamicas/exportacion'

export const dynamic = 'force-dynamic'

/**
 * Descarga del `.xlsx` de una dinámica empresarial.
 *
 * Calco de `app/api/reportes/[id]/excel/route.ts`: vive bajo `/api/reportes/`
 * porque ese prefijo exige sesión en el middleware —una ruta `/api/` sin
 * sesión recibe 401, no un redirect— y este handler exige además ser del
 * equipo. El libro trae los nombres de quien puso cada calificación en cada
 * empresa; eso no es de un alumno.
 *
 * Se arma al vuelo y se manda en la respuesta, sin bucket ni URL firmada: los
 * tableros cambian mientras la dinámica está abierta, y guardar el archivo
 * solo serviría para repartir una versión vieja.
 */
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 })
  }
  // Mismo 404 que si no existiera: a quien no le toca, no se le confirma que la
  // dinámica existe.
  if (!esEquipo(sesion.perfil)) {
    return NextResponse.json({ error: 'Dinámica no encontrada.' }, { status: 404 })
  }

  const { id } = await params
  const datos = await datosDeDinamica(id)
  if (!datos) {
    return NextResponse.json({ error: 'Dinámica no encontrada.' }, { status: 404 })
  }

  const ahora = new Date()
  const libro = libroDeDinamica(datos, ahora)

  return new NextResponse(new Uint8Array(libro), {
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${nombreDeArchivoDinamica(datos, 'xlsx', ahora)}"`,
      'content-length': String(libro.length),
      'cache-control': 'no-store',
    },
  })
}
