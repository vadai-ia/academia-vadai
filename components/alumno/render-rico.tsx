import { Fragment, type ReactNode } from 'react'

import type { Json } from '@/lib/supabase/types'

/**
 * Renderiza el JSON de Tiptap.
 *
 * Se guarda JSON y no HTML justamente para poder renderizarlo así: recorriendo
 * nodos conocidos y descartando lo que no esté en esta lista. No hay
 * dangerouslySetInnerHTML en ningún punto, así que ni un admin comprometido ni
 * un pegado desde Word pueden inyectar markup en la página del alumno.
 *
 * Tipografía de lectura (25-sep-2026): cuerpo de 16 px con interlínea 1.65,
 * no 14 px. El texto de una lección se LEE, no se escanea como una tabla, y
 * 14 px era el tamaño de una nota al pie. Los títulos internos son <h2>/<h3>
 * de verdad, en peso 500 como el resto de la plataforma.
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
        return <strong className="font-semibold text-foreground">{dentro}</strong>
      case 'italic':
        return <em>{dentro}</em>
      case 'code':
        return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{dentro}</code>
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
      // Un párrafo vacío es el Enter de más al final del editor: no ocupa lugar.
      if (!nodo.content || nodo.content.length === 0) return null
      return <p className="mb-4 last:mb-0">{hijos(nodo)}</p>
    case 'text':
      return conMarcas(nodo.text ?? '', nodo.marks)
    case 'hardBreak':
      return <br />
    case 'heading': {
      const nivel = Number(nodo.attrs?.level ?? 2)
      return nivel <= 2 ? (
        <h2 className="mt-8 mb-3 text-xl leading-snug font-medium tracking-tight text-foreground first:mt-0">
          {hijos(nodo)}
        </h2>
      ) : (
        <h3 className="mt-6 mb-2 text-lg leading-snug font-medium text-foreground first:mt-0">
          {hijos(nodo)}
        </h3>
      )
    }
    case 'bulletList':
      return <ul className="mb-4 list-disc space-y-1.5 pl-6 last:mb-0">{hijos(nodo)}</ul>
    case 'orderedList':
      return <ol className="mb-4 list-decimal space-y-1.5 pl-6 last:mb-0">{hijos(nodo)}</ol>
    case 'listItem':
      return <li className="pl-1 [&>p]:mb-1.5 [&>p:last-child]:mb-0">{hijos(nodo)}</li>
    case 'blockquote':
      return (
        <blockquote className="mb-4 border-l-2 border-primary pl-4 text-muted-foreground last:mb-0">
          {hijos(nodo)}
        </blockquote>
      )
    case 'codeBlock':
      // Se envuelve: un prompt largo o un pegado con saltos de línea no debe
      // obligar a desplazarse de lado, y menos en el teléfono.
      return (
        <pre className="mb-4 overflow-x-auto rounded-[10px] bg-muted p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap last:mb-0">
          <code>{hijos(nodo)}</code>
        </pre>
      )
    default:
      // Nodo desconocido: se rinden sus hijos si los tiene, y se ignora el resto.
      return nodo.content ? hijos(nodo) : null
  }
}

export function RenderRico({ contenido, className }: { contenido: Json | null; className?: string }) {
  if (!contenido || typeof contenido !== 'object') return null

  return (
    // `break-words` porque esto renderiza texto de alumnos: una URL pegada sin
    // espacios no cabe en un teléfono y empujaría toda la página a lo ancho.
    <div className={`text-base leading-[1.65] break-words text-foreground/90 ${className ?? ''}`}>
      {render(contenido as Nodo)}
    </div>
  )
}
