import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ResultadosEncuesta } from '@/components/admin/resultados-encuesta'
import { Button } from '@/components/ui/button'
import { Seccion } from '@/components/ui-vadai/superficie'
import { exigirAdmin } from '@/lib/auth/sesion'
import { datosParaExportar } from '@/lib/encuestas/exportacion'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() es control de acceso.

export const metadata: Metadata = { title: 'Resultados de la encuesta' }

export default async function PaginaResultados({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()

  const { id } = await params

  // La MISMA función que arma el Excel y el PDF. Así lo que se ve en pantalla y
  // lo que se descarga no pueden decir cifras distintas del mismo evento.
  const datos = await datosParaExportar(id)
  if (!datos) notFound()

  return (
    <div className="flex flex-col gap-8">
      <Seccion
        titulo="Llévatelo"
        apoyo="Se arman al momento, con lo que haya contestado la sala hasta ahora."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border p-5">
          <Button asChild variant="outline">
            {/*
              `download` y no target=_blank: son descargas, no páginas. El nombre
              del archivo lo fija el Content-Disposition del servidor, que ya
              lleva el código de la encuesta y la fecha.
            */}
            <a href={`/api/reportes/${datos.id}/excel`} download>
              Descargar Excel
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/reportes/${datos.id}/pdf`} download>
              Descargar PDF con gráficas
            </a>
          </Button>

          <p className="text-xs text-muted-foreground">
            El Excel trae una hoja por pregunta con cada respuesta y su autor, más el padrón
            completo. El PDF trae las mismas gráficas que se proyectaron.
          </p>
        </div>
      </Seccion>

      <ResultadosEncuesta datos={datos} />
    </div>
  )
}
