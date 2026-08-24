'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import * as tus from 'tus-js-client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { confirmarSubida, prepararSubida } from '@/lib/admin/acciones-bunny'
import { cn } from '@/lib/utils'

/**
 * Sube el video del navegador directo a Bunny por TUS resumible (§7.2).
 *
 * El archivo nunca pasa por nuestro servidor: un video de 2 GB reventaría el
 * límite de body de cualquier server action y pagaríamos el ancho de banda dos
 * veces. Del servidor solo viene una firma con caducidad; la llave de Bunny se
 * queda allá.
 *
 * TUS es resumible por diseño: si la conexión se cae a la mitad —muy probable
 * subiendo 2 GB desde México— continúa donde se quedó en vez de empezar de cero.
 * Es la mitigación que pide §11 para "upload de videos largos falla".
 */

type Estado =
  | { fase: 'inactivo' }
  | { fase: 'preparando' }
  | { fase: 'subiendo'; porcentaje: number }
  | { fase: 'procesando' }
  | { fase: 'listo'; mensaje: string }
  | { fase: 'error'; mensaje: string }

const MB = 1024 * 1024

export function SubidaVideo({
  leccionId,
  cursoId,
  titulo,
  guidActual,
}: {
  leccionId: string
  cursoId: string
  titulo: string
  guidActual: string | null
}) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>({ fase: 'inactivo' })
  const campo = useRef<HTMLInputElement>(null)
  const subidaActual = useRef<tus.Upload | null>(null)

  const enProceso =
    estado.fase === 'preparando' || estado.fase === 'subiendo' || estado.fase === 'procesando'

  async function subir(archivo: File) {
    setEstado({ fase: 'preparando' })

    const preparacion = await prepararSubida(leccionId, titulo)
    if (!preparacion.ok) {
      setEstado({ fase: 'error', mensaje: preparacion.error })
      return
    }

    const subida = new tus.Upload(archivo, {
      endpoint: preparacion.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      // Trozos de 50 MB: suficientemente grandes para no perder tiempo en
      // handshakes, suficientemente chicos para no perder mucho al reintentar.
      chunkSize: 50 * MB,
      headers: {
        AuthorizationSignature: preparacion.firma,
        AuthorizationExpire: String(preparacion.expiracion),
        VideoId: preparacion.guid,
        LibraryId: preparacion.libraryId,
      },
      metadata: {
        filetype: archivo.type,
        title: titulo || archivo.name,
      },
      onProgress(subidos, totales) {
        setEstado({ fase: 'subiendo', porcentaje: Math.round((subidos / totales) * 100) })
      },
      onError(error) {
        console.error('Fallo la subida a Bunny:', error)
        setEstado({
          fase: 'error',
          mensaje: 'Se interrumpió la subida. Vuelve a elegir el archivo para continuar.',
        })
      },
      async onSuccess() {
        setEstado({ fase: 'procesando' })
        const resultado = await confirmarSubida(leccionId, preparacion.guid, cursoId)
        setEstado(
          resultado.ok
            ? { fase: 'listo', mensaje: resultado.mensaje }
            : { fase: 'error', mensaje: resultado.mensaje }
        )
        // El GUID y la duración los escribió el servidor: hay que releerlos para
        // que el formulario no siga mostrando los valores viejos.
        if (resultado.ok) router.refresh()
      },
    })

    // Reanuda si esta subida ya se había intentado antes.
    const previas = await subida.findPreviousUploads()
    if (previas.length > 0 && previas[0]) subida.resumeFromPreviousUpload(previas[0])

    subidaActual.current = subida
    subida.start()
  }

  function cancelar() {
    void subidaActual.current?.abort()
    setEstado({ fase: 'inactivo' })
    if (campo.current) campo.current.value = ''
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={campo}
          type="file"
          accept="video/*"
          aria-label="Archivo de video"
          disabled={enProceso}
          onChange={(e) => {
            const archivo = e.target.files?.[0]
            if (archivo) void subir(archivo)
          }}
          className="file:mr-3 file:text-sm"
        />
        {enProceso ? (
          <Button type="button" variant="ghost" onClick={cancelar}>
            Cancelar
          </Button>
        ) : null}
      </div>

      {estado.fase === 'subiendo' ? (
        <div className="flex flex-col gap-1.5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={estado.porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso de la subida"
          >
            <div
              className="h-full bg-vadai-lima transition-[width] duration-300"
              style={{ width: `${estado.porcentaje}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Subiendo {estado.porcentaje}% · puedes seguir en esta pestaña
          </p>
        </div>
      ) : null}

      {estado.fase !== 'inactivo' && estado.fase !== 'subiendo' ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            estado.fase === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : estado.fase === 'listo'
                ? 'border-exito/40 bg-exito/10 text-exito'
                : 'border-border text-muted-foreground'
          )}
        >
          {estado.fase === 'preparando'
            ? 'Preparando el video en Bunny…'
            : estado.fase === 'procesando'
              ? 'Subida terminada. Preguntando a Bunny por la duración…'
              : estado.mensaje}
        </p>
      ) : null}

      {guidActual && estado.fase === 'inactivo' ? (
        <p className="text-xs text-muted-foreground">
          Esta lección ya tiene un video. Subir otro lo reemplaza.
        </p>
      ) : null}
    </div>
  )
}
