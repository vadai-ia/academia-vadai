import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FormularioPlan } from '@/components/admin/formulario-plan'
import { CodigoQr } from '@/components/encuestas/codigo-qr'
import { PublicarPlan } from '@/components/admin/publicar-plan'
import { moneda } from '@/components/membresias/precio'
import { Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { fechaLarga } from '@/components/vaip/tu-membresia'
import { exigirAdmin } from '@/lib/auth/sesion'
import { SLUG_VAIP } from '@/lib/membresia/consultas'
import { etiquetaDeMotivo } from '@/lib/membresia/motivos'
import { ETIQUETA_ESTADO_PLAN, cancelacionesDelPlan, cursosElegibles, planDelPanel } from '@/lib/membresia/planes'

export const metadata: Metadata = { title: 'Plan' }
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Un plan (M18): sus datos, sus cursos, su estado en Stripe, el QR de su
 * página y por qué se va la gente. Solo admin.
 */
export default async function PaginaPlan({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ creado?: string }>
}) {
  const perfil = await exigirAdmin()
  const { id } = await params
  const { creado } = await searchParams
  if (!UUID.test(id)) notFound()
  const [plan, cursos, cancelaciones] = await Promise.all([
    planDelPanel(id),
    cursosElegibles(perfil.email),
    cancelacionesDelPlan(id),
  ])
  if (!plan) notFound()

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  const ruta = plan.slug === SLUG_VAIP ? '/vaip' : `/membresias/${plan.slug}`
  const cambioDePrecio = plan.precioEnStripe !== null && plan.precioEnStripe !== plan.precioMxn

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link href="/admin/vaip/planes" className="w-fit text-sm text-muted-foreground hover:text-primary">
          ← Planes
        </Link>
        <Titulo apoyo={`${ETIQUETA_ESTADO_PLAN[plan.estado]} · ${moneda(plan.precioMxn)} al mes · ${plan.miembrosVigentes} con acceso`}>
          {plan.nombre}
        </Titulo>
      </div>

      {creado ? (
        <p className="rounded-lg border border-accent bg-accent/15 px-4 py-3 text-sm">
          Plan creado en borrador. Completa su descripción y sus cursos, y publícalo en Stripe cuando esté listo.
        </p>
      ) : null}

      <div className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Seccion titulo="Datos del plan">
          <Tarjeta className="p-5">
            <FormularioPlan
              plan={{
                id: plan.id,
                slug: plan.slug,
                nombre: plan.nombre,
                precioMxn: plan.precioMxn,
                precioTachadoMxn: plan.precioTachadoMxn,
                frase: plan.frase,
                descripcion: plan.descripcion,
                imagen: plan.imagen,
                casaId: plan.casaId,
                cursos: plan.cursos,
                slugFijo: plan.enStripe || plan.slug === SLUG_VAIP,
              }}
              cursos={cursos}
            />
          </Tarjeta>
        </Seccion>

        <div className="flex flex-col gap-8">
          <Seccion titulo="En Stripe">
            <Tarjeta className="flex flex-col gap-4 p-5">
              {plan.linkDePago ? (
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">Link de pago</dt>
                    <dd className="font-mono text-xs break-all">{plan.linkDePago}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted-foreground">Cobra</dt>
                    <dd className="font-medium">{plan.precioEnStripe ? `${moneda(plan.precioEnStripe)} al mes` : '—'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-pretty text-muted-foreground">
                  Todavía no existe en Stripe. Publicar crea el producto, el precio, el link de pago y el portal de
                  tarjeta y cobros.
                </p>
              )}
              <PublicarPlan
                planId={plan.id}
                publicado={plan.enStripe && plan.estado !== 'archived'}
                archivable={plan.slug !== SLUG_VAIP}
                cambioDePrecio={cambioDePrecio}
              />
            </Tarjeta>
          </Seccion>

          <Seccion titulo="QR de la página" apoyo="Lleva a la página del plan, no al link: si el precio cambia, sigue sirviendo.">
            <Tarjeta className="flex items-center gap-4 p-5">
              <CodigoQr texto={`${base}${ruta}`} tamano={112} className="shrink-0 border border-border" />
              <div className="flex min-w-0 flex-col gap-1.5 text-sm">
                <span className="font-mono text-xs break-all">{`${base}${ruta}`}</span>
                <Link href={ruta} className="w-fit font-medium text-primary hover:underline">
                  Abrir la página
                </Link>
              </div>
            </Tarjeta>
          </Seccion>
        </div>
      </div>

      <Seccion titulo="Por qué se van" apoyo="Lo que eligieron al cancelar, en la plataforma o en el portal de Stripe.">
        {cancelaciones.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Nadie ha cancelado.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cancelaciones.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 rounded-[10px] border border-border px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{c.nombre || c.correo || 'Sin cuenta'}</span>
                  <span className="text-xs text-muted-foreground">
                    {fechaLarga(c.fecha)} · {c.origen === 'plataforma' ? 'en la plataforma' : 'en Stripe'}
                    {c.revertida ? ' · volvió' : ''}
                  </span>
                </div>
                <span className="text-muted-foreground">{etiquetaDeMotivo(c.motivo)}</span>
                {c.comentario ? <p className="text-pretty">«{c.comentario}»</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  )
}
