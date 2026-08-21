'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  eliminarComentario,
  moderarComentario,
  publicarComentario,
} from '@/lib/comunidad/acciones-comentarios'
import type { Comentario } from '@/lib/comunidad/comentarios'

/**
 * Hilo de comentarios de una lección (§3.7).
 *
 * Un solo nivel de respuesta, sin likes ni reacciones: el spec lo pide así y
 * además evita convertir la lección en una red social.
 *
 * Los comentarios ocultos por el admin no llegan hasta aquí — los filtra RLS.
 * Este componente no tiene lógica de visibilidad, y es a propósito.
 *
 * Dos decisiones sostienen el modo sin JavaScript, y las dos son fáciles de
 * romper sin darse cuenta:
 *
 *   1. `action={accion}` va tal cual. Envolverla en un closure de cliente le
 *      quita a React el campo oculto $ACTION_ID y el <form> queda inerte sin
 *      JS. El reset del textarea se consigue con `key`, no con el closure.
 *   2. Los recuadros que se abren y cierran son <details>, no estado de React.
 *      Un botón con onClick no hace nada sin JS.
 */

/** El <summary> se disfraza de botón fantasma; el triángulo nativo estorba. */
const claseResumen =
  'inline-flex w-fit cursor-pointer list-none items-center rounded-md px-2.5 py-1 ' +
  'text-[0.8rem] font-medium text-muted-foreground transition-colors select-none ' +
  'hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ' +
  '[&::-webkit-details-marker]:hidden'

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function BotonPublicar({ etiqueta }: { etiqueta: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Publicando…' : etiqueta}
    </Button>
  )
}

function Formulario({
  leccionId,
  cursoSlug,
  padreId,
  etiqueta,
  marcador,
}: {
  leccionId: string
  cursoSlug: string
  padreId?: string
  etiqueta: string
  marcador: string
}) {
  const [estado, accion] = useActionState(publicarComentario, {})

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="lesson_id" value={leccionId} />
      <input type="hidden" name="curso_slug" value={cursoSlug} />
      {padreId ? <input type="hidden" name="parent_id" value={padreId} /> : null}

      <Textarea
        name="contenido"
        rows={padreId ? 2 : 3}
        placeholder={marcador}
        aria-label={etiqueta}
        required
        minLength={2}
      />

      {estado.error ? (
        <p role="status" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}

      <div>
        <BotonPublicar etiqueta={etiqueta} />
      </div>
    </form>
  )
}

function Fila({
  comentario,
  leccionId,
  cursoSlug,
  soyEquipo,
  esRespuesta = false,
}: {
  comentario: Comentario
  leccionId: string
  cursoSlug: string
  soyEquipo: boolean
  esRespuesta?: boolean
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5 rounded-lg border border-border px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium">{comentario.autor.nombre}</span>
          {comentario.autor.esEquipo ? (
            <Badge className="bg-vadai-lima text-vadai-navy">Equipo VADAI</Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {fechaCorta(comentario.creadoEn)}
          </span>
        </div>

        <p className="text-sm whitespace-pre-wrap">{comentario.contenido}</p>

        <div className="flex flex-wrap items-center gap-1">
          {comentario.editable ? (
            <form action={eliminarComentario}>
              <input type="hidden" name="id" value={comentario.id} />
              <input type="hidden" name="lesson_id" value={leccionId} />
              <input type="hidden" name="curso_slug" value={cursoSlug} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                title="Solo durante los primeros 15 minutos"
              >
                Eliminar
              </Button>
            </form>
          ) : null}

          {/* Moderación a dos clics desde el propio hilo (§6.4). */}
          {soyEquipo ? (
            <form action={moderarComentario}>
              <input type="hidden" name="id" value={comentario.id} />
              <input type="hidden" name="lesson_id" value={leccionId} />
              <input type="hidden" name="curso_slug" value={cursoSlug} />
              <input type="hidden" name="ocultar" value="si" />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                title="Deja de verse para los alumnos. Es reversible."
              >
                Ocultar
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {!esRespuesta ? (
        <details className="pl-6">
          <summary className={claseResumen}>Responder</summary>
          <div className="pt-2">
            <Formulario
              leccionId={leccionId}
              cursoSlug={cursoSlug}
              padreId={comentario.id}
              etiqueta="Responder"
              marcador="Tu respuesta…"
            />
          </div>
        </details>
      ) : null}

      {comentario.respuestas.length > 0 ? (
        <ul className="flex flex-col gap-2 border-l border-border pl-4">
          {comentario.respuestas.map((respuesta) => (
            <Fila
              key={respuesta.id}
              comentario={respuesta}
              leccionId={leccionId}
              cursoSlug={cursoSlug}
              soyEquipo={soyEquipo}
              esRespuesta
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function Comentarios({
  comentarios,
  leccionId,
  cursoSlug,
  soyEquipo,
}: {
  comentarios: Comentario[]
  leccionId: string
  cursoSlug: string
  soyEquipo: boolean
}) {
  const total = comentarios.reduce((n, c) => n + 1 + c.respuestas.length, 0)

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">
        Comentarios{total > 0 ? <span className="text-muted-foreground"> · {total}</span> : null}
      </h2>

      {/* `key` es el reset: al publicarse un comentario la revalidación trae un
          total distinto, el <form> se remonta y el textarea queda limpio. */}
      <Formulario
        key={total}
        leccionId={leccionId}
        cursoSlug={cursoSlug}
        etiqueta="Publicar"
        marcador="¿Tienes una duda sobre esta lección?"
      />

      {comentarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay comentarios. Sé el primero en preguntar.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comentarios.map((comentario) => (
            <Fila
              key={`${comentario.id}:${comentario.respuestas.length}`}
              comentario={comentario}
              leccionId={leccionId}
              cursoSlug={cursoSlug}
              soyEquipo={soyEquipo}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
