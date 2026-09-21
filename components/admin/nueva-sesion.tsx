'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { crearSesion } from '@/lib/admin/acciones-cohortes'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Agendando…' : 'Agendar sesión'}
    </Button>
  )
}

export type CohorteParaAgendar = { id: string; nombre: string; cursoTitulo: string }

/**
 * `reinicio` cambia cuando se agrega una sesión: React remonta el formulario y
 * los campos vuelven a su valor por default.
 *
 * Se hace así, y no envolviendo la acción en una función que llame a reset(),
 * porque ese envoltorio es una función de CLIENTE: Next deja de emitir el campo
 * oculto $ACTION_ID y el formulario pasa a depender de JavaScript. Con la acción
 * pasada directa, el form funciona aunque el JS falle.
 *
 * Dos lugares lo usan. La página de una cohorte pasa `cohorteId` y el campo va
 * oculto. El panel principal pasa `cohortes` y la cohorte se elige en un
 * <select>: desde ahí se agenda la sesión de la semana sin ir a buscar el
 * curso, la cohorte y luego el formulario.
 */
export function NuevaSesion({
  cohorteId,
  cohortes,
  reinicio,
}: {
  cohorteId?: string
  cohortes?: CohorteParaAgendar[]
  reinicio: number
}) {
  const [estado, accion] = useActionState(crearSesion, SIN_ESTADO)
  const sufijo = cohorteId ?? 'panel'

  return (
    <form
      key={reinicio}
      action={accion}
      className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-4"
    >
      {cohorteId ? (
        <input type="hidden" name="cohort_id" value={cohorteId} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sesion-cohorte-${sufijo}`}>Cohorte</Label>
          <select
            id={`sesion-cohorte-${sufijo}`}
            name="cohort_id"
            required
            defaultValue={cohortes?.length === 1 ? cohortes[0]?.id : ''}
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="" disabled>
              Elige la cohorte
            </option>
            {(cohortes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.cursoTitulo} · {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`sesion-titulo-${sufijo}`}>Título</Label>
        <Input
          id={`sesion-titulo-${sufijo}`}
          name="title"
          placeholder="Sesión 1 · Contexto del mundo y arranque del tour"
          required
          minLength={2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sesion-fecha-${sufijo}`}>Fecha</Label>
          <Input id={`sesion-fecha-${sufijo}`} name="fecha" type="date" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sesion-hora-${sufijo}`}>Hora (CDMX)</Label>
          <Input id={`sesion-hora-${sufijo}`} name="hora" type="time" required defaultValue="19:00" />
          <p className="text-xs text-muted-foreground">
            Se captura en horario de Ciudad de México. Cada alumno la verá en su
            propia hora local.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`sesion-liga-${sufijo}`}>Liga de la sesión (Zoom o Meet)</Label>
        <Input
          id={`sesion-liga-${sufijo}`}
          name="meet_url"
          type="url"
          placeholder="https://us02web.zoom.us/j/…"
        />
        <p className="text-xs text-muted-foreground">
          El botón &ldquo;Unirse&rdquo; se activa 15 minutos antes de la hora.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`sesion-descripcion-${sufijo}`}>Descripción</Label>
        <Textarea
          id={`sesion-descripcion-${sufijo}`}
          name="description"
          rows={2}
          placeholder="Qué se ve en esta sesión. Opcional."
        />
      </div>

      <AvisoAccion estado={estado} />

      <div>
        <Boton />
      </div>
    </form>
  )
}
