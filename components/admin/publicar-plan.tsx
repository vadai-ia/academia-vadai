'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Desplegable } from '@/components/admin/desplegable'
import { Button } from '@/components/ui/button'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { archivarPlan, publicarPlan } from '@/lib/membresia/acciones-planes'

function Enviar({ texto, ocupado, variante = 'default' }: { texto: string; ocupado: string; variante?: 'default' | 'outline' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} variant={variante}>
      {pending ? ocupado : texto}
    </Button>
  )
}

/**
 * Publicar un plan en Stripe y sacarlo de venta (M18). Publicar crea o pone al
 * día el producto, el precio, el link de pago y el portal; se puede repetir
 * sin duplicar nada. Archivar apaga el link: quien ya paga sigue dentro.
 */
export function PublicarPlan({
  planId,
  publicado,
  archivable,
  cambioDePrecio,
}: {
  planId: string
  publicado: boolean
  /** V-AI-P no se archiva: su página y el espacio de miembros dependen de él. */
  archivable: boolean
  /** El precio guardado no es el que cobra Stripe hoy. */
  cambioDePrecio: boolean
}) {
  const [estado, accion] = useActionState(publicarPlan, SIN_ESTADO)
  const [estadoArchivo, accionArchivo] = useActionState(archivarPlan, SIN_ESTADO)

  return (
    <div className="flex flex-col gap-4">
      <form action={accion} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={planId} />
        <input type="hidden" name="accion" value="publicar" />
        {cambioDePrecio ? (
          <p className="rounded-lg border border-accent bg-accent/15 px-4 py-3 text-sm text-pretty">
            Cambiaste el precio. Al publicar se crea el precio nuevo y un link de pago nuevo; quien ya paga sigue con
            el suyo.
          </p>
        ) : null}
        <div>
          <Enviar texto={publicado ? 'Actualizar en Stripe' : 'Publicar en Stripe'} ocupado="Publicando…" />
        </div>
        <AvisoAccion estado={estado} />
      </form>

      {archivable && publicado ? (
        <Desplegable etiqueta="Archivar plan" variante="discreto" icono="ninguno" tamano="sm" abierto={Boolean(estadoArchivo.error || estadoArchivo.aviso)}>
          <form action={accionArchivo} className="flex flex-col gap-3 pt-3">
            <input type="hidden" name="id" value={planId} />
            <input type="hidden" name="accion" value="archivar" />
            <p className="text-sm text-pretty text-muted-foreground">
              El link de pago deja de cobrar y la página da 404. Quien ya paga sigue dentro y se le sigue cobrando hasta
              que cancele. Se reactiva publicándolo otra vez.
            </p>
            <div>
              <Enviar texto="Sí, archivar" ocupado="Archivando…" variante="outline" />
            </div>
            <AvisoAccion estado={estadoArchivo} />
          </form>
        </Desplegable>
      ) : null}
    </div>
  )
}
