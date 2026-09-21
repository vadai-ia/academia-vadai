import { NextResponse } from 'next/server'

import { estadoEfectivo } from '@/lib/dinamicas/comun'
import { crearClienteServidor } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Lo que sondea el tablero del alumno cada tres segundos.
 *
 * Devuelve lo mínimo para saber si algo cambió: la versión del tablero —que
 * el trigger mueve con cada columna, celda o fila— y el estado efectivo de la
 * dinámica, para que "Cerrada" llegue a todos en cuanto pasa la fecha límite
 * aunque nadie haya escrito nada.
 *
 * Va con el cliente del usuario, o sea por RLS: quien no es miembro del
 * tablero recibe 404, y sin sesión el middleware ya contestó 401 (este prefijo
 * NO está en PREFIJOS_PUBLICOS, a diferencia de /api/encuestas/). Con `ETag`
 * la respuesta habitual es un 304 sin cuerpo.
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params
  const supabase = await crearClienteServidor()

  const { data } = await supabase
    .from('dynamic_boards')
    .select('version, dynamics(status, closes_at)')
    .eq('id', boardId)
    .maybeSingle()

  type Fila = {
    version: number
    dynamics: { status: string; closes_at: string | null } | null
  }
  const fila = data as unknown as Fila | null

  if (!fila) {
    return NextResponse.json({ error: 'Ese tablero no existe.' }, { status: 404 })
  }

  const estado = fila.dynamics ? estadoEfectivo(fila.dynamics) : 'closed'
  const etiqueta = `"${fila.version}-${estado}"`

  if (peticion.headers.get('if-none-match') === etiqueta) {
    return new Response(null, { status: 304, headers: { etag: etiqueta } })
  }

  return NextResponse.json(
    { v: Number(fila.version), estado },
    {
      headers: {
        etag: etiqueta,
        // Sin esto, un proxy intermedio podría servir una versión vieja y
        // dejar a media empresa mirando un tablero que ya cambió.
        'cache-control': 'no-store',
      },
    }
  )
}
