import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { CodigoQr } from '@/components/encuestas/codigo-qr'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pestanas, type Pestana } from '@/components/ui-vadai/pestanas'
import { Titulo } from '@/components/ui-vadai/superficie'
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

/**
 * Marco de una encuesta: lo que se ve igual en todas sus secciones.
 *
 * El QR y el código viven AQUÍ y no dentro de una pestaña, a propósito: son lo
 * que hay que tener a la mano en cualquier momento —para proyectarlos, para
 * dictarlos, para comprobar que la sala está entrando por el código correcto—.
 * Escondidos en una sección habría que ir a buscarlos a media dinámica.
 *
 * `obtenerEncuesta` está memorizada por petición con `cache()`, así que pedirla
 * aquí y otra vez en la página hija cuesta un solo viaje.
 */
export default async function LayoutEncuesta({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  await exigirAdmin()

  const { id } = await params
  const encuesta = await obtenerEncuesta(id)
  if (!encuesta) notFound()

  const url = urlDeEncuesta(process.env.NEXT_PUBLIC_APP_URL ?? '', encuesta.join_code)
  const base = `/admin/encuestas/${encuesta.id}`
  const totalRespuestas = encuesta.preguntas.reduce((n, p) => n + p.totalRespuestas, 0)

  const pestanas: Pestana[] = [
    { href: base, etiqueta: 'Preguntas', exacto: true, insignia: encuesta.preguntas.length },
    {
      href: `${base}/control`,
      etiqueta: 'En vivo',
      // Sin preguntas no hay nada que abrir, y entrar a la pantalla de control
      // solo para encontrarla vacía es un viaje perdido.
      deshabilitada: encuesta.preguntas.length === 0,
      motivo: 'Agrega al menos una pregunta para poder correr la dinámica.',
    },
    { href: `${base}/resultados`, etiqueta: 'Resultados', insignia: totalRespuestas },
    { href: `${base}/configuracion`, etiqueta: 'Configuración' },
  ]

  return (
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[10px] border border-border p-5">
        <CodigoQr texto={url} tamano={116} />

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

        <Button asChild variant="outline">
          {/* En otra pestaña: el control se queda donde está. Si navegara, se
              perderían los botones a media dinámica. */}
          <a href={`/proyectar/${encuesta.projection_token}`} target="_blank" rel="noreferrer">
            Ver la proyección
          </a>
        </Button>
      </div>

      <Pestanas pestanas={pestanas} etiqueta="Secciones de la encuesta" />

      {children}
    </div>
  )
}
