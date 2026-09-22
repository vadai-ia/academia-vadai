'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { SelectorDeEmpresa, type EmpresaOpcion } from '@/components/admin/dar-de-alta'
import { Desplegable } from '@/components/admin/desplegable'
import { claseResumen, claseSelect } from '@/components/admin/estilos'
import { ListaSeleccionable } from '@/components/admin/lista-seleccionable'
import { AutoEnviar } from '@/components/ui-vadai/auto-enviar'
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
 * JavaScript. Las acciones van directas al <form> (CLAUDE.md). Todo vive
 * detrás del botón "Agregar alumnos" (M14), que se abre solo si hay una
 * búsqueda en la URL o si una acción contestó algo.
 */

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
      <Label htmlFor={id}>Generación</Label>
      <select id={id} name="cohort_id" defaultValue="" className={claseSelect}>
        <option value="">Sin generación</option>
        {grupos.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nombre}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        La generación decide qué calendario de sesiones en vivo ve. Aplica a todos los que agregues
        ahora.
      </p>
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
  const contestoLista = Boolean(estadoLista.error || estadoLista.aviso)
  const contestoCorreo = Boolean(estadoCorreo.error || estadoCorreo.aviso)

  return (
    <div className="flex flex-col gap-3" id="agregar">
      <Desplegable
        etiqueta="Agregar alumnos"
        variante="primario"
        abierto={Boolean(buscar) || contestoLista || contestoCorreo}
      >
        <div className="flex flex-col gap-4">
          {/* --- Ya tienen cuenta: buscar y marcar ---------------------- */}
          <form method="get" action={`/admin/cursos/${cursoId}`} className="flex flex-wrap items-end gap-2">
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
            <Button type="submit" variant="outline" data-aplicar>
              Buscar
            </Button>
            <AutoEnviar />
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

              <AvisoAccion estado={estadoLista} />

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
          <details className="border-t border-border pt-2" open={contestoCorreo || undefined}>
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

              <AvisoAccion estado={estadoCorreo} />

              <div>
                <Enviar>Dar de alta en este curso</Enviar>
              </div>
            </form>
          </details>
        </div>
      </Desplegable>
    </div>
  )
}
