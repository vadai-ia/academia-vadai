'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { CerrarDesplegable } from '@/components/admin/cerrar-desplegable'
import { Desplegable } from '@/components/admin/desplegable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearSesionesEnSerie } from '@/lib/admin/acciones-cohortes'
import { DIAS } from '@/lib/admin/fechas'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Agendando…' : 'Agendar la serie'}
    </Button>
  )
}

/**
 * "8 sesiones, lunes y jueves a las 6, desde el 21 de septiembre, con esta
 * liga". Planear el curso completo de una vez, para que los alumnos vean las
 * fechas desde el primer día. Después cada sesión se edita con su tema.
 */
export function SesionesEnSerie({
  cohorteId,
  reinicio,
  nombre,
}: {
  cohorteId: string
  reinicio: number
  /** Acordeón: los desplegables con el mismo nombre se cierran entre sí. */
  nombre?: string
}) {
  const [estado, accion] = useActionState(crearSesionesEnSerie, SIN_ESTADO)

  return (
    <Desplegable
      etiqueta="Agendar varias de una vez"
      variante="contorno"
      nombre={nombre}
      abierto={Boolean(estado.error || estado.aviso)}
    >
      <form key={reinicio} action={accion} className="flex flex-col gap-4">
        <input type="hidden" name="cohort_id" value={cohorteId} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-titulo">Título base</Label>
            <Input id="serie-titulo" name="titulo_base" defaultValue="Sesión" required minLength={2} />
            <p className="text-xs text-muted-foreground">Salen numeradas: Sesión 1, Sesión 2…</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-cantidad">Cuántas</Label>
            <Input id="serie-cantidad" name="cantidad" type="number" min={1} max={40} defaultValue={8} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-hora">Hora (CDMX)</Label>
            <Input id="serie-hora" name="hora" type="time" required defaultValue="18:00" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serie-fecha">Primera fecha</Label>
            <Input id="serie-fecha" name="fecha" type="date" required />
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium">Días de la semana</legend>
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map((dia, i) => (
                <label
                  key={dia}
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-sm select-none has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                >
                  <input type="checkbox" name="dias" value={i} defaultChecked={i === 1 || i === 4} className="size-3.5 accent-primary" />
                  {dia}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Sin ninguno marcado, se repite el día de la primera fecha.
            </p>
          </fieldset>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="serie-liga">Liga de la sesión (Zoom o Meet)</Label>
          <Input id="serie-liga" name="meet_url" type="url" placeholder="https://us02web.zoom.us/j/…" />
          <p className="text-xs text-muted-foreground">La misma para todas. Se puede cambiar una por una después.</p>
        </div>

        <AvisoAccion estado={estado} />

        <div className="flex flex-wrap gap-2">
          <Boton />
          <CerrarDesplegable />
        </div>
      </form>
    </Desplegable>
  )
}
