'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Mensaje } from '@/components/auth/mensaje'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { enviarRecuperacion } from '@/lib/auth/acciones'
import { RUTAS } from '@/lib/auth/rutas'
import { ESTADO_INICIAL } from '@/lib/auth/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviarme el enlace'}
    </Button>
  )
}

export function FormularioRecuperar() {
  const [estado, accion] = useActionState(enviarRecuperacion, ESTADO_INICIAL)
  const enviado = Boolean(estado.aviso)

  return (
    <form action={accion} className="flex flex-col gap-4">
      {!enviado ? (
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
      ) : null}

      <Mensaje estado={estado} />

      {!enviado ? <Boton /> : null}

      <Link
        href={RUTAS.login}
        className="text-center text-sm text-vadai-cyan underline-offset-4 hover:underline"
      >
        Volver a entrar
      </Link>
    </form>
  )
}
