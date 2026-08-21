'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'

import { RenderRico } from '@/components/alumno/render-rico'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { entregarTarea, urlDeArchivoEntregado } from '@/lib/alumno/acciones-tarea'
import type { TareaParaAlumno } from '@/lib/alumno/tarea'
import { cn } from '@/lib/utils'

/**
 * Tarea del alumno (§3.5).
 *
 * Tres estados posibles y cada uno se ve distinto:
 *   entregada  → esperando revisión, ya no se toca
 *   aprobada   → terminado
 *   rechazada  → se muestra el feedback y se puede reentregar
 *
 * El formulario es un `<form>` con server action, así que funciona sin
 * JavaScript, igual que el resto de la app.
 */

const ETIQUETA = {
  submitted: 'Entregada, en revisión',
  approved: 'Aprobada',
  rejected: 'Necesita correcciones',
} as const

function Boton({ reentrega }: { reentrega: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enviando…' : reentrega ? 'Reenviar tarea' : 'Entregar tarea'}
    </Button>
  )
}

function BotonArchivo({ ruta, nombre }: { ruta: string; nombre: string }) {
  const [pendiente, iniciar] = useTransition()
  const [fallo, setFallo] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          const url = await urlDeArchivoEntregado(ruta)
          if (url) window.open(url, '_blank', 'noopener,noreferrer')
          else setFallo(true)
        })
      }
    >
      {pendiente ? 'Abriendo…' : fallo ? 'No disponible' : nombre}
    </Button>
  )
}

export function Tarea({
  tarea,
  leccionId,
  cursoSlug,
}: {
  tarea: TareaParaAlumno
  leccionId: string
  cursoSlug: string
}) {
  const router = useRouter()
  const [estado, accion] = useActionState(entregarTarea, { ok: false })
  const [reinicio, setReinicio] = useState(0)

  const entrega = tarea.entrega
  const aprobada = entrega?.estado === 'approved'
  const rechazada = entrega?.estado === 'rejected'
  const enRevision = entrega?.estado === 'submitted'

  // Tras entregar, el estado lo recalcula el servidor.
  const enviado = estado.ok
  useEffect(() => {
    if (enviado) {
      router.refresh()
      setReinicio((n) => n + 1)
    }
  }, [enviado, router])

  // Se puede escribir mientras no esté aprobada ni en revisión.
  const puedeEntregar = !aprobada && !enRevision

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Tarea</h2>
        {entrega ? (
          <Badge
            className={cn(
              aprobada && 'bg-vadai-lima text-vadai-navy',
              rechazada && 'bg-destructive text-white'
            )}
            variant={enRevision ? 'secondary' : 'default'}
          >
            {ETIQUETA[entrega.estado]}
          </Badge>
        ) : null}
      </div>

      {tarea.instrucciones ? <RenderRico contenido={tarea.instrucciones} /> : null}

      {entrega?.feedback ? (
        <div
          className={cn(
            'flex flex-col gap-1 rounded-md border px-4 py-3',
            rechazada
              ? 'border-destructive/40 bg-destructive/10'
              : 'border-vadai-lima/40 bg-vadai-lima/10'
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">Comentarios del equipo</p>
          <p className="text-sm break-words whitespace-pre-wrap">{entrega.feedback}</p>
        </div>
      ) : null}

      {entrega && (entrega.texto || entrega.archivos.length > 0) ? (
        <div className="flex flex-col gap-2 rounded-md border border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Lo que entregaste</p>
          {entrega.texto ? (
            <p className="text-sm break-words whitespace-pre-wrap">{entrega.texto}</p>
          ) : null}
          {entrega.archivos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {entrega.archivos.map((a) => (
                <BotonArchivo key={a.storage_path} ruta={a.storage_path} nombre={a.name} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {aprobada ? (
        <p className="rounded-md border border-vadai-lima/40 bg-vadai-lima/10 px-4 py-3 text-sm text-vadai-lima">
          Tu tarea quedó aprobada. No hay nada más que hacer aquí.
        </p>
      ) : enRevision ? (
        <p className="rounded-md border border-border px-4 py-3 text-sm text-muted-foreground">
          Ya la recibimos. Te avisamos en cuanto la revisemos.
        </p>
      ) : null}

      {puedeEntregar ? (
        <form key={reinicio} action={accion} className="flex flex-col gap-4">
          <input type="hidden" name="assignment_id" value={tarea.id} />
          <input type="hidden" name="lesson_id" value={leccionId} />
          <input type="hidden" name="curso_slug" value={cursoSlug} />

          {tarea.aceptaTexto ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tarea-texto">Tu respuesta</Label>
              <Textarea
                id="tarea-texto"
                name="texto"
                rows={5}
                defaultValue={entrega?.texto ?? ''}
                placeholder="Escribe aquí tu entrega."
              />
            </div>
          ) : null}

          {tarea.aceptaArchivos ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tarea-archivos">Archivos</Label>
              <Input
                id="tarea-archivos"
                name="archivos"
                type="file"
                multiple
                className="file:mr-3 file:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Hasta 5 archivos. Si subes nuevos, reemplazan a los anteriores.
              </p>
            </div>
          ) : null}

          {estado.error ? (
            <p
              role="status"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {estado.error}
            </p>
          ) : null}

          <div>
            <Boton reentrega={rechazada} />
          </div>
        </form>
      ) : null}
    </section>
  )
}
