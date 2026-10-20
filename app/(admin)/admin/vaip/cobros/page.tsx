import type { Metadata } from 'next'
import Link from 'next/link'

import { CodigoQr } from '@/components/encuestas/codigo-qr'
import { Cifra, Seccion, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { SincronizarAccesos } from '@/components/vaip/sincronizar-accesos'
import { fechaLarga } from '@/components/vaip/tu-membresia'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ETIQUETA_ESTADO_CURSO } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { panelVaip, type MiembroDelPanel } from '@/lib/membresia/admin'
import { planVaip } from '@/lib/membresia/consultas'
import { etiquetaDeMotivo } from '@/lib/membresia/motivos'
import { cancelacionesDelPlan } from '@/lib/membresia/planes'
import { crearClienteServidor } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'V-AI-P' }
export const dynamic = 'force-dynamic'

const ETIQUETA_ESTADO: Record<MiembroDelPanel['estado'], string> = {
  active: 'Activa',
  trialing: 'Activa',
  past_due: 'Pago pendiente',
  unpaid: 'Sin pago',
  canceled: 'Cancelada',
  incomplete: 'Sin terminar',
  incomplete_expired: 'Sin terminar',
  paused: 'En pausa',
}

const moneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

/**
 * La pestaña Cobros del portal de V-AI-P (M17; pestaña desde M19), SOLO
 * admin: el community manager no ve pagos. Antes era toda la página de
 * /admin/vaip; los temas del muro se fueron a la pestaña Muro.
 *
 * Arriba lo que hace falta para vender (link, QR, página); luego quién paga,
 * lo que hay que atender y los cobros. Reembolsar a alguien se hace en
 * Stripe: el webhook lo refleja aquí.
 */
export default async function PaginaCobros() {
  await exigirAdmin()
  const plan = await planVaip()
  if (!plan) {
    return <Titulo apoyo="Falta aplicar la migración academia_0040_membresia.">VADAI V-AI-P</Titulo>
  }

  const supabase = await crearClienteServidor()
  const [panel, { data: enlaces }, cancelaciones] = await Promise.all([
    panelVaip(plan.id),
    supabase.from('membership_plan_courses').select('course_id').eq('plan_id', plan.id),
    cancelacionesDelPlan(plan.id, 5),
  ])

  const ids = (enlaces ?? []).map((e) => e.course_id)
  const { data: filas } = ids.length
    ? await supabase.from('courses').select('id, title, slug, status').in('id', ids).order('created_at')
    : { data: [] }
  const cursos = filas ?? []

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  const pagina = `${base}/vaip`
  const { cifras, alertas } = panel
  const hayAlertas = alertas.atrasados.length + alertas.duplicados.length + alertas.sinCuenta.length > 0

  return (
    <div className="flex flex-col gap-10">
      {!plan.linkDePago || !plan.casa?.publicada ? (
        <Tarjeta className="flex flex-col gap-2 border-dashed p-5">
          <p className="font-medium">Antes de abrir la suscripción</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            {!plan.linkDePago ? (
              <li>
                Publícalo en Stripe desde{' '}
                <Link href={`/admin/vaip/planes/${plan.id}`} className="font-medium text-primary hover:underline">
                  Planes
                </Link>
                : crea el precio, el link de pago y el portal de tarjeta y cobros.
              </li>
            ) : null}
            {plan.casa && !plan.casa.publicada ? (
              <li>
                Publica el curso{' '}
                <Link href={`/admin/cursos/${plan.casa.id}`} className="font-medium text-primary hover:underline">
                  VADAI V-AI-P
                </Link>
                . Mientras esté en borrador, la página de venta dice que abre pronto.
              </li>
            ) : null}
          </ul>
        </Tarjeta>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra valor={String(cifras.vigentes)} etiqueta="Miembros con acceso" destacada />
        <Cifra valor={String(cifras.seCancelan)} etiqueta="Cancelaron la renovación" detalle="Siguen dentro hasta su fecha" />
        <Cifra valor={String(cifras.atrasados)} etiqueta="Con pago pendiente" />
        <Cifra valor={moneda(cifras.cobradoEsteMes)} etiqueta="Cobrado este mes" />
      </div>

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
                <p className="text-xs text-muted-foreground">Aparece al correr el script de Stripe.</p>
              )}
            </div>
          </Tarjeta>
        </div>
      </Seccion>

      {hayAlertas ? (
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

      <Seccion titulo="Miembros" apoyo={`${panel.miembros.length} en total, contando a quien ya salió.`}>
        {panel.miembros.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no hay miembros. Cuando alguien se suscriba, aparece aquí en segundos.
          </p>
        ) : (
          <div className="relative overflow-x-auto rounded-[10px] border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Miembro</th>
                  <th className="px-4 py-2.5 font-medium">Empresa</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium">Acceso hasta</th>
                  <th className="px-4 py-2.5 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {panel.miembros.map((m) => (
                  <tr key={m.clave}>
                    <td className="px-4 py-3">
                      {m.userId ? (
                        <Link href={`/admin/alumnos/${m.userId}`} className="font-medium hover:text-primary">
                          {m.nombre}
                        </Link>
                      ) : (
                        <span className="font-medium">{m.nombre}</span>
                      )}
                      <span className="block text-xs text-muted-foreground">{m.correo}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.empresa ?? 'General'}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          m.vigente && m.estado === 'active' && !m.seCancela && 'border-transparent bg-accent text-accent-foreground'
                        )}
                      >
                        {m.vigente && m.seCancela ? 'Se cancela' : ETIQUETA_ESTADO[m.estado]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{m.accesoHasta ? fechaLarga(m.accesoHasta) : '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{fechaLarga(m.desde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion
        titulo="Cursos de V-AI-P"
        apoyo="Los marcados «Incluido en V-AI-P» en su ficha. Al publicar uno nuevo, sincroniza para dárselo a todos."
        accion={<SincronizarAccesos />}
      >
        <ul className="flex flex-col gap-2">
          {cursos.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/cursos/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-3 text-sm transition-colors hover:border-primary/50"
              >
                <span className="font-medium">{c.title}</span>
                <Badge variant="outline">{ETIQUETA_ESTADO_CURSO[c.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>

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
    </div>
  )
}
