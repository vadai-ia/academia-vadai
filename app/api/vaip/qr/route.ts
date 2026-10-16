import { NextResponse, type NextRequest } from 'next/server'

import { esAdmin, obtenerSesion } from '@/lib/auth/sesion'
import { planVaip } from '@/lib/membresia/consultas'
import { svgDelQr } from '@/lib/membresia/qr'

export const dynamic = 'force-dynamic'

/**
 * Descarga del QR de V-AI-P en SVG (M17), solo para admin.
 *
 *   ?destino=pagina → a /vaip (recomendado: si cambia el link de Stripe, lo
 *                     impreso sigue sirviendo)
 *   ?destino=pago   → directo al Payment Link
 */
export async function GET(request: NextRequest) {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo' || !esAdmin(sesion.perfil)) {
    return NextResponse.json({ error: 'Solo admin.' }, { status: 403 })
  }

  const plan = await planVaip()
  if (!plan) return NextResponse.json({ error: 'Sin plan.' }, { status: 404 })

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).replace(/\/+$/, '')
  const destino = request.nextUrl.searchParams.get('destino') === 'pago' ? 'pago' : 'pagina'
  const texto = destino === 'pago' ? plan.linkDePago : `${base}/vaip`
  if (!texto) return NextResponse.json({ error: 'El plan todavía no tiene link de pago.' }, { status: 409 })

  const pie =
    destino === 'pago' ? `Suscríbete · $${plan.precioMxn} MXN al mes` : texto.replace(/^https?:\/\//, '')
  return new NextResponse(svgDelQr(texto, 'VADAI V-AI-P', pie), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'content-disposition': `attachment; filename="qr-vaip-${destino}.svg"`,
      'cache-control': 'no-store',
    },
  })
}
