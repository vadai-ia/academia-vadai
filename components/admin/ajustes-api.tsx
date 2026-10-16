'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Desplegable } from '@/components/admin/desplegable'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { crearLlaveApi, crearWebhook, probarWebhook, rotarSecretoWebhook, type EstadoApi } from '@/lib/api/acciones'
import { EVENTOS_DE_WEBHOOK, PERMISOS } from '@/lib/api/permisos'

const VACIO: EstadoApi = {}

function Enviar({ texto, ocupado, variante = 'default', tamano = 'default' }: { texto: string; ocupado: string; variante?: 'default' | 'outline'; tamano?: 'default' | 'sm' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} variant={variante} size={tamano}>
      {pending ? ocupado : texto}
    </Button>
  )
}

/** Lo que se muestra una sola vez: la llave o el secreto, para copiarlo. */
function UnaVez({ valor }: { valor?: string }) {
  if (!valor) return null
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-accent bg-accent/15 p-3">
      <code className="font-mono text-xs break-all select-all">{valor}</code>
      <span className="text-xs text-muted-foreground">Selecciónalo y cópialo. Al recargar la página ya no aparece.</span>
    </div>
  )
}

export function NuevaLlave() {
  const [estado, accion] = useActionState(crearLlaveApi, VACIO)
  return (
    <Desplegable etiqueta="Nueva llave" variante="primario" abierto={Boolean(estado.error || estado.aviso)}>
      <form action={accion} className="mt-3 flex max-w-2xl flex-col gap-4 rounded-[10px] border border-border bg-card p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="llave-nombre">Para qué es</Label>
          <Input id="llave-nombre" name="nombre" required minLength={2} maxLength={80} placeholder="Noticias diarias con Claude" />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Permisos</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PERMISOS.map((p) => (
              <label key={p.clave} className="flex min-h-9 items-start gap-2 text-sm">
                <input type="checkbox" name="permisos" value={p.clave} className="mt-0.5 size-4 accent-vadai-cyan" />
                <span>
                  {p.etiqueta} <span className="font-mono text-xs text-muted-foreground">{p.clave}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Dale solo lo que necesita: una llave para publicar noticias no necesita ver miembros.</p>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="llave-vence">Vence</Label>
          <select id="llave-vence" name="vence_dias" defaultValue="365" className={claseSelect}>
            <option value="30">En 30 días</option>
            <option value="90">En 90 días</option>
            <option value="365">En un año</option>
            <option value="0">No vence (no aplica si ve cobros)</option>
          </select>
        </div>
        <AvisoAccion estado={estado} />
        <UnaVez valor={estado.secreto} />
        <div>
          <Enviar texto="Crear llave" ocupado="Creando…" />
        </div>
      </form>
    </Desplegable>
  )
}

export function NuevoWebhook() {
  const [estado, accion] = useActionState(crearWebhook, VACIO)
  return (
    <Desplegable etiqueta="Nuevo webhook" variante="contorno" abierto={Boolean(estado.error || estado.aviso)}>
      <form action={accion} className="mt-3 flex max-w-2xl flex-col gap-4 rounded-[10px] border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="webhook-nombre">Nombre</Label>
            <Input id="webhook-nombre" name="nombre" required minLength={2} maxLength={80} placeholder="Make · noticias al newsletter" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="webhook-url">URL (https)</Label>
            <Input id="webhook-url" name="url" type="url" required placeholder="https://hook.us1.make.com/…" />
          </div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Qué le avisamos</legend>
          {EVENTOS_DE_WEBHOOK.map((e) => (
            <label key={e.clave} className="flex min-h-9 items-start gap-2 text-sm">
              <input type="checkbox" name="eventos" value={e.clave} className="mt-0.5 size-4 accent-vadai-cyan" />
              <span>
                {e.etiqueta} <span className="font-mono text-xs text-muted-foreground">{e.clave}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <AvisoAccion estado={estado} />
        <UnaVez valor={estado.secreto} />
        <div>
          <Enviar texto="Registrar webhook" ocupado="Registrando…" />
        </div>
      </form>
    </Desplegable>
  )
}

/** «Mandar prueba» y «Rotar secreto» de un webhook. */
export function AccionesDeWebhook({ id }: { id: string }) {
  const [prueba, accionPrueba] = useActionState(probarWebhook, VACIO)
  const [rotado, accionRotar] = useActionState(rotarSecretoWebhook, VACIO)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={accionPrueba}>
          <input type="hidden" name="id" value={id} />
          <Enviar texto="Mandar prueba" ocupado="Mandando…" variante="outline" tamano="sm" />
        </form>
        <form action={accionRotar}>
          <input type="hidden" name="id" value={id} />
          <Enviar texto="Rotar secreto" ocupado="Rotando…" variante="outline" tamano="sm" />
        </form>
      </div>
      <AvisoAccion estado={prueba} />
      <AvisoAccion estado={rotado} />
      <UnaVez valor={rotado.secreto} />
    </div>
  )
}
