import type { Metadata } from 'next'

import { FormularioRecuperar } from '@/components/auth/formulario-recuperar'

export const metadata: Metadata = { title: 'Recuperar contraseña' }

export default function PaginaRecuperar() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">¿Olvidaste tu contraseña?</h1>
        <p className="text-sm text-muted-foreground">
          Escribe tu correo y te mandamos un enlace para crear una nueva.
        </p>
      </header>

      <FormularioRecuperar />
    </div>
  )
}
