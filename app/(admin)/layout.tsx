import type { ReactNode } from 'react'

import { Encabezado } from '@/components/marca/encabezado'
import {
  IconoCursos,
  IconoEncuestas,
  IconoPanel,
  IconoPerfil,
} from '@/components/marca/iconos-navegacion'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import { exigirAdmin } from '@/lib/auth/sesion'

/** Marco del área de administración. Un alumno que llegue aquí es devuelto. */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const perfil = await exigirAdmin()

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SaltarAlContenido />
      <Encabezado
        perfil={perfil}
        navegacion={[
          { href: '/admin', etiqueta: 'Panel', icono: IconoPanel, exacto: true },
          { href: '/admin/cursos', etiqueta: 'Cursos', icono: IconoCursos },
          { href: '/admin/alumnos', etiqueta: 'Alumnos', icono: IconoPerfil },
          { href: '/admin/encuestas', etiqueta: 'Encuestas', icono: IconoEncuestas },
          { href: '/mis-cursos', etiqueta: 'Vista de alumno', icono: IconoCursos },
        ]}
      />
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-10">
        {children}
      </main>
    </div>
  )
}
