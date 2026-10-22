'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

/**
 * La academia en la pantalla de inicio del teléfono (22-oct-2026).
 *
 * Tres piezas, todas de mejora progresiva: sin JavaScript /instalar sigue
 * explicando paso a paso cómo agregarla, que es lo que de verdad funciona en
 * los dos teléfonos.
 *
 *   CapturarInstalacion  en el marco: Chrome en Android avisa UNA vez, al
 *                        cargar, que la app se puede instalar
 *                        (`beforeinstallprompt`). Si nadie lo escucha en ese
 *                        momento, el botón de un toque ya no se puede ofrecer.
 *   AvisoInstalar        la tarjeta de Inicio, solo en teléfono, solo si no la
 *                        abrió ya instalada y solo hasta que diga «Ahora no».
 *   InstalarEnUnToque    en /instalar: el botón de Android cuando hay evento, y
 *                        «Ya la tienes» cuando se abrió desde el icono.
 *
 * El iPhone no tiene evento ni botón posible: Safari solo instala desde su
 * menú Compartir. Por eso existen los pasos ilustrados.
 */

type EventoInstalar = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let eventoGuardado: EventoInstalar | null = null
const AVISO = 'academia:instalable'
const DESCARTADO = 'academia:instalar-descartado'

export function CapturarInstalacion() {
  useEffect(() => {
    const guardar = (e: Event) => {
      // Sin esto Chrome pone su propia mini barra; el aviso lo damos nosotros.
      e.preventDefault()
      eventoGuardado = e as EventoInstalar
      window.dispatchEvent(new Event(AVISO))
    }
    const instalada = () => {
      eventoGuardado = null
      window.dispatchEvent(new Event(AVISO))
    }
    window.addEventListener('beforeinstallprompt', guardar)
    window.addEventListener('appinstalled', instalada)
    return () => {
      window.removeEventListener('beforeinstallprompt', guardar)
      window.removeEventListener('appinstalled', instalada)
    }
  }, [])
  return null
}

/** ¿Se abrió desde el icono de la pantalla de inicio? */
function abiertaComoApp(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

function esTelefono(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

function leerDescartado(): boolean {
  try {
    return window.localStorage.getItem(DESCARTADO) === '1'
  } catch {
    return false
  }
}

/**
 * La tarjeta de Inicio. Hasta montar no pinta nada: el servidor no sabe si el
 * teléfono ya la tiene instalada, y pintarla para luego quitarla sería un salto.
 */
export function AvisoInstalar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(esTelefono() && !abiertaComoApp() && !leerDescartado())
  }, [])

  if (!visible) return null

  function descartar() {
    try {
      window.localStorage.setItem(DESCARTADO, '1')
    } catch {
      // Sin almacenamiento (ventana privada) solo se esconde por esta vez.
    }
    setVisible(false)
  }

  return (
    <aside
      aria-label="Instalar la academia"
      className="flex items-center gap-4 rounded-[14px] border border-primary/25 bg-primary/6 p-4"
    >
      <Image
        src="/vadai-app-192.png"
        alt=""
        width={52}
        height={52}
        // Aparece después de montar: con carga diferida el navegador ya no la
        // pedía y quedaba el cuadro vacío. Son 6 KB; no hay nada que optimizar.
        loading="eager"
        unoptimized
        className="size-13 shrink-0 rounded-[12px] border border-border"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[0.95rem] leading-snug font-medium">Ten la academia en tu pantalla de inicio</p>
          <p className="text-sm text-muted-foreground">Se abre con un toque, como cualquier app.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/instalar">Cómo instalarla</Link>
          </Button>
          <Button type="button" variant="ghost" onClick={descartar}>
            Ahora no
          </Button>
        </div>
      </div>
    </aside>
  )
}

/**
 * En /instalar, encima de los pasos. Android con evento: un botón que instala.
 * Abierta desde el icono: confirma que ya está. En cualquier otro caso no pinta
 * nada y quedan los pasos.
 */
export function InstalarEnUnToque() {
  const [estado, setEstado] = useState<'nada' | 'boton' | 'instalada'>('nada')

  useEffect(() => {
    const revisar = () => {
      if (abiertaComoApp()) setEstado('instalada')
      else setEstado(eventoGuardado ? 'boton' : 'nada')
    }
    revisar()
    window.addEventListener(AVISO, revisar)
    return () => window.removeEventListener(AVISO, revisar)
  }, [])

  if (estado === 'instalada') {
    return (
      <p className="rounded-[10px] border border-accent/60 bg-accent/15 px-4 py-3 text-[0.95rem] font-medium">
        Ya la tienes instalada: la estás usando desde su icono.
      </p>
    )
  }
  if (estado !== 'boton') return null

  async function instalar() {
    const evento = eventoGuardado
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    // El evento se gasta con un solo `prompt()`, acepte o no.
    eventoGuardado = null
    setEstado(outcome === 'accepted' ? 'instalada' : 'nada')
  }

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-4">
      <p className="text-[0.95rem] font-medium">Tu teléfono la puede instalar directo</p>
      <Button type="button" variant="acento" size="lg" onClick={instalar} className="h-12 w-full text-base">
        Instalar la app
      </Button>
      <p className="text-sm text-muted-foreground">O sigue los pasos de abajo.</p>
    </div>
  )
}
