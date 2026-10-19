import { Fragment } from 'react'

/**
 * Texto plano de un comentario con sus ligas `http(s)` clicables (M21: el
 * agente deja la liga de la lección; los alumnos también pegan ligas).
 *
 * Solo http y https: nada de `javascript:` ni otros esquemas. React escapa el
 * resto del texto. Lo de afuera abre en otra pestaña y sin pasar referencia;
 * lo de la academia, en la misma. Sin hooks: sirve en componentes de servidor y
 * de cliente.
 */

const LIGA = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g

function esDeLaAcademia(url: string): boolean {
  try {
    const propia = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://academia.vadai.com.mx').hostname
    return new URL(url).hostname === propia
  } catch {
    return false
  }
}

export function TextoConLigas({ texto }: { texto: string }) {
  const partes: Array<string | { url: string }> = []
  let desde = 0
  for (const m of texto.matchAll(LIGA)) {
    const i = m.index ?? 0
    if (i > desde) partes.push(texto.slice(desde, i))
    partes.push({ url: m[0] })
    desde = i + m[0].length
  }
  if (desde < texto.length) partes.push(texto.slice(desde))

  return (
    <>
      {partes.map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : esDeLaAcademia(p.url) ? (
          <a key={i} href={p.url} className="break-all text-primary underline-offset-4 hover:underline">
            {p.url}
          </a>
        ) : (
          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-primary underline-offset-4 hover:underline">
            {p.url}
          </a>
        )
      )}
    </>
  )
}
