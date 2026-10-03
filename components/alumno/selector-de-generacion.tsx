import { Pestanas, type Pestana } from '@/components/ui-vadai/pestanas'
import type { GeneracionParaSelector } from '@/lib/alumno/generaciones-equipo'

/**
 * El selector de generación que ve el EQUIPO en la comunidad (M16): una fila
 * de pestañas con `?gen=`, enlaces y no un menú de JavaScript. El alumno nunca
 * lo ve: su muro es el de su generación.
 */
export function SelectorDeGeneracion({
  base,
  generaciones,
  activa,
}: {
  /** La ruta de la comunidad, con o sin `?curso=`. */
  base: string
  generaciones: GeneracionParaSelector[]
  activa: string | null
}) {
  const separador = base.includes('?') ? '&' : '?'
  const pestanas: Pestana[] = generaciones.map((g) => ({
    href: `${base}${separador}gen=${g.id}`,
    etiqueta: g.nombre,
    activa: g.id === activa,
    motivo: g.estado === 'abierta' ? 'Abierta a inscripciones' : g.estado === 'terminada' ? 'Terminada' : undefined,
  }))
  return <Pestanas pestanas={pestanas} etiqueta="Generaciones del curso (solo el equipo)" />
}
