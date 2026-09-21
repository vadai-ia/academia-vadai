import { NextResponse, type NextRequest } from 'next/server'

import { crearClienteServiceRole } from '@/lib/supabase/service-role'

/**
 * Recibe los errores del navegador y los deja donde se puedan leer.
 *
 * El 21-sep-2026, día del lanzamiento, una alumna mandó una foto de la barra
 * azul de Next: "a client-side exception has occurred". Eso no llega a ningún
 * log —pasa en su navegador— y sin el mensaje ni el navegador no hay forma de
 * saber qué falló. La pantalla de error (app/error.tsx) manda aquí el mensaje,
 * la ruta y el user agent.
 *
 * Va al log de Vercel (`errorDelNavegador`) Y a `academia.client_errors`: el
 * log no se puede leer desde el repo sin el CLI, y la tabla sí. Service role
 * porque el error puede ocurrir antes de entrar y no hay sesión que valga.
 *
 * Se acota el tamaño; no se guarda quién es. Es un log, no un expediente.
 */
export async function POST(request: NextRequest) {
  let cuerpo: unknown = null
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const c = (typeof cuerpo === 'object' && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>
  const corta = (v: unknown, tope: number) => (typeof v === 'string' ? v.slice(0, tope) : null)

  const fila = {
    mensaje: corta(c.mensaje, 500),
    pila: corta(c.pila, 3000),
    ruta: corta(c.ruta, 300),
    digest: corta(c.digest, 100),
    navegador: corta(request.headers.get('user-agent'), 300),
  }

  console.error(JSON.stringify({ operacion: 'errorDelNavegador', ...fila, cuando: new Date().toISOString() }))

  try {
    const { error } = await crearClienteServiceRole().from('client_errors').insert(fila)
    if (error) console.error(JSON.stringify({ operacion: 'errorDelNavegador:guardar', error: error.message }))
  } catch (e) {
    console.error(JSON.stringify({ operacion: 'errorDelNavegador:guardar', error: e instanceof Error ? e.message : 'desconocido' }))
  }

  return NextResponse.json({ ok: true })
}
