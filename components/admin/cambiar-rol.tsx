'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { claseSelectCompacto } from '@/components/admin/estilos'
import { Button } from '@/components/ui/button'
import { cambiarRol } from '@/lib/admin/acciones-equipo'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Guardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? 'Guardando…' : 'Cambiar rol'}
    </Button>
  )
}

/**
 * El rol de una cuenta, para el superadmin (3-oct-2026): así se nombra o se
 * retira a un community manager. La ficha solo lo pinta para un superadmin y
 * nunca en su propia cuenta; la acción y la base lo vuelven a exigir.
 */
export function CambiarRol({ userId, actual }: { userId: string; actual: string }) {
  const [estado, accion] = useActionState(cambiarRol, SIN_ESTADO)

  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`rol-${userId}`} className="text-sm text-muted-foreground">
          Rol
        </label>
        <select id={`rol-${userId}`} name="rol" defaultValue={actual} className={claseSelectCompacto}>
          <option value="alumno">Alumno</option>
          <option value="community_manager">Community manager</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <Guardar />
      </div>
      <AvisoAccion estado={estado} />
    </form>
  )
}
