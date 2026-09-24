import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import {
  CalendarioSesiones,
  HeroSesion,
  ListaSesiones,
  SelectorVista,
  SesionesTerminadas,
  SinSesiones,
} from '@/components/alumno/en-vivo'
import { Seccion } from '@/components/ui-vadai/superficie'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { sesionesDelCurso } from '@/lib/alumno/sesiones'
import { exigirPerfil } from '@/lib/auth/sesion'
import { estadoDe, proximaOActual } from '@/lib/calendario/estado'
import { hoyCdmx, mesDe, mesValido, partesCdmx } from '@/lib/calendario/mes'

/**
 * La pestaña "En vivo" de un curso.
 *
 * NO lleva `loading.tsx`: abajo hay un `redirect()` para el acceso vencido y un
 * límite de Suspense haría que la respuesta saliera 200 con el esqueleto.
 * Ver components/marca/esqueleto.tsx.
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const curso = await cursoDelAlumno(slug)
  return { title: curso ? `En vivo · ${curso.titulo}` : 'En vivo' }
}

export default async function PaginaEnVivo({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ vista?: string; mes?: string }>
}) {
  await exigirPerfil()
  const { slug } = await params
  const { vista: pedida, mes: mesPedido } = await searchParams

  const [curso, sesiones] = await Promise.all([cursoDelAlumno(slug), sesionesDelCurso(slug)])
  if (!curso) notFound()

  const base = `/curso/${curso.slug}`
  // Con el acceso vencido no hay liga que enseñar: la pestaña ya sale apagada,
  // y quien llegue por la URL directa vuelve al curso.
  if (!curso.vigente) redirect(base)

  const vista = pedida === 'lista' ? 'lista' : 'calendario'
  const ahora = Date.now()
  const hoy = hoyCdmx(ahora)
  const actual = proximaOActual(sesiones, ahora)

  // Todas comparten cohorte salvo que alguien del equipo esté en dos: el .ics
  // de "todas" solo tiene sentido cuando hay una sola.
  const cohortes = new Set(sesiones.map((s) => s.cohorteId))
  const proximas = sesiones.filter((s) => estadoDe(s.programadaEn, ahora) !== 'pasada')
  // Qué mes se abre: el que pidan, o el de la sesión que toca. Abrir en el mes
  // de hoy sería peor cuando el curso empieza el mes que viene: se vería un mes
  // vacío y habría que adivinar hacia dónde avanzar.
  const mes =
    mesValido(mesPedido) ?? mesDe(actual ? partesCdmx(actual.programadaEn).fecha : hoy)

  const primera = sesiones[0]
  const ultima = sesiones[sesiones.length - 1]

  const icsDeTodas =
    primera && cohortes.size === 1 && proximas.length > 1
      ? `/api/calendario/cohorte/${primera.cohorteId}`
      : undefined

  const apoyo =
    primera && ultima
      ? `${sesiones.length} sesion${sesiones.length === 1 ? '' : 'es'} · del ${partesCdmx(primera.programadaEn).diaNumero} de ${partesCdmx(primera.programadaEn).mesLargo} al ${partesCdmx(ultima.programadaEn).diaNumero} de ${partesCdmx(ultima.programadaEn).mesLargo}`
      : undefined

  return (
    <div className="flex flex-col gap-8">
      {sesiones.length === 0 ? (
        <SinSesiones />
      ) : actual ? (
        <HeroSesion
          sesion={actual}
          estado={estadoDe(actual.programadaEn, ahora)}
          hoy={hoy}
          icsDeTodas={icsDeTodas}
        />
      ) : (
        <SesionesTerminadas
          cursoSlug={curso.slug}
          conGrabacion={sesiones.filter((s) => s.grabacionLeccionId).length}
        />
      )}

      {sesiones.length > 0 ? (
        <Seccion
          titulo="Todas las sesiones"
          apoyo={apoyo}
          accion={<SelectorVista base={`${base}/en-vivo`} vista={vista} />}
        >
          {vista === 'lista' ? (
            <ListaSesiones sesiones={sesiones} ahora={ahora} cursoSlug={curso.slug} />
          ) : (
            <CalendarioSesiones
              sesiones={sesiones}
              hoy={hoy}
              ahora={ahora}
              cursoSlug={curso.slug}
              mes={mes}
              base={`${base}/en-vivo`}
            />
          )}
        </Seccion>
      ) : null}
    </div>
  )
}
