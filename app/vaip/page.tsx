import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MarcaVaip } from '@/components/marca/logo-vaip'
import { TuMembresia } from '@/components/vaip/tu-membresia'
import { VentaVaip } from '@/components/vaip/venta'
import { Button } from '@/components/ui/button'
import { obtenerSesion } from '@/lib/auth/sesion'
import { enlaceDelPortal, enlaceDeSuscripcion, miMembresia, planVaip } from '@/lib/membresia/consultas'

export const metadata: Metadata = {
  title: 'VADAI V-AI-P',
  description:
    'La comunidad de la academia VADAI: una clase en vivo cada quince días, cursos nuevos para miembros y un muro para compartir lo que ya te funciona con IA.',
}
export const dynamic = 'force-dynamic'

/**
 * /vaip (M17): una sola URL para todos, que es la que lleva el QR.
 *
 *   - miembro vigente → su membresía y la entrada a la comunidad;
 *   - cualquier otra persona, con o sin sesión → la página de venta.
 *
 * Con sesión, el link de pago lleva el correo y el id de la cuenta, para que
 * la suscripción caiga en la misma cuenta.
 */
export default async function PaginaVaip() {
  const plan = await planVaip()
  if (!plan) notFound()

  const sesion = await obtenerSesion()
  const perfil = sesion.tipo === 'activo' ? sesion.perfil : null
  const membresia = perfil ? await miMembresia(plan.id) : null

  const enlace =
    plan.abierto && plan.linkDePago
      ? enlaceDeSuscripcion(plan.linkDePago, perfil ? { correo: perfil.email, userId: perfil.user_id } : null)
      : null
  const portal = plan.portal ? enlaceDelPortal(plan.portal, perfil?.email ?? null) : null

  if (membresia?.vigente) {
    return (
      <div className="flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <MarcaVaip />
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Ya eres parte de V-AI-P.
          </h1>
          <p className="max-w-[60ch] text-pretty text-muted-foreground">
            Las clases en vivo, el muro y lo nuevo que se publique para miembros están en la comunidad.
          </p>
          {plan.casa?.publicada ? (
            <div>
              <Button asChild variant="acento" size="lg">
                <Link href={`/curso/${plan.casa.slug}`}>Entrar a la comunidad</Link>
              </Button>
            </div>
          ) : null}
        </header>
        <TuMembresia membresia={membresia} portal={portal} enlaceDeSuscripcion={enlace} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {membresia ? (
        <div className="max-w-3xl">
          <TuMembresia membresia={membresia} portal={portal} enlaceDeSuscripcion={enlace} />
        </div>
      ) : null}
      <VentaVaip precioMxn={plan.precioMxn} enlace={membresia ? null : enlace} conSesion={Boolean(perfil)} />
    </div>
  )
}
