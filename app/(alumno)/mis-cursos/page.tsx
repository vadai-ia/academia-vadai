import type { Metadata } from 'next'

import { TarjetaCurso } from '@/components/alumno/tarjeta-curso'
import { misCursos } from '@/lib/alumno/consultas'
import { exigirPerfil, nombreVisible } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Mis cursos' }
export const dynamic = 'force-dynamic'

export default async function PaginaMisCursos() {
  const perfil = await exigirPerfil()
  const cursos = await misCursos()

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {nombreVisible(perfil)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {cursos.length === 0
            ? 'Aquí aparecerán tus cursos.'
            : cursos.length === 1
              ? 'Tu curso y tu avance.'
              : `Tus ${cursos.length} cursos y tu avance.`}
        </p>
      </header>

      {cursos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no tienes ningún curso asignado.
          </p>
          <a
            href="mailto:hola@vadai.com.mx?subject=No%20veo%20mi%20curso"
            className="mt-2 inline-block text-sm text-vadai-cyan underline-offset-4 hover:underline"
          >
            Si compraste uno, escríbenos
          </a>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {cursos.map((curso) => (
            <li key={curso.id}>
              <TarjetaCurso curso={curso} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
