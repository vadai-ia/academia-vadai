'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { ListaSeleccionable, gruposDesdeCursos } from '@/components/admin/lista-seleccionable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { altaManual } from '@/lib/admin/acciones-alumnos'
import { altaDeEquipo, altaMasiva } from '@/lib/admin/acciones-equipo'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { cn } from '@/lib/utils'

/**
 * Las tres formas de dar de alta, detrás de un solo botón.
 *
 * Antes el formulario estaba siempre abierto y era lo primero de la pantalla,
 * aunque el 95% de las visitas son para BUSCAR a alguien, no para agregar. Un
 * formulario permanentemente desplegado empuja hacia abajo lo que sí se usa.
 *
 * Se abre con `<details>` y no con estado de React: sin JavaScript un botón con
 * `onClick` no hace nada y el formulario quedaría inalcanzable — que es justo el
 * anti-pattern que CLAUDE.md prohíbe.
 *
 * Las tres vías van en la misma caja porque son la misma tarea vista desde
 * distinta cantidad: uno, muchos, o alguien del equipo.
 */

const claseSelect =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

export type CursoOpcion = {
  id: string
  titulo: string
  cohortes: Array<{ id: string; nombre: string }>
}

function Enviar({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Procesando…' : children}
    </Button>
  )
}

/**
 * Curso + cohorte del alta masiva: un archivo entero va a UN curso.
 *
 * El alta individual ya no usa esto. Ahí se eligen varios cursos con
 * `ListaSeleccionable`, donde cada grupo aparece bajo su curso — este par de
 * selects solo puede listar los grupos del primer curso, porque sin JavaScript
 * el segundo no tiene forma de enterarse de qué se eligió en el primero.
 */
function CamposDeCurso({ cursos, prefijo }: { cursos: CursoOpcion[]; prefijo: string }) {
  const primero = cursos[0]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefijo}-curso`}>Curso</Label>
        <select id={`${prefijo}-curso`} name="course_id" required className={claseSelect}>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefijo}-cohorte`}>Cohorte</Label>
        <select id={`${prefijo}-cohorte`} name="cohort_id" className={claseSelect}>
          <option value="">Sin cohorte</option>
          {(primero?.cohortes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Grupo con su propio calendario de sesiones en vivo. Se crean desde el curso.
        </p>
      </div>
    </div>
  )
}

function AltaIndividual({ cursos, reinicio }: { cursos: CursoOpcion[]; reinicio: number }) {
  const [estado, accion] = useActionState(altaManual, SIN_ESTADO)

  return (
    <form key={reinicio} action={accion} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ind-correo">Correo</Label>
          <Input
            id="ind-correo"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="alumno@empresa.com"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ind-nombre">Nombre</Label>
          <Input id="ind-nombre" name="nombre" placeholder="Nombre y apellido" />
        </div>
      </div>

      <ListaSeleccionable
        nombre="accesos"
        leyenda="Cursos a los que entra"
        grupos={gruposDesdeCursos(cursos)}
      />

      <AvisoAccion estado={estado} />

      <p className="text-xs text-muted-foreground">
        Toca los cursos que quieras; toca otra vez para quitar. Se le manda un solo correo para
        que defina su contraseña, y nombra todos los cursos. Si ya tiene cuenta, solo se le
        agregan las inscripciones.
      </p>

      <div>
        <Enviar>Dar de alta</Enviar>
      </div>
    </form>
  )
}

function AltaPorArchivo({ cursos, reinicio }: { cursos: CursoOpcion[]; reinicio: number }) {
  const [estado, accion] = useActionState(altaMasiva, SIN_ESTADO)

  return (
    <form key={reinicio} action={accion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mas-archivo">Archivo</Label>
        <Input
          id="mas-archivo"
          name="archivo"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="file:mr-3 file:text-sm"
        />
        <p className="text-xs text-muted-foreground">
          CSV o Excel (.xlsx). Necesita una columna de correo; el nombre es opcional. No
          importa el orden de las columnas ni cómo se llame el encabezado —
          <span className="font-medium"> Correo</span>,{' '}
          <span className="font-medium">E-mail</span> o{' '}
          <span className="font-medium">mail</span> funcionan igual.
        </p>
      </div>

      <CamposDeCurso cursos={cursos} prefijo="mas" />

      <AvisoAccion estado={estado} />

      <p className="text-xs text-muted-foreground">
        Cada fila crea su cuenta y le manda su correo. Una fila con el correo mal escrito se
        reporta y no detiene a las demás.
      </p>

      <div>
        <Enviar>Cargar archivo</Enviar>
      </div>
    </form>
  )
}

function AltaEquipo({ reinicio }: { reinicio: number }) {
  const [estado, accion] = useActionState(altaDeEquipo, SIN_ESTADO)

  return (
    <form key={reinicio} action={accion} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-1">
          <Label htmlFor="eq-correo">Correo</Label>
          <Input
            id="eq-correo"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="persona@vadai.com.mx"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eq-nombre">Nombre</Label>
          <Input id="eq-nombre" name="nombre" placeholder="Nombre y apellido" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eq-rol">Rol</Label>
          <select id="eq-rol" name="rol" defaultValue="admin" className={claseSelect}>
            <option value="admin">Admin — gestiona todo el contenido</option>
            <option value="superadmin">Superadmin — además puede borrar pagos</option>
          </select>
        </div>
      </div>

      <AvisoAccion estado={estado} />

      <p className="text-xs text-muted-foreground">
        No se inscribe a ningún curso: entra por su rol. Puede ver la plataforma como alumno
        sin estar inscrito.
      </p>

      <div>
        <Enviar>Agregar al equipo</Enviar>
      </div>
    </form>
  )
}

const claseResumenSeccion =
  'inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 ' +
  'text-sm font-medium transition-colors select-none hover:bg-muted ' +
  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ' +
  '[&::-webkit-details-marker]:hidden'

export function DarDeAlta({
  cursos,
  reinicio,
  soySuperadmin,
}: {
  cursos: CursoOpcion[]
  reinicio: number
  soySuperadmin: boolean
}) {
  if (cursos.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        Crea un curso antes de dar de alta a alguien.
      </p>
    )
  }

  return (
    <details className="group/alta">
      <summary
        className={cn(
          'inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-2.5',
          'bg-primary text-sm font-medium text-primary-foreground select-none',
          'transition-all hover:-translate-y-px hover:brightness-110',
          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          '[&::-webkit-details-marker]:hidden'
        )}
      >
        <Mas />
        Dar de alta
      </summary>

      <div className="mt-4 flex flex-col gap-2 rounded-[10px] border border-border bg-card p-4 sm:p-5">
        <details open>
          <summary className={claseResumenSeccion}>
            <Flecha /> Una persona
          </summary>
          <div className="px-1 pt-4 pb-2">
            <AltaIndividual cursos={cursos} reinicio={reinicio} />
          </div>
        </details>

        <details className="border-t border-border pt-2">
          <summary className={claseResumenSeccion}>
            <Flecha /> Varias desde un archivo
          </summary>
          <div className="px-1 pt-4 pb-2">
            <AltaPorArchivo cursos={cursos} reinicio={reinicio} />
          </div>
        </details>

        {/* Solo el superadmin: si un admin pudiera crear admins, podría darse a
            sí mismo un segundo correo con más permisos. La acción lo vuelve a
            comprobar en el servidor — esto es únicamente para no mostrar una
            puerta que no abre. */}
        {soySuperadmin ? (
          <details className="border-t border-border pt-2">
            <summary className={claseResumenSeccion}>
              <Flecha /> Alguien del equipo (admin o superadmin)
            </summary>
            <div className="px-1 pt-4 pb-2">
              <AltaEquipo reinicio={reinicio} />
            </div>
          </details>
        ) : null}
      </div>
    </details>
  )
}

function Mas() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="size-4 transition-transform group-open/alta:rotate-45"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function Flecha() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0 text-muted-foreground transition-transform [details[open]>summary>&]:rotate-90"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
