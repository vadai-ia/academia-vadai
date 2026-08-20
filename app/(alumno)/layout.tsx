import type { ReactNode } from 'react'

import { Encabezado } from '@/components/marca/encabezado'
import { exigirPerfil } from '@/lib/auth/sesion'

/**
 * Marco del área de alumno. `exigirPerfil` es la segunda barrera: el middleware
 * ya filtró, pero un server component nunca debe confiar en eso solo.
 */
export default async function LayoutAlumno({ children }: { children: ReactNode }) {
  const perfil = await exigirPerfil()

  return (
    <div className="flex min-h-dvh flex-col">
      <Encabezado perfil={perfil} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
    </div>
  )
}
