import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AdjuntosAlumno } from '@/components/alumno/adjuntos-alumno'
import { BotonCompletada } from '@/components/alumno/boton-completada'
import { Comentarios } from '@/components/alumno/comentarios'
import { RenderRico } from '@/components/alumno/render-rico'
import { Reproductor } from '@/components/alumno/reproductor'
import { Button } from '@/components/ui/button'
import { contenidoDeLeccion } from '@/lib/alumno/consultas'
import { esEquipo } from '@/lib/auth/sesion'
import { firmarReproduccion, reproduccionConfigurada } from '@/lib/bunny/reproduccion'
import { comentariosDeLeccion } from '@/lib/comunidad/comentarios'
import { PUNTOS } from '@/lib/gamificacion/reglas'
import { contextoVaip } from '@/lib/membresia/espacio'
import { herramientaDeVaip } from '@/lib/vaip/contenido'
import { duracionCorta, etiquetaValida, RUTA_HERRAMIENTAS, rutaDeContenido } from '@/lib/vaip/rutas'
import { cn } from '@/lib/utils'

/**
 * Una herramienta de V-AI-P, como reel (M26, 21-oct-2026).
 *
 * El video manda: va primero y cabe completo en la pantalla —vertical (9:16)
 * toma el alto disponible; horizontal, 16:9 de borde a borde en el teléfono—.
 * «Anterior» y «Siguiente» son grandes y se quedan DENTRO de la etiqueta por
 * la que llegaste (`?etiqueta=rh`): quien está viendo las de RH sigue en RH.
 * En el teléfono van pegados abajo; en escritorio, junto al título. Se marca
 * «Vista» sola al 90 % (y a mano, por si el video no reporta su duración).
 *
 * NO lleva `loading.tsx`: los `redirect()` son control de acceso.
 */
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: { params: Promise<{ leccionId: string }> }): Promise<Metadata> {
  const { leccionId } = await params
  const leccion = UUID.test(leccionId) ? await contenidoDeLeccion(leccionId) : null
  return { title: leccion ? `${leccion.titulo} · V-AI-P` : 'Herramienta · V-AI-P' }
}

export default async function HerramientaDeVaip({
  params,
  searchParams,
}: {
  params: Promise<{ leccionId: string }>
  searchParams: Promise<{ etiqueta?: string }>
}) {
  const ctx = await contextoVaip()
  if (!ctx) redirect('/vaip')
  const [{ leccionId }, { etiqueta: pedida }] = await Promise.all([params, searchParams])
  if (!UUID.test(leccionId)) redirect(RUTA_HERRAMIENTAS)

  const [datos, comentarios] = await Promise.all([
    herramientaDeVaip(ctx, leccionId, etiquetaValida(pedida)),
    comentariosDeLeccion(leccionId, ctx.perfil.user_id),
  ])
  if (!datos || !ctx.casa) redirect(RUTA_HERRAMIENTAS)

  const { leccion, herramienta, etiqueta, anterior, siguiente, posicion, total } = datos
  const casa = ctx.casa
  const vertical = herramienta.orientacion === 'vertical'
  const reproduccion = leccion.bunnyVideoId && reproduccionConfigurada() ? firmarReproduccion(leccion.bunnyVideoId) : null
  const regreso = etiqueta ? `${RUTA_HERRAMIENTAS}?etiqueta=${etiqueta.slug}` : RUTA_HERRAMIENTAS
  const meta = [duracionCorta(leccion.duracionSeg), vertical ? 'Video vertical' : 'Video horizontal'].filter(Boolean).join(' · ')

  // «Anterior/Siguiente». En el teléfono va pegado abajo (último por `order`, con
  // `sticky`, sin JavaScript, como la barra de la venta); en escritorio, bajo el
  // título, a la vista sin desplazar.
  const navegacion =
    anterior || siguiente ? (
      <nav
        aria-label="Herramienta anterior y siguiente"
        data-barra-inferior
        className={cn(
          'sticky bottom-[var(--alto-barra-inferior,0px)] z-20 order-5 -mx-5 border-t border-border bg-background/95 px-5 pt-3 pb-seguro backdrop-blur-md',
          'lg:static lg:order-none lg:mx-0 lg:border-t-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          {anterior ? (
            <Button asChild variant="outline" size="lg" className="pointer-coarse:min-h-11">
              <Link href={rutaDeContenido('herramientas', anterior.id, etiqueta?.slug)} rel="prev">
                <span aria-hidden>←</span> Anterior
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-center text-sm text-muted-foreground tabular-nums">
            {posicion} de {total}
            {etiqueta ? <span className="hidden sm:inline lg:hidden"> · {etiqueta.nombre}</span> : null}
          </span>
          {siguiente ? (
            <Button asChild size="lg" className="pointer-coarse:min-h-11">
              <Link href={rutaDeContenido('herramientas', siguiente.id, etiqueta?.slug)} rel="next">
                Siguiente <span aria-hidden>→</span>
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </div>
      </nav>
    ) : null

  return (
    <article className="flex flex-col gap-5">
      <Link
        href={regreso}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 pointer-coarse:min-h-11 hover:text-foreground hover:underline"
      >
        <span aria-hidden>←</span> {etiqueta ? `Herramientas · ${etiqueta.nombre}` : 'Herramientas'}
      </Link>

      {/* Como reel, el video va primero y cabe completo en la pantalla. En el
          teléfono le siguen el título, el detalle, la conversación y, pegado
          abajo, «Anterior/Siguiente». En escritorio la columna derecha junta
          título, navegación y detalle; bajo `lg` esa columna no existe como
          caja (`max-lg:contents`) y sus piezas toman su lugar por `order`:
          nada se duplica en el DOM. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-10 lg:gap-y-8">
        <div className="order-1 lg:col-start-1 lg:row-start-1">
          {reproduccion ? (
            <Reproductor
              urlIframe={reproduccion.urlIframe}
              leccionId={leccion.id}
              cursoSlug={casa.slug}
              duracionSeg={leccion.duracionSeg}
              yaCompletada={leccion.completada}
              titulo={leccion.titulo}
              orientacion={herramienta.orientacion}
              className={vertical ? undefined : '-mx-5 sm:mx-0'}
            />
          ) : (
            <p className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              El video no está disponible por un problema de configuración. Avísanos.
            </p>
          )}
        </div>

        <div className="max-lg:contents lg:sticky lg:top-[calc(var(--alto-encabezado)+1rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
          <header className="order-2 flex min-w-0 flex-col gap-1 lg:order-none">
            {herramienta.etiquetas.length > 0 ? (
              <p className="text-xs font-medium tracking-wider text-primary uppercase">
                {herramienta.etiquetas.map((e) => e.nombre).join(' · ')}
              </p>
            ) : null}
            <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance sm:text-[1.75rem]">{leccion.titulo}</h1>
            <p className="text-sm text-muted-foreground">{meta}</p>
          </header>

          {navegacion}

          <div className="order-3 flex flex-col gap-5 lg:order-none">
            {leccion.descripcion ? <RenderRico contenido={leccion.descripcion} /> : null}
            <div className="flex flex-col gap-1.5">
              <BotonCompletada
                key={String(leccion.completada)}
                leccionId={leccion.id}
                cursoSlug={casa.slug}
                completadaInicial={leccion.completada}
                puntos={PUNTOS.herramienta}
                textos={{ marcar: 'Marcar como vista', hecha: 'Vista' }}
              />
              {leccion.completada ? null : (
                <p className="text-xs text-muted-foreground">
                  Se marca sola al llegar al 90 % del video. Suma {PUNTOS.herramienta} puntos en el ranking de V-AI-P.
                </p>
              )}
            </div>
            <AdjuntosAlumno adjuntos={leccion.adjuntos} />
          </div>
        </div>

        <div className="order-4 lg:col-start-1 lg:row-start-2">
          <Comentarios
            comentarios={comentarios}
            leccionId={leccion.id}
            cursoSlug={casa.slug}
            soyEquipo={esEquipo(ctx.perfil)}
            marcador="¿Tienes una duda sobre esta herramienta?"
          />
        </div>
      </div>
    </article>
  )
}
