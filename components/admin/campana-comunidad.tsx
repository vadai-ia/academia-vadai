import Link from 'next/link'

import { HORAS_DE_ESPERA, hrefEnPanel, pendientesDeComunidad, type PendientesDeUnMundo } from '@/lib/admin/comunidad'
import { borradoresPendientes } from '@/lib/agente/panel'

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
 *
 * Dos secciones desde M25 (20-oct-2026): el muro de V-AI-P y los grupos de los
 * cursos, cada una con su cuenta y su lugar. El número rojo es la suma.
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
  const [{ sinRespuesta, vencidas, vaip, grupos }, borradores] = await Promise.all([
    pendientesDeComunidad(),
    // M21: lo que el agente dejó para una persona. No suma al número rojo
    // (esos hilos ya cuentan como sin respuesta); se ve como un renglón aparte.
    borradoresPendientes().catch(() => 0),
  ])
  const ahora = Date.now()
  const id = 'campana-de-comunidad'

  const etiqueta =
    sinRespuesta === 0
      ? 'Conversaciones: nada espera respuesta'
      : `Conversaciones sin respuesta: ${vaip.sinRespuesta} en el muro de V-AI-P y ${grupos.sinRespuesta} en los grupos${vencidas > 0 ? `; ${vencidas} con más de ${HORAS_DE_ESPERA} horas` : ''}`

  return (
    <div>
      <button
        type="button"
        popoverTarget={id}
        aria-label={etiqueta}
        data-vencidas={vencidas}
        data-vaip={vaip.sinRespuesta}
        data-grupos={grupos.sinRespuesta}
        data-slot="icono-boton"
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
        ) : sinRespuesta > 0 || borradores > 0 ? (
          <span aria-hidden className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background" />
        ) : null}
      </button>

      {/* Sin clase de `display`: pisaría el `display: none` del popover cerrado. */}
      <div
        id={id}
        popover="auto"
        className="inset-auto top-[3.75rem] right-[max(1.25rem,calc((100%-72rem)/2+1.25rem))] m-0 w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-[12px] border border-border bg-card p-0 text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]"
      >
        <Seccion
          titulo="Muro de V-AI-P"
          href="/admin/vaip/muro"
          pendientes={vaip}
          ahora={ahora}
          vacio="El muro de V-AI-P está al día."
        />
        <Seccion
          titulo="Grupos"
          href="/admin/grupos"
          pendientes={grupos}
          ahora={ahora}
          vacio="Los grupos de los cursos están al día."
        />

        {borradores > 0 ? (
          <Link
            href="/admin/agente"
            className="block border-t border-border px-4 py-2.5 text-sm transition-colors hover:bg-muted/60"
          >
            El agente dejó {borradores === 1 ? 'un borrador' : `${borradores} borradores`} por revisar →
          </Link>
        ) : null}
      </div>
    </div>
  )
}

/** Una sección de la campana: su cuenta, los tres que más esperan y su lugar. */
function Seccion({
  titulo,
  href,
  pendientes,
  ahora,
  vacio,
}: {
  titulo: string
  href: string
  pendientes: PendientesDeUnMundo
  ahora: number
  vacio: string
}) {
  return (
    <section className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
        <span className="text-sm font-medium">{titulo}</span>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          {pendientes.sinRespuesta === 0 ? 'Abrir →' : `${pendientes.sinRespuesta} sin respuesta →`}
        </Link>
      </div>
      {pendientes.primeros.length === 0 ? (
        <p className="px-4 pt-1 pb-3 text-sm text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="flex flex-col pb-1">
          {pendientes.primeros.slice(0, 3).map((h) => {
            const espera = h.esperaDesde ?? h.creadoEn
            const vencida = ahora - Date.parse(espera) > HORAS_DE_ESPERA * 3_600_000
            return (
              <li key={h.id}>
                <Link
                  href={hrefEnPanel(h)}
                  className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className={'mt-1.5 size-2 shrink-0 rounded-full ' + (vencida ? 'bg-destructive' : 'bg-primary')}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    {h.mundo === 'cursos' ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {h.curso.titulo}
                        {h.generacion ? ` · ${h.generacion.nombre}` : ''}
                      </span>
                    ) : null}
                    <span className="line-clamp-2 text-sm leading-snug font-medium text-pretty">{h.titulo ?? h.texto}</span>
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
    </section>
  )
}
