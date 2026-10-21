import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { TarjetaCurso } from '@/components/alumno/tarjeta-curso'
import { Seccion } from '@/components/ui-vadai/superficie'
import { FiltroDeEtiquetas, GaleriaDeHerramientas } from '@/components/vaip/contenido'
import { EncabezadoVaip } from '@/components/vaip/espacio'
import { misCursos } from '@/lib/alumno/consultas'
import { sesionesDelCurso } from '@/lib/alumno/sesiones'
import { proximaOActual } from '@/lib/calendario/estado'
import { contextoVaip } from '@/lib/membresia/espacio'
import { filtrarPorEtiqueta, herramientasDeVaip } from '@/lib/vaip/contenido'
import { etiquetaValida } from '@/lib/vaip/rutas'

export const metadata: Metadata = { title: 'Herramientas · V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * V-AI-P → Herramientas (M26, 21-oct-2026): videos cortos, como reels, que se
 * recorren uno tras otro. Alejandro: «yo puedo subir aquí videos rápidos como
 * si fueran reels y aquí la gente va a poder navegar en ellos», con las
 * etiquetas que él decide (creativas, administrativas, RH, contables…).
 *
 * Arriba las etiquetas como filtro (`?etiqueta=`, ligas: funcionan sin JS);
 * luego la galería de portadas. Los demás cursos del plan, si los hay, al
 * final como «Cursos incluidos».
 */
export default async function HerramientasDeVaip({ searchParams }: { searchParams: Promise<{ etiqueta?: string }> }) {
  const ctx = await contextoVaip()
  if (!ctx) redirect('/vaip')
  const { perfil, plan, casa } = ctx
  const { etiqueta: pedida } = await searchParams

  const [datos, sesiones, cursos] = await Promise.all([
    herramientasDeVaip(ctx),
    casa ? sesionesDelCurso(casa.slug) : Promise.resolve([]),
    misCursos(),
  ])
  const etiqueta = datos.etiquetas.find((e) => e.slug === etiquetaValida(pedida))?.slug ?? null
  const lista = filtrarPorEtiqueta(datos, etiqueta)
  const incluidos = cursos.filter((c) => c.enVaip && c.id !== plan.casa?.id)

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoVaip nombre={perfil.full_name || perfil.email} clase={proximaOActual(sesiones, Date.now())} />

      <section aria-labelledby="titulo-herramientas" className="flex flex-col gap-5">
        <div className="flex flex-col gap-0.5">
          <h2 id="titulo-herramientas" className="text-lg font-medium tracking-tight">
            Herramientas
          </h2>
          <p className="text-sm text-muted-foreground">Videos cortos: una herramienta cada uno y cómo usarla en tu empresa.</p>
        </div>

        {datos.todas.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            Aquí aparecen los videos de cada herramienta en cuanto el equipo los publica.
          </p>
        ) : (
          <>
            <FiltroDeEtiquetas etiquetas={datos.etiquetas} activa={etiqueta} total={datos.todas.length} />
            <GaleriaDeHerramientas herramientas={lista} etiqueta={etiqueta} />
          </>
        )}
      </section>

      {incluidos.length > 0 ? (
        <Seccion titulo="Cursos incluidos" apoyo="Los cursos que trae tu membresía.">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {incluidos.map((c) => (
              <li key={c.id}>
                <TarjetaCurso curso={c} />
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}
    </div>
  )
}
