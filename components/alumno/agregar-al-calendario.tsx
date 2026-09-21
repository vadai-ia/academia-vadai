import { enlaceGoogle, enlaceOutlook, type DatosDeSesion } from '@/lib/calendario/enlaces'

/**
 * "Agregar a mi calendario": Google, Outlook y .ics.
 *
 * Tres ligas chicas debajo de la sesión, no un botón grande: la acción grande
 * es entrar a la sesión. Google y Outlook abren su formulario prellenado en
 * otra pestaña; el .ics lo descarga /api/calendario/[id] y lo abre Apple
 * Calendar o el que tenga la persona. Sin JavaScript, las tres funcionan.
 */
export function AgregarAlCalendario({ sesion, compacto = false }: { sesion: DatosDeSesion; compacto?: boolean }) {
  const clase =
    'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground ' +
    'underline-offset-4 transition-colors hover:text-primary hover:underline ' +
    'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

  return (
    <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
      {!compacto ? <IconoCalendario /> : null}
      <span>Agregar a</span>
      <a href={enlaceGoogle(sesion)} target="_blank" rel="noopener noreferrer" className={clase}>
        Google Calendar
      </a>
      <span aria-hidden>·</span>
      <a href={enlaceOutlook(sesion)} target="_blank" rel="noopener noreferrer" className={clase}>
        Outlook
      </a>
      <span aria-hidden>·</span>
      <a href={`/api/calendario/${sesion.id}`} className={clase} title="Apple Calendar y otros">
        .ics
      </a>
    </span>
  )
}

function IconoCalendario() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
