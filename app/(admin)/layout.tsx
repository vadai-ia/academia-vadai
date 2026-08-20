import type { ReactNode } from 'react'

import { Encabezado } from '@/components/marca/encabezado'
import { exigirAdmin } from '@/lib/auth/sesion'

/** Marco del área de administración. Un alumno que llegue aquí es devuelto. */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const perfil = await exigirAdmin()

  return (
    <div className="flex min-h-dvh flex-col">
      <Encabezado perfil={perfil} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
    </div>
  )
}
