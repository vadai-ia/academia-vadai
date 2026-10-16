import Link from 'next/link'

import { LogoVaip } from '@/components/marca/logo-vaip'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import type { EstadoSuscripcion } from '@/lib/membresia/acceso'
import type { MiMembresia } from '@/lib/membresia/consultas'
import { cn } from '@/lib/utils'

/**
 * «Tu membresía»: el estado, las fechas y dónde administrarla. Va en /perfil
 * y en /vaip, una por plan (M18).
 *
 * La tarjeta y los cobros, en el portal de Stripe. Cancelar, en los pasos de
 * /perfil/membresia, con un enlace discreto: visible y fácil, pero no es el
 * botón principal (decidido por Alejandro, 16-oct-2026).
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
  plan,
  membresia,
  portal,
  enlaceDeSuscripcion,
}: {
  plan: { slug: string; nombre: string }
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
        {plan.slug === 'v-ai-p' ? <LogoVaip className="h-9" /> : <span className="font-medium">{plan.nombre}</span>}
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
          El último cobro no pasó. Actualiza tu tarjeta en «Tarjeta y cobros» para no perder el acceso.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!membresia.vigente && enlaceDeSuscripcion ? (
          <Button asChild variant="acento">
            <a href={enlaceDeSuscripcion}>Volver a suscribirme</a>
          </Button>
        ) : null}
        {portal && membresia.vigente ? (
          <Button asChild variant="outline">
            <a href={portal}>Tarjeta y cobros</a>
          </Button>
        ) : null}
      </div>
      {membresia.vigente ? (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {portal ? <p>La tarjeta y los cobros están en Stripe: te pide un código que llega a tu correo.</p> : null}
          <Link
            href={`/perfil/membresia?plan=${plan.slug}`}
            className="w-fit underline-offset-4 hover:text-primary hover:underline"
          >
            Administrar membresía
          </Link>
        </div>
      ) : null}
    </Tarjeta>
  )
}
