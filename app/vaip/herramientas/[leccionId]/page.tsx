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
 * El video manda: vertical (9:16) toma el alto de la pantalla; horizontal,
 * 16:9 de borde a borde en el teléfono. «Anterior» y «Siguiente» son grandes y
 * se quedan DENTRO de la etiqueta por la que llegaste (`?etiqueta=rh`): quien
 * está viendo las de RH sigue en RH. En el teléfono van fijos abajo, con
 * `sticky` y no con JavaScript, como la barra de la venta; en escritorio,
 * bajo el video. Se marca «Vista» sola al 90 % (y a mano, por si el video no
 * reporta su duración).
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

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <Link
          href={regreso}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 pointer-coarse:min-h-11 hover:text-foreground hover:underline"
        >
          <span aria-hidden>←</span> {etiqueta ? `Herramientas · ${etiqueta.nombre}` : 'Herramientas'}
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          {herramienta.etiquetas.length > 0 ? (
            <p className="text-xs font-medium tracking-wider text-primary uppercase">
              {herramienta.etiquetas.map((e) => e.nombre).join(' · ')}
            </p>
          ) : null}
          <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance sm:text-[1.75rem]">{leccion.titulo}</h1>
          <p className="text-sm text-muted-foreground">{meta}</p>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-10">
        {/* 1 · El video. */}
        <div className="lg:col-start-1 lg:row-start-1">
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

        {/* 2 · Qué es y para qué: a la derecha en escritorio. */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-[calc(var(--alto-encabezado)+1rem)] lg:col-start-2 lg:row-span-3 lg:row-start-1">
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

        {/* 4 · La conversación. */}
        <div className="lg:col-start-1 lg:row-start-3">
          <Comentarios comentarios={comentarios} leccionId={leccion.id} cursoSlug={casa.slug} soyEquipo={esEquipo(ctx.perfil)} />
        </div>

        {/* 3 · Anterior y siguiente: último en el DOM para que en el teléfono
            se quede pegado abajo mientras se lee todo lo de arriba. */}
        {anterior || siguiente ? (
          <nav
            aria-label="Herramienta anterior y siguiente"
            data-barra-inferior
            className={cn(
              'sticky bottom-0 z-20 -mx-5 border-t border-border bg-background/95 px-5 pt-3 pb-seguro backdrop-blur-md',
              'lg:static lg:col-start-1 lg:row-start-2 lg:mx-0 lg:border-t-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none'
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
                {etiqueta ? <span className="hidden sm:inline"> · {etiqueta.nombre}</span> : null}
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
        ) : null}
      </div>
    </article>
  )
}
