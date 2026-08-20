'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { EditorRico } from '@/components/admin/editor-rico'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { actualizarLeccion } from '@/lib/admin/acciones'
import type { Leccion } from '@/lib/admin/consultas'
import { ETIQUETA_ESTADO_LECCION, ETIQUETA_TIPO_LECCION, SIN_ESTADO } from '@/lib/admin/tipos'

import { AvisoAccion } from './aviso-accion'

const claseSelect =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar lección'}
    </Button>
  )
}

export function FormularioLeccion({
  leccion,
  cursoId,
}: {
  leccion: Leccion
  cursoId: string
}) {
  const [estado, accion] = useActionState(actualizarLeccion, SIN_ESTADO)
  const [tipo, setTipo] = useState(leccion.lesson_type)

  return (
    <form action={accion} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={leccion.id} />
      <input type="hidden" name="module_id" value={leccion.module_id} />
      <input type="hidden" name="course_id" value={cursoId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" defaultValue={leccion.title} required minLength={2} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="lesson_type">Tipo</Label>
          <select
            id="lesson_type"
            name="lesson_type"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            className={claseSelect}
          >
            {Object.entries(ETIQUETA_TIPO_LECCION).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            name="status"
            defaultValue={leccion.status}
            className={claseSelect}
          >
            {Object.entries(ETIQUETA_ESTADO_LECCION).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="is_required">Obligatoria</Label>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              id="is_required"
              name="is_required"
              type="checkbox"
              value="true"
              defaultChecked={leccion.is_required}
              className="size-4 accent-vadai-cyan"
            />
            Cuenta para el certificado
          </label>
        </div>
      </div>

      {tipo === 'video' ? (
        <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Video</h3>
            <p className="text-xs text-muted-foreground">
              Sube el video en el panel de Bunny Stream y pega aquí su GUID. La URL de
              reproducción se firma en el servidor: nunca se expone sin token.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bunny_video_id">GUID de Bunny</Label>
              <Input
                id="bunny_video_id"
                name="bunny_video_id"
                defaultValue={leccion.bunny_video_id ?? ''}
                placeholder="8f2c1e4a-…"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="video_duration_sec">Duración (segundos)</Label>
              <Input
                id="video_duration_sec"
                name="video_duration_sec"
                type="number"
                min="1"
                step="1"
                defaultValue={leccion.video_duration_sec ?? ''}
                placeholder="600"
              />
            </div>
          </div>
        </section>
      ) : (
        <>
          <input type="hidden" name="bunny_video_id" value={leccion.bunny_video_id ?? ''} />
          <input
            type="hidden"
            name="video_duration_sec"
            value={leccion.video_duration_sec ?? ''}
          />
        </>
      )}

      <EditorRico
        nombre="description_rich"
        contenidoInicial={leccion.description_rich}
        etiqueta="Descripción"
        ayuda="Lo que el alumno lee debajo del video."
      />

      <AvisoAccion estado={estado} />

      <div>
        <Guardar />
      </div>
    </form>
  )
}
