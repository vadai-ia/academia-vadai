import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'

import { PrecioDelPlan } from '@/components/membresias/precio'
import { TuMembresia } from '@/components/vaip/tu-membresia'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { obtenerSesion } from '@/lib/auth/sesion'
import {
  SLUG_VAIP,
  enlaceDelPortal,
  enlaceDeSuscripcion,
  miMembresia,
  planPublico,
} from '@/lib/membresia/consultas'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const plan = await planPublico(slug)
  return { title: plan?.nombre ?? 'Membresía', description: plan?.frase ?? undefined }
}

/**
 * La página de venta de cualquier plan que no sea V-AI-P (M18): lo que se
 * llenó en el panel —nombre, frase, descripción, imagen, precio y los cursos
 * que trae—. V-AI-P tiene su propia página en /vaip.
 *
 * Solo planes a la venta: un borrador o un archivado da 404.
 */
export default async function PaginaMembresia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (slug === SLUG_VAIP) redirect('/vaip')
  const plan = await planPublico(slug)
  if (!plan) notFound()

  const sesion = await obtenerSesion()
  const perfil = sesion.tipo === 'activo' ? sesion.perfil : null
  const membresia = perfil ? await miMembresia(plan.id) : null
  const enlace =
    plan.abierto && plan.linkDePago
      ? enlaceDeSuscripcion(plan.linkDePago, perfil ? { correo: perfil.email, userId: perfil.user_id } : null)
      : null

  return (
    <div className="flex flex-col gap-12">
      {membresia ? (
        <div className="max-w-3xl">
          <TuMembresia
            plan={{ slug: plan.slug, nombre: plan.nombre }}
            membresia={membresia}
            portal={plan.portal ? enlaceDelPortal(plan.portal, perfil?.email ?? null) : null}
            enlaceDeSuscripcion={enlace}
          />
        </div>
      ) : null}

      <section className="grid items-start gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          {plan.imagen ? (
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border">
              <Image
                src={plan.imagen}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 640px, 100vw"
                className="object-cover"
                unoptimized={!plan.imagen.startsWith('/')}
              />
            </div>
          ) : null}
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{plan.nombre}</h1>
          {plan.descripcion ? (
            <p className="max-w-[60ch] text-base text-pretty whitespace-pre-line text-muted-foreground sm:text-lg">
              {plan.descripcion}
            </p>
          ) : null}
        </div>
        <Tarjeta className="p-6 sm:p-7">
          <PrecioDelPlan
            precioMxn={plan.precioMxn}
            tachadoMxn={plan.precioTachadoMxn}
            frase={plan.frase}
            enlace={membresia?.vigente ? null : enlace}
            conSesion={Boolean(perfil)}
          />
        </Tarjeta>
      </section>

      {plan.cursos.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Qué incluye</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {plan.cursos.map((titulo) => (
              <li key={titulo}>
                <Tarjeta className="flex h-full items-center gap-3 p-4">
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"
                  >
                    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="font-medium">{titulo}</span>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
