import { BotonSuscribir, SuscripcionCerrada } from '@/components/membresias/boton-suscribir'
import { cn } from '@/lib/utils'

/**
 * El precio de un plan con su llamado a la acción (M18): «Precio de graduado»,
 * el de referencia tachado y el que se cobra. Lo usa la página de cualquier
 * plan (/membresias/<slug>); el encabezado de /vaip arma el suyo con las
 * mismas piezas (M23).
 *
 * `sobreFoto`: va encima del flyer, un plano oscuro que no cambia con el tema
 * (el mismo criterio que el hero de Mis cursos): texto blanco y lima fijos.
 */

export const moneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

/** La frase, el precio tachado y el que se cobra. Sin botón. */
export function PrecioConTachado({
  precioMxn,
  tachadoMxn,
  frase,
  sobreFoto = false,
  tamano = 'grande',
}: {
  precioMxn: number
  tachadoMxn: number | null
  frase: string | null
  sobreFoto?: boolean
  /** `mediano` para el teléfono, donde el encabezado tiene que caber sin scroll. */
  tamano?: 'grande' | 'mediano'
}) {
  const tenue = sobreFoto ? 'text-white/70' : 'text-muted-foreground'
  return (
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
          <span className={cn('tabular-nums', tamano === 'grande' ? 'text-xl' : 'text-lg', tenue)}>
            <span className="sr-only">Antes </span>
            <s>{moneda(tachadoMxn)}</s>
          </span>
        ) : null}
        <span
          className={cn(
            'font-semibold tracking-tight tabular-nums',
            tamano === 'grande' ? 'text-5xl' : 'text-4xl sm:text-5xl'
          )}
        >
          {tachadoMxn ? <span className="sr-only">Ahora </span> : null}
          {moneda(precioMxn)}
        </span>
        <span className={tenue}>MXN al mes</span>
      </div>
    </div>
  )
}

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
      <PrecioConTachado precioMxn={precioMxn} tachadoMxn={tachadoMxn} frase={frase} sobreFoto={sobreFoto} />

      {enlace ? (
        <BotonSuscribir enlace={enlace} lugar="hero" sobreFoto={sobreFoto}>
          Suscribirme
        </BotonSuscribir>
      ) : (
        <SuscripcionCerrada sobreFoto={sobreFoto} />
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
