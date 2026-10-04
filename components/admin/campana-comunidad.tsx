import Link from 'next/link'

import { HORAS_DE_ESPERA, pendientesDeComunidad } from '@/lib/admin/comunidad'

/**
 * La campana del panel: lo que en la comunidad lleva más de doce horas sin
 * respuesta del equipo (3-oct-2026).
 *
 * El número solo cuenta lo VENCIDO, no todo lo pendiente: una pregunta de
 * hace diez minutos no es una alarma, y una campana que siempre tiene número
 * deja de mirarse. Dentro se ven los cinco que más llevan esperando, y la
 * liga a la bandeja.
 *
 * Es un `popover` nativo (como la campana del alumno y el menú de cuenta): abre
 * y cierra sin JavaScript. Nada se "marca como visto": el aviso se apaga
 * cuando alguien contesta, que es lo único que de verdad lo resuelve.
 *
 * Es asíncrona y va dentro de un <Suspense> en el layout: leer la comunidad no
 * debe frenar el resto del panel.
 */

const ZONA = 'America/Mexico_City'

function hace(iso: string, ahora: number): string {
  const horas = Math.floor((ahora - Date.parse(iso)) / 3_600_000)
  if (horas < 1) return 'hace menos de 1 h'
  if (horas < 48) return `hace ${horas} h`
  return `hace ${Math.floor(horas / 24)} días`
}

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: ZONA }).format(new Date(iso))
}

export async function CampanaDeComunidad() {
  const { sinRespuesta, vencidas, primeros } = await pendientesDeComunidad()
  const ahora = Date.now()
  const id = 'campana-de-comunidad'

  const etiqueta =
    sinRespuesta === 0
      ? 'Comunidad: nada espera respuesta'
      : `Comunidad: ${sinRespuesta} sin respuesta${vencidas > 0 ? `, ${vencidas} con más de ${HORAS_DE_ESPERA} horas` : ''}`

  return (
    <div>
      <button
        type="button"
        popoverTarget={id}
        aria-label={etiqueta}
        data-vencidas={vencidas}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={'size-5 ' + (vencidas > 0 ? 'vadai-campana' : '')}
          aria-hidden
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {vencidas > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white tabular-nums"
          >
            {vencidas > 9 ? '9+' : vencidas}
          </span>
        ) : sinRespuesta > 0 ? (
          <span aria-hidden className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background" />
        ) : null}
      </button>

      {/* Sin clase de `display`: pisaría el `display: none` del popover cerrado. */}
      <div
        id={id}
        popover="auto"
        className="inset-auto top-[3.75rem] right-[max(1.25rem,calc((100%-72rem)/2+1.25rem))] m-0 w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-[12px] border border-border bg-card p-0 text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-sm font-medium">Comunidad</span>
          <span className="text-xs text-muted-foreground">
            {sinRespuesta === 0 ? 'Al día' : `${sinRespuesta} sin respuesta`}
          </span>
        </div>

        {primeros.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nada espera respuesta. Aquí aparece lo que lleve más de {HORAS_DE_ESPERA} horas sin que el equipo conteste.
          </p>
        ) : (
          <ul className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto">
            {primeros.map((h) => {
              const espera = h.esperaDesde ?? h.creadoEn
              const vencida = ahora - Date.parse(espera) > HORAS_DE_ESPERA * 3_600_000
              return (
                <li key={h.id}>
                  <Link
                    href={`/admin/comunidad#hilo-${h.id}`}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className={'mt-1.5 size-2 shrink-0 rounded-full ' + (vencida ? 'bg-destructive' : 'bg-primary')}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-xs text-muted-foreground">
                        {h.curso.titulo}
                        {h.generacion ? ` · ${h.generacion.nombre}` : ''}
                      </span>
                      <span className="line-clamp-2 text-sm leading-snug font-medium text-pretty">
                        {h.titulo ?? h.texto}
                      </span>
                      <span className={'text-xs ' + (vencida ? 'text-destructive' : 'text-muted-foreground')}>
                        {h.autor.nombre} · {fechaCorta(espera)} · {hace(espera, ahora)}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <Link
          href="/admin/comunidad"
          className="block border-t border-border px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted/60"
        >
          Abrir la bandeja →
        </Link>
      </div>
    </div>
  )
}
