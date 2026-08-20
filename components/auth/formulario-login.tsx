'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Mensaje } from '@/components/auth/mensaje'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { entrarConContrasena, entrarConGoogle } from '@/lib/auth/acciones'
import { RUTAS } from '@/lib/auth/rutas'
import { ESTADO_INICIAL } from '@/lib/auth/tipos'

function BotonEnviar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Entrando…' : children}
    </Button>
  )
}

function BotonGoogle() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      <GoogleIcono />
      {pending ? 'Abriendo Google…' : 'Continuar con Google'}
    </Button>
  )
}

function GoogleIcono() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3 0-5.6-2-6.6-4.8H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.4 6.9 9 4.8 12 4.8Z"
      />
    </svg>
  )
}

export function FormularioLogin({ destino, errorInicial }: { destino?: string; errorInicial?: string }) {
  const [estado, accion] = useActionState(entrarConContrasena, {
    ...ESTADO_INICIAL,
    error: errorInicial,
  })

  return (
    <div className="flex flex-col gap-5">
      <form action={entrarConGoogle}>
        <BotonGoogle />
      </form>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">o con tu correo</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={accion} className="flex flex-col gap-4">
        {destino ? <input type="hidden" name="destino" value={destino} /> : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="correo">Correo</Label>
          <Input
            id="correo"
            name="correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="tucorreo@empresa.com"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="contrasena">Contraseña</Label>
            <Link
              href={RUTAS.recuperar}
              className="text-xs text-vadai-cyan underline-offset-4 hover:underline"
            >
              ¿La olvidaste?
            </Link>
          </div>
          <Input
            id="contrasena"
            name="contrasena"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <Mensaje estado={estado} />

        <BotonEnviar>Entrar</BotonEnviar>
      </form>
    </div>
  )
}
