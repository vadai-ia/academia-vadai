'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
 *   - Teléfono: un <details> «Menú» arriba del contenido, que dice en qué
 *     sección estás. Nativo: abre y cierra sin JavaScript (CLAUDE.md).
 *
 * Solo navegación: ninguna ruta, acción ni guarda cambió. Qué destinos ve
 * cada rol lo decide el layout, igual que antes.
 */

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
        tactil ? 'min-h-11' : 'min-h-9',
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
  const actual = destinoActual(ruta, grupos.flatMap((g) => g.destinos))
  // «Menú · V-AI-P · Muro» (M25): con dos mundos, el nombre solo no dice de cuál.
  const grupo = actual ? grupos.find((g) => g.destinos.includes(actual))?.titulo : undefined

  return (
    <>
      {/* Teléfono y tableta */}
      <div className="border-b border-border px-5 py-2 lg:hidden">
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2.5">
              {actual ? <span className="text-primary">{actual.icono}</span> : null}
              <span>
                <span className="text-muted-foreground">
                  Menú · {grupo && grupo !== actual?.etiqueta ? `${grupo} · ` : ''}
                </span>
                {actual?.etiqueta ?? 'Secciones'}
              </span>
            </span>
            <span className="ml-auto shrink-0">{total}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <nav aria-label="Secciones del panel" className="flex flex-col gap-4 pt-2 pb-3">
            <Grupos grupos={grupos} pie={pie} ruta={ruta} tactil />
          </nav>
        </details>
      </div>

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
