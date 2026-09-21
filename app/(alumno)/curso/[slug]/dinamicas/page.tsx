import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ListaDinamicas } from '@/components/dinamicas/lista-dinamicas'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { misDinamicas } from '@/lib/dinamicas/consultas-alumno'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() es control de acceso.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const curso = await cursoDelAlumno(slug)
  return { title: curso ? `Dinámicas · ${curso.titulo}` : 'Dinámicas' }
}

/**
 * Pestaña "Dinámicas" de un curso.
 *
 * Sin encabezado propio ni migaja: el layout del curso ya pone el título, el
 * progreso y las pestañas. NO redirige por acceso vencido: las dinámicas son
 * estructura del curso, y se pueden ver aunque ya no se puedan puntuar.
 */
export default async function PaginaDinamicasDelCurso({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const perfil = await exigirPerfil()
  const { slug } = await params

  // El layout ya lo pidió y `cache()` lo memoriza: esto no cuesta otro viaje.
  const curso = await cursoDelAlumno(slug)
  if (!curso) notFound()

  const dinamicas = await misDinamicas(curso.id)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Lo que tu empresa decide con lo que va aprendiendo en este curso.
      </p>

      {dinamicas.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Este curso todavía no tiene dinámicas. Cuando el equipo abra una, aparece aquí.
          </p>
        </Tarjeta>
      ) : (
        <ListaDinamicas dinamicas={dinamicas} omitirCurso equipo={esEquipo(perfil)} />
      )}
    </div>
  )
}
