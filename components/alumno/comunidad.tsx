'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Reacciones } from '@/components/alumno/reacciones'
import { RenderRico } from '@/components/alumno/render-rico'
import { Avatar } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  comentarEnPost,
  eliminarPostPropio,
  fijarPost,
  moderarPost,
  publicarEnComunidad,
} from '@/lib/comunidad/acciones-posts'
import type { PostDeComunidad } from '@/lib/comunidad/posts'

/**
 * Feed de comunidad por curso (§3.8).
 *
 * Sin categorías, sin puntos, sin niveles: el spec los excluye del MVP y en un
 * grupo de 40 personas la gamificación solo agrega ruido.
 *
 * Lo oculto por moderación no llega hasta aquí — lo filtra RLS. Este componente
 * no tiene lógica de visibilidad, y eso es deliberado.
 *
 * Todo lo que se abre y se cierra son <details>, y las acciones van directas al
 * <form>. Un onClick o un closure alrededor de la acción dejarían la comunidad
 * inservible sin JavaScript: React solo emite el $ACTION_ID cuando la acción
 * llega sin envolver. El reset de los campos lo da `key`, desde el servidor.
 */

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

function NuevaPublicacion({ cursoId, cursoSlug }: { cursoId: string; cursoSlug: string }) {
  const [estado, accion] = useActionState(publicarEnComunidad, {})

  return (
    <details>
      <summary className={claseResumen}>Escribir una publicación</summary>

      <form action={accion} className="mt-3 flex flex-col gap-4 rounded-lg border border-border p-4">
        <input type="hidden" name="course_id" value={cursoId} />
        <input type="hidden" name="curso_slug" value={cursoSlug} />

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

function Comentar({ postId, cursoSlug }: { postId: string; cursoSlug: string }) {
  const [estado, accion] = useActionState(comentarEnPost, {})

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="curso_slug" value={cursoSlug} />

      <Textarea
        name="contenido"
        rows={2}
        placeholder="Escribe un comentario…"
        aria-label="Comentario"
        required
        minLength={2}
      />

      {estado.error ? <p className="text-sm text-destructive">{estado.error}</p> : null}

      <div>
        <Boton etiqueta="Comentar" pendienteEtiqueta="Publicando…" size="sm" />
      </div>
    </form>
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

            <h3 className="font-medium text-pretty">{post.titulo}</h3>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          {soyEquipo ? (
            <>
              <form action={fijarPost}>
                <input type="hidden" name="id" value={post.id} />
                <input type="hidden" name="curso_slug" value={cursoSlug} />
                <input type="hidden" name="fijar" value={post.fijado ? 'no' : 'si'} />
                <Button type="submit" variant="ghost" size="sm">
                  {post.fijado ? 'Desfijar' : 'Fijar'}
                </Button>
              </form>

              <form action={moderarPost}>
                <input type="hidden" name="id" value={post.id} />
                <input type="hidden" name="tipo" value="post" />
                <input type="hidden" name="curso_slug" value={cursoSlug} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  Ocultar
                </Button>
              </form>
            </>
          ) : post.esMio ? (
            <form action={eliminarPostPropio}>
              <input type="hidden" name="id" value={post.id} />
              <input type="hidden" name="curso_slug" value={cursoSlug} />
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

      {/* Reaccionar cuesta un toque; comentar cuesta escribir. Por eso la fila
          va antes de los comentarios y siempre visible, aunque nadie haya
          reaccionado: escondida hasta la primera reacción, no hay primera. */}
      <Reacciones datos={post.reacciones} postId={post.id} ruta={ruta} />

      {post.comentarios.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-border pt-3">
          {post.comentarios.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.autor.nombre}</span>
                {c.autor.esEquipo ? (
                  <Badge variant="outline" className="text-[11px]">
                    Equipo VADAI
                  </Badge>
                ) : null}
                {fechaCorta(c.creadoEn)}
                {soyEquipo ? (
                  <form action={moderarPost} className="inline">
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="tipo" value="comentario" />
                    <input type="hidden" name="curso_slug" value={cursoSlug} />
                    <button
                      type="submit"
                      className="text-destructive underline-offset-2 hover:underline"
                    >
                      ocultar
                    </button>
                  </form>
                ) : null}
              </span>
              <p className="text-sm break-words whitespace-pre-wrap">{c.contenido}</p>
              <div className="pt-0.5">
                <Reacciones
                  datos={c.reacciones}
                  comentarioId={c.id}
                  ruta={ruta}
                  tamano="chico"
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <details>
        <summary className={claseResumen}>Comentar</summary>
        <div className="pt-2">
          <Comentar postId={post.id} cursoSlug={cursoSlug} />
        </div>
      </details>
    </li>
  )
}

export function Comunidad({
  posts,
  cursoId,
  cursoSlug,
  soyEquipo,
  ruta,
}: {
  posts: PostDeComunidad[]
  cursoId: string
  cursoSlug: string
  soyEquipo: boolean
  /** Qué ruta revalidar al reaccionar: este mismo feed. */
  ruta: string
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* `key` es el reset: al publicarse algo cambia el conteo que manda el
          servidor, el <details> se remonta cerrado y los campos quedan limpios. */}
      <NuevaPublicacion key={posts.length} cursoId={cursoId} cursoSlug={cursoSlug} />

      {posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
          Todavía no hay publicaciones. Empieza la conversación.
        </p>
      ) : (
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
      )}
    </div>
  )
}
