'use client'

import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { salir } from '@/lib/auth/acciones'

type Variante = 'principal' | 'discreto' | 'menu'

function Boton({ variante }: { variante: Variante }) {
  const { pending } = useFormStatus()

  // Dentro del menú de cuenta va como renglón de menú, no como botón: alineado
  // a la izquierda, a todo el ancho y en rojo discreto, que es lo que un ojo
  // espera de "cerrar sesión" en un desplegable.
  if (variante === 'menu') {
    return (
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="w-full justify-start text-destructive hover:text-destructive"
      >
        {pending ? 'Saliendo…' : 'Cerrar sesión'}
      </Button>
    )
  }

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

export function BotonSalir({ variante = 'discreto' }: { variante?: Variante }) {
  return (
    <form action={salir}>
      <Boton variante={variante} />
    </form>
  )
}
