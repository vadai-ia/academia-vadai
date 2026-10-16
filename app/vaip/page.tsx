import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EspacioDeMiembro } from '@/components/vaip/espacio'
import { TuMembresia } from '@/components/vaip/tu-membresia'
import { VentaVaip } from '@/components/vaip/venta'
import { esEquipo, obtenerSesion } from '@/lib/auth/sesion'
import { enlaceDelPortal, enlaceDeSuscripcion, miMembresia, planVaip } from '@/lib/membresia/consultas'
import { espacioVaip } from '@/lib/membresia/espacio'

export const metadata: Metadata = {
  title: 'VADAI V-AI-P',
  description:
    'La comunidad de la academia VADAI: una clase en vivo cada quince días, cursos nuevos para miembros y un muro para compartir lo que ya te funciona con IA.',
}
export const dynamic = 'force-dynamic'

/**
 * /vaip (M17): una sola URL para todos, que es la que lleva el QR.
 *
 *   - miembro vigente (o alguien del equipo) → el espacio de V-AI-P;
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

  // El miembro vigente ve su espacio; el equipo también, para revisarlo.
  if (perfil && (membresia?.vigente || esEquipo(perfil))) {
    const espacio = await espacioVaip(perfil, plan)
    return (
      <EspacioDeMiembro
        nombre={perfil.full_name || perfil.email}
        userId={perfil.user_id}
        casaSlug={plan.casa?.publicada || esEquipo(perfil) ? (plan.casa?.slug ?? null) : null}
        espacio={espacio}
        portal={membresia ? portal : null}
      />
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {membresia ? (
        <div className="max-w-3xl">
          <TuMembresia
            plan={{ slug: plan.slug, nombre: plan.nombre }}
            membresia={membresia}
            portal={portal}
            enlaceDeSuscripcion={enlace}
          />
        </div>
      ) : null}
      <VentaVaip plan={plan} enlace={enlace} conSesion={Boolean(perfil)} />
    </div>
  )
}
