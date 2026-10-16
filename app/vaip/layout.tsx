import Link from 'next/link'
import type { ReactNode } from 'react'

import { MarcoAlumno } from '@/components/alumno/marco-alumno'
import { CambiarTema } from '@/components/marca/cambiar-tema'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import { Wordmark } from '@/components/marca/wordmark'
import { obtenerSesion } from '@/lib/auth/sesion'

/**
 * Marco de /vaip (M17).
 *
 * La página es pública porque es el destino del QR impreso. Quien llega con
 * sesión la ve dentro de su plataforma, con el encabezado de siempre; quien no,
 * con un encabezado mínimo de marca y un «Entrar» para el que ya tiene cuenta.
 */
export default async function LayoutVaip({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion()
  if (sesion.tipo === 'activo') {
    return <MarcoAlumno perfil={sesion.perfil}>{children}</MarcoAlumno>
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SaltarAlContenido />
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/vaip" className="flex items-center rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Wordmark alto={22} prioridad />
          </Link>
          <div className="flex items-center gap-2">
            <CambiarTema />
            <Link
              href="/login?destino=%2Fvaip"
              className="inline-flex h-8 items-center rounded-full border border-border px-3.5 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-12">
        {children}
      </main>
    </div>
  )
}
