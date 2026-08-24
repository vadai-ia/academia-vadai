import Link from 'next/link'

import { BotonSalir } from '@/components/auth/boton-salir'
import { CambiarTema } from '@/components/marca/cambiar-tema'
import { NavegacionPrincipal, type Destino } from '@/components/marca/navegacion'
import { EtiquetaAcademia, Wordmark } from '@/components/marca/wordmark'
import { Avatar } from '@/components/ui-vadai/superficie'
import { nombreVisible, type Perfil } from '@/lib/auth/sesion'

/**
 * Encabezado de la plataforma.
 *
 * Pegajoso: en una lección larga, tener que subir hasta arriba para cambiar de
 * sección es de las cosas que hacen sentir pesada una plataforma.
 *
 * En móvil la navegación baja a su propio renglón en vez de apretarse contra la
 * marca. Cuatro pastillas no caben a 375 px junto al logo y el nombre.
 */
export function Encabezado({
  perfil,
  navegacion = [],
}: {
  perfil: Perfil
  navegacion?: Destino[]
}) {
  const equipo = perfil.role === 'admin' || perfil.role === 'superadmin'

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Wordmark alto={20} prioridad />
            <EtiquetaAcademia className="hidden text-[0.6rem] tracking-[0.28em] sm:inline" />
          </Link>

          {navegacion.length > 0 ? (
            <div className="hidden min-w-0 flex-1 md:flex">
              <NavegacionPrincipal destinos={navegacion} />
            </div>
          ) : null}

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden min-w-0 items-center gap-2 sm:flex">
              <Avatar nombre={nombreVisible(perfil)} tamano={28} />
              <span className="hidden max-w-36 truncate text-sm text-muted-foreground lg:inline">
                {nombreVisible(perfil)}
              </span>
              {equipo ? (
                <span className="shrink-0 rounded-full bg-vadai-lima px-2 py-0.5 text-[11px] font-medium text-vadai-navy">
                  Equipo
                </span>
              ) : null}
            </span>

            <CambiarTema />
            <BotonSalir />
          </div>
        </div>

        {navegacion.length > 0 ? (
          <div className="pb-2 md:hidden">
            <NavegacionPrincipal destinos={navegacion} />
          </div>
        ) : null}
      </div>
    </header>
  )
}
