import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { obtenerSesion } from '@/lib/auth/sesion'
import { planPublico } from '@/lib/membresia/consultas'

export const metadata: Metadata = { title: 'Gracias' }
export const dynamic = 'force-dynamic'

/**
 * A donde regresa Stripe después de pagar un plan (M18), como /vaip/gracias.
 * SOLO informa: el alta la hace el webhook, con la firma de Stripe de por medio.
 */
export default async function PaginaGracias({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const plan = await planPublico(slug)
  if (!plan) notFound()
  const conSesion = (await obtenerSesion()).tipo === 'activo'

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Listo. Ya tienes {plan.nombre}.</h1>
      <Tarjeta className="flex flex-col gap-3 p-6 text-left">
        {conSesion ? (
          <p className="text-pretty text-muted-foreground">
            Tu acceso se activa en unos segundos. Si los cursos todavía no aparecen en Mis cursos, recarga la página en
            un momento.
          </p>
        ) : (
          <>
            <p className="text-pretty text-muted-foreground">
              Te mandamos un correo con la liga para entrar. Revisa también la carpeta de promociones o de spam.
            </p>
            <p className="text-pretty text-muted-foreground">
              Si ya tenías cuenta en la academia, entra con tu contraseña de siempre: la membresía ya está en tu cuenta.
            </p>
          </>
        )}
      </Tarjeta>
      <Button asChild variant="acento" size="lg">
        <Link href={conSesion ? '/mis-cursos' : '/login?destino=%2Fmis-cursos'}>{conSesion ? 'Ir a Mis cursos' : 'Entrar'}</Link>
      </Button>
    </div>
  )
}
