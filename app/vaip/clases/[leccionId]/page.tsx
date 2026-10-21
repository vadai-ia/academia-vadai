import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AdjuntosAlumno } from '@/components/alumno/adjuntos-alumno'
import { CierreDeLeccion } from '@/components/alumno/cierre-de-leccion'
import { Comentarios } from '@/components/alumno/comentarios'
import { RenderRico } from '@/components/alumno/render-rico'
import { Reproductor } from '@/components/alumno/reproductor'
import { RenglonDeGrabacion } from '@/components/vaip/contenido'
import { contenidoDeLeccion } from '@/lib/alumno/consultas'
import { esEquipo } from '@/lib/auth/sesion'
import { firmarReproduccion, reproduccionConfigurada } from '@/lib/bunny/reproduccion'
import { comentariosDeLeccion } from '@/lib/comunidad/comentarios'
import { PUNTOS } from '@/lib/gamificacion/reglas'
import { contextoVaip } from '@/lib/membresia/espacio'
import { grabacionDeVaip } from '@/lib/vaip/contenido'
import { duracionCorta, fechaDeClase, RUTA_CLASES } from '@/lib/vaip/rutas'

/**
 * Una clase grabada de V-AI-P (M26, 21-oct-2026).
 *
 * Es la pantalla de una lección, pero de V-AI-P: arriba «← Clases» y la fecha
 * de la clase, no el título de un curso ni su barra de avance; a la derecha el
 * material y las demás clases de ESE mes; al final «Marcar como vista» con la
 * clase anterior y la siguiente por fecha, y la conversación. En el menú se
 * enciende V-AI-P, no «Mis cursos».
 *
 * NO lleva `loading.tsx`: los `redirect()` de abajo son control de acceso.
 */
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: { params: Promise<{ leccionId: string }> }): Promise<Metadata> {
  const { leccionId } = await params
  const leccion = UUID.test(leccionId) ? await contenidoDeLeccion(leccionId) : null
  return { title: leccion ? `${leccion.titulo} · V-AI-P` : 'Clase grabada · V-AI-P' }
}

export default async function GrabacionDeVaip({ params }: { params: Promise<{ leccionId: string }> }) {
  const ctx = await contextoVaip()
  if (!ctx) redirect('/vaip')
  const { leccionId } = await params
  if (!UUID.test(leccionId)) redirect(RUTA_CLASES)

  // Los comentarios se piden en paralelo: su policy exige acceso a la lección,
  // así que quien no deba verlos recibe cero filas.
  const [datos, comentarios] = await Promise.all([
    grabacionDeVaip(ctx, leccionId),
    comentariosDeLeccion(leccionId, ctx.perfil.user_id),
  ])
  if (!datos || !ctx.casa) redirect(RUTA_CLASES)

  const { leccion, mes, anterior, siguiente, fecha } = datos
  const casa = ctx.casa
  const reproduccion = leccion.bunnyVideoId && reproduccionConfigurada() ? firmarReproduccion(leccion.bunnyVideoId) : null
  const meta = [mes.titulo, duracionCorta(leccion.duracionSeg)].filter(Boolean).join(' · ')

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href={RUTA_CLASES}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 pointer-coarse:min-h-11 hover:text-foreground hover:underline"
        >
          <span aria-hidden>←</span> Clases
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-medium tracking-wider text-primary uppercase">{fechaDeClase(fecha)}</p>
          <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance sm:text-[1.75rem]">{leccion.titulo}</h1>
          {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
        </div>
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-x-10 lg:gap-y-8">
        <div className="order-1 lg:col-start-1">
          {reproduccion ? (
            <Reproductor
              urlIframe={reproduccion.urlIframe}
              leccionId={leccion.id}
              cursoSlug={casa.slug}
              duracionSeg={leccion.duracionSeg}
              yaCompletada={leccion.completada}
              titulo={leccion.titulo}
              className="-mx-5 sm:mx-0"
            />
          ) : (
            <p className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              El video no está disponible por un problema de configuración. Avísanos.
            </p>
          )}
        </div>

        <aside
          aria-label="Material y clases del mes"
          className="max-lg:contents lg:sticky lg:top-[calc(var(--alto-encabezado)+1rem)] lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:flex lg:max-h-[calc(100dvh-var(--alto-encabezado)-2rem)] lg:flex-col lg:gap-6 lg:self-start lg:overflow-y-auto"
        >
          <AdjuntosAlumno adjuntos={leccion.adjuntos} className="order-2 lg:order-none" />
          {mes.grabaciones.length > 1 ? (
            <nav aria-label={`Clases de ${mes.titulo}`} className="order-4 flex flex-col gap-2 lg:order-none" data-este-mes>
              <h2 className="text-sm font-medium">{mes.titulo}</h2>
              <ul className="flex flex-col gap-1.5">
                {mes.grabaciones.map((g) => (
                  <li key={g.id}>
                    <RenglonDeGrabacion g={g} activa={g.id === leccion.id} compacto />
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </aside>

        <div className="order-3 flex flex-col gap-8 lg:col-start-1">
          {leccion.descripcion ? <RenderRico contenido={leccion.descripcion} /> : null}
          <CierreDeLeccion
            leccionId={leccion.id}
            cursoSlug={casa.slug}
            completada={leccion.completada}
            esVideo={Boolean(reproduccion)}
            anterior={anterior}
            siguiente={siguiente}
            base={RUTA_CLASES}
            puntos={PUNTOS.grabacion}
            textos={{
              marcar: 'Marcar como vista',
              hecha: 'Vista',
              anterior: 'Clase anterior',
              siguiente: 'Clase siguiente',
              pie: `Suma ${PUNTOS.grabacion} puntos en el ranking de V-AI-P.`,
            }}
          />
        </div>

        <div className="order-5 lg:col-start-1">
          <Comentarios
            comentarios={comentarios}
            leccionId={leccion.id}
            cursoSlug={casa.slug}
            soyEquipo={esEquipo(ctx.perfil)}
            marcador="¿Tienes una duda sobre esta clase?"
          />
        </div>
      </div>
    </article>
  )
}
