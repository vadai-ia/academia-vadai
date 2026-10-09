import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ListaDeAcceso } from '@/components/admin/lista-de-acceso'
import { Titulo } from '@/components/ui-vadai/superficie'
import { accesoDeModulo } from '@/lib/admin/exclusivas'
import { exigirEquipo } from '@/lib/auth/sesion'

export const metadata: Metadata = { title: 'Acceso a la sesión' }
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Quién entra a una sesión exclusiva (0038, 9-oct-2026). La manejan admin y
 * community manager. NO lleva `loading.tsx`: el `notFound()` es control de
 * acceso (CLAUDE.md).
 */
export default async function PaginaAccesoDeModulo({ params }: { params: Promise<{ id: string }> }) {
  await exigirEquipo()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const datos = await accesoDeModulo(id)
  if (!datos) notFound()
  const { modulo, personas, empresas } = datos

  // Cambia con lo guardado: la lista vuelve a nacer con eso tras guardar.
  const enLista = personas.filter((p) => p.enLista)
  const ultima = enLista.reduce((max, p) => (p.agregadaEn && p.agregadaEn > max ? p.agregadaEn : max), '')
  const version = `${modulo.exclusiva}-${enLista.length}-${ultima}`

  const volver = `/admin/cursos/${modulo.cursoId}${modulo.cohorteId ? `?gen=${modulo.cohorteId}` : ''}`

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href={volver} className="w-fit text-sm text-primary underline-offset-4 hover:underline">
        ← {modulo.cursoTitulo}
        {modulo.generacion ? ` · ${modulo.generacion}` : ''}
      </Link>

      <Titulo apoyo="Elige quién de la generación abre esta sesión. Puedes volver cuando quieras a agregar o quitar personas.">
        {modulo.titulo}
      </Titulo>

      <ListaDeAcceso
        moduloId={modulo.id}
        personas={personas}
        exclusiva={modulo.exclusiva}
        empresas={empresas}
        version={version}
      />
    </div>
  )
}
