'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cambiarDeGeneracion } from '@/lib/admin/acciones-alumnos'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { ETIQUETA_ESTADO, type EstadoGeneracion } from '@/lib/generaciones'

/** El `id` del formulario: las casillas de la tabla le pertenecen con `form=`. */
export const FORMULARIO_CAMBIO = 'cambiar-generacion'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? 'Cambiando…' : 'Cambiar a los marcados'}
    </Button>
  )
}

/**
 * Cambia de generación a los inscritos marcados en la tabla (M16).
 *
 * El formulario vive FUERA de la tabla y cada fila le presta una casilla con
 * el atributo `form`: así no hay un formulario por fila (la tabla ya tiene
 * dos) y funciona sin JavaScript. Sirve igual para asignar generación a quien
 * no tiene y para pasar a alguien de la 1 a la 2.
 */
export function AsignarGeneracion({
  cursoId,
  generaciones,
  actual,
}: {
  cursoId: string
  generaciones: Array<{ id: string; nombre: string; estado: EstadoGeneracion }>
  /** La generación de la pestaña: se propone otra, que es a lo que se viene. */
  actual: string | null
}) {
  const [estado, accion] = useActionState(cambiarDeGeneracion, SIN_ESTADO)
  const propuesta = generaciones.find((g) => g.id !== actual)?.id ?? generaciones[0]?.id ?? ''

  return (
    <form id={FORMULARIO_CAMBIO} action={accion} className="flex flex-wrap items-end gap-3 rounded-[10px] border border-border px-4 py-3">
      <input type="hidden" name="course_id" value={cursoId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="cambio-generacion" className="text-xs text-muted-foreground">
          Cambiar de generación
        </Label>
        <select id="cambio-generacion" name="cohort_id" defaultValue={propuesta} className={claseSelect}>
          {generaciones.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
              {g.estado !== 'en_curso' ? ` · ${ETIQUETA_ESTADO[g.estado]}` : ''}
            </option>
          ))}
        </select>
      </div>
      <Boton />
      <span className="text-xs text-muted-foreground">
        Marca a las personas en la tabla. Ven la nueva generación y dejan de ver la anterior; su
        avance y sus puntos se conservan.
      </span>
      <AvisoAccion estado={estado} />
    </form>
  )
}
