'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * El latido del celular del asistente.
 *
 * Sondea el endpoint más barato de la feature —solo dice qué pregunta está
 * abierta, no trae agregados— y recarga la página cuando algo cambió. Así, en
 * cuanto el admin abre la pregunta 2, el teléfono de la sala pasa solo.
 *
 * TRES SEGUNDOS, no uno. La proyección va a un segundo porque son una o dos
 * pantallas; aquí son todos los teléfonos del salón y nadie está mirando su
 * pantalla esperando el cambio: están viendo la pared.
 *
 * `state_version` no se mueve con las respuestas (lo garantiza el trigger de la
 * migración), así que cien personas contestando no provocan cien recargas.
 *
 * SIN JAVASCRIPT esto simplemente no corre, y por eso la página siempre ofrece
 * además un enlace de "Actualizar" a la vista. La dinámica sigue siendo usable a
 * mano; lo que este componente agrega es que no haya que acordarse.
 */

const CADENCIA_MS = 3000

export function Pulso({ codigo, version }: { codigo: string; version: number }) {
  const router = useRouter()

  // En refs: cambiarlas no debe repintar nada, solo decidir si hay que recargar.
  const ultima = useRef(version)
  const etiqueta = useRef<string | null>(null)

  useEffect(() => {
    ultima.current = version
  }, [version])

  useEffect(() => {
    let vivo = true

    async function latir() {
      // Si la pestaña está en segundo plano, no hay nadie mirando: sondear sería
      // gastar batería y peticiones para nada. Al volver, el navegador dispara
      // visibilitychange y se retoma.
      if (document.visibilityState !== 'visible') return

      try {
        const respuesta = await fetch(`/api/encuestas/${codigo}/estado`, {
          cache: 'no-store',
          headers: etiqueta.current ? { 'if-none-match': etiqueta.current } : {},
        })

        const nuevaEtiqueta = respuesta.headers.get('etag')
        if (nuevaEtiqueta) etiqueta.current = nuevaEtiqueta

        // 304: no cambió nada. Es la respuesta habitual y no cuesta cuerpo.
        if (respuesta.status === 304 || !respuesta.ok) return

        const datos = (await respuesta.json()) as { v: number }
        if (vivo && datos.v !== ultima.current) {
          ultima.current = datos.v
          router.refresh()
        }
      } catch {
        // Una red que se cae en un salón es lo normal. Se reintenta al siguiente
        // latido sin decirle nada a nadie.
      }
    }

    const reloj = window.setInterval(latir, CADENCIA_MS)
    document.addEventListener('visibilitychange', latir)

    return () => {
      vivo = false
      window.clearInterval(reloj)
      document.removeEventListener('visibilitychange', latir)
    }
  }, [codigo, router])

  return null
}
