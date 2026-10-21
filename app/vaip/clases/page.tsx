import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { CalendarioSesiones, HeroSesion, ListaSesiones, SelectorVista } from '@/components/alumno/en-vivo'
import { Seccion, Tarjeta } from '@/components/ui-vadai/superficie'
import { GrabacionesPorMes } from '@/components/vaip/contenido'
import { EncabezadoVaip } from '@/components/vaip/espacio'
import { sesionesDelCurso } from '@/lib/alumno/sesiones'
import { estadoDe, proximaOActual } from '@/lib/calendario/estado'
import { hoyCdmx, mesDe, mesValido, partesCdmx } from '@/lib/calendario/mes'
import { contextoVaip } from '@/lib/membresia/espacio'
import { grabacionesDeVaip } from '@/lib/vaip/contenido'
import { RUTA_CLASES } from '@/lib/vaip/rutas'

export const metadata: Metadata = { title: 'Clases · V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * V-AI-P → Clases (M22; por dentro desde M26, 21-oct-2026).
 *
 * Arriba la próxima clase con «Entrar»; luego las CLASES GRABADAS, un bloque
 * por mes —«Octubre 2026»— con el día de cada clase, que es como Alejandro
 * pidió que se navegaran; y al final el calendario. Ya no hay «Grabaciones y
 * material» con el índice de un curso: V-AI-P no es un curso.
 *
 * Solo para miembros (y el equipo): a cualquier otra persona la regresa a
 * /vaip, que le muestra la invitación. Sin `loading.tsx`, por ese redirect.
 */
export default async function ClasesVaip({ searchParams }: { searchParams: Promise<{ vista?: string; mes?: string }> }) {
  const ctx = await contextoVaip()
  if (!ctx) redirect('/vaip')
  const { perfil, casa } = ctx
  const nombre = perfil.full_name || perfil.email
  const { vista: pedida, mes: mesPedido } = await searchParams

  const [sesiones, meses] = await Promise.all([casa ? sesionesDelCurso(casa.slug) : Promise.resolve([]), grabacionesDeVaip(ctx)])
  const ahora = Date.now()
  const hoy = hoyCdmx(ahora)
  const actual = proximaOActual(sesiones, ahora)
  const vista = pedida === 'lista' ? 'lista' : 'calendario'
  const mes = mesValido(mesPedido) ?? mesDe(actual ? partesCdmx(actual.programadaEn).fecha : hoy)
  const proximas = sesiones.filter((s) => estadoDe(s.programadaEn, ahora) !== 'pasada')
  const primera = sesiones[0]
  const icsDeTodas = primera && proximas.length > 1 ? `/api/calendario/cohorte/${primera.cohorteId}` : undefined

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoVaip nombre={nombre} clase={actual} />

      {!casa ? (
        <p className="rounded-[10px] border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
          Las clases aparecen aquí en cuanto se agendan. Te avisamos por correo.
        </p>
      ) : (
        <>
          {actual ? (
            <HeroSesion sesion={actual} estado={estadoDe(actual.programadaEn, ahora)} hoy={hoy} icsDeTodas={icsDeTodas} />
          ) : (
            <Tarjeta className="border-dashed px-5 py-6 text-sm text-pretty text-muted-foreground">
              No hay clase agendada por ahora. En cuanto se agende la siguiente te llega por correo y aparece aquí.
            </Tarjeta>
          )}

          <Seccion titulo="Clases grabadas" apoyo="Cada clase se queda grabada con su material. Un bloque por mes.">
            {meses.length > 0 ? (
              <GrabacionesPorMes meses={meses} abierto={meses[0]?.id ?? null} />
            ) : (
              <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
                Aquí se queda cada clase grabada, con la fecha en que se dio, en cuanto el equipo la sube.
              </p>
            )}
          </Seccion>

          {sesiones.length > 0 ? (
            <Seccion titulo="Calendario" accion={<SelectorVista base={RUTA_CLASES} vista={vista} />}>
              {vista === 'lista' ? (
                <ListaSesiones sesiones={sesiones} ahora={ahora} cursoSlug={casa.slug} rutaGrabaciones={RUTA_CLASES} />
              ) : (
                <CalendarioSesiones
                  sesiones={sesiones}
                  hoy={hoy}
                  ahora={ahora}
                  cursoSlug={casa.slug}
                  mes={mes}
                  base={RUTA_CLASES}
                  rutaGrabaciones={RUTA_CLASES}
                />
              )}
            </Seccion>
          ) : null}
        </>
      )}
    </div>
  )
}
