'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Mensaje } from '@/components/auth/mensaje'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fijarNuevaContrasena } from '@/lib/auth/acciones'
import { ESTADO_INICIAL } from '@/lib/auth/tipos'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar y entrar'}
    </Button>
  )
}

export function FormularioNuevaContrasena() {
  const [estado, accion] = useActionState(fijarNuevaContrasena, ESTADO_INICIAL)

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="contrasena">Contraseña nueva</Label>
        <Input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmacion">Repítela</Label>
        <Input
          id="confirmacion"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <Mensaje estado={estado} />
      <Boton />
    </form>
  )
}
