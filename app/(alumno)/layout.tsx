import type { ReactNode } from 'react'

import { Encabezado } from '@/components/marca/encabezado'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import { exigirPerfil } from '@/lib/auth/sesion'

/**
 * Marco del área de alumno. `exigirPerfil` es la segunda barrera: el middleware
 * ya filtró, pero un server component nunca debe confiar en eso solo.
 */
export default async function LayoutAlumno({ children }: { children: ReactNode }) {
  const perfil = await exigirPerfil()

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SaltarAlContenido />
      <Encabezado
        perfil={perfil}
        navegacion={[
          { href: '/mis-cursos', etiqueta: 'Mis cursos' },
          { href: '/blog', etiqueta: 'Blog' },
          { href: '/perfil', etiqueta: 'Mi perfil' },
        ]}
      />
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  )
}
