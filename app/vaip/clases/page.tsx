import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  CalendarioSesiones,
  HeroSesion,
  ListaSesiones,
  SelectorVista,
  SesionesTerminadas,
  SinSesiones,
} from '@/components/alumno/en-vivo'
import { IndiceCurso } from '@/components/alumno/indice-curso'
import { RenderRico } from '@/components/alumno/render-rico'
import { Seccion, Tarjeta } from '@/components/ui-vadai/superficie'
import { EncabezadoVaip } from '@/components/vaip/espacio'
import { sesionesDelCurso } from '@/lib/alumno/sesiones'
import { estadoDe, proximaOActual } from '@/lib/calendario/estado'
import { hoyCdmx, mesDe, mesValido, partesCdmx } from '@/lib/calendario/mes'
import { publicacionesParaAlumno } from '@/lib/comunidad/posts'
import { contextoVaip } from '@/lib/membresia/espacio'

export const metadata: Metadata = { title: 'Clases · V-AI-P' }
export const dynamic = 'force-dynamic'

const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(new Date(iso))

/**
 * V-AI-P → Clases (M22): la próxima clase con «Entrar», el calendario, los
 * anuncios de la comunidad y las grabaciones con su material. Es lo que antes
 * vivía en la pestaña En vivo y el Contenido del «curso casa».
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

  const [sesiones, anuncios] = await Promise.all([
    casa ? sesionesDelCurso(casa.slug) : Promise.resolve([]),
    publicacionesParaAlumno('announcement'),
  ])
  const ahora = Date.now()
  const hoy = hoyCdmx(ahora)
  const actual = proximaOActual(sesiones, ahora)
  const vista = pedida === 'lista' ? 'lista' : 'calendario'
  const mes = mesValido(mesPedido) ?? mesDe(actual ? partesCdmx(actual.programadaEn).fecha : hoy)
  const proximas = sesiones.filter((s) => estadoDe(s.programadaEn, ahora) !== 'pasada')
  const primera = sesiones[0]
  const icsDeTodas = primera && proximas.length > 1 ? `/api/calendario/cohorte/${primera.cohorteId}` : undefined
  const deLaCasa = anuncios.filter((a) => a.cursoId !== null && a.cursoId === casa?.id).slice(0, 3)

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoVaip nombre={nombre} clase={actual} />

      {!casa ? (
        <p className="rounded-[10px] border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
          Las clases aparecen aquí en cuanto se agendan. Te avisamos por correo.
        </p>
      ) : (
        <>
          {sesiones.length === 0 ? (
            <SinSesiones />
          ) : actual ? (
            <HeroSesion sesion={actual} estado={estadoDe(actual.programadaEn, ahora)} hoy={hoy} icsDeTodas={icsDeTodas} />
          ) : (
            <SesionesTerminadas cursoSlug={casa.slug} conGrabacion={sesiones.filter((s) => s.grabacionLeccionId).length} />
          )}

          {deLaCasa.length > 0 ? (
            <Seccion titulo="Anuncios">
              <ul className="flex flex-col gap-3">
                {deLaCasa.map((a) => (
                  <li key={a.id} id={`anuncio-${a.id}`}>
                    <Tarjeta className="flex flex-col gap-2 p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-balance">{a.titulo}</p>
                        <span className="text-xs text-muted-foreground">{fechaCorta(a.publicadoEn)}</span>
                      </div>
                      {a.contenido ? (
                        <div className="text-sm text-muted-foreground">
                          <RenderRico contenido={a.contenido} />
                        </div>
                      ) : null}
                    </Tarjeta>
                  </li>
                ))}
              </ul>
            </Seccion>
          ) : null}

          {sesiones.length > 0 ? (
            <Seccion titulo="Todas las clases" accion={<SelectorVista base="/vaip/clases" vista={vista} />}>
              {vista === 'lista' ? (
                <ListaSesiones sesiones={sesiones} ahora={ahora} cursoSlug={casa.slug} />
              ) : (
                <CalendarioSesiones
                  sesiones={sesiones}
                  hoy={hoy}
                  ahora={ahora}
                  cursoSlug={casa.slug}
                  mes={mes}
                  base="/vaip/clases"
                />
              )}
            </Seccion>
          ) : null}

          {casa.modulos.length > 0 ? (
            <Seccion titulo="Grabaciones y material">
              <IndiceCurso curso={casa} />
            </Seccion>
          ) : null}
        </>
      )}
    </div>
  )
}
