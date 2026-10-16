import type { ReactNode } from 'react'

import { MarcoAlumno } from '@/components/alumno/marco-alumno'
import { exigirPerfil } from '@/lib/auth/sesion'

/**
 * Marco del área de alumno. `exigirPerfil` es la segunda barrera: el middleware
 * ya filtró, pero un server component nunca debe confiar en eso solo.
 */
export default async function LayoutAlumno({ children }: { children: ReactNode }) {
  const perfil = await exigirPerfil()
  return <MarcoAlumno perfil={perfil}>{children}</MarcoAlumno>
}
