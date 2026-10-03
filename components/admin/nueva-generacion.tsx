'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearGeneracion } from '@/lib/admin/acciones-generaciones'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creando…' : 'Crear generación'}
    </Button>
  )
}

/**
 * El formulario de la pestaña «+ Nueva generación» (M16).
 *
 * Qué pasa con el contenido lo decide el curso:
 *   - sin generaciones todavía: el contenido actual PASA a esta primera
 *     generación (no hay opción: es lo único coherente);
 *   - con generaciones: se copia la estructura de una de ellas —sin videos ni
 *     grabaciones, lecciones en borrador— o se empieza vacía.
 *
 * La acción redirige a la pestaña de la generación nueva con el aviso.
 */
export function NuevaGeneracion({
  cursoId,
  porGeneraciones,
  modulosDelCurso,
  generaciones,
  propuesta,
}: {
  cursoId: string
  porGeneraciones: boolean
  /** Módulos a nivel curso (curso sin generaciones): lo que se movería. */
  modulosDelCurso: number
  generaciones: Array<{ id: string; nombre: string; modulos: number }>
  /** Nombre sugerido: «Generación N». */
  propuesta: string
}) {
  const [estado, accion] = useActionState(crearGeneracion, SIN_ESTADO)
  const conContenido = generaciones.filter((g) => g.modulos > 0)

  return (
    <form action={accion} className="flex max-w-2xl flex-col gap-4 rounded-[10px] border border-border bg-card p-5">
      <input type="hidden" name="course_id" value={cursoId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="gen-nueva-nombre">Nombre</Label>
          <Input id="gen-nueva-nombre" name="name" defaultValue={propuesta} placeholder="Generación 2 · nov–dic 2026" required minLength={2} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-nueva-inicio">Inicia</Label>
          <Input id="gen-nueva-inicio" name="starts_on" type="date" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-nueva-fin">Termina</Label>
          <Input id="gen-nueva-fin" name="ends_on" type="date" />
        </div>
      </div>

      {porGeneraciones ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-nueva-copiar">Contenido</Label>
          <select id="gen-nueva-copiar" name="copiar_de" defaultValue={conContenido[0]?.id ?? ''} className={claseSelect}>
            <option value="">Empezar vacía</option>
            {conContenido.map((g) => (
              <option key={g.id} value={g.id}>
                Copiar la estructura de {g.nombre} ({g.modulos} módulo{g.modulos === 1 ? '' : 's'})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Copiar trae módulos, lecciones, adjuntos, quizzes y tareas, sin videos ni grabaciones.
            Las lecciones copiadas nacen en borrador: se publican cuando les subas su video.
          </p>
        </div>
      ) : (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Es la primera generación del curso.{' '}
          {modulosDelCurso > 0
            ? `Sus ${modulosDelCurso} módulo${modulosDelCurso === 1 ? '' : 's'} actuales pasan a ella (no se copian: el avance de los alumnos se conserva) y `
            : 'A partir de aquí '}
          cada generación tendrá su propio contenido, calendario y comunidad.
        </p>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="abrir_inscripciones" defaultChecked className="mt-1 size-4 accent-primary" />
        <span>
          <span className="font-medium">Abrir a inscripciones</span>
          <span className="block text-xs text-muted-foreground">
            Las compras, el catálogo y las altas sin elección caen en la generación abierta. Solo
            puede haber una: si otra lo estaba, se cierra.
          </span>
        </span>
      </label>

      <AvisoAccion estado={estado} />

      <div>
        <Boton />
      </div>
    </form>
  )
}
