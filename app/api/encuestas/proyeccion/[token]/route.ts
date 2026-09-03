import { NextResponse } from 'next/server'

import { esEquipo, obtenerSesion } from '@/lib/auth/sesion'
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
  // Exige admin, igual que la página que lo consume. Vive bajo el prefijo
  // público `/api/encuestas/` —que existe para que el celular de la sala pueda
  // sondear sin sesión—, así que el middleware no corta aquí y la comprobación
  // tiene que estar en el handler.
  //
  // No es paranoia: este endpoint devuelve el muro con los NOMBRES de quienes
  // contestaron. Dejarlo abierto al token haría inútil haber cerrado la página.
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') {
    return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 })
  }
  if (!esEquipo(sesion.perfil)) {
    return NextResponse.json({ error: 'Proyección no encontrada.' }, { status: 404 })
  }

  const { token } = await params
  const encuesta = await encuestaPorToken(token)

  if (!encuesta) {
    return NextResponse.json({ error: 'Proyección no encontrada.' }, { status: 404 })
  }

  return NextResponse.json(await payloadDeProyeccion(encuesta), {
    headers: { 'cache-control': 'no-store' },
  })
}
