import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { entrarConEnlace } from '@/lib/auth/acciones-acceso'
import { DIAS_DE_VIGENCIA, resolverEnlaceDurable } from '@/lib/auth/enlace-durable'
import { RUTAS } from '@/lib/auth/rutas'

export const metadata: Metadata = { title: 'Tu acceso' }
export const dynamic = 'force-dynamic'

/**
 * Aterrizaje de la liga del correo de bienvenida.
 *
 * Es una página con un botón, no un redirect: el GET no puede gastar nada
 * porque los escáneres de enlaces de Outlook y Gmail lo hacen antes que la
 * persona. Lo que abre sesión es el POST del botón (lib/auth/acciones-acceso).
 *
 * Con una liga vencida se dice cuánto duran y cuál es la salida —pedir una
 * nueva—, no "intenta de nuevo": reintentar una liga muerta no puede
 * funcionar, y mandar a la persona a repetirlo es dejarla en un callejón.
 */
export default async function PaginaAcceso({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const enlace = await resolverEnlaceDurable(token)

  if (!enlace.ok) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Este enlace ya venció</h1>
          <p className="text-sm text-muted-foreground">
            Las ligas de acceso valen {DIAS_DE_VIGENCIA} días. Pide una nueva con tu correo y te
            llega en menos de un minuto.
          </p>
        </header>

        <Button asChild className="w-full">
          <Link href={RUTAS.recuperar}>Pedir una liga nueva</Link>
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes contraseña?{' '}
          <Link href={RUTAS.login} className="font-medium text-primary underline-offset-4 hover:underline">
            Entra aquí
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {enlace.nombre ? `Hola, ${enlace.nombre}` : 'Hola'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Este es tu acceso a la academia. Da clic, elige una contraseña y con ella entras la
          próxima vez.
        </p>
      </header>

      <form action={entrarConEnlace} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" className="w-full">
          Entrar a mi academia
        </Button>
      </form>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Si no esperabas este correo, cierra esta ventana y nada pasa.
      </p>
    </div>
  )
}
