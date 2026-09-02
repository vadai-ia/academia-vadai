import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AjustesEncuesta } from '@/components/admin/ajustes-encuesta'
import { ConstructorEncuesta } from '@/components/admin/constructor-encuesta'
import { CodigoQr } from '@/components/encuestas/codigo-qr'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Seccion, Titulo } from '@/components/ui-vadai/superficie'
import { opcionesDeAlta } from '@/lib/admin/alumnos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { ETIQUETA_ESTADO_ENCUESTA, urlDeEncuesta } from '@/lib/encuestas/comun'
import { obtenerEncuesta } from '@/lib/encuestas/consultas'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx` en esta ruta: el notFound() de abajo es control de acceso, y
// un límite de Suspense lo convertiría en un 200 con esqueleto. Ver
// components/marca/esqueleto.tsx.

const VARIANTE = {
  live: 'default',
  draft: 'secondary',
  closed: 'outline',
} as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const encuesta = await obtenerEncuesta(id)
  return { title: encuesta?.title ?? 'Encuesta' }
}

export default async function PaginaEncuesta({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()

  const { id } = await params
  const [encuesta, cursos] = await Promise.all([obtenerEncuesta(id), opcionesDeAlta()])

  if (!encuesta) notFound()

  const url = urlDeEncuesta(process.env.NEXT_PUBLIC_APP_URL ?? '', encuesta.join_code)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/encuestas"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <span aria-hidden>←</span> Encuestas
        </Link>

        <Titulo
          apoyo={`${encuesta.curso}${encuesta.cohorte ? ` · ${encuesta.cohorte}` : ''}`}
          acciones={
            <Badge variant={VARIANTE[encuesta.status]}>
              {ETIQUETA_ESTADO_ENCUESTA[encuesta.status]}
            </Badge>
          }
        >
          {encuesta.title}
        </Titulo>
      </div>

      <Seccion
        titulo="Cómo entra la sala"
        apoyo="Este es el código que la gente teclea si no puede escanear."
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[10px] border border-border p-5">
          <CodigoQr texto={url} tamano={132} />

          <div className="flex flex-col gap-1">
            <span className="text-xs tracking-wider text-muted-foreground">CÓDIGO</span>
            <span className="font-mono text-[1.75rem] leading-none font-medium tracking-[0.2em]">
              {encuesta.join_code}
            </span>
            <span className="mt-1 text-sm text-muted-foreground">
              {url.replace(/^https?:\/\//, '')}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs tracking-wider text-muted-foreground">PARTICIPANTES</span>
            <span className="text-[1.75rem] leading-none font-medium tabular-nums">
              {encuesta.totalParticipantes}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/admin/encuestas/${encuesta.id}/control`}>Correr la dinámica →</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={`/proyectar/${encuesta.projection_token}`} target="_blank" rel="noreferrer">
                Ver la proyección
              </a>
            </Button>
          </div>
        </div>
      </Seccion>

      <ConstructorEncuesta encuesta={encuesta} />

      <Seccion
        titulo="Exportar"
        apoyo="Se arman al momento, con lo que haya contestado la sala hasta ahora."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border p-5">
          <Button asChild variant="outline">
            {/*
              `download` y no target=_blank: son descargas, no páginas. El
              nombre del archivo lo fija el Content-Disposition del servidor,
              que ya lleva el código de la encuesta y la fecha.
            */}
            <a href={`/api/reportes/${encuesta.id}/excel`} download>
              Descargar Excel
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/reportes/${encuesta.id}/pdf`} download>
              Descargar PDF con gráficas
            </a>
          </Button>

          <p className="text-xs text-muted-foreground">
            El Excel trae una hoja por pregunta con cada respuesta y su autor, más el padrón de
            participantes. El PDF trae las mismas gráficas que se proyectaron.
          </p>
        </div>
      </Seccion>

      <Seccion titulo="Ajustes" apoyo="Dónde vive la encuesta y cómo se comporta en vivo.">
        <AjustesEncuesta encuesta={encuesta} cursos={cursos} />
      </Seccion>
    </div>
  )
}
