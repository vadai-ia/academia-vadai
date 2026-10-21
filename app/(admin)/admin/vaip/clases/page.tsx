import type { Metadata } from 'next'
import Link from 'next/link'

import { CalendarioDeGeneracion } from '@/components/admin/calendario-de-generacion'
import { SubirGrabacion } from '@/components/admin/subir-grabacion'
import { Seccion, Titulo } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { generacionesDelCurso, leccionesLigables } from '@/lib/admin/generaciones'
import { exigirEquipo } from '@/lib/auth/sesion'
import { hoyCdmx } from '@/lib/calendario/mes'
import { generacionPorOmision } from '@/lib/generaciones'
import { casaDelPanel, clasesSinGrabacion, grabacionesDelPanel, type EstadoDeContenido } from '@/lib/vaip/admin'
import { duracionCorta, fechaDeClase, PANEL_CLASES, partesDeFecha } from '@/lib/vaip/rutas'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Clases · V-AI-P' }
export const dynamic = 'force-dynamic'

const ESTADO: Record<EstadoDeContenido, { texto: string; clase: string }> = {
  publicada: { texto: 'Publicada', clase: 'border-exito/40 bg-exito/10 text-exito' },
  borrador: { texto: 'Borrador', clase: 'border-border text-muted-foreground' },
  sinVideo: { texto: 'Sin video', clase: 'border-destructive/40 bg-destructive/10 text-destructive' },
}

/**
 * Las clases de V-AI-P (M19; por dentro desde M26, 21-oct-2026).
 *
 * Alejandro: las grabaciones «se puedan subir fácilmente por módulo mensual y
 * en cada mes subir las grabaciones y en esa grabación ponerle el día». Así
 * que aquí ya no hay árbol de un curso ni «Datos de la casa»: hay un botón,
 * «Subir grabación», que pide la clase (o el día) y crea el mes solo; la
 * lista de grabaciones por mes; y el calendario, donde cada clase que ya pasó
 * sin grabación tiene su propio «Subir grabación».
 *
 * Admin y community manager suben y publican; borrar es de admin.
 */
export default async function PaginaClases({
  searchParams,
}: {
  searchParams: Promise<{ sesion?: string; subir?: string }>
}) {
  const perfil = await exigirEquipo()
  const { sesion, subir } = await searchParams
  const lugar = await casaDelPanel()

  if (!lugar) {
    return (
      <div className="flex flex-col gap-6">
        <Titulo ceja="V-AI-P">Clases</Titulo>
        <p className="text-sm text-muted-foreground">V-AI-P todavía no tiene casa: crea el plan en Planes y cobros.</p>
      </div>
    )
  }

  const generaciones = await generacionesDelCurso(lugar.casa.id)
  const generacion = generaciones.find((g) => g.id === lugar.generacionId) ?? generacionPorOmision(generaciones)
  const [meses, paraSubir, ligables] = generacion
    ? await Promise.all([
        grabacionesDelPanel(lugar.casa.id, generacion.id),
        clasesSinGrabacion(generacion.id),
        leccionesLigables(lugar.casa.id, generacion.id, { soloGrabaciones: true }),
      ])
    : [[], [], []]
  const total = meses.reduce((n, m) => n + m.grabaciones.length, 0)
  const anioActual = Number(hoyCdmx(Date.now()).slice(0, 4))

  return (
    <div className="flex flex-col gap-10">
      <Titulo
        ceja="V-AI-P"
        apoyo="Las clases en vivo y sus grabaciones. Cada grabación queda en su mes, con el día de la clase."
      >
        Clases
      </Titulo>

      {generacion ? (
        <>
          <SubirGrabacion clases={paraSubir} hoy={hoyCdmx(Date.now())} elegida={subir && /^[0-9a-f-]{36}$/i.test(subir) ? subir : null} />

          <Seccion
            titulo="Grabaciones"
            apoyo={
              total > 0
                ? `${total} ${total === 1 ? 'grabación' : 'grabaciones'}. Una sin video o en borrador no la ven los miembros.`
                : undefined
            }
          >
            {meses.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Todavía no hay grabaciones. Usa «Subir grabación» después de cada clase.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {meses.map((m, i) => (
                  <details
                    key={m.id}
                    open={i === 0 || undefined}
                    className="group/mes rounded-[10px] border border-border bg-card"
                    data-mes={m.mes.slice(0, 7)}
                  >
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
                      <span className="font-medium">{m.titulo}</span>
                      <span className="text-sm text-muted-foreground">
                        {m.grabaciones.length} {m.grabaciones.length === 1 ? 'grabación' : 'grabaciones'}
                      </span>
                    </summary>
                    <ul className="flex flex-col divide-y divide-border border-t border-border">
                      {m.grabaciones.map((g) => {
                        const p = partesDeFecha(g.fecha)
                        return (
                          <li key={g.id}>
                            <Link
                              href={`${PANEL_CLASES}/${g.id}`}
                              data-grabacion={g.id}
                              className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/60"
                            >
                              <span
                                aria-hidden
                                className="flex size-12 shrink-0 flex-col items-center justify-center rounded-[10px] border border-primary/25 bg-primary/10 text-primary"
                              >
                                <span className="text-[0.6rem] font-medium uppercase">{p.mesCorto}</span>
                                <span className="text-lg leading-none font-semibold tabular-nums">{p.dia}</span>
                                <span className="text-[0.6rem] text-muted-foreground">{p.diaDeLaSemana.slice(0, 3)}</span>
                              </span>
                              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="font-medium text-pretty">{g.titulo}</span>
                                <span className="text-sm text-muted-foreground">
                                  {[fechaDeClase(g.fecha, anioActual), duracionCorta(g.duracionSeg), g.clase ? 'Ligada a su clase' : null]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </span>
                              <Badge variant="outline" className={cn('shrink-0', ESTADO[g.estado].clase)}>
                                {ESTADO[g.estado].texto}
                              </Badge>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </Seccion>

          <Seccion titulo="Calendario" apoyo="Agendar una clase manda las fechas por correo a los miembros y la pone en su campana. Los avisos que no son clase van fijados en el Muro.">
            <CalendarioDeGeneracion
              generacion={generacion}
              ligables={ligables}
              correoAdmin={perfil.email}
              compacto
              sesionAbierta={sesion ?? null}
              prefijo="?"
              deVaip
              esCasa
              rutaGrabaciones={PANEL_CLASES}
            />
          </Seccion>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">La casa de V-AI-P no tiene generación.</p>
      )}
    </div>
  )
}
