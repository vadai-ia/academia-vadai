import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Tablero } from '@/components/dinamicas/tablero'
import { RefrescoPeriodico } from '@/components/encuestas/refresco-periodico'
import { Button } from '@/components/ui/button'
import { Seccion } from '@/components/ui-vadai/superficie'
import { exigirAdmin } from '@/lib/auth/sesion'
import { duenoDeTablero, obtenerTablero } from '@/lib/dinamicas/tablero'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() es control de acceso.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; boardId: string }>
}): Promise<Metadata> {
  const { boardId } = await params
  const tablero = await obtenerTablero(boardId)
  return { title: tablero ? `Tablero de ${tablero.empresa ?? 'alumno'}` : 'Tablero' }
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/**
 * Un tablero visto —y editable— desde el admin.
 *
 * El equipo escribe aunque la dinámica esté cerrada: "cerrada" es el candado
 * del alumno, no del equipo, y los puntos se calculan al leer, así que una
 * corrección posterior fluye sola. El banner lo dice para que nadie corrija
 * creyendo que "no se guarda".
 *
 * El encabezado, la caja de cifras y las pestañas los pone el layout de la
 * dinámica (agente ADMIN); aquí solo va el tablero.
 */
export default async function PaginaTableroAdmin({
  params,
}: {
  params: Promise<{ id: string; boardId: string }>
}) {
  const perfil = await exigirAdmin()
  const { id, boardId } = await params

  const [tablero, dueno] = await Promise.all([obtenerTablero(boardId), duenoDeTablero(boardId)])
  // Un tablero de OTRA dinámica bajo esta URL no existe.
  if (!tablero || tablero.dinamicaId !== id) notFound()

  const total = tablero.filas.length * tablero.columnas.length
  const llenas = tablero.celdas.length
  const nombres =
    tablero.editores.length > 0
      ? tablero.editores.map((e) => e.nombre).join(', ')
      : 'nadie todavía'

  return (
    <Seccion
      titulo={`Tablero de ${tablero.empresa ?? dueno ?? 'alumno'}`}
      apoyo={`${plural(tablero.columnas.length, 'proyecto', 'proyectos')} · ${llenas} de ${total} celdas · editan ${nombres}`}
      accion={
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/dinamicas/${id}/tableros`}>Todos los tableros</Link>
        </Button>
      }
    >
      {tablero.estado !== 'open' ? (
        <p
          role="status"
          className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
        >
          Esta dinámica está cerrada: los alumnos solo la ven. Lo que cambies aquí queda guardado
          y sale en el Excel.
        </p>
      ) : null}

      <Tablero tablero={tablero} puedeEscribir soyAdmin miUserId={perfil.user_id} />

      <RefrescoPeriodico />
    </Seccion>
  )
}
