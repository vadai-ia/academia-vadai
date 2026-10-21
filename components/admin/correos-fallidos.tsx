'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { AvisoAccion } from '@/components/admin/aviso-accion'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { reenviarCorreosFallidos } from '@/lib/admin/acciones-alumnos'
import { SIN_ESTADO } from '@/lib/admin/tipos'

function Enviar({ texto, ocupado, chico = false }: { texto: string; ocupado: string; chico?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" variant={chico ? 'outline' : 'default'} disabled={pending}>
      {pending ? ocupado : texto}
    </Button>
  )
}

export type CorreoFallidoEnLista = { userId: string; email: string; nombre: string | null; motivo: string | null }

/**
 * «N correos de acceso no salieron · Reenviar» (M25), arriba de Alumnos.
 *
 * Antes un correo que fallaba solo quedaba en el log del servidor y nadie se
 * enteraba hasta que el alumno escribía que no podía entrar. Las direcciones
 * van en un `<details>` cerrado: esta pantalla se proyecta.
 */
export function CorreosQueNoSalieron({ correos }: { correos: CorreoFallidoEnLista[] }) {
  const [estado, accion] = useActionState(reenviarCorreosFallidos, SIN_ESTADO)
  const n = correos.length

  return (
    <Tarjeta className="flex flex-col gap-3 border-destructive/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3" data-correos-fallidos={n}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-medium">
            {n === 1 ? '1 correo de acceso no salió' : `${n} correos de acceso no salieron`}
          </p>
          <p className="text-sm text-pretty text-muted-foreground">
            Sin ese correo no pueden entrar. Se reenvía el mismo correo, con una liga nueva de 30 días.
          </p>
        </div>
        <form action={accion}>
          <Enviar texto={n === 1 ? 'Reenviar' : `Reenviar a los ${n}`} ocupado="Reenviando…" />
        </form>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Ver a quién</summary>
        <ul className="mt-2 flex flex-col gap-1 [overflow-wrap:anywhere]">
          {correos.map((c) => (
            <li key={c.userId}>
              <a href={`/admin/alumnos/${c.userId}`} className="font-medium hover:underline">
                {c.nombre ?? c.email}
              </a>
              {c.nombre ? <span className="text-muted-foreground"> · {c.email}</span> : null}
              {c.motivo ? <span className="text-muted-foreground"> · {c.motivo}</span> : null}
            </li>
          ))}
        </ul>
      </details>
      <AvisoAccion estado={estado} />
    </Tarjeta>
  )
}

/** «Reintentar» del último correo que falló, en la ficha de una persona. */
export function ReintentarCorreo({ userId }: { userId: string }) {
  const [estado, accion] = useActionState(reenviarCorreosFallidos, SIN_ESTADO)
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <div>
        <Enviar texto="Reintentar" ocupado="Reenviando…" chico />
      </div>
      <AvisoAccion estado={estado} />
    </form>
  )
}
