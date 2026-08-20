'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { altaManual } from '@/lib/admin/acciones-alumnos'
import { SIN_ESTADO } from '@/lib/admin/tipos'

type Curso = {
  id: string
  titulo: string
  cohortes: Array<{ id: string; nombre: string }>
}

const claseSelect =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Dando de alta…' : 'Dar de alta'}
    </Button>
  )
}

/**
 * Alta manual (§3.1-A).
 *
 * Corre el mismo `darDeAlta` que el webhook de Stripe, así que el respaldo de
 * §11 produce exactamente el mismo resultado que una compra: cuenta, perfil,
 * inscripción y correo para definir contraseña.
 */
export function AltaManual({ cursos, reinicio }: { cursos: Curso[]; reinicio: number }) {
  const [estado, accion] = useActionState(altaManual, SIN_ESTADO)
  const [cursoId, setCursoId] = useState(cursos[0]?.id ?? '')

  const cohortes = cursos.find((c) => c.id === cursoId)?.cohortes ?? []

  if (cursos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Crea un curso antes de dar de alta alumnos.
      </p>
    )
  }

  return (
    <form
      key={reinicio}
      action={accion}
      className="flex flex-col gap-4 rounded-lg border border-border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alta-email">Correo</Label>
          <Input
            id="alta-email"
            name="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="alumno@empresa.com"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alta-nombre">Nombre</Label>
          <Input id="alta-nombre" name="nombre" placeholder="Nombre y apellido" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alta-curso">Curso</Label>
          <select
            id="alta-curso"
            name="course_id"
            value={cursoId}
            onChange={(e) => setCursoId(e.target.value)}
            className={claseSelect}
            required
          >
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alta-cohorte">Cohorte</Label>
          <select id="alta-cohorte" name="cohort_id" className={claseSelect}>
            <option value="">Sin cohorte</option>
            {cohortes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Se le manda un correo para que defina su contraseña. Si ya tiene cuenta, solo se
        le agrega la inscripción.
      </p>

      <AvisoAccion estado={estado} />

      <div>
        <Boton />
      </div>
    </form>
  )
}
