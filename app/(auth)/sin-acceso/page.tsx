import type { Metadata } from 'next'

import { BotonSalir } from '@/components/auth/boton-salir'
import { obtenerSesion } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Sin acceso' }
export const dynamic = 'force-dynamic'

/**
 * Pantalla para quien está autenticado pero no pertenece a la academia (§2).
 *
 * Pasa cuando alguien entra con un Google cuyo correo no compró nada, o cuando
 * una cuenta fue suspendida. No es un error del usuario: el tono lo refleja.
 */
export default async function PaginaSinAcceso() {
  const sesion = await obtenerSesion()

  const correo =
    sesion.tipo === 'sinPerfil'
      ? sesion.email
      : sesion.tipo === 'suspendido'
        ? sesion.perfil.email
        : null

  const suspendida = sesion.tipo === 'suspendido'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {suspendida ? 'Tu cuenta está suspendida' : 'Esta cuenta no tiene acceso'}
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {suspendida
            ? 'Escríbenos y lo resolvemos.'
            : 'Si compraste un curso, es probable que lo hayas hecho con otro correo. Escríbenos y te ayudamos a entrar.'}
        </p>
      </header>

      {correo ? (
        <div className="rounded-md border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">Entraste como</p>
          <p className="text-sm break-all">{correo}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <a
          href="mailto:ayuda@vadai.com.mx?subject=No%20puedo%20entrar%20a%20la%20academia"
          className="text-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Escribir a soporte
        </a>
        <BotonSalir variante="principal" />
      </div>
    </div>
  )
}
