'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { crearFila } from '@/lib/dinamicas/acciones'
import {
  ETIQUETA_TIPO_FILA,
  TIPOS_FILA,
  TOPE_ETIQUETA_FILA,
  TOPE_TEXTO_INFORMATIVO,
} from '@/lib/dinamicas/comun'

function Enviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Agregando…' : 'Agregar fila'}
    </Button>
  )
}

/** Cuánto falta (o sobra) para 100, a dos decimales. */
function diferenciaA100(suma: number): number {
  return Math.round((100 - suma) * 100) / 100
}

function ayudaDePeso(suma: number): string {
  const faltan = diferenciaA100(suma)
  if (faltan === 0) return 'Los pesos ya suman 100. Si agregas otro criterio, baja alguno de los demás.'
  if (faltan < 0) return `Sobran ${-faltan}: baja algún peso para volver a 100.`
  if (faltan < 1) {
    return `Faltan ${faltan} para llegar a 100. Súbele ese pico a un criterio (33.34 en vez de 33.33).`
  }
  return `Faltan ${faltan} para llegar a 100.`
}

/**
 * Alta de una fila: un criterio con peso o una fila informativa.
 *
 * EL CAMPO PESO SOLO SE VE CUANDO LA FILA ES UN CRITERIO, y eso lo hace CSS
 * (`[data-tipo-fila]` en globals.css) siguiendo al `<select>`, no React: con
 * `useState` el formulario dejaría de poder cambiar de tipo sin JavaScript.
 * Por lo mismo el peso NO lleva `required` —un `required` oculto bloquea el
 * envío sin decir por qué— y quien lo exige es la server action ("Un criterio
 * necesita peso.").
 *
 * El peso viene prellenado con lo que falta para 100: el caso normal es ir
 * agregando criterios hasta cerrar la suma, y así el último cae solo.
 *
 * Con la dinámica ABIERTA solo se ofrece "Fila informativa": un criterio nuevo
 * cambiaría el ponderado de tableros que ya están calificando.
 */
export function NuevaFilaDinamica({
  dinamicaId,
  suma,
  abierta,
  reinicio,
}: {
  dinamicaId: string
  /** Lo que suman hoy los criterios. */
  suma: number
  abierta: boolean
  reinicio: number
}) {
  const [estado, accion] = useActionState(crearFila, SIN_ESTADO)
  const faltan = diferenciaA100(suma)
  const tipos = abierta ? TIPOS_FILA.filter((t) => t === 'informativa') : TIPOS_FILA

  return (
    <form
      key={reinicio}
      action={accion}
      className="flex flex-col gap-5 rounded-[10px] border border-dashed border-border p-4 sm:p-5"
    >
      <input type="hidden" name="dynamic_id" value={dinamicaId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fila-nombre">Nombre de la fila</Label>
        <Input
          id="fila-nombre"
          name="label"
          required
          maxLength={TOPE_ETIQUETA_FILA}
          placeholder="Impacto en la empresa: tiempo, costo, etc."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fila-tipo">Tipo de fila</Label>
        <select
          id="fila-tipo"
          name="row_kind"
          className={claseSelect}
          defaultValue={abierta ? 'informativa' : 'criterio'}
        >
          {tipos.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETA_TIPO_FILA[tipo]}
            </option>
          ))}
        </select>

        <p data-tipo-fila="criterio" className="text-xs text-muted-foreground">
          Entra al ponderado. Entre todos los criterios los pesos suman 100.
        </p>
        <p data-tipo-fila="informativa" className="text-xs text-muted-foreground">
          Texto corto (hasta {TOPE_TEXTO_INFORMATIVO} caracteres) que cada empresa llena por
          proyecto. No entra al ponderado.
        </p>
        {abierta ? (
          <p className="text-xs text-muted-foreground">
            Está abierta: un criterio nuevo cambiaría el ponderado de las empresas que ya están
            calificando. Ciérrala para ajustar criterios.
          </p>
        ) : null}
      </div>

      <div data-tipo-fila="criterio" className="flex-col gap-1.5">
        <Label htmlFor="fila-peso">Peso (%)</Label>
        <Input
          id="fila-peso"
          name="weight"
          type="number"
          inputMode="decimal"
          min={0.01}
          max={100}
          step={0.01}
          defaultValue={faltan > 0 ? faltan : ''}
          className="sm:max-w-32"
        />
        <p className="text-xs text-muted-foreground tabular-nums">{ayudaDePeso(suma)}</p>
      </div>

      <AvisoAccion estado={estado} />

      <div>
        <Enviar />
      </div>
    </form>
  )
}
