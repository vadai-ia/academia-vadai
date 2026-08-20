import type { Metadata } from 'next'

import { FormularioNuevaContrasena } from '@/components/auth/formulario-nueva-contrasena'

export const metadata: Metadata = { title: 'Nueva contraseña' }

/**
 * Aterrizaje de la invitación (§3.1-A) y de la recuperación. En ambos casos el
 * enlace del correo ya dejó una sesión activa; aquí solo se define la clave.
 */
export default function PaginaNuevaContrasena() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu contraseña</h1>
        <p className="text-sm text-muted-foreground">
          Con ella entrarás la próxima vez. También puedes entrar con Google si usas el
          mismo correo.
        </p>
      </header>

      <FormularioNuevaContrasena />
    </div>
  )
}
