'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { entrarAEncuesta } from '@/lib/encuestas/acciones-publicas'
import { SIN_ESTADO_PUBLICO } from '@/lib/encuestas/tipos-publicos'
import { cn } from '@/lib/utils'

/**
 * Los tres caminos para entrar a una encuesta.
 *
 * Están en UN SOLO formulario con DOS botones de envío, y eso no es un ahorro de
 * código: un `<button name="crear_cuenta">` solo manda su valor si fue el que se
 * pulsó, así que el servidor sabe cuál eligió la persona **sin una línea de
 * JavaScript**. La alternativa —un botón que cambia un campo oculto con
 * onClick— dejaría a quien tenga JS bloqueado sin poder participar, de pie en
 * una sala.
 *
 * Los datos se piden igual en los dos caminos. Es la decisión de Alejandro y es
 * la que sostiene el negocio: quien "continúa como invitado" también deja su
 * nombre, correo y teléfono; lo único que no se le crea es la cuenta.
 */

function Boton({
  children,
  variant = 'default',
  name,
  value,
}: {
  children: string
  variant?: 'default' | 'outline'
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant={variant}
      name={name}
      value={value}
      disabled={pending}
      className="w-full"
    >
      {pending ? 'Un momento…' : children}
    </Button>
  )
}

export function EntrarAEncuesta({
  codigo,
  permiteInvitados,
  sesion,
}: {
  codigo: string
  permiteInvitados: boolean
  /** Si ya trae sesión, se le ofrece entrar con su cuenta y ya. */
  sesion: { nombre: string; email: string } | null
}) {
  const [estado, accion] = useActionState(entrarAEncuesta, SIN_ESTADO_PUBLICO)

  const partes = sesion?.nombre.trim().split(/\s+/) ?? []

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="codigo" value={codigo} />

      {sesion ? (
        <>
          {/* Camino (a): ya tiene cuenta. No se le vuelve a preguntar nada. */}
          <input type="hidden" name="nombre" value={partes[0] ?? sesion.email.split('@')[0]} />
          <input type="hidden" name="apellido" value={partes.slice(1).join(' ') || '·'} />
          <input type="hidden" name="email" value={sesion.email} />
          <input type="hidden" name="telefono" value="" />

          <div className="flex flex-col gap-2">
            <p className="text-base">
              Entras como <span className="font-medium">{sesion.nombre}</span>.
            </p>
            <p className="text-sm text-muted-foreground">{sesion.email}</p>
          </div>

          <Boton>Entrar</Boton>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ent-nombre">Nombre</Label>
                <Input
                  id="ent-nombre"
                  name="nombre"
                  required
                  minLength={2}
                  maxLength={60}
                  autoComplete="given-name"
                  autoCapitalize="words"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ent-apellido">Apellido</Label>
                <Input
                  id="ent-apellido"
                  name="apellido"
                  required
                  minLength={2}
                  maxLength={60}
                  autoComplete="family-name"
                  autoCapitalize="words"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ent-email">Correo</Label>
              <Input
                id="ent-email"
                name="email"
                type="email"
                inputMode="email"
                required
                maxLength={160}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="tucorreo@empresa.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ent-telefono">Teléfono</Label>
              <Input
                id="ent-telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                maxLength={30}
                autoComplete="tel"
                placeholder="55 1234 5678"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Boton name="crear_cuenta" value="si">
              Crear mi cuenta y entrar
            </Boton>
            <p className="text-xs text-muted-foreground">
              Te mandamos un correo para que pongas tu contraseña. Así vuelves a entrar en la
              siguiente dinámica sin llenar nada.
            </p>

            {permiteInvitados ? (
              <>
                <div className="flex items-center gap-3" aria-hidden>
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">o</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Boton variant="outline">Continuar como invitado</Boton>
              </>
            ) : null}
          </div>
        </>
      )}

      {estado.error ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            'border-destructive/40 bg-destructive/10 text-destructive'
          )}
        >
          {estado.error}
        </p>
      ) : null}
    </form>
  )
}
