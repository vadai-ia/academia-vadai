import type { Metadata } from 'next'
import Link from 'next/link'

import { CodigoQr } from '@/components/encuestas/codigo-qr'
import { moneda } from '@/components/membresias/precio'
import { Cifra, Seccion, Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { describirHorario } from '@/lib/calendario/enlaces'
import { planVaip } from '@/lib/membresia/consultas'
import { resumenDelPortal } from '@/lib/membresia/portal'
import { esCuentaQa } from '@/lib/qa'

export const metadata: Metadata = { title: 'V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * Resumen del portal de V-AI-P (M19): cómo va la comunidad hoy. Para todo el
 * equipo; las cifras de dinero, solo para admin.
 */
export default async function PaginaResumen() {
  const perfil = await exigirEquipo()
  const admin = esAdmin(perfil)
  const plan = await planVaip()
  if (!plan) {
    return <p className="text-sm text-muted-foreground">El plan V-AI-P no está a la venta.</p>
  }
  const r = await resumenDelPortal(plan, { conCobros: admin, veQa: esCuentaQa(perfil.email) })
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  const pagina = `${base}/vaip`

  return (
    <div className="flex flex-col gap-10">
      {!plan.abierto ? (
        <Tarjeta className="flex flex-col gap-1 border-dashed p-5 text-sm">
          <p className="font-medium">La suscripción todavía no abre.</p>
          <p className="text-pretty text-muted-foreground">
            {admin ? (
              <>
                Falta lo que dice{' '}
                <Link href="/admin/vaip/cobros" className="font-medium text-primary hover:underline">
                  Cobros
                </Link>
                : publicar el plan en Stripe y el curso V-AI-P.
              </>
            ) : (
              'Cuando el equipo la abra, aquí verás a los miembros.'
            )}
          </p>
        </Tarjeta>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra valor={String(r.vigentes)} etiqueta="Miembros con acceso" destacada />
        <Cifra valor={String(r.nuevosEsteMes)} etiqueta="Nuevos este mes" />
        <Cifra valor={String(r.vencieronEsteMes)} etiqueta="Salieron este mes" detalle="Se les venció el acceso" />
        <Cifra
          valor={r.sinRespuesta === null ? '—' : String(r.sinRespuesta)}
          etiqueta="En el muro, sin respuesta"
          detalle="Hilos que esperan al equipo"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Seccion titulo={r.proxima?.tipo === 'evento' ? 'Próximo evento' : 'Próxima clase'}>
          <Tarjeta className="flex flex-col gap-2 p-5">
            {r.proxima ? (
              <>
                <p className="font-medium text-balance">{r.proxima.titulo}</p>
                <p className="text-sm text-muted-foreground">
                  {describirHorario(r.proxima.programadaEn)}
                  {r.proxima.lugar ? ` · ${r.proxima.lugar}` : ''}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay nada agendado.</p>
            )}
            <Link href="/admin/vaip/clases" className="w-fit text-sm font-medium text-primary hover:underline">
              Clases y eventos
            </Link>
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Atender">
          <Tarjeta className="flex flex-col gap-3 p-5 text-sm">
            <p className="text-pretty text-muted-foreground">
              {r.sinRespuesta
                ? `${r.sinRespuesta} ${r.sinRespuesta === 1 ? 'hilo espera' : 'hilos esperan'} respuesta en el muro de V-AI-P.`
                : 'El muro de V-AI-P está al día.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/vaip/muro">Ir al muro</Link>
              </Button>
              {plan.casa ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/curso/${plan.casa.slug}/comunidad?tema=noticias`}>Publicar una noticia</Link>
                </Button>
              ) : null}
            </div>
          </Tarjeta>
        </Seccion>
      </div>

      {r.cobros ? (
        <Seccion titulo="Cobros" apoyo="Solo lo ve un admin.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cifra valor={moneda(r.cobros.cobradoEsteMes)} etiqueta="Cobrado este mes" />
            <Cifra valor={String(r.cobros.seCancelan)} etiqueta="Cancelaron la renovación" detalle="Siguen dentro hasta su fecha" />
            <Cifra valor={String(r.cobros.atrasados)} etiqueta="Con pago pendiente" />
            <Cifra valor={String(r.cobros.alertas)} etiqueta="Alertas" detalle={r.cobros.alertas ? 'Revísalas en Cobros' : 'Ninguna'} />
          </div>
        </Seccion>
      ) : null}

      <Seccion titulo="Para invitar" apoyo="La página de V-AI-P: venta para quien no es miembro, su espacio para quien sí.">
        <Tarjeta className="flex items-center gap-4 p-5">
          <CodigoQr texto={pagina} tamano={112} className="shrink-0 border border-border" />
          <div className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="font-mono text-xs break-all">{pagina}</span>
            <Link href="/vaip" className="w-fit font-medium text-primary hover:underline">
              Abrir la página
            </Link>
          </div>
        </Tarjeta>
      </Seccion>
    </div>
  )
}
