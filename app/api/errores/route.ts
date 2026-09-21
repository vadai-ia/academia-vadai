import { NextResponse, type NextRequest } from 'next/server'

/**
 * Recibe los errores del navegador y los deja en el log del servidor.
 *
 * El 21-sep-2026, día del lanzamiento, una alumna mandó una foto de la barra
 * azul de Next: "a client-side exception has occurred". Eso no llega a ningún
 * log —pasa en su navegador— y sin el mensaje ni el navegador no hay forma de
 * saber qué falló. La pantalla de error (app/error.tsx) manda aquí el mensaje,
 * la ruta y el user agent; en los logs de Vercel se buscan como
 * `errorDelNavegador`.
 *
 * Sin sesión a propósito: el error puede ocurrir antes de entrar. Se acota el
 * tamaño y no se guarda nada en la base: es un log, no una tabla.
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

  console.error(
    JSON.stringify({
      operacion: 'errorDelNavegador',
      mensaje: corta(c.mensaje, 500),
      pila: corta(c.pila, 1500),
      ruta: corta(c.ruta, 300),
      digest: corta(c.digest, 100),
      navegador: corta(request.headers.get('user-agent'), 300),
      cuando: new Date().toISOString(),
    })
  )

  return NextResponse.json({ ok: true })
}
