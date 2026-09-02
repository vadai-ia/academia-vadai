'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Mantiene al día la pantalla de control del admin.
 *
 * A diferencia de `Pulso`, que solo recarga cuando cambia `state_version`, aquí
 * se recarga siempre: lo que el admin necesita ver subir son los CONTADORES
 * —cuánta gente entró, cuántos ya contestaron— y esos no mueven la versión a
 * propósito, justamente para no despertar a toda la sala.
 *
 * Es una sola pantalla y un solo usuario, así que recargar cada tres segundos no
 * tiene el costo que tendría hacerlo en los teléfonos.
 */
export function RefrescoPeriodico({ cadaMs = 3000 }: { cadaMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const reloj = window.setInterval(refrescar, cadaMs)
    return () => window.clearInterval(reloj)
  }, [cadaMs, router])

  return null
}
