'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { CerrarDesplegable } from '@/components/admin/cerrar-desplegable'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { Desplegable } from '@/components/admin/desplegable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  abrirInscripciones,
  actualizarGeneracion,
  cerrarInscripciones,
  eliminarGeneracion,
  marcarTerminada,
  reabrirGeneracion,
} from '@/lib/admin/acciones-generaciones'
import type { GeneracionCompleta } from '@/lib/admin/generaciones'
import { ETIQUETA_ESTADO, rangoDeGeneracion } from '@/lib/generaciones'
import { SIN_ESTADO } from '@/lib/admin/tipos'

/**
 * La cabecera de la pestaña de una generación (M16): nombre, fechas, estado y
 * sus conteos, con las acciones que la cambian de estado a la derecha.
 *
 * Estados: «Abierta a inscripciones» (en cian: es donde caen las compras),
 * «En curso» y «Terminada» (outline). Las acciones son formularios con su
 * server action, y las que cambian algo delicado —cerrar, terminar, borrar—
 * piden confirmación en modal. Solo una generación por curso puede estar
 * abierta: abrir esta cierra la otra, y el aviso lo dice.
 *
 * `aviso` llega por la URL (`?aviso=`) cuando se acaba de crear la generación:
 * la acción redirige aquí y no hay otro canal para contar qué se copió.
 */

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar'}
    </Button>
  )
}

export function EncabezadoGeneracion({
  generacion,
  grabaciones,
  aviso,
}: {
  generacion: GeneracionCompleta
  /** Sesiones con grabación ligada, para «N de M». */
  grabaciones: number
  aviso?: string | null
}) {
  const [estado, guardar] = useActionState(actualizarGeneracion, SIN_ESTADO)
  const [estadoAbrir, abrir] = useActionState(abrirInscripciones, SIN_ESTADO)
  const g = generacion
  const campos = { id: g.id, course_id: g.cursoId }
  const rango = rangoDeGeneracion(g.starts_on, g.ends_on)

  return (
    <section className="flex flex-col gap-4 rounded-[10px] border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-medium">
            {g.name}
            <Badge
              variant={g.estado === 'abierta' ? 'default' : g.estado === 'terminada' ? 'outline' : 'secondary'}
              title={
                g.estado === 'abierta'
                  ? 'Las compras, el catálogo y las altas sin elección caen aquí'
                  : g.estado === 'terminada'
                    ? 'Ya pasó su fecha de fin. Los alumnos conservan el acceso mientras les dure'
                    : undefined
              }
            >
              {ETIQUETA_ESTADO[g.estado]}
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground">
            {rango ? `${rango} · ` : ''}
            {g.inscritos} inscrito{g.inscritos === 1 ? '' : 's'} · {g.modulos} módulo{g.modulos === 1 ? '' : 's'} ·{' '}
            {g.totalSesiones} sesión{g.totalSesiones === 1 ? '' : 'es'}
            {g.totalSesiones > 0 ? ` · grabaciones: ${grabaciones} de ${g.totalSesiones}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {g.estado === 'abierta' ? (
            <ConfirmarConModal
              idModal={`cerrar-${g.id}`}
              accion={cerrarInscripciones}
              campos={campos}
              boton={{ texto: 'Cerrar inscripciones', etiquetaAccesible: `Cerrar inscripciones de ${g.name}`, variante: 'outline' }}
              titulo="¿Cerrar las inscripciones?"
              confirmar={{ texto: 'Sí, cerrar', enCurso: 'Cerrando…' }}
            >
              <p>
                El curso dejará de ofrecerse en el catálogo y las compras no tendrán dónde caer
                hasta que abras otra generación. Quien ya está inscrito no cambia.
              </p>
            </ConfirmarConModal>
          ) : g.estado === 'en_curso' ? (
            <form action={abrir}>
              <input type="hidden" name="id" value={g.id} />
              <input type="hidden" name="course_id" value={g.cursoId} />
              <Button type="submit" variant="outline" size="sm">
                Abrir a inscripciones
              </Button>
            </form>
          ) : null}

          {g.estado === 'terminada' ? (
            <ConfirmarConModal
              idModal={`reabrir-${g.id}`}
              accion={reabrirGeneracion}
              campos={campos}
              boton={{ texto: 'Reabrir', etiquetaAccesible: `Reabrir ${g.name}`, variante: 'outline' }}
              titulo="¿Volver a poner la generación en curso?"
              confirmar={{ texto: 'Sí, reabrir', enCurso: 'Reabriendo…' }}
            >
              <p>Se quita la fecha de fin. Después ponle la nueva en «Editar».</p>
            </ConfirmarConModal>
          ) : (
            <ConfirmarConModal
              idModal={`terminar-${g.id}`}
              accion={marcarTerminada}
              campos={campos}
              boton={{ texto: 'Marcar terminada', etiquetaAccesible: `Marcar terminada ${g.name}`, variante: 'outline' }}
              titulo={`¿Dar por terminada «${g.name}»?`}
              confirmar={{ texto: 'Sí, terminar', enCurso: 'Terminando…' }}
            >
              <p>
                Se cierran las inscripciones y la fecha de fin queda en ayer. Los alumnos siguen
                viendo su contenido, su comunidad y sus grabaciones mientras su acceso al curso
                esté vigente.
              </p>
            </ConfirmarConModal>
          )}

          <Desplegable etiqueta="Editar" variante="discreto" icono="lapiz" tamano="sm" abierto={Boolean(estado.error || estado.aviso)}>
            <form action={guardar} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={g.id} />
              <input type="hidden" name="course_id" value={g.cursoId} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`gen-nombre-${g.id}`}>Nombre</Label>
                  <Input id={`gen-nombre-${g.id}`} name="name" defaultValue={g.name} required minLength={2} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`gen-inicio-${g.id}`}>Inicia</Label>
                  <Input id={`gen-inicio-${g.id}`} name="starts_on" type="date" defaultValue={g.starts_on ?? ''} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`gen-fin-${g.id}`}>Termina</Label>
                  <Input id={`gen-fin-${g.id}`} name="ends_on" type="date" defaultValue={g.ends_on ?? ''} />
                </div>
              </div>
              <AvisoAccion estado={estado} />
              <div className="flex flex-wrap gap-2">
                <Guardar />
                <CerrarDesplegable />
              </div>
            </form>
          </Desplegable>
        </div>
      </div>

      {aviso ? (
        <p role="status" className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          {aviso}
        </p>
      ) : null}
      <AvisoAccion estado={estadoAbrir} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Todo lo de esta pestaña —contenido, sesiones, alumnos— es de esta generación. Los
          alumnos de otra no lo ven.
        </p>
        <ConfirmarConModal
          idModal={`eliminar-generacion-${g.id}`}
          accion={eliminarGeneracion}
          campos={campos}
          boton={{ texto: 'Eliminar generación', etiquetaAccesible: `Eliminar la generación ${g.name}`, tono: 'destructivo' }}
          titulo={`¿Eliminar la generación «${g.name}»?`}
          confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
        >
          <p>
            Sus {g.totalSesiones} sesiones se borran del calendario. Las inscripciones no: los
            alumnos conservan su acceso y quedan «sin generación» hasta que les asignes otra.
            {g.modulos > 0
              ? ` Tiene ${g.modulos} módulo(s): no se puede borrar hasta que los quites o los muevas.`
              : ''}
          </p>
        </ConfirmarConModal>
      </div>
    </section>
  )
}
