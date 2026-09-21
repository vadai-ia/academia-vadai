'use client'

import { useEffect } from 'react'

/**
 * El último recurso: cuando revienta el layout raíz y ni `app/error.tsx`
 * alcanza a pintarse. Tiene que traer su propio <html> y <body>. Mismo
 * mensaje y mismo reporte que la pantalla de error normal.
 */
export default function ErrorGlobal({
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
    <html lang="es-MX">
      <body
        style={{
          margin: 0,
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
            Recarga la página. Si vuelve a pasar, intenta con otro navegador (Chrome o Edge
            actualizados) y escríbenos a hola@vadai.com.mx. Ya nos llegó el aviso del error.
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
        </div>
      </body>
    </html>
  )
}
