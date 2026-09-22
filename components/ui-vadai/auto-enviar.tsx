'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Hace que un filtro se aplique solo, sin botón.
 *
 * Alejandro lo pidió el 21-sep-2026: "¿por qué tenemos tanto botón de Aplicar
 * tanto en filtros como en búsqueda? Deberían ser proactivos". Tenía razón:
 * elegir "50 por página" y que no pase nada hasta apretar otro botón es un paso
 * que no aporta, y quien lo olvida cree que el filtro no sirve.
 *
 * Es mejora progresiva, no un reemplazo:
 *
 *   - El `<form method="get">` sigue siendo un formulario de verdad. Sin
 *     JavaScript, el botón marcado con `data-aplicar` está ahí y funciona.
 *   - Con JavaScript, este componente esconde ese botón y navega solo.
 *
 * Por eso el botón se esconde desde aquí y no con una clase de CSS: si el
 * JavaScript no cargó, nadie lo escondió, que es exactamente lo que se quiere.
 *
 * NAVEGA CON EL ENRUTADOR, NO ENVÍA EL FORMULARIO. Un `requestSubmit()` es una
 * carga completa de la página: el campo de búsqueda se desmonta y el cursor se
 * pierde a media palabra, que con un envío por cada pausa al teclear sería
 * inusable. `router.replace` cambia solo lo que cambió, así que el foco y lo
 * que llevas escrito se quedan donde están. Y es `replace` y no `push` para no
 * llenar el historial: el botón de atrás debe salir de la lista, no recorrer
 * letra por letra lo que alguien tecleó.
 *
 * Los `<select>` y las casillas aplican al instante. Los campos de texto
 * esperan a que dejes de teclear.
 */
export function AutoEnviar({ retrasoDeTexto = 400 }: { retrasoDeTexto?: number }) {
  const ancla = useRef<HTMLSpanElement>(null)
  const router = useRouter()

  useEffect(() => {
    const formulario = ancla.current?.closest('form')
    if (!formulario) return

    // Sin el botón, quien no tenga JS se queda sin forma de aplicar. Por eso
    // solo se esconde ahora, cuando ya sabemos que este código corrió.
    const botones = formulario.querySelectorAll<HTMLElement>('[data-aplicar]')
    for (const b of botones) b.hidden = true

    let reloj: ReturnType<typeof setTimeout> | undefined
    let ultima = ''

    const destino = (): string => {
      // `formulario.action` ya viene resuelta a URL absoluta por el navegador;
      // si el formulario no declara ninguna, es la de la página. De ahí salen
      // la ruta y el ancla (#inscritos), que hay que conservar.
      const base = new URL(formulario.action || window.location.href, window.location.origin)
      const params = new URLSearchParams()

      for (const [nombre, valor] of new FormData(formulario).entries()) {
        // Los vacíos no viajan: "?q=&empresa=" ensucia la URL y no filtra nada.
        if (typeof valor === 'string' && valor !== '') params.set(nombre, valor)
      }

      const cadena = params.toString()
      return `${base.pathname}${cadena ? `?${cadena}` : ''}${base.hash}`
    }

    const navegar = () => {
      const url = destino()
      if (url === ultima) return
      ultima = url
      router.replace(url, { scroll: false })
    }

    const alCambiar = () => {
      clearTimeout(reloj)
      navegar()
    }

    const alTeclear = (evento: Event) => {
      const objetivo = evento.target as HTMLInputElement | null
      const tipo = (objetivo?.type ?? '').toLowerCase()
      if (tipo !== 'text' && tipo !== 'search' && tipo !== 'email') return

      clearTimeout(reloj)
      reloj = setTimeout(navegar, retrasoDeTexto)
    }

    formulario.addEventListener('change', alCambiar)
    formulario.addEventListener('input', alTeclear)

    return () => {
      clearTimeout(reloj)
      formulario.removeEventListener('change', alCambiar)
      formulario.removeEventListener('input', alTeclear)
      for (const b of botones) b.hidden = false
    }
  }, [retrasoDeTexto, router])

  // Un ancla sin pintura: solo sirve para encontrar el formulario que lo
  // contiene, sin obligar a quien lo use a pasar una referencia.
  return <span ref={ancla} hidden />
}
