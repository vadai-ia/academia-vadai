import type { Metadata } from 'next'

import { ListaDinamicas } from '@/components/dinamicas/lista-dinamicas'
import { Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { misDinamicas } from '@/lib/dinamicas/consultas-alumno'

export const metadata: Metadata = { title: 'Dinámicas' }
export const dynamic = 'force-dynamic'

/**
 * Las dinámicas empresariales del alumno, de todos sus cursos.
 *
 * Es la segunda pastilla del menú porque es lo que se toca entre una sesión y
 * otra: la tarea real del curso, la que se resuelve con la empresa.
 */
export default async function PaginaDinamicas() {
  const [perfil, dinamicas] = await Promise.all([exigirPerfil(), misDinamicas()])

  return (
    <div className="flex flex-col gap-8">
      <Titulo apoyo="Ejercicios que resuelves con tu empresa entre una sesión y otra.">
        Dinámicas
      </Titulo>

      {dinamicas.length === 0 ? (
        <Tarjeta className="border-dashed px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no hay dinámicas para ti. Cuando el equipo abra una en tu curso, aparece
            aquí y te avisamos en la campana.
          </p>
        </Tarjeta>
      ) : (
        <ListaDinamicas dinamicas={dinamicas} equipo={esEquipo(perfil)} />
      )}
    </div>
  )
}
