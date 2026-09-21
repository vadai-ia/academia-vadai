'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Desplegable } from '@/components/admin/desplegable'
import { claseResumen, claseSelect } from '@/components/admin/estilos'
import { ListaSeleccionable, gruposDesdeCursos } from '@/components/admin/lista-seleccionable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { altaManual } from '@/lib/admin/acciones-alumnos'
import { altaDeEquipo, altaMasiva } from '@/lib/admin/acciones-equipo'
import { SIN_ESTADO, type EstadoAccion } from '@/lib/admin/tipos'

/**
 * Las tres formas de dar de alta, detrás de un solo botón.
 *
 * Antes el formulario estaba siempre abierto y era lo primero de la pantalla,
 * aunque el 95% de las visitas son para BUSCAR a alguien, no para agregar. Un
 * formulario permanentemente desplegado empuja hacia abajo lo que sí se usa.
 *
 * Se abre con `Desplegable` (<details>) y no con estado de React: sin
 * JavaScript un botón con `onClick` no hace nada y el formulario quedaría
 * inalcanzable — que es justo el anti-pattern que CLAUDE.md prohíbe.
 *
 * Los tres `useActionState` viven aquí arriba (M14): así el panel sabe cuándo
 * una acción contestó algo y se abre solo para enseñar el aviso o el error,
 * también en el envío sin JavaScript.
 *
 * Las tres vías van en la misma caja porque son la misma tarea vista desde
 * distinta cantidad: uno, muchos, o alguien del equipo.
 */

export type CursoOpcion = {
  id: string
  titulo: string
  cohortes: Array<{ id: string; nombre: string }>
}

export type EmpresaOpcion = { id: string; nombre: string }

type Accion = (datos: FormData) => void

/**
 * Vacío = General. Se elige una existente o se escribe una nueva ahí mismo:
 * si el campo de texto trae algo, manda sobre el selector y la empresa se
 * crea (o se reúsa) al dar de alta (pedido de Roberto, 21-sep-2026).
 */
export function SelectorDeEmpresa({ id, empresas, ayuda }: { id: string; empresas: EmpresaOpcion[]; ayuda?: string }) {
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
      <Input
        name="company_nueva"
        placeholder="…o escribe una empresa nueva"
        autoComplete="off"
        aria-label="Empresa nueva"
        className="h-9"
      />
      {ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}
    </div>
  )
}

function Enviar({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Procesando…' : children}
    </Button>
  )
}

function AltaIndividual({
  cursos,
  empresas,
  reinicio,
  estado,
  accion,
}: {
  cursos: CursoOpcion[]
  empresas: EmpresaOpcion[]
  reinicio: number
  estado: EstadoAccion
  accion: Accion
}) {
  return (
    <form key={reinicio} action={accion} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
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
        <SelectorDeEmpresa id="ind-empresa" empresas={empresas} />
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

function AltaPorArchivo({
  cursos,
  empresas,
  reinicio,
  estado,
  accion,
}: {
  cursos: CursoOpcion[]
  empresas: EmpresaOpcion[]
  reinicio: number
  estado: EstadoAccion
  accion: Accion
}) {
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
          <span className="font-medium">mail</span> funcionan igual. Si trae una columna{' '}
          <span className="font-medium">Empresa</span>, cada fila queda en la suya y las que no
          existan se crean.
        </p>
      </div>

      <SelectorDeEmpresa
        id="mas-empresa"
        empresas={empresas}
        ayuda="Solo se usa si el archivo no trae columna Empresa."
      />

      <ListaSeleccionable
        nombre="accesos"
        leyenda="Cursos a los que entra todo el archivo"
        grupos={gruposDesdeCursos(cursos)}
      />

      <AvisoAccion estado={estado} />

      <p className="text-xs text-muted-foreground">
        Toca los cursos que quieras; toca otra vez para quitar. Cada fila crea su cuenta y le
        manda un solo correo, que nombra todos los cursos. Una fila con el correo mal escrito se
        reporta y no detiene a las demás.
      </p>

      <div>
        <Enviar>Cargar archivo</Enviar>
      </div>
    </form>
  )
}

function AltaEquipo({ reinicio, estado, accion }: { reinicio: number; estado: EstadoAccion; accion: Accion }) {
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

const contesto = (estado: EstadoAccion) => Boolean(estado.error || estado.aviso)

export function DarDeAlta({
  cursos,
  empresas,
  reinicio,
  soySuperadmin,
}: {
  cursos: CursoOpcion[]
  empresas: EmpresaOpcion[]
  reinicio: number
  soySuperadmin: boolean
}) {
  const [estadoIndividual, altaIndividual] = useActionState(altaManual, SIN_ESTADO)
  const [estadoArchivo, altaArchivo] = useActionState(altaMasiva, SIN_ESTADO)
  const [estadoEquipo, altaEquipo] = useActionState(altaDeEquipo, SIN_ESTADO)

  if (cursos.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        Crea un curso antes de dar de alta a alguien.
      </p>
    )
  }

  return (
    <Desplegable
      etiqueta="Dar de alta"
      variante="primario"
      abierto={contesto(estadoIndividual) || contesto(estadoArchivo) || contesto(estadoEquipo)}
    >
      <div className="flex flex-col gap-2">
        <details open={!contesto(estadoArchivo) && !contesto(estadoEquipo)}>
          <summary className={claseResumen}>
            <Flecha /> Una persona
          </summary>
          <div className="px-1 pt-4 pb-2">
            <AltaIndividual
              cursos={cursos}
              empresas={empresas}
              reinicio={reinicio}
              estado={estadoIndividual}
              accion={altaIndividual}
            />
          </div>
        </details>

        <details className="border-t border-border pt-2" open={contesto(estadoArchivo) || undefined}>
          <summary className={claseResumen}>
            <Flecha /> Varias desde un archivo
          </summary>
          <div className="px-1 pt-4 pb-2">
            <AltaPorArchivo
              cursos={cursos}
              empresas={empresas}
              reinicio={reinicio}
              estado={estadoArchivo}
              accion={altaArchivo}
            />
          </div>
        </details>

        {/* Solo el superadmin: si un admin pudiera crear admins, podría darse a
            sí mismo un segundo correo con más permisos. La acción lo vuelve a
            comprobar en el servidor — esto es únicamente para no mostrar una
            puerta que no abre. */}
        {soySuperadmin ? (
          <details className="border-t border-border pt-2" open={contesto(estadoEquipo) || undefined}>
            <summary className={claseResumen}>
              <Flecha /> Alguien del equipo (admin o superadmin)
            </summary>
            <div className="px-1 pt-4 pb-2">
              <AltaEquipo reinicio={reinicio} estado={estadoEquipo} accion={altaEquipo} />
            </div>
          </details>
        ) : null}
      </div>
    </Desplegable>
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
