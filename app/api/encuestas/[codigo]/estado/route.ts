import { NextResponse } from 'next/server'

import { encuestaPorCodigo } from '@/lib/encuestas/publico'

export const dynamic = 'force-dynamic'

/**
 * Lo que sondea el CELULAR del asistente.
 *
 * Devuelve lo mínimo para saber si algo cambió: la versión del estado, si la
 * encuesta sigue viva y cuál es la pregunta abierta. **No trae los agregados**,
 * y eso es la decisión que hace barata toda la arquitectura: la gente está
 * viendo los resultados en la pared, no en su teléfono. Mandarle a cada quien la
 * nube completa cada tres segundos sería multiplicar por cien el tráfico para
 * pintar algo que nadie mira.
 *
 * `state_version` solo se mueve cuando el admin abre o cierra una pregunta —las
 * respuestas no lo tocan (ver el trigger de la migración)—, así que cien
 * personas contestando no despiertan a las otras noventa y nueve.
 *
 * Con `ETag` la respuesta habitual es un 304 sin cuerpo.
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  const encuesta = await encuestaPorCodigo(codigo)

  if (!encuesta) {
    return NextResponse.json({ error: 'Ese código no existe.' }, { status: 404 })
  }

  const abierta = encuesta.preguntas.find((p) => p.status === 'open')
  const etiqueta = `"${encuesta.stateVersion}-${encuesta.status}-${abierta?.id ?? 'ninguna'}"`

  if (peticion.headers.get('if-none-match') === etiqueta) {
    return new Response(null, { status: 304, headers: { etag: etiqueta } })
  }

  return NextResponse.json(
    {
      v: encuesta.stateVersion,
      estado: encuesta.status,
      pregunta: abierta?.id ?? null,
    },
    {
      headers: {
        etag: etiqueta,
        // Sin esto, un proxy intermedio podría servir un estado viejo y dejar a
        // media sala mirando una pregunta que ya cerró.
        'cache-control': 'no-store',
      },
    }
  )
}
