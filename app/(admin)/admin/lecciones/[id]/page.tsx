import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Adjuntos } from '@/components/admin/adjuntos'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { ConstructorQuiz } from '@/components/admin/constructor-quiz'
import { ConstructorTarea } from '@/components/admin/constructor-tarea'
import { FormularioLeccion } from '@/components/admin/formulario-leccion'
import { eliminarLeccion } from '@/lib/admin/acciones'
import { bunnyConfigurado } from '@/lib/bunny/cliente'
import { obtenerLeccion } from '@/lib/admin/consultas'
import { quizDeLeccion } from '@/lib/admin/quizzes'
import { tareaDeLeccion } from '@/lib/admin/tareas'
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
  const tarea =
    leccion.lesson_type === 'assignment' ? await tareaDeLeccion(leccion.id) : null

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <header className="flex flex-col gap-1">
        <Link
          href={`/admin/cursos/${leccion.curso_id}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
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

      {leccion.lesson_type === 'assignment' ? (
        <div className="border-t border-border pt-8">
          <ConstructorTarea tarea={tarea} leccionId={leccion.id} />
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
        <ConfirmarConModal
          idModal={`eliminar-leccion-${leccion.id}`}
          accion={eliminarLeccion}
          campos={{ id: leccion.id, course_id: leccion.curso_id }}
          boton={{ texto: 'Eliminar lección', etiquetaAccesible: `Eliminar la lección ${leccion.title}`, tono: 'destructivo' }}
          titulo={`¿Eliminar «${leccion.title}»?`}
          confirmar={{ texto: 'Sí, eliminar', enCurso: 'Eliminando…', tono: 'destructivo' }}
        >
          <p>
            Se borra con su video ligado, adjuntos, quiz o tarea, y el avance que los alumnos
            tuvieran en ella. No se puede deshacer.
          </p>
        </ConfirmarConModal>
      </div>
    </div>
  )
}
