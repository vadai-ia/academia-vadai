import type { ReactNode } from 'react'

import { Encabezado } from '@/components/marca/encabezado'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import { exigirAdmin } from '@/lib/auth/sesion'

/** Marco del área de administración. Un alumno que llegue aquí es devuelto. */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const perfil = await exigirAdmin()

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SaltarAlContenido />
      <Encabezado perfil={perfil} />
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  )
}
