'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { actualizarFila } from '@/lib/dinamicas/acciones'
import { ETIQUETA_TIPO_FILA, TIPOS_FILA, TOPE_ETIQUETA_FILA } from '@/lib/dinamicas/comun'
import type { FilaConUso } from '@/lib/dinamicas/consultas'

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </Button>
  )
}

/**
 * Edita una fila ya guardada. Va dentro de un `<details>` en el constructor.
 *
 * QUÉ SE PUEDE CAMBIAR DEPENDE DEL ESTADO Y DE SI YA HAY CELDAS:
 *
 *   - El NOMBRE siempre: un error de dedo se corrige aunque esté abierta, y
 *     no cambia el significado de ninguna calificación.
 *   - Con la dinámica ABIERTA, el tipo y el peso van como `<input hidden>` con
 *     su valor actual y un texto fijo que dice por qué. Ofrecer un campo que
 *     el servidor va a rechazar es peor que no ofrecerlo.
 *   - Con CELDAS (y la dinámica no abierta), el tipo se queda fijo —pasar de
 *     criterio a informativa dejaría números en una fila que se lee por
 *     texto— pero el peso sí se puede mover.
 *   - Sin celdas y no abierta: todo, y el campo Peso sigue al `<select>` por
 *     CSS, como en el alta.
 *
 * El servidor lo valida todo igual: un formulario se puede reenviar a mano.
 */
export function EditarFilaDinamica({
  dinamicaId,
  fila,
  abierta,
}: {
  dinamicaId: string
  fila: FilaConUso
  abierta: boolean
}) {
  const [estado, accion] = useActionState(actualizarFila, SIN_ESTADO)
  const tipoFijo = abierta || fila.celdas > 0
  const campoPeso = (
    <>
      <Label htmlFor={`ed-peso-${fila.id}`}>Peso (%)</Label>
      {/* Sin min/max/step: oculto por CSS cuando la fila es informativa, un
          rango que falla ahí bloquea el envío sin decir por qué. El rango lo
          valida el servidor (leerPeso). */}
      <Input
        id={`ed-peso-${fila.id}`}
        name="weight"
        type="number"
        inputMode="decimal"
        defaultValue={fila.peso ?? ''}
        className="sm:max-w-32"
      />
    </>
  )

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={fila.id} />
      <input type="hidden" name="dynamic_id" value={dinamicaId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`ed-nombre-${fila.id}`}>Nombre de la fila</Label>
        <Input
          id={`ed-nombre-${fila.id}`}
          name="label"
          defaultValue={fila.etiqueta}
          required
          maxLength={TOPE_ETIQUETA_FILA}
        />
      </div>

      {abierta ? (
        <>
          <input type="hidden" name="row_kind" value={fila.tipo} />
          {fila.tipo === 'criterio' ? (
            <>
              <input type="hidden" name="weight" value={fila.peso ?? ''} />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">{fila.peso} %</span> ·
                el peso no se puede cambiar mientras está abierta: ya hay tableros calificando con
                él. Ciérrala para ajustar criterios.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Fila informativa</span> · texto libre
              por proyecto, no entra al ponderado.
            </p>
          )}
        </>
      ) : tipoFijo ? (
        <>
          <input type="hidden" name="row_kind" value={fila.tipo} />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{ETIQUETA_TIPO_FILA[fila.tipo]}</span> ·
            el tipo no se puede cambiar porque ya tiene {fila.celdas} calificación(es), y dejarían de
            poder leerse.
          </p>
          {fila.tipo === 'criterio' ? <div className="flex flex-col gap-1.5">{campoPeso}</div> : null}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`ed-tipo-${fila.id}`}>Tipo de fila</Label>
            <select
              id={`ed-tipo-${fila.id}`}
              name="row_kind"
              className={claseSelect}
              defaultValue={fila.tipo}
            >
              {TIPOS_FILA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETA_TIPO_FILA[tipo]}
                </option>
              ))}
            </select>
            <p data-tipo-fila="criterio" className="text-xs text-muted-foreground">
              Entra al ponderado. Entre todos los criterios los pesos suman 100.
            </p>
            <p data-tipo-fila="informativa" className="text-xs text-muted-foreground">
              Texto corto que cada empresa llena por proyecto. No entra al ponderado.
            </p>
          </div>

          {/* Mismo mecanismo que el alta: el CSS muestra el peso solo con
              "criterio" elegido, así el formulario funciona sin JS. */}
          <div data-tipo-fila="criterio" className="flex-col gap-1.5">
            {campoPeso}
          </div>
        </>
      )}

      <AvisoAccion estado={estado} />

      <div>
        <Guardar />
      </div>
    </form>
  )
}
