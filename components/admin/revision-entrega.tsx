'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { revisarEntrega, urlDeEntrega } from '@/lib/admin/acciones-tareas'
import type { EntregaEnBandeja } from '@/lib/admin/tareas'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Botones() {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="approved" disabled={pending}>
        {pending ? 'Guardando…' : 'Aprobar'}
      </Button>
      <Button
        type="submit"
        name="decision"
        value="rejected"
        variant="outline"
        disabled={pending}
      >
        Pedir correcciones
      </Button>
    </div>
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
          const url = await urlDeEntrega(ruta)
          if (url) window.open(url, '_blank', 'noopener,noreferrer')
          else setFallo(true)
        })
      }
    >
      {pendiente ? 'Abriendo…' : fallo ? 'No disponible' : nombre}
    </Button>
  )
}

export function RevisionEntrega({ entrega }: { entrega: EntregaEnBandeja }) {
  const [estado, accion] = useActionState(revisarEntrega, SIN_ESTADO)

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{entrega.alumnoNombre}</span>
          <span className="truncate text-xs text-muted-foreground">
            {entrega.cursoTitulo} · {entrega.leccionTitulo}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat('es-MX', {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/Mexico_City',
          }).format(new Date(entrega.entregadaEn))}
        </span>
      </div>

      {entrega.texto ? (
        <p className="rounded-md bg-muted/40 px-3 py-2.5 text-sm break-words whitespace-pre-wrap">
          {entrega.texto}
        </p>
      ) : null}

      {entrega.archivos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {entrega.archivos.map((a) => (
            <BotonArchivo key={a.storage_path} ruta={a.storage_path} nombre={a.name} />
          ))}
        </div>
      ) : null}

      <form action={accion} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={entrega.id} />

        <Textarea
          name="feedback"
          rows={2}
          defaultValue={entrega.feedback ?? ''}
          placeholder="Feedback para el alumno. Obligatorio si pides correcciones."
          aria-label="Feedback"
        />

        <AvisoAccion estado={estado} />
        <Botones />
      </form>
    </li>
  )
}
