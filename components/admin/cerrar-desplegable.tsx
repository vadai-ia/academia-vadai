'use client'

import { Button } from '@/components/ui/button'

/**
 * El "Cancelar" de un formulario que vive en un `Desplegable`.
 *
 * Es comodidad con JavaScript, como `expandir-todo.tsx`: cierra el <details>
 * que lo contiene sin que la persona tenga que subir hasta el botón. Sin
 * JavaScript no hace nada, y no pasa nada: el <summary> sigue cerrando.
 */
export function CerrarDesplegable({ children = 'Cancelar' }: { children?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={(evento) => evento.currentTarget.closest('details')?.removeAttribute('open')}
    >
      {children}
    </Button>
  )
}
