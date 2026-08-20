import { cn } from '@/lib/utils'
import type { EstadoFormulario } from '@/lib/auth/tipos'

/** Muestra el resultado de una server action. No renderiza nada si no hay. */
export function Mensaje({ estado }: { estado: EstadoFormulario }) {
  const texto = estado.error ?? estado.aviso
  if (!texto) return null

  const esError = Boolean(estado.error)

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        esError
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-vadai-cyan/40 bg-vadai-cyan/10 text-vadai-texto'
      )}
    >
      {texto}
    </p>
  )
}
