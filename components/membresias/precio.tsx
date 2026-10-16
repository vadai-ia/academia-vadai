import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * El precio de un plan con su llamado a la acción (M18): «Precio de graduado»,
 * el de referencia tachado y el que se cobra. Lo usan el flyer de /vaip y la
 * página de cualquier otro plan.
 *
 * `sobreFoto`: va encima del flyer, un plano oscuro que no cambia con el tema
 * (el mismo criterio que el hero de Mis cursos): texto blanco y lima fijos.
 */

export const moneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

export function PrecioDelPlan({
  precioMxn,
  tachadoMxn,
  frase,
  enlace,
  conSesion,
  sobreFoto = false,
}: {
  precioMxn: number
  tachadoMxn: number | null
  frase: string | null
  /** El link de pago ya personalizado, o null si la suscripción no abre todavía. */
  enlace: string | null
  conSesion: boolean
  sobreFoto?: boolean
}) {
  const tenue = sobreFoto ? 'text-white/70' : 'text-muted-foreground'
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {frase ? (
          <span
            className={cn(
              'text-xs font-medium tracking-[0.18em] uppercase',
              sobreFoto ? 'text-vadai-lima' : 'text-primary'
            )}
          >
            {frase}
          </span>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {tachadoMxn ? (
            <span className={cn('text-xl tabular-nums', tenue)}>
              <span className="sr-only">Antes </span>
              <s>{moneda(tachadoMxn)}</s>
            </span>
          ) : null}
          <span className="text-5xl font-semibold tracking-tight tabular-nums">
            {tachadoMxn ? <span className="sr-only">Ahora </span> : null}
            {moneda(precioMxn)}
          </span>
          <span className={tenue}>MXN al mes</span>
        </div>
      </div>

      {enlace ? (
        <Button
          asChild
          size="lg"
          className={cn('h-11 w-full text-base sm:w-fit sm:px-8', sobreFoto && 'bg-vadai-lima text-vadai-navy hover:brightness-105')}
          variant={sobreFoto ? 'default' : 'acento'}
        >
          <a href={enlace}>Suscribirme</a>
        </Button>
      ) : (
        <p
          className={cn(
            'rounded-lg border border-dashed px-4 py-3 text-center text-sm sm:w-fit',
            sobreFoto ? 'border-white/30 text-white/80' : 'border-border text-muted-foreground'
          )}
        >
          La suscripción abre muy pronto.
        </p>
      )}

      <p className={cn('text-xs text-pretty', tenue)}>
        Se cobra con tarjeta cada mes. Cancelas desde tu perfil cuando quieras y sigues dentro hasta que termine el
        mes que pagaste.{' '}
        {conSesion
          ? 'La suscripción queda en la cuenta con la que entraste.'
          : 'Si ya tienes cuenta en la academia, usa el mismo correo al pagar.'}
      </p>
    </div>
  )
}
