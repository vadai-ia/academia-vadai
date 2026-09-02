import type { Metadata } from 'next'
import Link from 'next/link'

import { NuevaEncuesta } from '@/components/admin/nueva-encuesta'
import { Badge } from '@/components/ui/badge'
import { Titulo } from '@/components/ui-vadai/superficie'
import { opcionesDeAlta } from '@/lib/admin/alumnos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { ETIQUETA_ESTADO_ENCUESTA } from '@/lib/encuestas/comun'
import { listarEncuestas } from '@/lib/encuestas/consultas'

export const metadata: Metadata = { title: 'Encuestas' }
export const dynamic = 'force-dynamic'

const VARIANTE = {
  live: 'default',
  draft: 'secondary',
  closed: 'outline',
} as const

export default async function PaginaEncuestas() {
  await exigirAdmin()

  // Los dos viajes van juntos: no dependen entre sí y encadenarlos costaba una
  // ida y vuelta a Supabase de más, que es lo que M11 anduvo quitando.
  const [encuestas, cursos] = await Promise.all([listarEncuestas(), opcionesDeAlta()])

  return (
    <div className="flex flex-col gap-6">
      <Titulo apoyo="Proyecta un QR, la sala contesta desde el celular y ves las respuestas en vivo.">
        Encuestas en vivo
      </Titulo>

      <NuevaEncuesta cursos={cursos} reinicio={encuestas.length} />

      {encuestas.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no hay encuestas. Crea la primera y agrégale sus preguntas.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {encuestas.map((encuesta) => (
            <li key={encuesta.id}>
              <Link
                href={`/admin/encuestas/${encuesta.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-3 transition-colors hover:border-primary/60"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{encuesta.title}</span>
                    <Badge variant={VARIANTE[encuesta.status]} className="shrink-0">
                      {ETIQUETA_ESTADO_ENCUESTA[encuesta.status]}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono tracking-wider">{encuesta.join_code}</span> ·{' '}
                    {encuesta.curso}
                    {encuesta.cohorte ? ` · ${encuesta.cohorte}` : ''}
                  </span>
                </div>

                <div className="flex shrink-0 gap-4 text-xs text-muted-foreground tabular-nums">
                  <span>{encuesta.totalPreguntas} preguntas</span>
                  <span>{encuesta.totalParticipantes} participantes</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
