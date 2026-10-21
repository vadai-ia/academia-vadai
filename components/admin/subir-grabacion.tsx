'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Desplegable } from '@/components/admin/desplegable'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import type { ClaseParaSubir } from '@/lib/vaip/admin'
import { subirGrabacion } from '@/lib/vaip/acciones'

/*
 * Aparte de components/admin/contenido-vaip.tsx a propósito: la página de
 * Clases solo necesita esto, y aquel archivo trae el editor de texto (Tiptap).
 */

function Crear() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-fit">
      {pending ? 'Creando…' : 'Crear y subir el video'}
    </Button>
  )
}

const enCdmx = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Mexico_City',
})

/**
 * «Subir grabación»: elige la clase del calendario (las que ya pasaron sin
 * grabación) o una fecha, y te lleva al editor a subir el video. `elegida`
 * llega de `?subir=<clase>`, el botón de cada clase en el calendario.
 */
export function SubirGrabacion({
  clases,
  hoy,
  elegida,
}: {
  clases: ClaseParaSubir[]
  hoy: string
  elegida: string | null
}) {
  const [estado, accion] = useActionState(subirGrabacion, SIN_ESTADO)
  const preseleccion = clases.some((c) => c.id === elegida) ? elegida : (clases[0]?.id ?? 'ninguna')

  return (
    <Desplegable
      etiqueta="Subir grabación"
      variante="primario"
      id="subir-grabacion"
      abierto={Boolean(elegida) || Boolean(estado.error)}
      ayuda="Queda en su mes, con el día de la clase."
    >
      <form action={accion} className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grabacion-clase">¿De qué clase es?</Label>
          <select id="grabacion-clase" name="clase" defaultValue={preseleccion ?? 'ninguna'} className={claseSelect}>
            {clases.map((c) => (
              <option key={c.id} value={c.id}>
                {enCdmx.format(new Date(c.programadaEn))} · {c.titulo}
              </option>
            ))}
            <option value="ninguna">No está en el calendario (uso la fecha de abajo)</option>
          </select>
          {clases.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay clases pasadas sin grabación en el calendario.</p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grabacion-fecha">Fecha de la clase</Label>
            <Input id="grabacion-fecha" name="fecha" type="date" defaultValue={hoy} max={hoy} />
            <p className="text-xs text-muted-foreground">Solo si no está en el calendario.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grabacion-titulo">Título (opcional)</Label>
            <Input id="grabacion-titulo" name="titulo" maxLength={200} placeholder="Si lo dejas vacío, va el de la clase" />
          </div>
        </div>
        <Crear />
        <AvisoAccion estado={estado} />
      </form>
    </Desplegable>
  )
}
