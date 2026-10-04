'use client'

import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'

/**
 * El botón de envío de un `<form>` cuya acción va directa (sin
 * `useActionState`): se apaga y cambia de texto mientras la acción corre, para
 * que nadie vuelva a apretar. Sin JavaScript es un botón de envío normal.
 */
export function BotonConEspera({
  texto,
  enCurso,
  variante = 'default',
  tamano = 'sm',
  className,
  etiquetaAccesible,
}: {
  texto: string
  enCurso: string
  variante?: 'default' | 'outline' | 'ghost' | 'destructive' | 'acento'
  tamano?: 'sm' | 'default'
  className?: string
  etiquetaAccesible?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variante}
      size={tamano}
      disabled={pending}
      aria-label={etiquetaAccesible}
      className={className}
    >
      {pending ? enCurso : texto}
    </Button>
  )
}
