import { LogoVaip } from '@/components/marca/logo-vaip'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import type { EstadoSuscripcion } from '@/lib/membresia/acceso'
import type { MiMembresia } from '@/lib/membresia/consultas'
import { cn } from '@/lib/utils'

/**
 * «Tu membresía V-AI-P»: el estado, las fechas y el botón para administrarla.
 * Va en /perfil y en /vaip. Cancelar, cambiar la tarjeta y ver los cobros
 * pasan en el portal de Stripe: la app nunca escribe en Stripe (M17).
 */

const ETIQUETAS: Record<EstadoSuscripcion, string> = {
  active: 'Activa',
  trialing: 'Activa',
  past_due: 'Pago pendiente',
  unpaid: 'Sin pago',
  canceled: 'Cancelada',
  incomplete: 'Pago sin terminar',
  incomplete_expired: 'Pago sin terminar',
  paused: 'En pausa',
}

/** Fechas siempre en hora de la Ciudad de México (CLAUDE.md). */
export function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

export function TuMembresia({
  membresia,
  portal,
  enlaceDeSuscripcion,
}: {
  membresia: MiMembresia
  /** El portal de Stripe con el correo ya puesto, o null si aún no se configura. */
  portal: string | null
  /** Para volver a suscribirse cuando ya no está vigente. */
  enlaceDeSuscripcion: string | null
}) {
  const atrasada = membresia.estado === 'past_due' || membresia.estado === 'unpaid'

  return (
    <Tarjeta className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LogoVaip className="h-9" />
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
            membresia.vigente && !atrasada && 'bg-accent text-accent-foreground',
            atrasada && 'bg-destructive/10 text-destructive',
            !membresia.vigente && !atrasada && 'bg-muted text-muted-foreground'
          )}
        >
          {membresia.vigente && membresia.estado === 'canceled' ? 'Cancelada · sigues dentro' : ETIQUETAS[membresia.estado]}
        </span>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        {membresia.proximoCobro ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Próximo cobro</dt>
            <dd className="font-medium">{fechaLarga(membresia.proximoCobro)}</dd>
          </div>
        ) : null}
        {membresia.accesoHasta ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{membresia.vigente ? 'Tienes acceso hasta' : 'Tu acceso terminó el'}</dt>
            <dd className="font-medium">{fechaLarga(membresia.accesoHasta)}</dd>
          </div>
        ) : null}
      </dl>

      {membresia.seCancela && membresia.vigente ? (
        <p className="text-sm text-pretty text-muted-foreground">
          Cancelaste la renovación: no se te vuelve a cobrar y sigues dentro hasta esa fecha.
        </p>
      ) : null}
      {atrasada ? (
        <p className="text-sm text-pretty text-muted-foreground">
          El último cobro no pasó. Actualiza tu tarjeta en Administrar suscripción para no perder el acceso.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!membresia.vigente && enlaceDeSuscripcion ? (
          <Button asChild variant="acento">
            <a href={enlaceDeSuscripcion}>Volver a suscribirme</a>
          </Button>
        ) : null}
        {portal ? (
          <Button asChild variant="outline">
            <a href={portal}>Administrar suscripción</a>
          </Button>
        ) : null}
      </div>
      {portal ? (
        <p className="text-xs text-muted-foreground">
          Ahí cancelas, cambias tu tarjeta y ves tus cobros. Te pide un código que llega a tu correo.
        </p>
      ) : null}
    </Tarjeta>
  )
}
