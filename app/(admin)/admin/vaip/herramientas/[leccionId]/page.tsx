import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Adjuntos } from '@/components/admin/adjuntos'
import { FormularioHerramienta, RedibujarPortada } from '@/components/admin/contenido-vaip'
import { EliminarContenido, VideoDeContenido } from '@/components/admin/video-de-contenido'
import { Seccion } from '@/components/ui-vadai/superficie'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { bunnyConfigurado } from '@/lib/bunny/cliente'
import { contenidoDelPanel, etiquetasDelPanel } from '@/lib/vaip/admin'
import { PANEL_HERRAMIENTAS } from '@/lib/vaip/rutas'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function generateMetadata({ params }: { params: Promise<{ leccionId: string }> }): Promise<Metadata> {
  const { leccionId } = await params
  const h = UUID.test(leccionId) ? await contenidoDelPanel(leccionId) : null
  return { title: h ? `${h.titulo} · Herramientas` : 'Herramienta · Herramientas' }
}

/**
 * El editor de una herramienta de V-AI-P (M26): el video, si ya la ven los
 * miembros, su título, formato, etiquetas y descripción, y su portada dibujada.
 * Admin y community manager; eliminar es solo de admin.
 */
export default async function EditorDeHerramienta({ params }: { params: Promise<{ leccionId: string }> }) {
  const perfil = await exigirEquipo()
  const { leccionId } = await params
  if (!UUID.test(leccionId)) notFound()
  const h = await contenidoDelPanel(leccionId)
  if (!h || h.tipo !== 'herramientas') notFound()
  const etiquetas = await etiquetasDelPanel(h.cursoId)

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <Link href={PANEL_HERRAMIENTAS} className="w-fit text-sm text-primary underline-offset-4 hover:underline">
          ← Herramientas
        </Link>
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
          Herramienta · {h.orientacion === 'vertical' ? 'video vertical' : 'video horizontal'}
        </p>
        <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight text-balance">{h.titulo}</h1>
      </header>

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_14rem]">
        <VideoDeContenido c={h} bunnyListo={bunnyConfigurado()} />
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">Portada</span>
          {h.portada ? (
            // eslint-disable-next-line @next/next/no-img-element -- PNG dibujado por nosotros en el bucket público
            <img
              src={h.portada}
              alt={`Portada de ${h.titulo}`}
              width={720}
              height={960}
              className="aspect-[3/4] w-full max-w-56 rounded-[10px] border border-border object-cover"
              data-portada
            />
          ) : (
            <p className="rounded-[10px] border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Todavía sin portada.
            </p>
          )}
          <p className="text-xs text-muted-foreground">Se dibuja sola con el título y la primera etiqueta.</p>
          <RedibujarPortada id={h.id} />
        </div>
      </div>

      <Seccion titulo="Datos de la herramienta">
        <FormularioHerramienta
          id={h.id}
          etiquetas={etiquetas}
          valores={{ titulo: h.titulo, orientacion: h.orientacion, etiquetas: h.etiquetas, descripcion: h.descripcion }}
        />
      </Seccion>

      <div className="border-t border-border pt-8">
        <Adjuntos adjuntos={h.adjuntos} leccionId={h.id} cursoId={h.cursoId} />
      </div>

      {esAdmin(perfil) ? <EliminarContenido c={h} /> : null}
    </div>
  )
}
