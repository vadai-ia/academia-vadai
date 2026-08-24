import { Fragment, type ReactNode } from 'react'

import type { Json } from '@/lib/supabase/types'

/**
 * Renderiza el JSON de Tiptap.
 *
 * Se guarda JSON y no HTML justamente para poder renderizarlo así: recorriendo
 * nodos conocidos y descartando lo que no esté en esta lista. No hay
 * dangerouslySetInnerHTML en ningún punto, así que ni un admin comprometido ni
 * un pegado desde Word pueden inyectar markup en la página del alumno.
 */

type Nodo = {
  type?: string
  text?: string
  content?: Nodo[]
  marks?: Array<{ type?: string }>
  attrs?: Record<string, unknown>
}

function conMarcas(texto: string, marcas: Nodo['marks']): ReactNode {
  if (!marcas || marcas.length === 0) return texto

  return marcas.reduce<ReactNode>((dentro, marca) => {
    switch (marca.type) {
      case 'bold':
        return <strong>{dentro}</strong>
      case 'italic':
        return <em>{dentro}</em>
      case 'code':
        return <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{dentro}</code>
      case 'strike':
        return <s>{dentro}</s>
      default:
        return dentro
    }
  }, texto)
}

function hijos(nodo: Nodo): ReactNode {
  return (nodo.content ?? []).map((hijo, i) => <Fragment key={i}>{render(hijo)}</Fragment>)
}

function render(nodo: Nodo): ReactNode {
  switch (nodo.type) {
    case 'doc':
      return hijos(nodo)
    case 'paragraph':
      return <p className="mb-3 last:mb-0">{hijos(nodo)}</p>
    case 'text':
      return conMarcas(nodo.text ?? '', nodo.marks)
    case 'hardBreak':
      return <br />
    case 'heading': {
      const nivel = Number(nodo.attrs?.level ?? 2)
      const clase = nivel <= 2 ? 'text-xl' : 'text-lg'
      return <p className={`mb-2 font-semibold ${clase}`}>{hijos(nodo)}</p>
    }
    case 'bulletList':
      return <ul className="mb-3 list-disc pl-5">{hijos(nodo)}</ul>
    case 'orderedList':
      return <ol className="mb-3 list-decimal pl-5">{hijos(nodo)}</ol>
    case 'listItem':
      return <li className="mb-1">{hijos(nodo)}</li>
    case 'blockquote':
      return (
        <blockquote className="mb-3 border-l-2 border-primary pl-4 text-muted-foreground">
          {hijos(nodo)}
        </blockquote>
      )
    case 'codeBlock':
      return (
        <pre className="mb-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
          <code>{hijos(nodo)}</code>
        </pre>
      )
    default:
      // Nodo desconocido: se rinden sus hijos si los tiene, y se ignora el resto.
      return nodo.content ? hijos(nodo) : null
  }
}

export function RenderRico({ contenido }: { contenido: Json | null }) {
  if (!contenido || typeof contenido !== 'object') return null

  return (
    // `break-words` porque esto renderiza texto de alumnos: una URL pegada sin
    // espacios no cabe en un teléfono y empujaría toda la página a lo ancho.
    <div className="text-sm leading-relaxed break-words text-foreground/90">
      {render(contenido as Nodo)}
    </div>
  )
}
