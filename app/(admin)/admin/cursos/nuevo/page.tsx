import type { Metadata } from 'next'
import Link from 'next/link'

import { FormularioCurso } from '@/components/admin/formulario-curso'
import { exigirAdmin } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Nuevo curso' }

export default async function PaginaNuevoCurso() {
  await exigirAdmin()

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/cursos"
          className="text-sm text-vadai-cyan underline-offset-4 hover:underline"
        >
          ← Cursos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo curso</h1>
        <p className="text-sm text-muted-foreground">
          Nace en borrador. Los módulos y lecciones se agregan después de crearlo.
        </p>
      </header>

      <FormularioCurso />
    </div>
  )
}
