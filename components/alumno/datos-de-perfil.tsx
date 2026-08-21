'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { actualizarNombre } from '@/lib/alumno/acciones-perfil'

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar'}
    </Button>
  )
}

export function DatosDePerfil({ nombre, correo }: { nombre: string; correo: string }) {
  const [estado, accion] = useActionState(actualizarNombre, {})

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="perfil-nombre">Nombre completo</Label>
        <Input
          id="perfil-nombre"
          name="full_name"
          defaultValue={nombre}
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
        />
        <p className="text-xs text-muted-foreground">
          Es el nombre que se imprime en tus certificados.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="perfil-correo">Correo</Label>
        <Input id="perfil-correo" value={correo} readOnly disabled />
        <p className="text-xs text-muted-foreground">
          Es tu identidad en la plataforma. Si necesitas cambiarlo, escríbenos.
        </p>
      </div>

      <AvisoAccion estado={estado} />

      <div>
        <Guardar />
      </div>
    </form>
  )
}
