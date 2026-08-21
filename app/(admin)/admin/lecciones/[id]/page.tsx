import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Adjuntos } from '@/components/admin/adjuntos'
import { ConstructorQuiz } from '@/components/admin/constructor-quiz'
import { FormularioLeccion } from '@/components/admin/formulario-leccion'
import { Button } from '@/components/ui/button'
import { eliminarLeccion } from '@/lib/admin/acciones'
import { bunnyConfigurado } from '@/lib/bunny/cliente'
import { obtenerLeccion } from '@/lib/admin/consultas'
import { quizDeLeccion } from '@/lib/admin/quizzes'
import { exigirAdmin } from '@/lib/auth/sesion'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const leccion = await obtenerLeccion(id)
  return { title: leccion?.title ?? 'Lección' }
}

export default async function PaginaLeccion({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()
  const { id } = await params

  const leccion = await obtenerLeccion(id)
  if (!leccion) notFound()

  const quiz = leccion.lesson_type === 'quiz' ? await quizDeLeccion(leccion.id) : null

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <header className="flex flex-col gap-1">
        <Link
          href={`/admin/cursos/${leccion.curso_id}`}
          className="text-sm text-vadai-cyan underline-offset-4 hover:underline"
        >
          ← {leccion.curso_titulo}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{leccion.title}</h1>
      </header>

      <FormularioLeccion
        leccion={leccion}
        cursoId={leccion.curso_id}
        bunnyListo={bunnyConfigurado()}
      />

      {leccion.lesson_type === 'quiz' ? (
        <div className="border-t border-border pt-8">
          <ConstructorQuiz quiz={quiz} leccionId={leccion.id} />
        </div>
      ) : null}

      <div className="border-t border-border pt-8">
        <Adjuntos
          adjuntos={leccion.adjuntos}
          leccionId={leccion.id}
          cursoId={leccion.curso_id}
        />
      </div>

      <div className="border-t border-border pt-6">
        <form action={eliminarLeccion}>
          <input type="hidden" name="id" value={leccion.id} />
          <input type="hidden" name="course_id" value={leccion.curso_id} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            title="Elimina la lección y todo lo que cuelga de ella"
          >
            Eliminar lección
          </Button>
        </form>
      </div>
    </div>
  )
}
