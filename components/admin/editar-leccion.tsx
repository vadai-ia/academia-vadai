'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ajustarLeccion, eliminarLeccion } from '@/lib/admin/acciones'
import { ETIQUETA_ESTADO_LECCION, ETIQUETA_TIPO_LECCION, SIN_ESTADO } from '@/lib/admin/tipos'

export type LeccionEditable = {
  id: string
  title: string
  lesson_type: keyof typeof ETIQUETA_TIPO_LECCION
  status: keyof typeof ETIQUETA_ESTADO_LECCION
  is_required: boolean
}

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </Button>
  )
}

/**
 * Editar una lección sin abrirla (M14).
 *
 * Título, tipo, estado y si cuenta para el certificado: lo que se cambia a
 * diario. Hasta hoy había que entrar a la lección una por una —publicar un
 * módulo de quince eran quince viajes— y el título no se podía tocar desde el
 * árbol en absoluto.
 *
 * El video, el texto rico y los adjuntos siguen en el editor completo, que
 * está a un clic de aquí. `ajustarLeccion` NO los toca: mandarlos vacíos en
 * este formulario los borraría.
 *
 * El borrado va FUERA del <form>: un <form> dentro de otro no es HTML válido.
 */
export function EditarLeccion({
  leccion,
  cursoId,
  ubicacion,
}: {
  leccion: LeccionEditable
  cursoId: string
  /** "3.2 · Título", para que el modal de borrar diga cuál es. */
  ubicacion: string
}) {
  const [estado, accion] = useActionState(ajustarLeccion, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-3">
      <form action={accion} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={leccion.id} />
        <input type="hidden" name="course_id" value={cursoId} />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`titulo-${leccion.id}`}>Título</Label>
            <Input
              id={`titulo-${leccion.id}`}
              name="title"
              defaultValue={leccion.title}
              required
              minLength={2}
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`tipo-${leccion.id}`}>Tipo</Label>
            <select
              id={`tipo-${leccion.id}`}
              name="lesson_type"
              defaultValue={leccion.lesson_type}
              className={`${claseSelect} sm:w-auto`}
            >
              {Object.entries(ETIQUETA_TIPO_LECCION).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`estado-${leccion.id}`}>Estado</Label>
            <select
              id={`estado-${leccion.id}`}
              name="status"
              defaultValue={leccion.status}
              className={`${claseSelect} sm:w-auto`}
            >
              {Object.entries(ETIQUETA_ESTADO_LECCION).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            name="is_required"
            type="checkbox"
            value="true"
            defaultChecked={leccion.is_required}
            className="mt-0.5 size-4 accent-vadai-cyan"
          />
          <span>
            Obligatoria para el certificado
            <span className="block text-xs text-muted-foreground">
              Sin ella marcada, el alumno puede certificarse aunque no la complete.
            </span>
          </span>
        </label>

        <AvisoAccion estado={estado} />

        <div className="flex flex-wrap items-center gap-2">
          <Guardar />
          <Button asChild variant="ghost" size="sm">
            <Link href={`/admin/lecciones/${leccion.id}`}>
              Abrir el editor completo (video, texto y adjuntos) →
            </Link>
          </Button>
        </div>
      </form>

      <div className="flex justify-end border-t border-border pt-3">
        <ConfirmarConModal
          idModal={`eliminar-leccion-${leccion.id}`}
          accion={eliminarLeccion}
          campos={{ id: leccion.id, course_id: cursoId }}
          boton={{
            texto: 'Eliminar lección',
            etiquetaAccesible: `Eliminar la lección ${leccion.title}`,
            tono: 'destructivo',
          }}
          titulo={`¿Eliminar «${leccion.title}»?`}
          confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
        >
          <p>
            Es la lección {ubicacion}. Se borra con su video ligado, adjuntos, quiz o tarea, y el
            avance que los alumnos tuvieran en ella. No se puede deshacer.
          </p>
        </ConfirmarConModal>
      </div>
    </div>
  )
}
