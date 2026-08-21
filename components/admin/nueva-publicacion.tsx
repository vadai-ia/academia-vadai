'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { EditorRico } from '@/components/admin/editor-rico'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearPublicacion } from '@/lib/admin/acciones-blog'
import { SIN_ESTADO } from '@/lib/admin/tipos'

const claseSelect =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Botones() {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="publicar" value="si" disabled={pending}>
        {pending ? 'Guardando…' : 'Publicar ahora'}
      </Button>
      <Button type="submit" name="publicar" value="no" variant="outline" disabled={pending}>
        Guardar borrador
      </Button>
    </div>
  )
}

export function NuevaPublicacion({
  cursos,
  reinicio,
}: {
  cursos: Array<{ id: string; titulo: string }>
  reinicio: number
}) {
  const [estado, accion] = useActionState(crearPublicacion, SIN_ESTADO)

  return (
    <form
      key={reinicio}
      action={accion}
      className="flex flex-col gap-4 rounded-lg border border-border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="pub-titulo">Título</Label>
          <Input id="pub-titulo" name="title" required minLength={3} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pub-tipo">Tipo</Label>
          <select id="pub-tipo" name="post_type" defaultValue="announcement" className={claseSelect}>
            <option value="announcement">Anuncio — destacado para el alumno</option>
            <option value="blog">Blog — aparece en /blog</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pub-audiencia">Para quién</Label>
          <select id="pub-audiencia" name="audience_course_id" className={claseSelect}>
            <option value="">Todos los alumnos</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                Solo {c.titulo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="pub-portada">URL de portada</Label>
          <Input id="pub-portada" name="cover_url" type="url" placeholder="https://… (opcional)" />
        </div>
      </div>

      <EditorRico nombre="content_rich" contenidoInicial={null} etiqueta="Contenido" />

      <AvisoAccion estado={estado} />

      <Botones />
    </form>
  )
}
