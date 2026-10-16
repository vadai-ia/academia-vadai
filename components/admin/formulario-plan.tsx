'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Desplegable } from '@/components/admin/desplegable'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SIN_ESTADO } from '@/lib/admin/tipos'
import { guardarPlan } from '@/lib/membresia/acciones-planes'

function Guardar({ nuevo }: { nuevo: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : nuevo ? 'Crear plan' : 'Guardar cambios'}
    </Button>
  )
}

function Campo({ id, etiqueta, ayuda, children }: { id: string; etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}
    </div>
  )
}

export type PlanEnFormulario = {
  id: string
  slug: string
  nombre: string
  precioMxn: number
  precioTachadoMxn: number | null
  frase: string | null
  descripcion: string | null
  imagen: string | null
  casaId: string | null
  cursos: string[]
  /** Ya existe en Stripe (o es V-AI-P): el slug no se edita. */
  slugFijo: boolean
}

/**
 * Los datos de un plan (M18). Sin el plan, crea uno en borrador con lo mínimo
 * y lleva a su página; con él, edita todo. Publicar en Stripe es un paso
 * aparte (`PublicarPlan`): guardar no cobra nada ni toca Stripe.
 */
export function FormularioPlan({
  plan,
  cursos = [],
}: {
  plan?: PlanEnFormulario
  cursos?: { id: string; titulo: string; publicado: boolean }[]
}) {
  const nuevo = !plan
  const [estado, accion] = useActionState(guardarPlan, SIN_ESTADO)
  const marcados = new Set(plan?.cursos ?? [])

  const formulario = (
    <form action={accion} className="flex flex-col gap-6">
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="plan-nombre" etiqueta="Nombre">
          <Input id="plan-nombre" name="nombre" defaultValue={plan?.nombre ?? ''} required minLength={3} maxLength={80} placeholder="VADAI Ventas con IA" />
        </Campo>
        {plan?.slugFijo ? (
          <Campo id="plan-slug" etiqueta="Slug" ayuda="Fijo: va en cada suscripción de Stripe.">
            <input type="hidden" name="slug" value={plan.slug} />
            <Input id="plan-slug" value={plan.slug} disabled readOnly />
          </Campo>
        ) : (
          <Campo id="plan-slug" etiqueta="Slug" ayuda={nuevo ? 'Vacío: sale del nombre. Es la URL de su página.' : 'Es la URL de su página: /membresias/<slug>.'}>
            <Input id="plan-slug" name="slug" defaultValue={plan?.slug ?? ''} pattern="[a-z0-9-]{2,40}" placeholder="ventas-con-ia" />
          </Campo>
        )}
        <Campo id="plan-precio" etiqueta="Precio al mes (MXN)" ayuda="Lo que se cobra. Cambiarlo no le sube el precio a quien ya paga.">
          <Input id="plan-precio" name="precio" type="number" min={1} step="1" defaultValue={plan?.precioMxn ?? ''} required />
        </Campo>
        <Campo id="plan-tachado" etiqueta="Precio tachado (MXN, opcional)" ayuda="Solo de referencia: se muestra tachado y nunca se cobra.">
          <Input id="plan-tachado" name="tachado" type="number" min={1} step="1" defaultValue={plan?.precioTachadoMxn ?? ''} />
        </Campo>
      </div>

      {plan ? (
        <>
          <Campo id="plan-frase" etiqueta="Frase sobre el precio" ayuda="Va arriba del precio, en mayúsculas. Ej.: «Precio de graduado».">
            <Input id="plan-frase" name="frase" defaultValue={plan.frase ?? ''} maxLength={140} />
          </Campo>
          <Campo id="plan-descripcion" etiqueta="Descripción">
            <Textarea id="plan-descripcion" name="descripcion" defaultValue={plan.descripcion ?? ''} maxLength={2000} rows={4} />
          </Campo>
          <Campo id="plan-imagen" etiqueta="Imagen (opcional)" ayuda="Una URL https:// o una ruta del sitio como /vaip/flyer.jpg.">
            <Input id="plan-imagen" name="imagen" defaultValue={plan.imagen ?? ''} placeholder="/vaip/flyer.jpg" />
          </Campo>

          <Campo id="plan-casa" etiqueta="Casa del plan (opcional)" ayuda="El curso donde vive la comunidad: muro, clases en vivo y anuncios. Siempre va incluido.">
            <select id="plan-casa" name="casa" defaultValue={plan.casaId ?? ''} className={claseSelect}>
              <option value="">Sin casa</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                  {c.publicado ? '' : ' (borrador)'}
                </option>
              ))}
            </select>
          </Campo>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Cursos que da el plan</legend>
            <p className="text-xs text-muted-foreground">
              Un curso en borrador se entrega cuando se publique. Si el plan ya está a la venta, los miembros reciben los
              cursos nuevos al guardar, con su aviso por correo.
            </p>
            <div className="grid max-h-80 gap-1.5 overflow-y-auto rounded-[10px] border border-border p-3 sm:grid-cols-2">
              {cursos.map((c) => (
                <label key={c.id} className="flex min-h-9 items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="cursos"
                    value={c.id}
                    defaultChecked={marcados.has(c.id) || c.id === plan.casaId}
                    className="mt-0.5 size-4 accent-vadai-cyan"
                  />
                  <span>
                    {c.titulo}
                    {c.publicado ? null : <span className="text-muted-foreground"> · borrador</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : (
        <>
          <input type="hidden" name="frase" value="" />
          <input type="hidden" name="descripcion" value="" />
          <input type="hidden" name="imagen" value="" />
          <input type="hidden" name="casa" value="" />
        </>
      )}

      <AvisoAccion estado={estado} />
      <div>
        <Guardar nuevo={nuevo} />
      </div>
    </form>
  )

  // Crear vive detrás de su botón; se abre solo si la acción devolvió algo
  // (un error de validación), también sin JavaScript (CLAUDE.md, M14).
  if (nuevo) {
    return (
      <Desplegable etiqueta="Nuevo plan" variante="primario" abierto={Boolean(estado.error || estado.aviso)}>
        <div className="mt-3 max-w-2xl rounded-[10px] border border-border bg-card p-5">{formulario}</div>
      </Desplegable>
    )
  }
  return formulario
}
