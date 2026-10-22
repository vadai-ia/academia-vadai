import Image from 'next/image'
import Link from 'next/link'

import { ResumenDeReacciones } from '@/components/alumno/reacciones'
import { Avatar } from '@/components/ui-vadai/superficie'
import { textoPlano } from '@/lib/comunidad/documento'
import { ligaEnVaip } from '@/lib/comunidad/ligas'
import type { PostDeComunidad } from '@/lib/comunidad/posts'
import type { RankingVaip } from '@/lib/membresia/espacio'
import { cn } from '@/lib/utils'

/**
 * Las noticias de V-AI-P como revista (22-oct-2026).
 *
 * Alejandro: «que el lector pueda paginar y navegar fácilmente las noticias,
 * leer de qué trata con puras imágenes, luego entrar a cada noticia… o navegar
 * directo a la noticia web». Y al verlas en su teléfono: «el título y la
 * imagen dicen literalmente lo mismo». La imagen ya trae el título dibujado
 * (lib/noticias/imagen.tsx), así que la tarjeta no lo repite: debajo van el
 * resumen como subtítulo y el arranque de nuestro análisis. El título sigue en
 * el texto accesible de la liga, para quien no ve la imagen.
 *
 * Dos salidas por tarjeta: toda la tarjeta abre nuestra página de la noticia,
 * y el medio («releasebot.io ↗») abre la nota original.
 */

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
}

/** El primer párrafo de nuestro análisis que no sea el resumen mismo. */
function arranque(post: PostDeComunidad): string {
  const resumen = (post.noticia?.resumen ?? '').trim()
  const parrafos = textoPlano(post.contenido)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && p !== resumen && !/^Fuente:/i.test(p))
  return parrafos[0] ?? ''
}

/** El medio, que lleva a la nota original. Encima de la liga de la tarjeta. */
function AlMedio({ post, className }: { post: PostDeComunidad; className?: string }) {
  const url = post.noticia?.url
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn(
        'relative z-10 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground transition-colors pointer-coarse:min-h-11',
        'hover:bg-muted hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className
      )}
    >
      <span className="max-w-40 truncate">{post.noticia?.medio || 'Nota original'}</span>
      <span aria-hidden>↗</span>
      <span className="sr-only"> (abre la nota original)</span>
    </a>
  )
}

/**
 * Una noticia en la lista. `destacada`: la primera de cada página, a todo lo
 * ancho y con más texto.
 */
export function TarjetaNoticia({ post, destacada = false }: { post: PostDeComunidad; destacada?: boolean }) {
  const imagen = post.imagenes[0] ?? null
  const resumen = (post.noticia?.resumen ?? '').trim()
  const analisis = arranque(post)
  const respuestas = post.comentarios.length

  return (
    <li className={cn(destacada && 'sm:col-span-2 lg:col-span-3')}>
      <article
        className={cn(
          'group relative flex h-full flex-col overflow-hidden rounded-[14px] border border-border bg-card transition-[border-color,box-shadow]',
          'hover:border-primary/40 hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.06)]',
          destacada && 'lg:flex-row'
        )}
      >
        {imagen ? (
          <Image
            src={imagen.url}
            alt=""
            width={1200}
            height={675}
            unoptimized
            className={cn(
              'aspect-video h-auto w-full border-b border-border object-cover',
              destacada && 'lg:w-3/5 lg:border-r lg:border-b-0'
            )}
          />
        ) : null}
        <div className={cn('flex flex-1 flex-col gap-2 p-4 sm:p-5', destacada && 'lg:justify-center lg:p-8')}>
          <span className="text-[0.8125rem] text-muted-foreground">{fecha(post.creadoEn)}</span>
          {/* Sin imagen, el título sí se ve: no hay dónde más leerlo. */}
          <h3 className={cn(imagen ? 'sr-only' : 'text-[1.0625rem] leading-snug font-medium text-pretty')}>
            <Link
              href={ligaEnVaip(post.id, true)}
              className="after:absolute after:inset-0 after:rounded-[14px] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {post.titulo}
            </Link>
          </h3>
          {resumen ? (
            <p
              className={cn(
                'font-medium text-pretty group-hover:text-primary',
                destacada ? 'text-[1.1875rem] leading-snug sm:text-[1.3125rem]' : 'line-clamp-3 text-[1.0625rem] leading-snug'
              )}
            >
              {resumen}
            </p>
          ) : null}
          {analisis ? (
            <p
              className={cn(
                'text-[0.95rem] leading-relaxed text-muted-foreground',
                destacada ? 'line-clamp-4' : 'line-clamp-3'
              )}
            >
              {analisis}
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <span className="flex items-center gap-3 text-sm">
              <span className="font-medium text-primary">
                Leer <span aria-hidden>→</span>
              </span>
              <ResumenDeReacciones datos={post.reacciones} />
              {respuestas > 0 ? (
                <span className="text-muted-foreground">
                  {respuestas} respuesta{respuestas === 1 ? '' : 's'}
                </span>
              ) : null}
            </span>
            <AlMedio post={post} className="-mr-2" />
          </div>
        </div>
      </article>
    </li>
  )
}

/** Varias noticias en rejilla: una columna en el teléfono, tres en escritorio. */
export function RejillaDeNoticias({ posts, conDestacada = false }: { posts: PostDeComunidad[]; conDestacada?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p, i) => (
        <TarjetaNoticia key={p.id} post={p} destacada={conDestacada && i === 0} />
      ))}
    </ul>
  )
}

/**
 * Las noticias en el muro, como carrusel lateral (22-oct-2026, Alejandro: «lo
 * primero que se ve son las noticias… mejor algo más mixto, un comprimido de
 * noticias como en carrusel lateral pero más abajo»). Tarjetas angostas con la
 * imagen y el resumen; se deslizan con el dedo y la última lleva a la pestaña.
 */
export function CarruselDeNoticias({ posts }: { posts: PostDeComunidad[] }) {
  if (posts.length === 0) return null
  return (
    <section aria-labelledby="noticias-del-muro" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="noticias-del-muro" className="text-lg font-medium tracking-tight">
          Noticias de IA
        </h2>
        <Link href="/vaip/noticias" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Ver todas
        </Link>
      </div>
      <div className="relative -mx-5 snap-x snap-mandatory scroll-px-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-3">
          {posts.map((p) => {
            const imagen = p.imagenes[0] ?? null
            return (
              <li key={p.id} className="w-[17rem] shrink-0 snap-start">
                <Link
                  href={ligaEnVaip(p.id, true)}
                  className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-border bg-card transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {imagen ? (
                    <Image
                      src={imagen.url}
                      alt=""
                      width={640}
                      height={360}
                      unoptimized
                      className="aspect-video h-auto w-full border-b border-border object-cover"
                    />
                  ) : null}
                  <span className="flex flex-1 flex-col gap-1 p-3.5">
                    <span className="text-[0.8125rem] text-muted-foreground">
                      {p.noticia?.medio ? `${p.noticia.medio} · ` : ''}
                      {fecha(p.creadoEn)}
                    </span>
                    <span className={cn('line-clamp-3 text-[0.95rem] leading-snug font-medium group-hover:text-primary', imagen && 'sr-only')}>
                      {p.titulo}
                    </span>
                    {imagen ? (
                      <span aria-hidden className="line-clamp-3 text-[0.95rem] leading-snug font-medium group-hover:text-primary">
                        {p.noticia?.resumen || p.titulo}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            )
          })}
          <li className="w-36 shrink-0 snap-start">
            <Link
              href="/vaip/noticias"
              className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-border text-sm font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <span aria-hidden className="text-xl">
                →
              </span>
              Todas las noticias
            </Link>
          </li>
        </ul>
      </div>
    </section>
  )
}

/**
 * El ranking en el muro: los tres primeros y tu lugar, con la liga a la
 * pestaña. Sin actividad todavía no se pinta.
 */
export function RankingBreve({ ranking }: { ranking: RankingVaip }) {
  const top = ranking.puestos.filter((p) => p.puntos > 0).slice(0, 3)
  if (top.length === 0) return null
  const yo = ranking.yo && !top.some((p) => p.soyYo) && ranking.yo.puntos > 0 ? ranking.yo : null

  return (
    <section aria-labelledby="ranking-del-muro" className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="ranking-del-muro" className="text-lg font-medium tracking-tight">
          Ranking de la comunidad
        </h2>
        <Link href="/vaip/ranking" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Ver ranking
        </Link>
      </div>
      <ol className="flex flex-col gap-1">
        {[...top, ...(yo ? [yo] : [])].map((p) => (
          <li key={p.userId}>
            <Link
              href={`/vaip/miembros/${p.userId}`}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors pointer-coarse:min-h-11 hover:bg-muted',
                p.soyYo && 'bg-primary/10'
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums',
                  p.lugar === 1 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {p.lugar}
              </span>
              <Avatar nombre={p.nombre} foto={p.foto} tamano={30} />
              <span className="min-w-0 flex-1 truncate text-[0.95rem]">
                {p.nombre}
                {p.soyYo ? <span className="text-muted-foreground"> (tú)</span> : null}
              </span>
              <span className="text-sm font-medium tabular-nums">{p.puntos} pts</span>
            </Link>
          </li>
        ))}
      </ol>
      {ranking.yo && ranking.yo.puntos === 0 ? (
        <p className="text-sm text-muted-foreground">Publica, comenta o ve una clase grabada y entras al ranking.</p>
      ) : null}
    </section>
  )
}
