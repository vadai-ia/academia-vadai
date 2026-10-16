import type { Metadata } from 'next'
import Link from 'next/link'

import { FormularioPlan } from '@/components/admin/formulario-plan'
import { moneda } from '@/components/membresias/precio'
import { Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { exigirAdmin } from '@/lib/auth/sesion'
import { SLUG_VAIP } from '@/lib/membresia/consultas'
import { ETIQUETA_ESTADO_PLAN, listarPlanes } from '@/lib/membresia/planes'
import { stripeAdminConfigurado } from '@/lib/stripe/admin'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Planes' }
export const dynamic = 'force-dynamic'

/**
 * Los planes de membresía (M18). Solo admin: son cobros. Crear un plan lo deja
 * en borrador; se pone a la venta desde su página, con «Publicar en Stripe».
 */
export default async function PaginaPlanes() {
  await exigirAdmin()
  const planes = await listarPlanes()

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link href="/admin/vaip" className="w-fit text-sm text-muted-foreground hover:text-primary">
          ← V-AI-P
        </Link>
        <Titulo apoyo="Cada plan es una suscripción mensual en Stripe que da uno o varios cursos. V-AI-P es uno de ellos.">
          Planes
        </Titulo>
      </div>

      {!stripeAdminConfigurado() ? (
        <Tarjeta className="border-dashed p-5 text-sm text-pretty">
          Para publicar en Stripe falta la llave del panel, <code>STRIPE_ADMIN_KEY</code>, en el servidor. Mientras, los
          planes se pueden crear y editar como borrador.
        </Tarjeta>
      ) : null}

      <Seccion titulo="Tus planes" apoyo={`${planes.length} en total.`}>
        <ul className="grid gap-3 lg:grid-cols-2">
          {planes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/vaip/planes/${p.id}`}
                className="flex h-full flex-col gap-3 rounded-[10px] border border-border bg-card p-5 transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{p.nombre}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                      p.estado === 'active' && 'bg-accent text-accent-foreground',
                      p.estado === 'draft' && 'border border-border text-muted-foreground',
                      p.estado === 'archived' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {ETIQUETA_ESTADO_PLAN[p.estado]}
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  {p.precioTachadoMxn ? (
                    <s className="text-sm text-muted-foreground tabular-nums">{moneda(p.precioTachadoMxn)}</s>
                  ) : null}
                  <span className="text-2xl font-medium tabular-nums">{moneda(p.precioMxn)}</span>
                  <span className="text-sm text-muted-foreground">al mes</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {p.miembrosVigentes} {p.miembrosVigentes === 1 ? 'miembro' : 'miembros'} con acceso · {p.cursos.length}{' '}
                  {p.cursos.length === 1 ? 'curso' : 'cursos'} ·{' '}
                  {p.slug === SLUG_VAIP ? '/vaip' : `/membresias/${p.slug}`}
                </p>
                {p.estado !== 'archived' && !p.linkDePago ? (
                  <p className="text-xs text-primary">Sin link de pago todavía: publícalo en Stripe.</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>

      <FormularioPlan />
    </div>
  )
}
