'use client'

import { useState, useTransition } from 'react'

import { SubidaAdjunto } from '@/components/admin/subida-adjunto'
import { Button } from '@/components/ui/button'
import { eliminarAdjunto, urlDeDescarga } from '@/lib/admin/acciones'
import type { Adjunto } from '@/lib/admin/consultas'

function tamanoLegible(bytes: number | null): string {
  if (bytes === null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Descarga por URL firmada.
 *
 * El bucket es privado (§4): no existe una URL permanente que se pueda copiar y
 * repartir. Se pide una firma de 5 minutos en el momento del clic.
 */
function BotonDescargar({ rutaStorage, nombre }: { rutaStorage: string; nombre: string }) {
  const [pendiente, iniciar] = useTransition()
  const [fallo, setFallo] = useState(false)

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          const url = await urlDeDescarga(rutaStorage)
          if (url) window.open(url, '_blank', 'noopener,noreferrer')
          else setFallo(true)
        })
      }
      title={`Descargar ${nombre}`}
    >
      {pendiente ? 'Abriendo…' : fallo ? 'No disponible' : 'Descargar'}
    </Button>
  )
}

export function Adjuntos({
  adjuntos,
  leccionId,
  cursoId,
}: {
  adjuntos: Adjunto[]
  leccionId: string
  cursoId: string
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Adjuntos</h2>
        <p className="text-sm text-muted-foreground">
          Materiales descargables de la lección. Se guardan en un bucket privado y el
          alumno los recibe por URL firmada.
        </p>
      </div>

      {adjuntos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Sin adjuntos todavía.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {adjuntos.map((adjunto) => (
            <li
              key={adjunto.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{adjunto.file_name}</span>
                <span className="text-xs text-muted-foreground">
                  {tamanoLegible(adjunto.size_bytes)}
                  {adjunto.mime_type ? ` · ${adjunto.mime_type}` : ''}
                </span>
              </div>

              <div className="flex shrink-0 items-center">
                <BotonDescargar
                  rutaStorage={adjunto.storage_path}
                  nombre={adjunto.file_name}
                />
                <form action={eliminarAdjunto}>
                  <input type="hidden" name="id" value={adjunto.id} />
                  <input type="hidden" name="lesson_id" value={leccionId} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    Eliminar
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* La subida va directo del navegador a Supabase (24-sep-2026): un PDF
          de más de 1 MB reventaba el límite de la server action antes de que
          hubiera un mensaje que dar. `key` remonta el formulario limpio cada
          vez que cambia la lista. */}
      <SubidaAdjunto leccionId={leccionId} cursoId={cursoId} reinicio={adjuntos.length} />
    </section>
  )
}
