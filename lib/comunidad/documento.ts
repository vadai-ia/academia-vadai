import type { Json } from '@/lib/supabase/types'

/**
 * Texto plano ↔ el documento de Tiptap que guarda `content_rich`.
 *
 * Vivía dentro de las acciones del muro; desde M20 también lo usan la API (las
 * noticias que llegan de otra plataforma) y, en M21, el agente. Como el texto
 * entra como texto y sale por nodos conocidos, no hay forma de inyectar markup.
 */

/**
 * Párrafos separados por una línea en blanco. `fuente`, si viene, cierra el
 * documento con «Fuente: <liga>» (solo http/https: `RenderRico` no pinta otras).
 */
export function comoDocumento(texto: string, fuente?: string | null): Json | null {
  // Los <textarea> mandan CRLF, no LF: partir sin normalizar antes colapsa
  // todos los párrafos en uno solo.
  const parrafos = texto
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  const conFuente = fuente && /^https?:\/\//i.test(fuente)

  if (parrafos.length === 0 && !conFuente) return null

  return {
    type: 'doc',
    content: [
      ...parrafos.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
      ...(conFuente
        ? [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Fuente: ' },
                { type: 'text', text: fuente, marks: [{ type: 'link', attrs: { href: fuente } }] },
              ],
            },
          ]
        : []),
    ],
  } as Json
}

/** El texto de un documento de Tiptap, con un párrafo por línea en blanco. */
export function textoPlano(doc: Json | null): string {
  const partes: string[] = []
  const recorrer = (nodo: unknown, salida: string[]) => {
    if (typeof nodo !== 'object' || nodo === null) return
    const n = nodo as { type?: unknown; text?: unknown; content?: unknown }
    if (typeof n.text === 'string') salida.push(n.text)
    if (Array.isArray(n.content)) for (const hijo of n.content) recorrer(hijo, salida)
  }
  const raiz = doc as { content?: unknown } | null
  if (raiz && Array.isArray(raiz.content)) {
    for (const bloque of raiz.content) {
      const linea: string[] = []
      recorrer(bloque, linea)
      if (linea.length > 0) partes.push(linea.join(''))
    }
  }
  return partes.join('\n\n')
}
