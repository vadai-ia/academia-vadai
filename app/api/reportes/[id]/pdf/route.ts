import { renderToBuffer } from '@react-pdf/renderer'
import { NextResponse } from 'next/server'

import { esEquipo, obtenerSesion } from '@/lib/auth/sesion'
import { urlDeEncuesta } from '@/lib/encuestas/comun'
import { datosParaExportar, nombreDeArchivo } from '@/lib/encuestas/exportacion'
import { Reporte } from '@/lib/encuestas/reporte'

export const dynamic = 'force-dynamic'

/**
 * Descarga del PDF con las gráficas de una encuesta.
 *
 * Las gráficas se redibujan en vector dentro de `reporte.tsx`, reusando los
 * mismos módulos de layout que la proyección. No hay captura de pantalla en
 * ningún punto: no hay navegador sin cabeza en este stack.
 *
 * Mismas guardas que la descarga del Excel, y por el mismo motivo: la ruta vive
 * fuera de `/api/encuestas/`, que es pública para el sondeo.
 */
export async function GET(_peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 })
  }
  if (!esEquipo(sesion.perfil)) {
    return NextResponse.json({ error: 'Encuesta no encontrada.' }, { status: 404 })
  }

  const { id } = await params
  const datos = await datosParaExportar(id)
  if (!datos) {
    return NextResponse.json({ error: 'Encuesta no encontrada.' }, { status: 404 })
  }

  const ahora = new Date()
  const url = urlDeEncuesta(process.env.NEXT_PUBLIC_APP_URL ?? '', datos.codigo)

  const pdf = await renderToBuffer(Reporte({ datos, url, emitidoEn: ahora }))

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${nombreDeArchivo(datos, 'pdf', ahora)}"`,
      'content-length': String(pdf.length),
      'cache-control': 'no-store',
    },
  })
}
