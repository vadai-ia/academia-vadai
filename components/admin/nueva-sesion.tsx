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

/**
 * `reinicio` cambia cuando se agrega una sesión: React remonta el formulario y
 * los campos vuelven a su valor por default.
 *
 * Se hace así, y no envolviendo la acción en una función que llame a reset(),
 * porque ese envoltorio es una función de CLIENTE: Next deja de emitir el campo
 * oculto $ACTION_ID y el formulario pasa a depender de JavaScript. Con la acción
 * pasada directa, el form funciona aunque el JS falle.
 */
export function NuevaSesion({ cohorteId, reinicio }: { cohorteId: string; reinicio: number }) {
  const [estado, accion] = useActionState(crearSesion, SIN_ESTADO)

  return (
    <form
      key={reinicio}
      action={accion}
      className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-4"
    >
      <input type="hidden" name="cohort_id" value={cohorteId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sesion-titulo">Título</Label>
        <Input
          id="sesion-titulo"
          name="title"
          placeholder="Sesión 1 · Fundamentos de Claude"
          required
          minLength={2}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sesion-fecha">Fecha</Label>
          <Input id="sesion-fecha" name="fecha" type="date" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sesion-hora">Hora (CDMX)</Label>
          <Input id="sesion-hora" name="hora" type="time" required defaultValue="19:00" />
          <p className="text-xs text-muted-foreground">
            Se captura en horario de Ciudad de México. Cada alumno la verá en su
            propia hora local.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sesion-meet">Link de Google Meet</Label>
        <Input
          id="sesion-meet"
          name="meet_url"
          type="url"
          placeholder="https://meet.google.com/abc-defg-hij"
        />
        <p className="text-xs text-muted-foreground">
          El botón &ldquo;Unirse&rdquo; se activa 15 minutos antes de la hora.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sesion-descripcion">Descripción</Label>
        <Textarea
          id="sesion-descripcion"
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
