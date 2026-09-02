import { NextResponse } from 'next/server'

import { encuestaPorToken, payloadDeProyeccion } from '@/lib/encuestas/publico'

export const dynamic = 'force-dynamic'

/**
 * Lo que sondea la PANTALLA proyectada.
 *
 * Aquí sí van los agregados completos, y aquí sí se puede: son una o dos
 * pantallas en toda la sala, no cien teléfonos. Por eso el reparto de carga de
 * esta feature no es "todos piden todo cada segundo" sino:
 *
 *   proyección (1–2)   estado + agregados      cada 1 s
 *   celular (N)        solo qué está abierto   cada 3 s
 *
 * El token es la llave: largo, aleatorio, y no se dicta ni se imprime. Quien lo
 * tiene, proyecta. Sin sesión, igual que `/certificado/[folio]`.
 *
 * El cuerpo lo arma `payloadDeProyeccion()`, la misma función que usa el primer
 * pintado de la página, para que el render inicial y el primer sondeo no puedan
 * diferir.
 */
export async function GET(_peticion: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const encuesta = await encuestaPorToken(token)

  if (!encuesta) {
    return NextResponse.json({ error: 'Proyección no encontrada.' }, { status: 404 })
  }

  return NextResponse.json(await payloadDeProyeccion(encuesta), {
    headers: { 'cache-control': 'no-store' },
  })
}
