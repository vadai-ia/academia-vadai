import Link from 'next/link'

import { BotonSalir } from '@/components/auth/boton-salir'
import { CambiarTema } from '@/components/marca/cambiar-tema'
import { EtiquetaAcademia, Wordmark } from '@/components/marca/wordmark'
import { nombreVisible, type Perfil } from '@/lib/auth/sesion'

export function Encabezado({
  perfil,
  navegacion = [],
}: {
  perfil: Perfil
  navegacion?: Array<{ href: string; etiqueta: string }>
}) {
  const equipo = perfil.role === 'admin' || perfil.role === 'superadmin'

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <span className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Wordmark alto={20} prioridad />
            <EtiquetaAcademia className="hidden text-[0.6rem] tracking-[0.28em] sm:inline" />
          </Link>
          {navegacion.length > 0 ? (
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {navegacion.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {n.etiqueta}
                </Link>
              ))}
            </nav>
          ) : null}
        </span>

        <div className="flex min-w-0 items-center gap-3">
          <span className="flex min-w-0 items-center text-sm text-muted-foreground">
            {/* Un nombre largo no puede empujar el botón de salir fuera de pantalla. */}
            <span className="truncate">{nombreVisible(perfil)}</span>
            {equipo ? (
              <span className="ml-2 hidden shrink-0 rounded-full border border-exito/40 bg-exito/10 px-2 py-0.5 text-[11px] text-exito sm:inline">
                Equipo VADAI
              </span>
            ) : null}
          </span>
          <CambiarTema />
          <BotonSalir />
        </div>
      </div>
    </header>
  )
}
