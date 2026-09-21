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
 * Entrar a una encuesta.
 *
 * UN SOLO BOTÓN (decidido 3-sep-2026). Antes había dos —"crear mi cuenta" y
 * "continuar como invitado"— y pedían exactamente los mismos datos, así que la
 * elección no cambiaba nada para quien la hacía: solo lo detenía a decidir, de
 * pie, con el celular en la mano y la pared esperándolo. Ahora se entra y la
 * cuenta se crea sola, que es lo que pedía el encargo original.
 *
 * Y si la cookie ya reconoce a la persona, esta pantalla ni se muestra: pasa
 * directo a contestar. Ver `app/e/[codigo]/page.tsx`.
 */

function Boton({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
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
            <Boton>Entrar</Boton>
            <p className="text-xs text-muted-foreground">
              {permiteInvitados
                ? 'Te mandamos un correo para que pongas tu contraseña y vuelvas a entrar en la siguiente encuesta sin llenar nada.'
                : 'Esta encuesta es solo para quien ya tiene cuenta en la academia.'}
            </p>
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
