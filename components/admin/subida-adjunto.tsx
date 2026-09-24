'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useRef, useState, type FormEvent } from 'react'

import { Desplegable } from '@/components/admin/desplegable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { subirAdjunto } from '@/lib/admin/acciones'
import { confirmarAdjunto, prepararSubidaDeAdjunto } from '@/lib/admin/acciones-adjuntos'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { cn } from '@/lib/utils'

import { AvisoAccion } from './aviso-accion'

/**
 * Sube un adjunto del navegador directo a Supabase Storage (24-sep-2026).
 *
 * El archivo nunca pasa por nuestro servidor: el límite de cuerpo de una
 * server action (1 MB en Next, 4.5 MB en Vercel) tumbaba cualquier PDF de
 * verdad antes de que existiera un mensaje que dar. Del servidor viene una URL
 * firmada para esa ruta; el navegador sube ahí; el servidor registra.
 *
 * MEJORA PROGRESIVA, NO REEMPLAZO. El `<form>` sigue llevando la acción de
 * servidor de siempre en su `action`, sin envolver, así que con JavaScript
 * apagado se envía como cualquier formulario y `subirAdjunto` recibe el
 * archivo (hasta los 4 MB que permite next.config). Con JavaScript, `onSubmit`
 * intercepta y toma el camino directo. La acción no va dentro de un closure
 * —eso le quitaría el `$ACTION_ID`—; el closure solo decide si se usa.
 *
 * La barra de progreso sale de `XMLHttpRequest`, no de `fetch`: es la única
 * API del navegador que reporta el avance de una subida. Con 100 MB desde una
 * conexión mexicana, un minuto sin barra es un minuto en el que la gente
 * recarga.
 */

type Fase =
  | { nombre: 'inactivo' }
  | { nombre: 'preparando' }
  | { nombre: 'subiendo'; porcentaje: number }
  | { nombre: 'registrando' }
  | { nombre: 'listo'; mensaje: string }
  | { nombre: 'error'; mensaje: string }

function subirConProgreso(
  url: string,
  archivo: File,
  alAvanzar: (porcentaje: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', archivo.type || 'application/octet-stream')
    // Nunca se pisa lo que ya hay: la ruta ya trae marca de tiempo.
    xhr.setRequestHeader('x-upsert', 'false')

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) alAvanzar(Math.round((evento.loaded / evento.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`El almacén respondió ${xhr.status}.`))
    }
    xhr.onerror = () => reject(new Error('Se perdió la conexión a mitad de la subida.'))
    xhr.onabort = () => reject(new Error('La subida se canceló.'))

    xhr.send(archivo)
  })
}

export function SubidaAdjunto({
  leccionId,
  cursoId,
  reinicio,
}: {
  leccionId: string
  cursoId: string
  /** Cambia cuando cambia la lista: remonta el formulario limpio. */
  reinicio: number
}) {
  const router = useRouter()
  const campo = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>({ nombre: 'inactivo' })
  // El camino sin JavaScript: React 19 siembra este estado tras el POST, así
  // que el aviso o el error se ven aunque el JS no haya cargado.
  const [estadoSinJs, accionSinJs] = useActionState(subirAdjunto, SIN_ESTADO)

  const ocupado =
    fase.nombre === 'preparando' || fase.nombre === 'subiendo' || fase.nombre === 'registrando'

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    // Con JavaScript se toma el camino directo. Sin él, este manejador nunca
    // corre y el formulario se envía a la acción de servidor de su `action`.
    evento.preventDefault()

    const archivo = campo.current?.files?.[0]
    if (!archivo || archivo.size === 0) {
      setFase({ nombre: 'error', mensaje: 'Elige un archivo.' })
      return
    }

    setFase({ nombre: 'preparando' })
    const preparacion = await prepararSubidaDeAdjunto(leccionId, archivo.name, archivo.size)
    if (!preparacion.ok) {
      setFase({ nombre: 'error', mensaje: preparacion.error })
      return
    }

    try {
      setFase({ nombre: 'subiendo', porcentaje: 0 })
      await subirConProgreso(preparacion.urlFirmada, archivo, (porcentaje) =>
        setFase({ nombre: 'subiendo', porcentaje })
      )
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No se pudo subir el archivo.'
      setFase({ nombre: 'error', mensaje: `${mensaje} Vuelve a intentarlo.` })
      return
    }

    setFase({ nombre: 'registrando' })
    const resultado = await confirmarAdjunto({
      leccionId,
      cursoId,
      ruta: preparacion.ruta,
      nombre: archivo.name,
      mime: archivo.type || null,
      tamano: archivo.size,
    })

    if (resultado.error) {
      setFase({ nombre: 'error', mensaje: resultado.error })
      return
    }

    setFase({ nombre: 'listo', mensaje: resultado.aviso ?? 'Archivo agregado.' })
    if (campo.current) campo.current.value = ''
    // La lista la pinta el servidor: hay que releerla para que aparezca.
    router.refresh()
  }

  return (
    <Desplegable
      etiqueta="Subir adjunto"
      variante="contorno"
      abierto={fase.nombre !== 'inactivo' || Boolean(estadoSinJs.error || estadoSinJs.aviso)}
    >
      <form key={reinicio} action={accionSinJs} onSubmit={alEnviar} className="flex flex-col gap-3">
        <input type="hidden" name="lesson_id" value={leccionId} />
        <input type="hidden" name="course_id" value={cursoId} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={campo}
            name="archivo"
            type="file"
            aria-label="Archivo a subir"
            required
            disabled={ocupado}
            className="file:mr-3 file:text-sm"
          />
          <Button type="submit" disabled={ocupado}>
            {fase.nombre === 'preparando'
              ? 'Preparando…'
              : fase.nombre === 'subiendo'
                ? `Subiendo ${fase.porcentaje}%`
                : fase.nombre === 'registrando'
                  ? 'Guardando…'
                  : 'Subir'}
          </Button>
        </div>

        {fase.nombre === 'subiendo' ? (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={fase.porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avance de la subida"
          >
            <div
              className={cn('h-full rounded-full bg-primary transition-[width] duration-200')}
              style={{ width: `${fase.porcentaje}%` }}
            />
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">Hasta 100 MB por archivo.</p>

        {fase.nombre === 'listo' ? <AvisoAccion estado={{ aviso: fase.mensaje }} /> : null}
        {fase.nombre === 'error' ? <AvisoAccion estado={{ error: fase.mensaje }} /> : null}
        {fase.nombre === 'inactivo' ? <AvisoAccion estado={estadoSinJs} /> : null}
      </form>
    </Desplegable>
  )
}
