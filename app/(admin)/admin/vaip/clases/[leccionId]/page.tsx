import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Adjuntos } from '@/components/admin/adjuntos'
import { FormularioGrabacion } from '@/components/admin/contenido-vaip'
import { EliminarContenido, VideoDeContenido } from '@/components/admin/video-de-contenido'
import { Seccion } from '@/components/ui-vadai/superficie'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { bunnyConfigurado } from '@/lib/bunny/cliente'
import { contenidoDelPanel } from '@/lib/vaip/admin'
import { fechaDeClase, PANEL_CLASES } from '@/lib/vaip/rutas'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const enCdmx = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Mexico_City',
})

export async function generateMetadata({ params }: { params: Promise<{ leccionId: string }> }): Promise<Metadata> {
  const { leccionId } = await params
  const g = UUID.test(leccionId) ? await contenidoDelPanel(leccionId) : null
  return { title: g ? `${g.titulo} · Clases` : 'Grabación · Clases' }
}

/**
 * El editor de una grabación de V-AI-P (M26): el video, si ya la ven los
 * miembros, su día (cambiarlo la mueve de mes), su descripción y su material.
 * Lo usan admin y community manager; eliminar es solo de admin.
 */
export default async function EditorDeGrabacion({ params }: { params: Promise<{ leccionId: string }> }) {
  const perfil = await exigirEquipo()
  const { leccionId } = await params
  if (!UUID.test(leccionId)) notFound()
  const g = await contenidoDelPanel(leccionId)
  if (!g || g.tipo !== 'mes' || !g.fecha) notFound()

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <Link
          href={PANEL_CLASES}
          className="inline-flex w-fit items-center text-sm text-primary underline-offset-4 pointer-coarse:min-h-11 hover:underline"
        >
          ← Clases
        </Link>
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">{fechaDeClase(g.fecha)}</p>
        <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight text-balance">{g.titulo}</h1>
        <p className="text-sm text-muted-foreground" data-clase-ligada={g.clase?.id ?? ''}>
          {g.clase
            ? `Es la grabación de la clase «${g.clase.titulo}»: ${enCdmx.format(new Date(g.clase.programadaEn))}`
            : 'No está ligada a una clase del calendario.'}
        </p>
      </header>

      <VideoDeContenido c={g} bunnyListo={bunnyConfigurado()} />

      <Seccion titulo="Datos de la grabación">
        <FormularioGrabacion key={`${g.titulo}:${g.fecha}`} id={g.id} titulo={g.titulo} fecha={g.fecha} descripcion={g.descripcion} />
      </Seccion>

      <div className="border-t border-border pt-8">
        <Adjuntos adjuntos={g.adjuntos} leccionId={g.id} cursoId={g.cursoId} />
      </div>

      {esAdmin(perfil) ? <EliminarContenido c={g} /> : null}
    </div>
  )
}
