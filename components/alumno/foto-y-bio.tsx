'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Avatar } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { actualizarFotoYBio } from '@/lib/alumno/acciones-perfil'

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar foto y bio'}
    </Button>
  )
}

/** Foto y bio (M17): lo que ven los demás en el muro y en el perfil de miembro. */
export function FotoYBio({ nombre, foto, bio }: { nombre: string; foto: string | null; bio: string | null }) {
  const [estado, accion] = useActionState(actualizarFotoYBio, {})

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar nombre={nombre} foto={foto} tamano={64} className="text-xl" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perfil-foto">Foto</Label>
          <input
            id="perfil-foto"
            name="foto"
            type="file"
            accept="image/*"
            className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
          {foto ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="quitar_foto" value="si" className="size-3.5" />
              Quitar mi foto
            </label>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="perfil-bio">Una línea sobre ti</Label>
        <Textarea
          id="perfil-bio"
          name="bio"
          defaultValue={bio ?? ''}
          maxLength={160}
          rows={2}
          placeholder="Director de operaciones. Automatizo reportes de inventario con Claude."
        />
        <p className="text-xs text-muted-foreground">Hasta 160 caracteres. La ven los demás miembros de V-AI-P.</p>
      </div>

      <AvisoAccion estado={estado} />
      <div>
        <Guardar />
      </div>
    </form>
  )
}
