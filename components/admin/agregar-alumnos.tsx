'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { ListaSeleccionable } from '@/components/admin/lista-seleccionable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { altaManual, inscribirEnCurso } from '@/lib/admin/acciones-alumnos'
import type { Candidato } from '@/lib/admin/inscritos'
import { SIN_ESTADO } from '@/lib/admin/tipos'

/**
 * Agregar gente a un curso, desde la página del curso.
 *
 * Dos caminos, porque son dos casos:
 *
 *   - Ya tiene cuenta → se BUSCA (con mil cuentas una lista completa no sirve
 *     ni pesa lo que debe), se marcan varias y se les da acceso
 *     (`inscribirEnCurso`). Se les avisa por correo.
 *   - Todavía no tiene cuenta → por correo, con `altaManual`: el MISMO alta que
 *     usa /admin/alumnos y el webhook de Stripe, con su correo de bienvenida.
 *     Aquí también se le pone empresa.
 *
 * La búsqueda es un <form> GET: viaja en la URL (`?buscar=`) y funciona sin
 * JavaScript. Las acciones van directas al <form> (CLAUDE.md).
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
type EmpresaOpcion = { id: string; nombre: string }

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

function SelectorDeEmpresa({ id, empresas }: { id: string; empresas: EmpresaOpcion[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Empresa</Label>
      <select id={id} name="company_id" defaultValue="" className={claseSelect}>
        <option value="">General (sin empresa)</option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
    </div>
  )
}

export function AgregarAlumnos({
  cursoId,
  candidatos,
  buscar,
  grupos,
  empresas,
  reinicio,
}: {
  cursoId: string
  /** Los que coinciden con `buscar` y no tienen el curso; máximo treinta. */
  candidatos: Candidato[]
  buscar: string
  grupos: Grupo[]
  empresas: EmpresaOpcion[]
  /** Cambia cuando cambia el padrón del curso: remonta los formularios limpios. */
  reinicio: number
}) {
  const [estadoLista, inscribir] = useActionState(inscribirEnCurso, SIN_ESTADO)
  const [estadoCorreo, darDeAlta] = useActionState(altaManual, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-3" id="agregar">
      <details className="group/agregar rounded-[10px] border border-dashed border-border" open={Boolean(buscar)}>
        <summary className={`${claseResumen} text-primary`}>+ Agregar alumnos</summary>

        <div className="flex flex-col gap-4 px-3 pb-3">
          {/* --- Ya tienen cuenta: buscar y marcar ---------------------- */}
          <form method="get" action={`/admin/cursos/${cursoId}`} className="flex flex-wrap items-end gap-2 pt-1">
            <label className="flex min-w-56 flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium">Buscar a quien ya tiene cuenta</span>
              <Input
                type="search"
                name="buscar"
                defaultValue={buscar}
                placeholder="Nombre, correo o empresa…"
                autoComplete="off"
              />
            </label>
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>

          {candidatos.length > 0 ? (
            <form key={`lista-${reinicio}-${buscar}`} action={inscribir} className="flex flex-col gap-4">
              <input type="hidden" name="course_id" value={cursoId} />

              <ListaSeleccionable
                nombre="user_ids"
                leyenda={
                  buscar
                    ? `${candidatos.length} coinciden con "${buscar}" y no tienen este curso`
                    : `Sin este curso (los primeros ${candidatos.length}; busca para acotar)`
                }
                conScroll
                grupos={[
                  {
                    clave: 'personas',
                    opciones: candidatos.map((c) => ({
                      valor: c.userId,
                      etiqueta: c.nombre || c.email,
                      detalle: [c.nombre ? c.email : null, c.empresa].filter(Boolean).join(' · ') || undefined,
                    })),
                  },
                ]}
              />

              <SelectorDeGrupo id="grupo-lista" grupos={grupos} />

              <p className="text-xs text-muted-foreground">
                Toca a quienes quieras; toca otra vez para quitar. Se les avisa por correo que ya
                tienen el curso.
              </p>

              <div>
                <Enviar>Dar acceso</Enviar>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {buscar
                ? `Nadie sin este curso coincide con "${buscar}".`
                : 'Todas las personas con cuenta ya tienen este curso.'}
            </p>
          )}

          {/* --- Todavía no tiene cuenta ----------------------------------- */}
          <details className="border-t border-border pt-2">
            <summary className={claseResumen}>Alguien que todavía no tiene cuenta</summary>

            <form
              key={`correo-${reinicio}`}
              action={darDeAlta}
              className="flex flex-col gap-4 px-1 pt-3"
            >
              <input type="hidden" name="course_id" value={cursoId} />

              <div className="grid gap-4 sm:grid-cols-3">
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
                <SelectorDeEmpresa id="nuevo-empresa" empresas={empresas} />
              </div>

              <SelectorDeGrupo id="grupo-correo" grupos={grupos} />

              <p className="text-xs text-muted-foreground">
                Se le crea la cuenta y se le manda un correo para que defina su contraseña. Si el
                correo ya tiene cuenta, solo se le agrega el curso y se le avisa.
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
