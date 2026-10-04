'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { CerrarDesplegable } from '@/components/admin/cerrar-desplegable'
import { Desplegable } from '@/components/admin/desplegable'
import { claseSelect } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { publicarDesdeElPanel } from '@/lib/admin/acciones-comunidad'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Botones() {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? 'Publicando…' : 'Publicar en el muro'}
      </Button>
      <CerrarDesplegable />
    </div>
  )
}

/**
 * Publicar en el muro de una generación —o de todas las de un curso— sin
 * entrar al portal. Es un mensaje de la comunidad, no un anuncio del blog:
 * los alumnos lo ven en su muro y le pueden contestar.
 */
export function PublicarEnMuro({
  cursos,
  reinicio,
}: {
  cursos: Array<{ id: string; titulo: string; generaciones: Array<{ id: string; nombre: string }> }>
  reinicio: number
}) {
  const [estado, accion] = useActionState(publicarDesdeElPanel, SIN_ESTADO)

  return (
    <Desplegable etiqueta="Publicar en un muro" variante="contorno" abierto={Boolean(estado.error || estado.aviso)}>
      <form key={reinicio} action={accion} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="muro-destino">Dónde</Label>
          {/* «curso::generación» o «curso::todas»; el servidor lo reparte. */}
          <select id="muro-destino" name="destino" required className={claseSelect} defaultValue="">
            <option value="" disabled>
              Elige un muro
            </option>
            {cursos.map((c) =>
              c.generaciones.length === 0 ? (
                <option key={c.id} value={`${c.id}::`}>
                  {c.titulo}
                </option>
              ) : (
                <optgroup key={c.id} label={c.titulo}>
                  {c.generaciones.length > 1 ? (
                    <option value={`${c.id}::todas`}>Todas sus generaciones</option>
                  ) : null}
                  {c.generaciones.map((g) => (
                    <option key={g.id} value={`${c.id}::${g.id}`}>
                      {g.nombre}
                    </option>
                  ))}
                </optgroup>
              )
            )}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="muro-titulo">Título</Label>
          <Input id="muro-titulo" name="titulo" required minLength={3} maxLength={160} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="muro-cuerpo">Mensaje</Label>
          <Textarea id="muro-cuerpo" name="cuerpo" rows={5} maxLength={5000} />
          <span className="text-xs text-muted-foreground">Deja una línea en blanco entre párrafos.</span>
        </div>

        <AvisoAccion estado={estado} />
        <Botones />
      </form>
    </Desplegable>
  )
}
