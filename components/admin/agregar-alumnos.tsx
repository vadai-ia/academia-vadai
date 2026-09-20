'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { ListaSeleccionable } from '@/components/admin/lista-seleccionable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { altaManual, inscribirEnCurso } from '@/lib/admin/acciones-alumnos'
import type { CandidatoAlCurso } from '@/lib/admin/alumnos'
import { SIN_ESTADO } from '@/lib/admin/tipos'

/**
 * Agregar gente a un curso, desde la página del curso.
 *
 * Es el espejo de "Dar acceso a otro curso" en la fila del alumno: la misma
 * inscripción, creada desde el otro lado. Dos caminos, porque son dos casos:
 *
 *   - Ya tiene cuenta → se elige de la lista, varias personas a la vez
 *     (`inscribirEnCurso`). No manda correo.
 *   - Todavía no tiene cuenta → por correo, con `altaManual`: el MISMO alta que
 *     usa /admin/alumnos y el webhook de Stripe, con su correo de bienvenida.
 *
 * Todo lo que se abre es `<details>` y las acciones van directas al `<form>`:
 * funciona sin JavaScript (CLAUDE.md).
 *
 * Los avisos viven aquí arriba y no dentro de cada formulario: cuando se agrega
 * a la última persona que faltaba, la lista deja de pintarse y se llevaría el
 * aviso consigo.
 */

const claseSelect =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

const claseResumen =
  'inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 ' +
  'text-sm font-medium select-none hover:bg-muted ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ' +
  '[&::-webkit-details-marker]:hidden'

type Grupo = { id: string; nombre: string }

function Enviar({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Procesando…' : children}
    </Button>
  )
}

function SelectorDeGrupo({ id, grupos }: { id: string; grupos: Grupo[] }) {
  if (grupos.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Grupo</Label>
      <select id={id} name="cohort_id" defaultValue="" className={claseSelect}>
        <option value="">Sin grupo</option>
        {grupos.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nombre}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        El grupo decide qué calendario de sesiones en vivo ve. Aplica a todos los que agregues
        ahora.
      </p>
    </div>
  )
}

export function AgregarAlumnos({
  cursoId,
  candidatos,
  grupos,
  reinicio,
}: {
  cursoId: string
  candidatos: CandidatoAlCurso[]
  grupos: Grupo[]
  /** Cambia cuando cambia el padrón del curso: remonta los formularios limpios. */
  reinicio: number
}) {
  const [estadoLista, inscribir] = useActionState(inscribirEnCurso, SIN_ESTADO)
  const [estadoCorreo, darDeAlta] = useActionState(altaManual, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-3">
      <details className="group/agregar rounded-[10px] border border-dashed border-border">
        <summary className={`${claseResumen} text-primary`}>+ Agregar alumnos</summary>

        <div className="flex flex-col gap-2 px-3 pb-3">
          {candidatos.length > 0 ? (
            <form key={`lista-${reinicio}`} action={inscribir} className="flex flex-col gap-4 pt-1">
              <input type="hidden" name="course_id" value={cursoId} />

              <ListaSeleccionable
                nombre="user_ids"
                leyenda="Personas que ya tienen cuenta"
                conScroll
                grupos={[
                  {
                    clave: 'personas',
                    opciones: candidatos.map((c) => ({
                      valor: c.userId,
                      etiqueta: c.nombre || c.email,
                      detalle: c.nombre ? c.email : undefined,
                    })),
                  },
                ]}
              />

              <SelectorDeGrupo id="grupo-lista" grupos={grupos} />

              <p className="text-xs text-muted-foreground">
                Toca a quienes quieras; toca otra vez para quitar. No se les manda correo: al
                entrar, encuentran el curso en su lista.
              </p>

              <div>
                <Enviar>Dar acceso</Enviar>
              </div>
            </form>
          ) : (
            <p className="pt-1 text-sm text-muted-foreground">
              Todas las personas con cuenta ya tienen este curso.
            </p>
          )}

          <details className="border-t border-border pt-2">
            <summary className={claseResumen}>Alguien que todavía no tiene cuenta</summary>

            <form
              key={`correo-${reinicio}`}
              action={darDeAlta}
              className="flex flex-col gap-4 px-1 pt-3"
            >
              <input type="hidden" name="course_id" value={cursoId} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nuevo-correo">Correo</Label>
                  <Input
                    id="nuevo-correo"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="alumno@empresa.com"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nuevo-nombre">Nombre</Label>
                  <Input id="nuevo-nombre" name="nombre" placeholder="Nombre y apellido" />
                </div>
              </div>

              <SelectorDeGrupo id="grupo-correo" grupos={grupos} />

              <p className="text-xs text-muted-foreground">
                Se le crea la cuenta y se le manda un correo para que defina su contraseña.
              </p>

              <div>
                <Enviar>Dar de alta en este curso</Enviar>
              </div>
            </form>
          </details>
        </div>
      </details>

      <AvisoAccion estado={estadoLista} />
      <AvisoAccion estado={estadoCorreo} />
    </div>
  )
}
