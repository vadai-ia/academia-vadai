import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CodigoQr } from '@/components/encuestas/codigo-qr'
import { RefrescoPeriodico } from '@/components/encuestas/refresco-periodico'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cifra, Seccion, Titulo } from '@/components/ui-vadai/superficie'
import { exigirAdmin } from '@/lib/auth/sesion'
import {
  abrirPregunta,
  alternarRespuestaOculta,
  cerrarEncuesta,
  cerrarPregunta,
  iniciarEncuesta,
} from '@/lib/encuestas/acciones'
import {
  ETIQUETA_ESTADO_ENCUESTA,
  ETIQUETA_TIPO_PREGUNTA,
  urlDeEncuesta,
} from '@/lib/encuestas/comun'
import { obtenerEncuesta, respuestasDePregunta } from '@/lib/encuestas/consultas'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() es control de acceso.

export const metadata: Metadata = { title: 'Control en vivo' }

const VARIANTE = {
  live: 'default',
  draft: 'secondary',
  closed: 'outline',
} as const

/**
 * La pantalla desde la que Alejandro corre la dinámica.
 *
 * Está pensada para el CELULAR, no para la laptop del proyector: él va a estar
 * de pie frente a la sala mirando la pared, con el teléfono en la mano. Por eso
 * los botones son grandes, hay uno solo importante a la vez, y el orden de la
 * página es el orden en que se usa: primero abrir, luego ver, luego cerrar.
 */
export default async function PaginaControl({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin()

  const { id } = await params
  const encuesta = await obtenerEncuesta(id)
  if (!encuesta) notFound()

  const abierta = encuesta.preguntas.find((p) => p.status === 'open')
  const respuestas = abierta ? await respuestasDePregunta(abierta.id) : []

  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const url = urlDeEncuesta(base, encuesta.join_code)
  const urlProyeccion = `/proyectar/${encuesta.projection_token}`

  const siguiente = encuesta.preguntas.find((p) => p.status === 'pending')
  const contestadas = encuesta.preguntas.filter((p) => p.status === 'closed').length

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href={`/admin/encuestas/${encuesta.id}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <span aria-hidden>←</span> Editar la encuesta
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

      {/* Lo primero: abrir la proyección y que la sala pueda escanear. */}
      <Seccion
        titulo="La pantalla que proyectas"
        apoyo="Ábrela en el proyector. No pide contraseña, así que puedes mandarla a otra máquina."
      >
        <div className="flex flex-wrap items-center gap-6 rounded-[10px] border border-border p-5">
          <CodigoQr texto={url} tamano={128} />

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs tracking-wider text-muted-foreground">LA SALA ENTRA EN</span>
              <span className="font-medium">{url.replace(/^https?:\/\//, '')}</span>
              <span className="font-mono text-2xl leading-none font-medium tracking-[0.2em]">
                {encuesta.join_code}
              </span>
            </div>

            <div>
              <Button asChild>
                {/* Se abre en otra pestaña porque el control se queda aquí: si
                    navegara, Alejandro perdería los botones a media dinámica. */}
                <a href={urlProyeccion} target="_blank" rel="noreferrer">
                  Abrir la proyección →
                </a>
              </Button>
            </div>
          </div>

          <div className="flex gap-8">
            <Cifra valor={encuesta.totalParticipantes} etiqueta="conectados" destacada />
            <Cifra
              valor={`${contestadas}/${encuesta.preguntas.length}`}
              etiqueta="preguntas cerradas"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {encuesta.status === 'draft' ? (
            <form action={iniciarEncuesta}>
              <input type="hidden" name="id" value={encuesta.id} />
              <Button type="submit" size="lg">
                Abrir la encuesta
              </Button>
            </form>
          ) : null}

          {encuesta.status === 'live' ? (
            <form action={cerrarEncuesta}>
              <input type="hidden" name="id" value={encuesta.id} />
              <Button type="submit" variant="outline" size="lg">
                Terminar la dinámica
              </Button>
            </form>
          ) : null}
        </div>
      </Seccion>

      {encuesta.preguntas.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Esta encuesta no tiene preguntas todavía.{' '}
            <Link
              href={`/admin/encuestas/${encuesta.id}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              Agrégalas primero
            </Link>
            .
          </p>
        </div>
      ) : (
        <Seccion
          titulo="Preguntas"
          apoyo="Solo una puede estar abierta a la vez. Abrir la siguiente cierra la anterior."
        >
          <ol className="flex flex-col gap-3">
            {encuesta.preguntas.map((pregunta, indice) => {
              const esLaAbierta = pregunta.status === 'open'
              return (
                <li
                  key={pregunta.id}
                  className={
                    esLaAbierta
                      ? 'flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-2 border-primary bg-primary/5 px-4 py-3'
                      : 'flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-3'
                  }
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {indice + 1}.
                      </span>
                      <span className="font-medium">{pregunta.prompt}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ETIQUETA_TIPO_PREGUNTA[pregunta.tipo]} · {pregunta.totalRespuestas}{' '}
                      respuesta(s)
                    </span>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {pregunta.status === 'pending' ? (
                      <form action={abrirPregunta}>
                        <input type="hidden" name="id" value={pregunta.id} />
                        <input type="hidden" name="poll_id" value={encuesta.id} />
                        <Button type="submit" variant={siguiente?.id === pregunta.id ? 'default' : 'outline'}>
                          Abrir
                        </Button>
                      </form>
                    ) : null}

                    {esLaAbierta ? (
                      <form action={cerrarPregunta}>
                        <input type="hidden" name="id" value={pregunta.id} />
                        <input type="hidden" name="poll_id" value={encuesta.id} />
                        <Button type="submit" variant="outline">
                          Cerrar
                        </Button>
                      </form>
                    ) : null}

                    {pregunta.status === 'closed' ? (
                      <Badge variant="secondary">Cerrada</Badge>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </Seccion>
      )}

      {/* El botón de pánico. Solo aparece cuando hay algo que moderar. */}
      {abierta && respuestas.length > 0 ? (
        <Seccion
          titulo="Lo que va entrando"
          apoyo="Si algo no puede quedarse en la pared, ocúltalo. Se quita de la proyección al instante y sigue guardado para la exportación."
        >
          <ul className="flex flex-col gap-2">
            {respuestas.map((respuesta) => (
              <li
                key={respuesta.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border px-4 py-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className={respuesta.oculta ? 'text-muted-foreground line-through' : ''}>
                    {respuesta.texto ?? respuesta.opcion ?? respuesta.numero}
                  </span>
                  <span className="text-xs text-muted-foreground">{respuesta.autor}</span>
                </div>

                <form action={alternarRespuestaOculta}>
                  <input type="hidden" name="id" value={respuesta.id} />
                  <input type="hidden" name="poll_id" value={encuesta.id} />
                  <input type="hidden" name="ocultar" value={respuesta.oculta ? 'no' : 'si'} />
                  <Button type="submit" variant={respuesta.oculta ? 'ghost' : 'destructive'} size="sm">
                    {respuesta.oculta ? 'Volver a mostrar' : 'Ocultar'}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      <RefrescoPeriodico />
    </div>
  )
}
