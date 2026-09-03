'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import type { CursoOpcion } from '@/components/admin/dar-de-alta'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import {
  actualizarEncuesta,
  eliminarEncuesta,
  nuevaCorrida,
  reiniciarEncuesta,
} from '@/lib/encuestas/acciones'
import type { EncuestaCompleta } from '@/lib/encuestas/consultas'

const claseSelect =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </Button>
  )
}

export function AjustesEncuesta({
  encuesta,
  cursos,
}: {
  encuesta: EncuestaCompleta
  cursos: CursoOpcion[]
}) {
  const [estado, accion] = useActionState(actualizarEncuesta, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-4">
      <form action={accion} className="flex flex-col gap-4 rounded-[10px] border border-border p-4">
        <input type="hidden" name="id" value={encuesta.id} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="aj-titulo">Título</Label>
          <Input
            id="aj-titulo"
            name="title"
            defaultValue={encuesta.title}
            required
            minLength={3}
            maxLength={160}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aj-curso">Curso</Label>
            <select
              id="aj-curso"
              name="course_id"
              required
              defaultValue={encuesta.course_id}
              className={claseSelect}
            >
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aj-cohorte">Cohorte</Label>
            <select
              id="aj-cohorte"
              name="cohort_id"
              defaultValue={encuesta.cohort_id ?? ''}
              className={claseSelect}
            >
              <option value="">Todo el curso</option>
              {cursos.flatMap((c) =>
                c.cohortes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nombre} · {c.titulo}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="aj-descripcion">Descripción</Label>
          <Textarea
            id="aj-descripcion"
            name="description"
            defaultValue={encuesta.description ?? ''}
            maxLength={400}
          />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Cómo se comporta en vivo</legend>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="allow_guests"
              defaultChecked={encuesta.allow_guests}
              className="mt-0.5 size-4 accent-vadai-cyan"
            />
            <span>
              Dejar entrar a quien no tiene cuenta
              <span className="block text-xs text-muted-foreground">
                Si lo apagas, solo contesta quien ya está en la academia. Útil en una sesión
                interna.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="show_names"
              defaultChecked={encuesta.show_names}
              className="mt-0.5 size-4 accent-vadai-cyan"
            />
            <span>
              Mostrar el nombre junto a cada respuesta
              <span className="block text-xs text-muted-foreground">
                Solo cambia lo que se proyecta. Quién contestó qué siempre queda guardado y sale
                en la exportación.
              </span>
            </span>
          </label>
        </fieldset>

        <AvisoAccion estado={estado} />

        <div>
          <Guardar />
        </div>
      </form>

      <details>
        <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          Correrla otra vez con otro grupo
        </summary>
        <form
          action={nuevaCorrida}
          className="mt-3 flex flex-col gap-3 rounded-[10px] border border-border p-4"
        >
          <input type="hidden" name="id" value={encuesta.id} />

          <p className="text-sm text-muted-foreground">
            Arranca la <span className="font-medium text-foreground">corrida{' '}
            {encuesta.totalCorridas + 1}</span> desde la pregunta 1, con la sala vacía.{' '}
            <span className="font-medium text-foreground">No borra nada</span>: lo que contestaron
            las {encuesta.totalCorridas} corrida(s) anteriores se queda guardado y sale en el
            Excel con su número.
          </p>
          <p className="text-xs text-muted-foreground">
            Lo que se proyecta y lo que ves en Resultados es siempre la corrida en curso.
          </p>

          <div>
            <Button type="submit" variant="outline">
              Empezar la corrida {encuesta.totalCorridas + 1}
            </Button>
          </div>
        </form>
      </details>

      <details>
        <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          Reiniciar esta encuesta
        </summary>
        <form
          action={reiniciarEncuesta}
          className="mt-3 flex flex-col gap-3 rounded-[10px] border border-border p-4"
        >
          <input type="hidden" name="id" value={encuesta.id} />

          <p className="text-sm text-muted-foreground">
            Borra <span className="font-medium text-foreground">todas</span> las respuestas —de
            las {encuesta.totalCorridas} corrida(s)— y deja las {encuesta.preguntas.length}{' '}
            pregunta(s) sin abrir, como si nunca se hubiera corrido. Las preguntas y su orden se
            quedan tal cual. Sirve para borrar un ensayo; para conservar el historial, usa
            &ldquo;correrla otra vez&rdquo; de arriba.
          </p>

          {/*
            Los participantes NO se borran por defecto, y no es una omisión: los
            correos y teléfonos que dejó la sala son lo más valioso que produce
            esta dinámica. Un "reiniciar" que se los lleva en silencio sería una
            forma elegante de perder el padrón de un evento.
          */}
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="borrar_participantes"
              className="mt-0.5 size-4 accent-vadai-cyan"
            />
            <span>
              Borrar también a los {encuesta.totalParticipantes} participante(s)
              <span className="block text-xs text-muted-foreground">
                Solo si esto fue un ensayo. Si el evento fue real, deja esto apagado: perderías
                los correos y teléfonos que capturaste, y son irrecuperables.
              </span>
            </span>
          </label>

          <div>
            <Button type="submit" variant="outline">
              Reiniciar desde la pregunta 1
            </Button>
          </div>
        </form>
      </details>

      <details>
        <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          Eliminar esta encuesta
        </summary>
        <form
          action={eliminarEncuesta}
          className="mt-3 flex flex-col gap-3 rounded-[10px] border border-destructive/40 bg-destructive/5 p-4"
        >
          <input type="hidden" name="id" value={encuesta.id} />
          <p className="text-sm text-muted-foreground">
            Se borran también sus preguntas y todas las respuestas que haya recibido. No hay
            manera de recuperarlas.
            {encuesta.totalParticipantes > 0
              ? ` Ya participaron ${encuesta.totalParticipantes} persona(s).`
              : ''}
          </p>
          <div>
            <Button type="submit" variant="destructive">
              Sí, eliminar la encuesta
            </Button>
          </div>
        </form>
      </details>
    </div>
  )
}
