import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Tablero } from '@/components/dinamicas/tablero'
import { Button } from '@/components/ui/button'
import { Seccion } from '@/components/ui-vadai/superficie'
import { exigirAdmin } from '@/lib/auth/sesion'
import { contarCeldasDeCriterio } from '@/lib/dinamicas/comun'
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

  // Mismo conteo que la pestaña de tableros y el Excel: solo celdas de criterio.
  const { llenas, total } = contarCeldasDeCriterio(tablero.filas, tablero.columnas, tablero.celdas)
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

      {/* Sin <RefrescoPeriodico />: el propio tablero sondea su versión cada tres
          segundos y se refresca cuando cambia. Un segundo reloj ciego encima
          duplicaba las recargas y pisaba la guarda de no refrescar con un
          guardado en vuelo. */}
      <Tablero tablero={tablero} puedeEscribir soyAdmin miUserId={perfil.user_id} />
    </Seccion>
  )
}
