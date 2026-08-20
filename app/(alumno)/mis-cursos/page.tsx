import type { Metadata } from 'next'

import { exigirPerfil, nombreVisible } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Mis cursos' }
export const dynamic = 'force-dynamic'

export default async function PaginaMisCursos() {
  const perfil = await exigirPerfil()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {nombreVisible(perfil)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Aquí verás tus cursos y tu avance.
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Tus cursos aparecerán aquí en cuanto estén listos.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">M4 · vista de alumno</p>
      </div>
    </div>
  )
}
