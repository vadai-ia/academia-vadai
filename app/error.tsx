'use client'

import { useEffect } from 'react'

/**
 * Lo que ve una persona cuando algo revienta en su navegador.
 *
 * Antes era la barra azul de Next en inglés: "Application error: a
 * client-side exception has occurred". Para una alumna que intenta crear su
 * contraseña el día del lanzamiento eso es una pared. Aquí se le dice en
 * español qué hacer —recargar, o volver al inicio— y, de paso, el error se
 * reporta al servidor (app/api/errores) con el navegador, que es lo que hace
 * falta para arreglarlo.
 *
 * Sin dependencias de nada nuestro: si el error vino de un componente de
 * marca, este no puede caer con él. Estilos en línea por lo mismo.
 */
export default function PaginaDeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    try {
      void fetch('/api/errores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: error.message,
          pila: error.stack,
          digest: error.digest,
          ruta: window.location.pathname + window.location.search,
        }),
        keepalive: true,
      })
    } catch {
      // Reportar no puede volver a fallar la página.
    }
  }, [error])

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#0A1A2F',
        background: '#F5F8FB',
      }}
    >
      <div style={{ maxWidth: '28rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Algo falló al cargar la página</h1>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#3d4f63' }}>
          No es algo que hayas hecho mal. Casi siempre se resuelve recargando; si vuelve a pasar,
          intenta con otro navegador (Chrome o Edge actualizados) y escríbenos a{' '}
          <a href="mailto:hola@vadai.com.mx" style={{ color: '#006E96' }}>
            hola@vadai.com.mx
          </a>{' '}
          con la hora en que pasó. Ya nos llegó el aviso del error.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '0.7rem 1.2rem',
              borderRadius: 10,
              border: 0,
              background: '#00A0DB',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Volver a intentar
          </button>
          {/* <a> a propósito y no <Link>: si lo que reventó fue el router, un
              enlace de HTML sigue funcionando. Es una recarga completa. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              padding: '0.7rem 1.2rem',
              borderRadius: 10,
              border: '1px solid #c9d3de',
              color: '#0A1A2F',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Ir al inicio
          </a>
        </div>
        {error.digest ? (
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#93A3B5' }}>Referencia: {error.digest}</p>
        ) : null}
      </div>
    </main>
  )
}
