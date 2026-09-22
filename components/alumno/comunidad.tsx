'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Reacciones } from '@/components/alumno/reacciones'
import { AutoEnviar } from '@/components/ui-vadai/auto-enviar'
import { RenderRico } from '@/components/alumno/render-rico'
import { Avatar } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  comentarEnPost,
  eliminarComoEquipo,
  eliminarPostPropio,
  fijarPost,
  moderarPost,
  publicarEnComunidad,
} from '@/lib/comunidad/acciones-posts'
import type { ComentarioDePost, PostDeComunidad } from '@/lib/comunidad/posts'
import { cn } from '@/lib/utils'

/**
 * Feed de comunidad (§3.8).
 *
 * UNA PUBLICACIÓN Y UNA RESPUESTA NO SE VEN IGUAL (21-sep-2026). Antes sí, y
 * Alejandro lo dijo mirando el feed: "no se ve como un comentario y un
 * subcomentario". La publicación es una tarjeta con su avatar grande y su
 * título; las respuestas cuelgan de ella, con sangría, línea al costado, fondo
 * distinto y avatar chico. La jerarquía se lee sin leer.
 *
 * LAS RESPUESTAS SE PLIEGAN. Con tres o más vienen cerradas tras "Ver N
 * respuestas": en un hilo largo, tener que pasar veinte comentarios para llegar
 * a la siguiente publicación es justo lo que cansa. Con una o dos se quedan
 * abiertas, porque esconderlas sería esconder la conversación entera.
 *
 * Lo oculto por moderación no llega hasta aquí — lo filtra RLS. Este componente
 * no tiene lógica de visibilidad, y eso es deliberado.
 *
 * Todo lo que se abre y se cierra son <details>, y las acciones van directas al
 * <form>. Un onClick o un closure alrededor de la acción dejarían la comunidad
 * inservible sin JavaScript: React solo emite el $ACTION_ID cuando la acción
 * llega sin envolver. El reset de los campos lo da `key`, desde el servidor.
 */

/** Con tres o más, el hilo viene plegado. */
const PLIEGA_DESDE = 3

/** El <summary> se disfraza de botón; el triángulo nativo estorba. */
const claseResumen =
  'inline-flex w-fit cursor-pointer list-none items-center rounded-md border border-border ' +
  'px-3 py-1.5 text-sm font-medium transition-colors select-none hover:bg-accent ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ' +
  '[&::-webkit-details-marker]:hidden'

function fechaCorta(iso: string): string {
  // Zona fija: el servidor pinta en UTC y el navegador en la suya; si no
  // coinciden, React 418 tira la página entera (21-sep-2026).
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function Boton({ etiqueta, pendienteEtiqueta, size = 'default' }: {
  etiqueta: string
  pendienteEtiqueta: string
  size?: 'default' | 'sm'
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size={size} disabled={pending}>
      {pending ? pendienteEtiqueta : etiqueta}
    </Button>
  )
}

/**
 * Borrar de verdad, detrás de una confirmación.
 *
 * Ocultar es un clic porque se deshace; borrar no se deshace, así que pide
 * decirlo dos veces. Es un `<details>`, no un `confirm()` ni un modal de
 * React: funciona con el JavaScript apagado.
 */
function BorrarConAviso({
  id,
  tipo,
  ruta,
  que,
}: {
  id: string
  tipo: 'post' | 'comentario'
  ruta: string
  que: string
}) {
  return (
    <details className="inline-block">
      <summary className="inline-flex cursor-pointer list-none items-center px-2 py-1 text-xs text-destructive underline-offset-2 select-none hover:underline [&::-webkit-details-marker]:hidden">
        eliminar
      </summary>
      <form
        action={eliminarComoEquipo}
        className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="ruta" value={ruta} />
        <span className="text-xs text-muted-foreground">
          {que} No se puede deshacer. Si solo estorba, usa ocultar.
        </span>
        <Button type="submit" variant="destructive" size="sm">
          Sí, eliminar
        </Button>
      </form>
    </details>
  )
}

function NuevaPublicacion({
  cursoId,
  cursoSlug,
  ruta,
}: {
  cursoId: string
  cursoSlug: string
  ruta: string
}) {
  const [estado, accion] = useActionState(publicarEnComunidad, {})

  return (
    <details>
      <summary className={claseResumen}>Escribir una publicación</summary>

      <form action={accion} className="mt-3 flex flex-col gap-4 rounded-lg border border-border p-4">
        <input type="hidden" name="course_id" value={cursoId} />
        <input type="hidden" name="curso_slug" value={cursoSlug} />
        <input type="hidden" name="ruta" value={ruta} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-titulo">Título</Label>
          <Input
            id="post-titulo"
            name="titulo"
            placeholder="¿De qué quieres hablar?"
            required
            minLength={3}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-cuerpo">Mensaje</Label>
          <Textarea id="post-cuerpo" name="cuerpo" rows={4} placeholder="Cuéntanos…" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-imagenes">Imágenes</Label>
          <Input
            id="post-imagenes"
            name="imagenes"
            type="file"
            accept="image/*"
            multiple
            className="file:mr-3 file:text-sm"
          />
          <p className="text-xs text-muted-foreground">Hasta 4 imágenes. Opcional.</p>
        </div>

        {estado.error ? (
          <p role="status" className="text-sm text-destructive">
            {estado.error}
          </p>
        ) : null}

        <div>
          <Boton etiqueta="Publicar" pendienteEtiqueta="Publicando…" />
        </div>
      </form>
    </details>
  )
}

function Comentar({
  postId,
  cursoSlug,
  ruta,
}: {
  postId: string
  cursoSlug: string
  ruta: string
}) {
  const [estado, accion] = useActionState(comentarEnPost, {})

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="curso_slug" value={cursoSlug} />
      <input type="hidden" name="ruta" value={ruta} />

      <Textarea
        name="contenido"
        rows={2}
        placeholder="Escribe una respuesta…"
        aria-label="Respuesta"
        required
        minLength={2}
      />

      {estado.error ? <p className="text-sm text-destructive">{estado.error}</p> : null}

      <div>
        <Boton etiqueta="Responder" pendienteEtiqueta="Publicando…" size="sm" />
      </div>
    </form>
  )
}

/** Una respuesta. Se ve claramente colgada de su publicación, no al lado. */
function Respuesta({
  comentario,
  ruta,
  soyEquipo,
}: {
  comentario: ComentarioDePost
  ruta: string
  soyEquipo: boolean
}) {
  return (
    <li className="flex gap-2.5 rounded-md bg-muted/40 px-3 py-2.5">
      <Avatar nombre={comentario.autor.nombre} tamano={28} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{comentario.autor.nombre}</span>
          {comentario.autor.esEquipo ? (
            <Badge variant="outline" className="text-[11px]">
              Equipo VADAI
            </Badge>
          ) : null}
          <span>· {fechaCorta(comentario.creadoEn)}</span>

          {soyEquipo ? (
            <>
              <form action={moderarPost} className="inline">
                <input type="hidden" name="id" value={comentario.id} />
                <input type="hidden" name="tipo" value="comentario" />
                <input type="hidden" name="ruta" value={ruta} />
                <button
                  type="submit"
                  className="px-1 text-destructive underline-offset-2 hover:underline"
                >
                  ocultar
                </button>
              </form>
              <BorrarConAviso
                id={comentario.id}
                tipo="comentario"
                ruta={ruta}
                que="Se borra esta respuesta."
              />
            </>
          ) : null}
        </span>

        <p className="text-sm break-words whitespace-pre-wrap">{comentario.contenido}</p>

        <Reacciones
          datos={comentario.reacciones}
          comentarioId={comentario.id}
          ruta={ruta}
          tamano="chico"
        />
      </div>
    </li>
  )
}

/** El hilo de respuestas: plegado cuando es largo, con su contador. */
function Respuestas({
  comentarios,
  ruta,
  soyEquipo,
}: {
  comentarios: ComentarioDePost[]
  ruta: string
  soyEquipo: boolean
}) {
  if (comentarios.length === 0) return null

  const lista = (
    <ul className="flex flex-col gap-2">
      {comentarios.map((c) => (
        <Respuesta key={c.id} comentario={c} ruta={ruta} soyEquipo={soyEquipo} />
      ))}
    </ul>
  )

  // La sangría y la línea son lo que dice "esto cuelga de arriba".
  const envoltura = (hijo: React.ReactNode) => (
    <div className="ml-4 border-l-2 border-border pl-3 sm:ml-5 sm:pl-4">{hijo}</div>
  )

  if (comentarios.length < PLIEGA_DESDE) return envoltura(lista)

  return envoltura(
    <details className="group/hilo">
      <summary className="mb-2 inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-primary transition-colors select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 transition-transform group-open/hilo:rotate-180"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        <span className="group-open/hilo:hidden">Ver {comentarios.length} respuestas</span>
        <span className="hidden group-open/hilo:inline">Ocultar respuestas</span>
      </summary>
      {lista}
    </details>
  )
}

function Publicacion({
  post,
  cursoSlug,
  ruta,
  soyEquipo,
}: {
  post: PostDeComunidad
  cursoSlug: string
  ruta: string
  soyEquipo: boolean
}) {
  return (
    <li className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:p-5">
      {/* Estructura del feed de Skool: avatar a la izquierda, y a la derecha
          autor · fecha arriba con el título debajo. El avatar es lo que hace
          que un hilo de veinte mensajes se escanee — sin él todos los posts
          arrancan igual y hay que leer para saber quién habla. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar nombre={post.autor.nombre} tamano={38} />

          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{post.autor.nombre}</span>
              {post.autor.esEquipo ? (
                <Badge variant="outline" className="text-[11px]">
                  Equipo VADAI
                </Badge>
              ) : null}
              <span>· {fechaCorta(post.creadoEn)}</span>
              {post.fijado ? (
                <Badge className="bg-vadai-lima text-vadai-navy text-[11px]">Fijado</Badge>
              ) : null}
            </span>

            {/* El título de una publicación pesa más que cualquier respuesta:
                es lo que distingue "alguien abrió un tema" de "alguien
                contestó". */}
            <h3 className="text-[1.05rem] leading-snug font-medium text-pretty">{post.titulo}</h3>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center">
          {soyEquipo ? (
            <>
              <form action={fijarPost}>
                <input type="hidden" name="id" value={post.id} />
                <input type="hidden" name="curso_slug" value={cursoSlug} />
                <input type="hidden" name="ruta" value={ruta} />
                <input type="hidden" name="fijar" value={post.fijado ? 'no' : 'si'} />
                <Button type="submit" variant="ghost" size="sm">
                  {post.fijado ? 'Desfijar' : 'Fijar'}
                </Button>
              </form>

              <form action={moderarPost}>
                <input type="hidden" name="id" value={post.id} />
                <input type="hidden" name="tipo" value="post" />
                <input type="hidden" name="ruta" value={ruta} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  Ocultar
                </Button>
              </form>

              <BorrarConAviso
                id={post.id}
                tipo="post"
                ruta={ruta}
                que={`Se borra la publicación y sus ${post.comentarios.length} respuesta(s).`}
              />
            </>
          ) : post.esMio ? (
            <form action={eliminarPostPropio}>
              <input type="hidden" name="id" value={post.id} />
              <input type="hidden" name="curso_slug" value={cursoSlug} />
              <input type="hidden" name="ruta" value={ruta} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                Eliminar
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {post.contenido ? <RenderRico contenido={post.contenido} /> : null}

      {post.imagenes.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {post.imagenes.map((img) => (
            <Image
              key={img.url}
              src={img.url}
              alt=""
              width={600}
              height={400}
              unoptimized
              className="h-auto w-full rounded-md border border-border object-cover"
            />
          ))}
        </div>
      ) : null}

      {/* Reaccionar cuesta un toque; responder cuesta escribir. Por eso la fila
          va antes de las respuestas y siempre visible, aunque nadie haya
          reaccionado: escondida hasta la primera reacción, no hay primera. */}
      <Reacciones datos={post.reacciones} postId={post.id} ruta={ruta} />

      <Respuestas comentarios={post.comentarios} ruta={ruta} soyEquipo={soyEquipo} />

      <details>
        <summary className={claseResumen}>Responder</summary>
        <div className="pt-2">
          <Comentar postId={post.id} cursoSlug={cursoSlug} ruta={ruta} />
        </div>
      </details>
    </li>
  )
}

/**
 * Cuántas por página, y las flechas para moverse.
 *
 * El tamaño es un `<select>` dentro de un `<form method="get">`: seis pastillas
 * ocupaban media barra para algo que se toca una vez al año, y en el teléfono
 * se amontonaban. Al elegir se aplica solo —`AutoEnviar` esconde el botón y
 * envía—; sin JavaScript el botón sigue ahí y el formulario funciona igual.
 *
 * Las flechas están SIEMPRE, no solo cuando hay varias páginas: un control que
 * aparece y desaparece obliga a buscarlo cada vez. Cuando no aplican se ven
 * apagadas y no se pueden tocar.
 *
 * Cambiar el tamaño siempre vuelve a la página 1, que es lo único que no
 * confunde: quedarse en la página 7 al bajar de 200 a 10 deja a alguien mirando
 * el final de la lista sin saber por qué.
 */
function Paginacion({
  pagina,
  paginas,
  porPagina,
  total,
  ruta,
  extra,
}: {
  pagina: number
  paginas: number
  porPagina: number
  total: number
  ruta: string
  extra: Record<string, string>
}) {
  const href = (p: number) => {
    const params = new URLSearchParams(extra)
    if (p > 1) params.set('p', String(p))
    if (porPagina !== 10) params.set('por', String(porPagina))
    const cadena = params.toString()
    return cadena ? `${ruta}?${cadena}` : ruta
  }

  const TAMANOS = [
    { valor: 10, etiqueta: '10 por página' },
    { valor: 25, etiqueta: '25 por página' },
    { valor: 50, etiqueta: '50 por página' },
    { valor: 100, etiqueta: '100 por página' },
    { valor: 200, etiqueta: '200 por página' },
    { valor: 0, etiqueta: 'Todas' },
  ]

  const claseFlecha = (habilitada: boolean) =>
    cn(
      'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium',
      'transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
      habilitada
        ? 'border-border hover:bg-muted'
        : 'pointer-events-none border-border/40 text-muted-foreground/40'
    )

  return (
    <nav
      aria-label="Navegar las publicaciones"
      className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <form method="get" className="flex items-center gap-2">
        {Object.entries(extra).map(([nombre, valor]) => (
          <input key={nombre} type="hidden" name={nombre} value={valor} />
        ))}

        <label htmlFor="com-por" className="text-sm text-muted-foreground">
          Ver
        </label>
        <select
          id="com-por"
          name="por"
          defaultValue={String(porPagina >= total && total > 0 ? porPagina : porPagina)}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {TAMANOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>

        <Button type="submit" variant="outline" size="sm" data-aplicar>
          Aplicar
        </Button>
        <AutoEnviar />

        <span className="hidden text-sm text-muted-foreground sm:inline">
          {total === 0
            ? 'Sin publicaciones'
            : `${total} publicación${total === 1 ? '' : 'es'}`}
        </span>
      </form>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="text-sm text-muted-foreground tabular-nums">
          {paginas > 1 ? `Página ${pagina} de ${paginas}` : null}
        </span>

        <div className="flex items-center gap-2">
          <Link
            href={href(Math.max(1, pagina - 1))}
            scroll={false}
            rel="prev"
            aria-disabled={pagina <= 1}
            tabIndex={pagina <= 1 ? -1 : undefined}
            className={claseFlecha(pagina > 1)}
          >
            <span aria-hidden>←</span> Anterior
          </Link>

          <Link
            href={href(Math.min(paginas, pagina + 1))}
            scroll={false}
            rel="next"
            aria-disabled={pagina >= paginas}
            tabIndex={pagina >= paginas ? -1 : undefined}
            className={claseFlecha(pagina < paginas)}
          >
            Siguiente <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}

export function Comunidad({
  posts,
  cursoId,
  cursoSlug,
  soyEquipo,
  ruta,
  pagina,
  paginas,
  porPagina,
  total,
  extra = {},
}: {
  posts: PostDeComunidad[]
  cursoId: string
  cursoSlug: string
  soyEquipo: boolean
  /** Qué ruta revalidar al reaccionar o moderar: este mismo feed. */
  ruta: string
  pagina: number
  paginas: number
  porPagina: number
  total: number
  /** Parámetros que la paginación debe conservar (el curso, en /comunidad). */
  extra?: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* `key` es el reset: al publicarse algo cambia el conteo que manda el
          servidor, el <details> se remonta cerrado y los campos quedan limpios. */}
      <NuevaPublicacion key={total} cursoId={cursoId} cursoSlug={cursoSlug} ruta={ruta} />

      {posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
          Todavía no hay publicaciones. Empieza la conversación.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {posts.map((post) => (
              <Publicacion
                key={`${post.id}:${post.comentarios.length}:${post.reacciones.total}`}
                post={post}
                cursoSlug={cursoSlug}
                ruta={ruta}
                soyEquipo={soyEquipo}
              />
            ))}
          </ul>

          <Paginacion
            pagina={pagina}
            paginas={paginas}
            porPagina={porPagina}
            total={total}
            ruta={ruta}
            extra={extra}
          />
        </>
      )}
    </div>
  )
}
