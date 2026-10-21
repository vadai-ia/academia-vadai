import type { Metadata } from 'next'
import Link from 'next/link'

import { CodigoQr } from '@/components/encuestas/codigo-qr'
import { FormularioPlan } from '@/components/admin/formulario-plan'
import { moneda as monedaDelPlan } from '@/components/membresias/precio'
import { Cifra, Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { SincronizarAccesos } from '@/components/vaip/sincronizar-accesos'
import { fechaLarga } from '@/components/vaip/tu-membresia'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ETIQUETA_ESTADO_CURSO } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { panelVaip } from '@/lib/membresia/admin'
import { planVaip, SLUG_VAIP } from '@/lib/membresia/consultas'
import { etiquetaDeMotivo } from '@/lib/membresia/motivos'
import { cancelacionesDelPlan, ETIQUETA_ESTADO_PLAN, listarPlanes } from '@/lib/membresia/planes'
import { stripeAdminConfigurado } from '@/lib/stripe/admin'
import { abrirCasa } from '@/lib/vaip/acciones'
import { crearClienteServidor } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Planes y cobros · V-AI-P' }
export const dynamic = 'force-dynamic'

const moneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

/**
 * Planes y cobros de V-AI-P (M25, 20-oct-2026): eran dos pestañas —Cobros
 * (M17) y Planes (M18)— que hablaban de lo mismo. SOLO admin: el community
 * manager no ve pagos (la barra no se la enseña y la página lo exige).
 *
 * Arriba lo que falta para vender, las cifras y los dos QR; luego lo que hay
 * que atender, los cursos del plan, por qué se van, los cobros y, al final,
 * los planes con su formulario. Quién es miembro vive en Miembros.
 * Reembolsar se hace en Stripe: el webhook lo refleja aquí.
 */
export default async function PaginaPlanesYCobros() {
  await exigirAdmin()
  const [plan, planes] = await Promise.all([planVaip(), listarPlanes()])

  const supabase = await crearClienteServidor()
  const [panel, enlaces, cancelaciones] = plan
    ? await Promise.all([
        panelVaip(plan.id),
        supabase.from('membership_plan_courses').select('course_id').eq('plan_id', plan.id),
        cancelacionesDelPlan(plan.id, 5),
      ])
    : [null, null, []]

  const ids = (enlaces?.data ?? []).map((e) => e.course_id)
  const { data: filas } = ids.length
    ? await supabase.from('courses').select('id, title, slug, status').in('id', ids).order('created_at')
    : { data: [] }
  const cursos = filas ?? []

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  const pagina = `${base}/vaip`
  const alertas = panel?.alertas
  const hayAlertas = alertas ? alertas.atrasados.length + alertas.duplicados.length + alertas.sinCuenta.length > 0 : false

  return (
    <div className="flex flex-col gap-10">
      <Titulo ceja="V-AI-P" apoyo="Solo lo ve un admin. Lo que cobra V-AI-P y los planes con los que se vende.">
        Planes y cobros
      </Titulo>

      {plan && (!plan.linkDePago || !plan.casa?.publicada) ? (
        <Tarjeta className="flex flex-col gap-2 border-dashed p-5">
          <p className="font-medium">Antes de abrir la suscripción</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            {!plan.linkDePago ? (
              <li>
                Publícalo en Stripe desde{' '}
                <Link href={`/admin/vaip/planes/${plan.id}`} className="font-medium text-primary hover:underline">
                  su plan
                </Link>
                : crea el precio, el link de pago y el portal de tarjeta y cobros.
              </li>
            ) : null}
            {plan.casa && !plan.casa.publicada ? (
              <li>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  Abre la comunidad: mientras esté cerrada, la página de venta dice que abre pronto.
                  <form action={abrirCasa}>
                    <Button type="submit" size="sm">
                      Abrir la comunidad
                    </Button>
                  </form>
                </span>
              </li>
            ) : null}
          </ul>
        </Tarjeta>
      ) : null}

      {panel ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra valor={String(panel.cifras.vigentes)} etiqueta="Miembros con acceso" destacada />
          <Cifra valor={String(panel.cifras.seCancelan)} etiqueta="Cancelaron la renovación" detalle="Siguen dentro hasta su fecha" />
          <Cifra valor={String(panel.cifras.atrasados)} etiqueta="Con pago pendiente" />
          <Cifra valor={moneda(panel.cifras.cobradoEsteMes)} etiqueta="Cobrado este mes" />
        </div>
      ) : null}

      {plan ? (
        <Seccion titulo="Para suscribirse" apoyo={`${moneda(plan.precioMxn)} MXN al mes, sin periodo de prueba.`}>
          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-start">
              <CodigoQr texto={pagina} tamano={148} className="shrink-0 border border-border" />
              <div className="flex min-w-0 flex-col gap-2">
                <p className="font-medium">QR a la página de V-AI-P</p>
                <p className="text-sm text-pretty text-muted-foreground">
                  El que conviene imprimir: si un día cambia el link de Stripe, este sigue sirviendo.
                </p>
                <p className="truncate font-mono text-xs">{pagina}</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <a href="/api/vaip/qr?destino=pagina">Descargar SVG</a>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href="/vaip" target="_blank" rel="noreferrer">
                      Abrir la página
                    </a>
                  </Button>
                </div>
              </div>
            </Tarjeta>

            <Tarjeta className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-start">
              {plan.linkDePago ? (
                <CodigoQr texto={plan.linkDePago} tamano={148} className="shrink-0 border border-border" />
              ) : (
                <div className="grid size-[148px] shrink-0 place-items-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  Sin link todavía
                </div>
              )}
              <div className="flex min-w-0 flex-col gap-2">
                <p className="font-medium">Link de pago de Stripe</p>
                <p className="text-sm text-pretty text-muted-foreground">
                  Va directo al pago. Útil para mandarlo por WhatsApp o correo.
                </p>
                {plan.linkDePago ? (
                  <>
                    <p className="truncate font-mono text-xs">{plan.linkDePago}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <a href="/api/vaip/qr?destino=pago">Descargar SVG</a>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Aparece al publicar el plan en Stripe.</p>
                )}
              </div>
            </Tarjeta>
          </div>
        </Seccion>
      ) : null}

      {alertas && hayAlertas ? (
        <Seccion titulo="Por atender">
          <ul className="flex flex-col gap-2 text-sm">
            {alertas.atrasados.map((m) => (
              <li key={`a-${m.clave}`} className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-4 py-3">
                <span className="font-medium">{m.nombre}</span> · su último cobro no pasó. Stripe lo reintenta; si
                no paga, pierde el acceso solo.
              </li>
            ))}
            {alertas.duplicados.map((m) => (
              <li key={`d-${m.clave}`} className="rounded-[10px] border border-border px-4 py-3">
                <span className="font-medium">{m.nombre}</span> · tiene {m.vivas} suscripciones activas. Cancela
                las de más en Stripe para que no pague doble.
              </li>
            ))}
            {alertas.sinCuenta.map((m) => (
              <li key={`s-${m.clave}`} className="rounded-[10px] border border-border px-4 py-3">
                <span className="font-medium">{m.correo ?? 'Una suscripción'}</span> · pagó y todavía no tiene
                cuenta enlazada. Revisa los registros del webhook.
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {plan ? (
        <Seccion
          titulo="Cursos de V-AI-P"
          apoyo="Los marcados «Incluido en V-AI-P» en su ficha. Al publicar uno nuevo, sincroniza para dárselo a todos."
          accion={<SincronizarAccesos />}
        >
          <ul className="flex flex-col gap-2">
            {cursos.map((c) => (
              <li key={c.id}>
                <Link
                  href={c.id === plan.casa?.id ? '/admin/vaip/clases' : `/admin/cursos/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-3 text-sm transition-colors hover:border-primary/50"
                >
                  <span className="font-medium">
                    {c.title}
                    {c.id === plan.casa?.id ? <span className="text-muted-foreground"> · la casa: clases y grabaciones</span> : null}
                  </span>
                  <Badge variant="outline">{ETIQUETA_ESTADO_CURSO[c.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {plan ? (
        <Seccion
          titulo="Por qué se van"
          apoyo="Las últimas cancelaciones, con el motivo que eligieron."
          accion={
            <Link href={`/admin/vaip/planes/${plan.id}`} className="text-sm font-medium text-primary hover:underline">
              Ver todas
            </Link>
          }
        >
          {cancelaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie ha cancelado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cancelaciones.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-[10px] border border-border px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{c.nombre || c.correo || 'Sin cuenta'}</span>
                    <span className="text-muted-foreground"> · {etiquetaDeMotivo(c.motivo)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fechaLarga(c.fecha)}
                    {c.revertida ? ' · volvió' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      ) : null}

      {panel ? (
        <Seccion titulo="Cobros recientes">
          {panel.cobros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cobros todavía.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border text-sm">
              {panel.cobros.map((c) => (
                <li key={c.factura} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0 truncate">{c.correo ?? c.factura}</span>
                  <span className="flex items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground">{fechaLarga(c.fecha)}</span>
                    <span className={cn('font-medium', c.estado === 'failed' && 'text-destructive')}>
                      {c.estado === 'failed' ? 'Falló · ' : ''}
                      {moneda(c.monto)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      ) : null}

      {!stripeAdminConfigurado() ? (
        <Tarjeta className="border-dashed p-5 text-sm text-pretty">
          Para publicar en Stripe falta la llave del panel, <code>STRIPE_ADMIN_KEY</code>, en el servidor. Mientras, los
          planes se pueden crear y editar como borrador.
        </Tarjeta>
      ) : null}

      <Seccion
        titulo="Planes"
        apoyo={`Cada plan es una suscripción mensual en Stripe que da uno o varios cursos. V-AI-P es uno de ellos. ${planes.length} en total.`}
      >
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
                    <s className="text-sm text-muted-foreground tabular-nums">{monedaDelPlan(p.precioTachadoMxn)}</s>
                  ) : null}
                  <span className="text-2xl font-medium tabular-nums">{monedaDelPlan(p.precioMxn)}</span>
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
