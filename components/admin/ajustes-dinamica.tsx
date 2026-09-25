'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import type { CursoOpcion } from '@/components/admin/dar-de-alta'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Seccion } from '@/components/ui-vadai/superficie'
import { fechaHoraCdmx, utcACdmx } from '@/lib/admin/fechas'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import {
  abrirDinamica,
  actualizarConfiguracion,
  cerrarDinamica,
  eliminarDinamica,
  reabrirDinamica,
} from '@/lib/dinamicas/acciones'
import { pesosSuman100, sumaPesos, TOPE_DESCRIPCION, TOPE_TITULO } from '@/lib/dinamicas/comun'
import type { DinamicaCompleta } from '@/lib/dinamicas/consultas'

/**
 * Configuración de una dinámica: ajustes, estado, exportación y borrado.
 *
 * Cuatro secciones en el orden en que se usan: primero se afina (escala,
 * fecha), luego se abre o se cierra, luego se lleva uno el Excel, y al final
 * —detrás de un `<details>`, después de la descarga— se borra.
 *
 * `ahora` lo manda el servidor. "¿La fecha ya pasó?" se decide con el reloj
 * del servidor y no con el del navegador: una comparación que cambia entre el
 * render del servidor y el del cliente es justo lo que produce el error 418 de
 * React.
 */

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </Button>
  )
}

function BotonDeEstado({
  texto,
  enCurso,
  variant = 'default',
  disabled = false,
}: {
  texto: string
  enCurso: string
  variant?: 'default' | 'outline'
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={disabled || pending}>
      {pending ? enCurso : texto}
    </Button>
  )
}

const claseEnlace = 'underline-offset-4 hover:underline'

// --------------------------------------------------------------------------
// 1. Ajustes
// --------------------------------------------------------------------------

function Ajustes({ dinamica, cursos }: { dinamica: DinamicaCompleta; cursos: CursoOpcion[] }) {
  const [estado, accion] = useActionState(actualizarConfiguracion, SIN_ESTADO)
  const escalaBloqueada = dinamica.totalCeldas > 0
  const limite = dinamica.closes_at ? utcACdmx(dinamica.closes_at) : null

  return (
    <form action={accion} className="flex flex-col gap-4 rounded-[10px] border border-border p-4">
      <input type="hidden" name="id" value={dinamica.id} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aj-titulo">Título</Label>
        <Input
          id="aj-titulo"
          name="title"
          defaultValue={dinamica.title}
          required
          minLength={3}
          maxLength={TOPE_TITULO}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="aj-curso">Curso</Label>
          <select
            id="aj-curso"
            name="course_id"
            required
            defaultValue={dinamica.course_id}
            className={claseSelect}
          >
            {/* Si el curso de la dinámica ya no está entre los que se ofrecen
                (archivado), el <select> caería al primero de la lista y
                "Guardar cambios" la movería de curso sin que nadie lo pidiera. */}
            {cursos.some((c) => c.id === dinamica.course_id) ? null : (
              <option value={dinamica.course_id}>{dinamica.curso} (archivado)</option>
            )}
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
            defaultValue={dinamica.cohort_id ?? ''}
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
          defaultValue={dinamica.description ?? ''}
          maxLength={TOPE_DESCRIPCION}
          placeholder="Qué tiene que decidir la empresa y con qué criterios. La ven los alumnos arriba del tablero."
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-sm font-medium">Escala de calificación</legend>

        {escalaBloqueada ? (
          <>
            {/* Ocultos con su valor actual: la acción los espera siempre y el
                trigger solo protesta si CAMBIAN. `disabled` en los visibles
                para que no viajen dos veces. */}
            <input type="hidden" name="scale_min" value={dinamica.scale_min} />
            <input type="hidden" name="scale_max" value={dinamica.scale_max} />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                Del {dinamica.scale_min} al {dinamica.scale_max}
              </span>{' '}
              · no se puede cambiar: ya hay {dinamica.totalCeldas} calificaciones puestas con esta
              escala.
            </p>
          </>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aj-min">Del</Label>
            <Input
              id="aj-min"
              name={escalaBloqueada ? undefined : 'scale_min'}
              type="number"
              defaultValue={dinamica.scale_min}
              min={0}
              max={99}
              disabled={escalaBloqueada}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aj-max">Al</Label>
            <Input
              id="aj-max"
              name={escalaBloqueada ? undefined : 'scale_max'}
              type="number"
              defaultValue={dinamica.scale_max}
              min={1}
              max={100}
              disabled={escalaBloqueada}
            />
          </div>
        </div>
        {escalaBloqueada ? null : (
          <p className="text-xs text-muted-foreground">
            Enteros. Se congela en cuanto una empresa pone la primera calificación.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-sm font-medium">Fecha límite</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aj-fecha">Fecha</Label>
            <Input id="aj-fecha" name="cierra_fecha" type="date" defaultValue={limite?.fecha ?? ''} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aj-hora">Hora (CDMX)</Label>
            <Input id="aj-hora" name="cierra_hora" type="time" defaultValue={limite?.hora ?? ''} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Se captura en horario de Ciudad de México y así la ven todos. Deja los dos vacíos para que
          no tenga fecha límite.
        </p>
      </fieldset>

      <AvisoAccion estado={estado} />

      <div>
        <Guardar />
      </div>
    </form>
  )
}

// --------------------------------------------------------------------------
// 2. Estado: un solo formulario según el caso
// --------------------------------------------------------------------------

function Abrir({ dinamica, base, ahora }: { dinamica: DinamicaCompleta; base: string; ahora: number }) {
  const [estado, accion] = useActionState(abrirDinamica, SIN_ESTADO)
  const criterios = dinamica.filas.filter((f) => f.tipo === 'criterio').length
  const suma = sumaPesos(dinamica.filas)
  const fechaPasada = dinamica.closes_at !== null && new Date(dinamica.closes_at).getTime() <= ahora

  const motivo =
    criterios === 0 ? (
      <>
        Agrega al menos un criterio para poder abrirla.{' '}
        <Link href={base} className={claseEnlace}>
          Ajustar criterios →
        </Link>
      </>
    ) : !pesosSuman100(dinamica.filas) ? (
      <>
        Para abrirla los pesos tienen que sumar 100. Van{' '}
        <span className="tabular-nums">{suma}</span>.{' '}
        <Link href={base} className={claseEnlace}>
          Ajustar criterios →
        </Link>
      </>
    ) : fechaPasada ? (
      <>La fecha límite ya pasó. Cámbiala arriba para poder abrirla.</>
    ) : null

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={dinamica.id} />
      <div>
        <BotonDeEstado texto="Abrir la dinámica" enCurso="Abriendo…" disabled={motivo !== null} />
      </div>
      {motivo ? (
        <p role="status" className="text-sm text-destructive">
          {motivo}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Al abrirla, cada inscrito la ve en su campana y su empresa puede empezar su tablero.
        </p>
      )}
      <AvisoAccion estado={estado} />
    </form>
  )
}

function Cerrar({ dinamica }: { dinamica: DinamicaCompleta }) {
  const [estado, accion] = useActionState(cerrarDinamica, SIN_ESTADO)

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={dinamica.id} />
      <div>
        <BotonDeEstado texto="Cerrar la dinámica" enCurso="Cerrando…" variant="outline" />
      </div>
      <p className="text-xs text-muted-foreground">
        Los alumnos dejan de poder calificar y se reparten los puntos. Puedes reabrirla.
        {dinamica.closes_at ? (
          <>
            {' '}
            Si no la cierras antes, se cierra sola el {fechaHoraCdmx(dinamica.closes_at)} (CDMX).
          </>
        ) : null}
      </p>
      <AvisoAccion estado={estado} />
    </form>
  )
}

function Reabrir({ dinamica, ahora }: { dinamica: DinamicaCompleta; ahora: number }) {
  const [estado, accion] = useActionState(reabrirDinamica, SIN_ESTADO)
  const fechaPasada = dinamica.closes_at !== null && new Date(dinamica.closes_at).getTime() <= ahora

  return (
    <form action={accion} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={dinamica.id} />

      {fechaPasada ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-sm">
            La fecha límite ya pasó. Pon una nueva para reabrirla.
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-fecha">Fecha</Label>
              <Input id="re-fecha" name="cierra_fecha" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-hora">Hora (CDMX)</Label>
              <Input id="re-hora" name="cierra_hora" type="time" required />
            </div>
          </div>
        </fieldset>
      ) : null}

      <div>
        <BotonDeEstado texto="Reabrir la dinámica" enCurso="Reabriendo…" variant="outline" />
      </div>
      <p className="text-xs text-muted-foreground">
        Vuelve a avisar en la campana a cada inscrito y las empresas pueden seguir calificando. Los
        puntos se vuelven a contar en el siguiente cierre.
      </p>
      <AvisoAccion estado={estado} />
    </form>
  )
}

// --------------------------------------------------------------------------
// 4. Eliminar
// --------------------------------------------------------------------------

function Eliminar({ dinamica }: { dinamica: DinamicaCompleta }) {
  const [estado, accion] = useActionState(eliminarDinamica, SIN_ESTADO)

  return (
    <details>
      <summary className="inline-flex w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        Eliminar esta dinámica
      </summary>
      <form
        action={accion}
        className="mt-3 flex flex-col gap-3 rounded-[10px] border border-destructive/40 bg-destructive/5 p-4"
      >
        <input type="hidden" name="id" value={dinamica.id} />
        <p className="text-sm text-muted-foreground">
          Se borran también sus{' '}
          <span className="font-medium text-foreground tabular-nums">
            {dinamica.filas.length} filas
          </span>
          ,{' '}
          <span className="font-medium text-foreground tabular-nums">
            {dinamica.totalTableros} tableros
          </span>{' '}
          y las{' '}
          <span className="font-medium text-foreground tabular-nums">
            {dinamica.totalCeldas} calificaciones
          </span>{' '}
          que pusieron las empresas. No hay manera de recuperarlas. Si las quieres conservar,
          descarga el Excel antes.
        </p>
        <AvisoAccion estado={estado} />
        <div>
          <BotonDeEstadoDestructivo />
        </div>
      </form>
    </details>
  )
}

function BotonDeEstadoDestructivo() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? 'Eliminando…' : 'Sí, eliminar la dinámica'}
    </Button>
  )
}

// --------------------------------------------------------------------------

export function AjustesDinamica({
  dinamica,
  cursos,
  ahora,
}: {
  dinamica: DinamicaCompleta
  cursos: CursoOpcion[]
  /** `Date.now()` del servidor, para no comparar fechas con el reloj del navegador. */
  ahora: number
}) {
  const base = `/admin/dinamicas/${dinamica.id}`

  return (
    <div className="flex flex-col gap-8">
      <Seccion titulo="Ajustes" apoyo="Dónde vive la dinámica, su escala y cuándo cierra.">
        <Ajustes dinamica={dinamica} cursos={cursos} />
      </Seccion>

      <Seccion
        titulo="Estado"
        apoyo={
          dinamica.estadoEfectivo === 'draft'
            ? 'En borrador: los alumnos todavía no la ven.'
            : dinamica.estadoEfectivo === 'open'
              ? 'Abierta: las empresas están calificando.'
              : 'Cerrada: los alumnos la ven, pero ya no califican.'
        }
      >
        {dinamica.estadoEfectivo === 'draft' ? (
          <Abrir dinamica={dinamica} base={base} ahora={ahora} />
        ) : dinamica.estadoEfectivo === 'open' ? (
          <Cerrar dinamica={dinamica} />
        ) : (
          <Reabrir dinamica={dinamica} ahora={ahora} />
        )}
      </Seccion>

      <Seccion
        titulo="Llévatelo"
        apoyo="Se arma al momento, con lo que hayan calificado las empresas hasta ahora."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border p-5">
          <Button asChild variant="outline">
            {/* `download` y no target=_blank: es una descarga, no una página. */}
            <a href={`/api/reportes/dinamicas/${dinamica.id}/excel`} download>
              Descargar Excel
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Una hoja Resumen con todos los tableros y una hoja por empresa con su matriz, el
            ponderado y quién puso cada calificación.
          </p>
        </div>
      </Seccion>

      <Eliminar dinamica={dinamica} />
    </div>
  )
}
