import type { Metadata } from 'next'
import Link from 'next/link'

import { EtiquetasDeHerramientas, NuevaHerramienta } from '@/components/admin/contenido-vaip'
import { Seccion, Titulo } from '@/components/ui-vadai/superficie'
import { PortadaDeHerramienta } from '@/components/vaip/contenido'
import { Badge } from '@/components/ui/badge'
import { exigirEquipo } from '@/lib/auth/sesion'
import { casaDelPanel, etiquetasDelPanel, herramientasDelPanel, type EstadoDeContenido, type EtiquetaDelPanel, type HerramientaDelPanel } from '@/lib/vaip/admin'
import { etiquetaValida, PANEL_HERRAMIENTAS } from '@/lib/vaip/rutas'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Herramientas · V-AI-P' }
export const dynamic = 'force-dynamic'

const ESTADO: Record<EstadoDeContenido, { texto: string; clase: string }> = {
  publicada: { texto: 'Publicada', clase: 'border-exito/40 bg-exito/10 text-exito' },
  borrador: { texto: 'Borrador', clase: 'border-border text-muted-foreground' },
  sinVideo: { texto: 'Sin video', clase: 'border-destructive/40 bg-destructive/10 text-destructive' },
}

function Tarjeta({ h, etiquetas }: { h: HerramientaDelPanel; etiquetas: EtiquetaDelPanel[] }) {
  const suyas = etiquetas.filter((e) => h.etiquetas.includes(e.id))
  return (
    <Link
      href={`${PANEL_HERRAMIENTAS}/${h.id}`}
      data-herramienta={h.id}
      className="group flex flex-col gap-2 rounded-[10px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <PortadaDeHerramienta
        h={{
          id: h.id,
          titulo: h.titulo,
          orientacion: h.orientacion,
          portada: h.portada,
          duracionSeg: h.duracionSeg,
          etiquetas: suyas.map((e) => ({ id: e.id, slug: e.slug, nombre: e.nombre })),
          vista: false,
          publicadaEn: null,
        }}
        className="transition-[border-color] group-hover:border-primary/60"
      />
      <span className="flex flex-col gap-1 px-0.5">
        <span className="line-clamp-2 text-sm leading-snug font-medium">{h.titulo}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Badge variant="outline" className={cn('shrink-0', ESTADO[h.estado].clase)}>
            {ESTADO[h.estado].texto}
          </Badge>
          <span className="truncate text-xs text-muted-foreground">
            {suyas.length > 0 ? suyas.map((e) => e.nombre).join(' · ') : 'Sin etiquetas'}
          </span>
        </span>
      </span>
    </Link>
  )
}

function Rejilla({ lista, etiquetas }: { lista: HerramientaDelPanel[]; etiquetas: EtiquetaDelPanel[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {lista.map((h) => (
        <li key={h.id}>
          <Tarjeta h={h} etiquetas={etiquetas} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Herramientas de V-AI-P (M26, 21-oct-2026). Ya no son cursos con un área:
 * son videos cortos, como reels, que el equipo sube aquí con las etiquetas
 * que quiera (Alejandro: «todas las etiquetas que pueda poner al crear un
 * nuevo video de herramientas»). La portada se dibuja sola.
 *
 * Arriba «Nueva herramienta»; luego los borradores, que esperan su video o su
 * clic; luego las publicadas, filtrables por etiqueta; y al final las
 * etiquetas, para agregar, renombrar o archivar.
 */
export default async function PaginaHerramientas({ searchParams }: { searchParams: Promise<{ etiqueta?: string }> }) {
  await exigirEquipo()
  const { etiqueta: pedida } = await searchParams
  const lugar = await casaDelPanel()

  if (!lugar?.generacionId) {
    return (
      <div className="flex flex-col gap-6">
        <Titulo ceja="V-AI-P">Herramientas</Titulo>
        <p className="text-sm text-muted-foreground">V-AI-P todavía no tiene casa: crea el plan en Planes y cobros.</p>
      </div>
    )
  }

  const [{ herramientas }, etiquetas] = await Promise.all([
    herramientasDelPanel(lugar.casa.id, lugar.generacionId),
    etiquetasDelPanel(lugar.casa.id),
  ])
  const elegida = etiquetas.find((e) => e.slug === etiquetaValida(pedida)) ?? null
  const lista = elegida ? herramientas.filter((h) => h.etiquetas.includes(elegida.id)) : herramientas
  const borradores = lista.filter((h) => h.estado !== 'publicada')
  const publicadas = lista.filter((h) => h.estado === 'publicada')
  const conVideos = etiquetas.filter((e) => !e.archivada && e.cuantas > 0)

  return (
    <div className="flex flex-col gap-10">
      <Titulo
        ceja="V-AI-P"
        apoyo="Videos cortos, como reels: una herramienta cada uno. Los miembros los recorren y filtran por etiqueta."
      >
        Herramientas
      </Titulo>

      <NuevaHerramienta etiquetas={etiquetas} />

      {conVideos.length > 0 ? (
        <nav aria-label="Filtrar por etiqueta" className="flex flex-wrap gap-2">
          {[{ slug: null as string | null, nombre: 'Todas', cuantas: herramientas.length }, ...conVideos].map((e) => {
            const activa = (e.slug ?? null) === (elegida?.slug ?? null)
            return (
              <Link
                key={e.slug ?? 'todas'}
                href={e.slug ? `${PANEL_HERRAMIENTAS}?etiqueta=${e.slug}` : PANEL_HERRAMIENTAS}
                aria-current={activa ? 'true' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors pointer-coarse:min-h-11',
                  activa ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border hover:border-primary/50'
                )}
              >
                {e.nombre}
                <span className="text-xs text-muted-foreground tabular-nums">{e.cuantas}</span>
              </Link>
            )
          })}
        </nav>
      ) : null}

      {borradores.length > 0 ? (
        <Seccion titulo="Borradores" apoyo="Los miembros todavía no las ven: súbeles el video y publícalas.">
          <Rejilla lista={borradores} etiquetas={etiquetas} />
        </Seccion>
      ) : null}

      <Seccion titulo="Publicadas">
        {publicadas.length > 0 ? (
          <Rejilla lista={publicadas} etiquetas={etiquetas} />
        ) : (
          <p className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {elegida ? `Ninguna publicada con «${elegida.nombre}».` : 'Todavía no hay herramientas publicadas.'}
          </p>
        )}
      </Seccion>

      <details id="etiquetas" className="group rounded-[10px] border border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-medium [&::-webkit-details-marker]:hidden">
          Etiquetas
          <span className="text-sm font-normal text-muted-foreground">
            {etiquetas.filter((e) => !e.archivada).length} activas
          </span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-5">
          <p className="text-sm text-pretty text-muted-foreground">
            Archivar esconde la etiqueta de los filtros sin quitársela a ningún video. Renombrar no cambia sus ligas.
          </p>
          <EtiquetasDeHerramientas etiquetas={etiquetas} />
        </div>
      </details>
    </div>
  )
}
