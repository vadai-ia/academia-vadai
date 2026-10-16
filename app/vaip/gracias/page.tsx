import type { Metadata } from 'next'
import Link from 'next/link'

import { LogoVaip } from '@/components/marca/logo-vaip'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { obtenerSesion } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Bienvenido a V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * A donde regresa Stripe después de pagar (M17).
 *
 * SOLO informa. No da de alta nada con el `session_id` de la URL: cualquiera
 * puede escribir esa URL a mano. El alta la hace el webhook, con la firma de
 * Stripe de por medio.
 */
export default async function PaginaGracias() {
  const sesion = await obtenerSesion()
  const conSesion = sesion.tipo === 'activo'

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-6 text-center">
      <LogoVaip className="h-14" />
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Listo. Ya eres parte de V-AI-P.</h1>
      <Tarjeta className="flex flex-col gap-3 p-6 text-left">
        {conSesion ? (
          <p className="text-pretty text-muted-foreground">
            Tu acceso se activa en unos segundos. Si V-AI-P todavía no aparece, recarga la página en un
            momento.
          </p>
        ) : (
          <>
            <p className="text-pretty text-muted-foreground">
              Te mandamos un correo con la liga para entrar. Revisa también la carpeta de promociones o de
              spam.
            </p>
            <p className="text-pretty text-muted-foreground">
              Si ya tenías cuenta en la academia, entra con tu contraseña de siempre: la membresía ya está en
              tu cuenta.
            </p>
          </>
        )}
      </Tarjeta>
      <Button asChild variant="acento" size="lg">
        <Link href={conSesion ? '/vaip' : '/login?destino=%2Fvaip'}>{conSesion ? 'Ir a V-AI-P' : 'Entrar'}</Link>
      </Button>
    </div>
  )
}
