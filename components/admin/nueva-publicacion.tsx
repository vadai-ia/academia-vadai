'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { CerrarDesplegable } from '@/components/admin/cerrar-desplegable'
import { Desplegable } from '@/components/admin/desplegable'
import { EditorRico } from '@/components/admin/editor-rico'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearPublicacion } from '@/lib/admin/acciones-blog'
import { SIN_ESTADO } from '@/lib/admin/tipos'

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
      <CerrarDesplegable />
    </div>
  )
}

/** El botón "Nueva publicación" y, detrás, su formulario con el editor (M14). */
export function NuevaPublicacion({
  cursos,
  reinicio,
}: {
  cursos: Array<{ id: string; titulo: string; generaciones: Array<{ id: string; nombre: string }> }>
  reinicio: number
}) {
  const [estado, accion] = useActionState(crearPublicacion, SIN_ESTADO)

  return (
    <Desplegable etiqueta="Nueva publicación" variante="primario" abierto={Boolean(estado.error || estado.aviso)}>
      <form key={reinicio} action={accion} className="flex flex-col gap-4">
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
            {/* Todos, un curso completo (todas sus generaciones) o una sola
                generación (M16). Un valor con prefijo, que el servidor reparte
                en `audience_course_id` / `audience_cohort_id`. */}
            <select id="pub-audiencia" name="audiencia" className={claseSelect}>
              <option value="">Todos los alumnos</option>
              {cursos.map((c) =>
                c.generaciones.length === 0 ? (
                  <option key={c.id} value={`curso:${c.id}`}>
                    Solo {c.titulo}
                  </option>
                ) : (
                  <optgroup key={c.id} label={c.titulo}>
                    <option value={`curso:${c.id}`}>Todas sus generaciones</option>
                    {c.generaciones.map((g) => (
                      <option key={g.id} value={`gen:${g.id}`}>
                        Solo {g.nombre}
                      </option>
                    ))}
                  </optgroup>
                )
              )}
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
    </Desplegable>
  )
}
