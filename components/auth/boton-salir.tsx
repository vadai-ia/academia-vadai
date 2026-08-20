'use client'

import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { salir } from '@/lib/auth/acciones'

function Boton({ variante }: { variante: 'principal' | 'discreto' }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variante === 'principal' ? 'default' : 'ghost'}
      size={variante === 'principal' ? 'default' : 'sm'}
      className={variante === 'principal' ? 'w-full' : undefined}
      disabled={pending}
    >
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </Button>
  )
}

export function BotonSalir({ variante = 'discreto' }: { variante?: 'principal' | 'discreto' }) {
  return (
    <form action={salir}>
      <Boton variante={variante} />
    </form>
  )
}
