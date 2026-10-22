'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import type { ReactNode } from 'react'

import type { Destino } from '@/components/marca/navegacion'
import { cn } from '@/lib/utils'

/**
 * La barra lateral del panel (M19, 16-oct-2026).
 *
 * Alejandro pidió reordenar el panel en una barra lateral con secciones
 * agrupadas: con doce destinos, la fila de pastillas del encabezado ya
 * envolvía a dos renglones y no decía qué iba con qué. El portal de alumnos
 * sigue con su encabezado de dos filas (CLAUDE.md · Branding); esto es solo
 * del panel.
 *
 *   - Escritorio (lg+): columna fija a la izquierda, pegada bajo el
 *     encabezado, con scroll propio si no cabe.
 *   - Teléfono y tableta (22-oct-2026, antes un <details> «Menú» arriba):
 *     barra abajo como app —Panel, Muro, Grupos, Alumnos y «Menú»— y «Menú»
 *     sube una hoja con todo el panel. Popover nativo: sin JavaScript abre y
 *     cierra igual (CLAUDE.md).
 *
 * Solo navegación: ninguna ruta, acción ni guarda cambió. Qué destinos ve
 * cada rol lo decide el layout, igual que antes.
 */

/** Lo que el equipo abre a diario: va en la barra de abajo del teléfono. */
const RAPIDOS = ['/admin', '/admin/vaip/muro', '/admin/grupos', '/admin/alumnos']
const ID_HOJA = 'menu-del-panel'

function IconoMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

/**
 * Un lugar de la barra de abajo: icono en su pastilla, nombre debajo y el
 * número de lo que espera arriba a la derecha. Sin `href` es el botón «Menú».
 */
function BotonDeBarra({
  href,
  activo,
  icono,
  etiqueta,
  insignia,
}: {
  href?: string
  activo: boolean
  icono: ReactNode
  etiqueta: string
  insignia?: ReactNode
}) {
  const contenido = (
    <>
      <span
        className={cn(
          'relative inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors [&_svg]:size-[1.375rem]',
          'group-focus-visible:ring-3 group-focus-visible:ring-ring/50',
          activo ? 'bg-primary/12' : 'group-active:bg-muted'
        )}
      >
        {icono}
        {insignia ? <span className="absolute -top-1.5 -right-0.5 scale-90">{insignia}</span> : null}
      </span>
      <span className="max-w-full truncate px-1">{etiqueta}</span>
    </>
  )
  const clases = cn(
    'group flex min-w-0 flex-col items-center justify-center gap-1 text-[0.6875rem] leading-none font-medium transition-colors focus-visible:outline-none',
    activo ? 'text-primary' : 'text-muted-foreground'
  )
  if (href) {
    return (
      <Link href={href} aria-current={activo ? 'page' : undefined} className={clases}>
        {contenido}
      </Link>
    )
  }
  return (
    <button type="button" popoverTarget={ID_HOJA} className={cn(clases, 'cursor-pointer')}>
      {contenido}
    </button>
  )
}

export type GrupoDeNavegacion = { titulo?: string; destinos: Destino[] }

/** Qué tan bien coincide la ruta con un destino: el largo del prefijo, o -1. */
function coincidencia(ruta: string, d: Destino): number {
  if (d.exacto) return ruta === d.href ? d.href.length : -1
  if (ruta === d.href || ruta.startsWith(`${d.href}/`)) return d.href.length
  // `tambien`: otras rutas que son de este destino (M25).
  const otras = (d.tambien ?? []).filter((prefijo) => ruta.startsWith(prefijo)).map((prefijo) => prefijo.length)
  return otras.length > 0 ? Math.max(...otras) : -1
}

/**
 * El destino activo es el MÁS específico que coincide (M24): en
 * /admin/vaip/noticias se enciende «Noticias», no también «Resumen».
 */
function destinoActual(ruta: string, destinos: Destino[]): Destino | undefined {
  return destinos
    .map((d) => ({ d, largo: coincidencia(ruta, d) }))
    .filter((x) => x.largo >= 0)
    .sort((a, b) => b.largo - a.largo)[0]?.d
}

function Enlace({ d, actual, tactil = false }: { d: Destino; actual: Destino | undefined; tactil?: boolean }) {
  const es = actual?.href === d.href
  return (
    <Link
      href={d.href}
      aria-current={es ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        // En tableta horizontal se ve la barra de escritorio y también se toca.
        tactil ? 'min-h-11' : 'min-h-9 pointer-coarse:min-h-11',
        es ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <span className="shrink-0">{d.icono}</span>
      <span className="min-w-0 flex-1 truncate">{d.etiqueta}</span>
      {d.insignia ? <span className="shrink-0">{d.insignia}</span> : null}
    </Link>
  )
}

function Grupos({ grupos, pie, ruta, tactil = false }: { grupos: GrupoDeNavegacion[]; pie?: Destino; ruta: string; tactil?: boolean }) {
  const actual = destinoActual(ruta, [...grupos.flatMap((g) => g.destinos), ...(pie ? [pie] : [])])
  return (
    <>
      {grupos.map((g, i) => (
        <div key={g.titulo ?? `grupo-${i}`} className="flex flex-col gap-0.5">
          {g.titulo ? (
            <p className="px-3 pb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground/80 uppercase">
              {g.titulo}
            </p>
          ) : null}
          {g.destinos.map((d) => (
            <Enlace key={d.href} d={d} actual={actual} tactil={tactil} />
          ))}
        </div>
      ))}
      {pie ? (
        <div className="border-t border-border pt-3">
          <Enlace d={pie} actual={actual} tactil={tactil} />
        </div>
      ) : null}
    </>
  )
}

export function BarraLateral({
  grupos,
  pie,
  total,
}: {
  grupos: GrupoDeNavegacion[]
  pie?: Destino
  /** M26: la suma de los números, en el resumen «Menú» del teléfono. */
  total?: ReactNode
}) {
  const ruta = usePathname()
  const todos = grupos.flatMap((g) => g.destinos)
  const actual = destinoActual(ruta, todos)
  const rapidos = RAPIDOS.flatMap((href) => todos.filter((d) => d.href === href))
  const enRapidos = Boolean(actual && rapidos.includes(actual))

  // Un <Link> cambia de página sin recargar: la hoja seguiría abierta encima.
  useEffect(() => {
    const hoja = document.getElementById(ID_HOJA) as (HTMLElement & { hidePopover?: () => void }) | null
    try {
      hoja?.hidePopover?.()
    } catch {
      // Ya estaba cerrada.
    }
  }, [ruta])

  return (
    <>
      {/* Teléfono y tableta (22-oct-2026): como app. Abajo, lo que el equipo
          abre a diario con su número; «Menú» sube una hoja con todo el panel.
          Es un popover nativo: abre, cierra con Esc o tocando fuera, y sin
          JavaScript funciona igual. */}
      <div
        id={ID_HOJA}
        popover="auto"
        className="inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-[18px] border-t border-border bg-background p-0 text-foreground shadow-[0_-8px_32px_rgba(0,0,0,0.18)] lg:hidden"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-3 backdrop-blur-md">
          <span className="text-[0.95rem] font-medium">Panel de VADAI</span>
          <button
            type="button"
            popoverTarget={ID_HOJA}
            popoverTargetAction="hide"
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-primary hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Cerrar
          </button>
        </div>
        <nav aria-label="Secciones del panel" className="flex flex-col gap-4 px-3 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Grupos grupos={grupos} pie={pie} ruta={ruta} tactil />
        </nav>
      </div>

      <nav
        aria-label="Accesos del panel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {rapidos.map((d) => (
            <BotonDeBarra key={d.href} activo={actual?.href === d.href} icono={d.icono} etiqueta={d.etiqueta} insignia={d.insignia} href={d.href} />
          ))}
          <BotonDeBarra
            activo={!enRapidos}
            icono={<IconoMenu />}
            etiqueta={enRapidos || !actual ? 'Menú' : actual.etiqueta}
            insignia={total}
          />
        </div>
      </nav>

      {/* Escritorio */}
      <aside className="hidden w-60 shrink-0 border-r border-border lg:block">
        <nav
          aria-label="Secciones del panel"
          className="sticky top-14 flex max-h-[calc(100dvh-3.5rem)] flex-col gap-5 overflow-y-auto py-6 pr-3 pl-5"
        >
          <Grupos grupos={grupos} pie={pie} ruta={ruta} />
        </nav>
      </aside>
    </>
  )
}
