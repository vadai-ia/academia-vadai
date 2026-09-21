'use client'

import Link from 'next/link'
import { startTransition } from 'react'

import { marcarNotificacionesVistas } from '@/lib/notificaciones/acciones'
import type { Notificacion } from '@/lib/notificaciones/consultas'

/**
 * La campana de novedades del encabezado.
 *
 * Mismo mecanismo que el menú de cuenta: un `popover` nativo abierto con
 * `popovertarget`, que se cierra con Esc, con un clic fuera y devuelve el
 * foco. Sin JavaScript se abre igual, y el botón de "Marcar como vistas" es
 * un <form> con la acción directa, así que también funciona.
 *
 * Con JavaScript, abrir la campana ya cuenta como verla: el evento `toggle`
 * del popover llama a la misma acción, y el número rojo desaparece en la
 * siguiente navegación. Sin JavaScript queda el botón.
 *
 * El aviso es el número sobre la campana, en lima, y la campana se sacude una
 * vez al cargar cuando hay algo nuevo (`.vadai-campana`, en globals.css; se
 * apaga con reduced-motion). Nada de toasts que se cierran solos: quien entra
 * a ver su lección no quiere leer un letrero con prisa.
 */

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso))
}

export function Campana({ lista, nuevas }: { lista: Notificacion[]; nuevas: number }) {
  const id = 'campana-de-novedades'

  return (
    <div className="group/campana">
      <button
        type="button"
        popoverTarget={id}
        aria-label={nuevas > 0 ? `Novedades: ${nuevas} sin ver` : 'Novedades'}
        data-nuevas={nuevas}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <IconoCampana className={nuevas > 0 ? 'vadai-campana' : undefined} />
        {nuevas > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] animate-in items-center justify-center rounded-full bg-vadai-lima px-1 text-[11px] font-semibold text-vadai-navy tabular-nums zoom-in duration-300"
          >
            {nuevas > 9 ? '9+' : nuevas}
          </span>
        ) : null}
      </button>

      {/* Sin clase de `display`: pisaría el `display: none` del popover cerrado. */}
      <div
        id={id}
        popover="auto"
        onToggle={(e) => {
          if (e.newState === 'open' && nuevas > 0) {
            startTransition(() => {
              void marcarNotificacionesVistas()
            })
          }
        }}
        className="inset-auto top-[3.75rem] right-[max(1.25rem,calc((100%-72rem)/2+1.25rem))] m-0 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-[12px] border border-border bg-card p-0 text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium">Novedades</span>
          {nuevas > 0 ? (
            <span className="text-xs text-muted-foreground">
              {nuevas} sin ver
            </span>
          ) : null}
        </div>

        {lista.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Aquí verás los anuncios y las entradas nuevas del blog.
          </p>
        ) : (
          <ul className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto">
            {lista.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className={
                      'mt-1.5 size-2 shrink-0 rounded-full ' +
                      (n.nueva ? 'bg-vadai-lima ring-4 ring-vadai-lima/25' : 'bg-transparent')
                    }
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs tracking-wider text-muted-foreground uppercase">
                      {n.tipo === 'blog' ? 'Blog' : 'Anuncio'} · {fechaCorta(n.publicadoEn)}
                      {n.nueva ? <span className="ml-1.5 font-semibold text-foreground normal-case">Nuevo</span> : null}
                    </span>
                    <span className="text-sm leading-snug font-medium text-pretty">{n.titulo}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {nuevas > 0 ? (
          <form action={marcarNotificacionesVistas} className="border-t border-border px-2 py-2">
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Marcar como vistas
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}

function IconoCampana({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={'size-5 ' + (className ?? '')}
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}
