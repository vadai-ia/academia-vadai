import Image from 'next/image'
import Link from 'next/link'

import { ResumenDeReacciones } from '@/components/alumno/reacciones'
import { textoPlano } from '@/lib/comunidad/documento'
import { ligaEnVaip } from '@/lib/comunidad/ligas'
import type { PostDeComunidad } from '@/lib/comunidad/posts'
import { cn } from '@/lib/utils'

/**
 * Las noticias de V-AI-P como revista (22-oct-2026).
 *
 * Alejandro: «que el lector pueda paginar y navegar fácilmente las noticias,
 * leer de qué trata con puras imágenes, luego entrar a cada noticia y ahí sí
 * leer a profundidad… o navegar directo a la noticia web». Cada tarjeta es la
 * imagen, el medio y la fecha, el título y una línea; toda la tarjeta abre la
 * noticia, donde están nuestro análisis, «Leer la nota original» y la
 * conversación.
 */

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
}

function Medio({ post }: { post: PostDeComunidad }) {
  return (
    <span className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
      {post.noticia?.medio ? <span className="font-medium text-primary">{post.noticia.medio}</span> : null}
      {post.noticia?.medio ? <span aria-hidden>·</span> : null}
      <span>{fecha(post.creadoEn)}</span>
    </span>
  )
}

function Conteos({ post }: { post: PostDeComunidad }) {
  const n = post.comentarios.length
  if (post.reacciones.total === 0 && n === 0) return null
  return (
    <span className="mt-auto flex items-center gap-3 pt-1 text-sm text-muted-foreground">
      <ResumenDeReacciones datos={post.reacciones} />
      {n > 0 ? (
        <span>
          {n} respuesta{n === 1 ? '' : 's'}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Una noticia en la lista. `destacada`: la primera de la primera página, a
 * todo lo ancho y con el resumen en dos líneas más.
 */
export function TarjetaNoticia({ post, destacada = false }: { post: PostDeComunidad; destacada?: boolean }) {
  const imagen = post.imagenes[0] ?? null
  const resumen = (post.noticia?.resumen || textoPlano(post.contenido)).trim()

  return (
    <li className={cn(destacada && 'sm:col-span-2 lg:col-span-3')}>
      <Link
        href={ligaEnVaip(post.id, true)}
        className={cn(
          'group flex h-full flex-col overflow-hidden rounded-[14px] border border-border bg-card transition-[border-color,box-shadow]',
          'hover:border-primary/40 hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.06)]',
          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
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
        <span className={cn('flex flex-1 flex-col gap-2 p-4 sm:p-5', destacada && 'lg:justify-center lg:p-8')}>
          <Medio post={post} />
          <span
            className={cn(
              'font-medium text-pretty group-hover:text-primary',
              destacada ? 'text-[1.375rem] leading-tight sm:text-[1.625rem]' : 'line-clamp-3 text-[1.0625rem] leading-snug'
            )}
          >
            {post.titulo}
          </span>
          {resumen ? (
            <span
              className={cn(
                'text-[0.95rem] leading-relaxed text-muted-foreground',
                destacada ? 'line-clamp-4' : 'line-clamp-2'
              )}
            >
              {resumen}
            </span>
          ) : null}
          <Conteos post={post} />
        </span>
      </Link>
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
