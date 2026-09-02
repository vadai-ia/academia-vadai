'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Visualizacion } from '@/components/encuestas/visualizaciones'
import type { PayloadProyeccion } from '@/lib/encuestas/agregados'

/**
 * La pantalla que se proyecta.
 *
 * SONDEA, no usa websockets. La razón está en el master document: las dos vías
 * de Supabase Realtime exigen tocar objetos fuera del schema `academia`
 * —`alter publication supabase_realtime` o policies en el schema `realtime`— y
 * eso cae del lado prohibido de la Regla Cero. Sondear un route handler cada
 * segundo no lo requiere, y además sobrevive al wifi de un hotel, que es donde
 * esto se va a usar de verdad.
 *
 * Un segundo es suficiente: lo que la sala percibe como "en vivo" es que su
 * palabra aparezca antes de que baje el teléfono.
 */

const CADENCIA_MS = 1000

export function PantallaEnVivo({
  token,
  inicial,
  qr,
  codigo,
  url,
}: {
  token: string
  inicial: PayloadProyeccion
  qr: ReactNode
  codigo: string
  url: string
}) {
  const [datos, setDatos] = useState<PayloadProyeccion>(inicial)
  const [enLinea, setEnLinea] = useState(true)

  // En una ref y no en el estado: cambiarlo no debe repintar la pantalla, solo
  // sirve para decidir si el intervalo sigue vivo.
  const vivo = useRef(true)

  useEffect(() => {
    vivo.current = true

    async function sondear() {
      try {
        const respuesta = await fetch(`/api/encuestas/proyeccion/${token}`, { cache: 'no-store' })
        if (!respuesta.ok) throw new Error(String(respuesta.status))
        const nuevos = (await respuesta.json()) as PayloadProyeccion
        if (vivo.current) {
          setDatos(nuevos)
          setEnLinea(true)
        }
      } catch {
        // Un sondeo fallido no borra la pantalla: se queda con lo último bueno y
        // se avisa discretamente. En una sala, una pantalla en blanco a media
        // dinámica es mucho peor que un dato de hace tres segundos.
        if (vivo.current) setEnLinea(false)
      }
    }

    const reloj = window.setInterval(sondear, CADENCIA_MS)
    return () => {
      vivo.current = false
      window.clearInterval(reloj)
    }
  }, [token])

  const esperando = !datos.pregunta

  return (
    <div className="flex min-h-dvh flex-col gap-6 p-8 lg:p-12">
      {/* Encabezado: el QR vive aquí SIEMPRE, no solo al principio.
          Alejandro lo pidió explícito y tiene razón: la gente llega tarde, se
          le bloquea el teléfono, o se anima a participar hasta la tercera
          pregunta. Un QR que desaparece deja fuera a todos ellos. */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          {datos.pregunta ? (
            <>
              <span className="text-lg text-muted-foreground">
                Pregunta {datos.pregunta.posicion} de {datos.total}
                {!datos.pregunta.abierta ? ' · cerrada' : ''}
              </span>
              <h1 className="text-4xl leading-tight font-medium text-balance lg:text-5xl">
                {datos.pregunta.prompt}
              </h1>
            </>
          ) : (
            <h1 className="text-4xl leading-tight font-medium text-balance lg:text-5xl">
              Escanea el código para entrar
            </h1>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm tracking-wider text-muted-foreground">ENTRA EN</span>
            <span className="text-xl font-medium">{url}</span>
            <span className="font-mono text-3xl leading-none font-medium tracking-[0.25em]">
              {codigo}
            </span>
            <span className="mt-1 text-lg text-muted-foreground tabular-nums">
              {datos.participantes} conectado(s)
            </span>
          </div>
          {qr}
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {esperando ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border">
            <p className="text-3xl text-balance">Ya puedes entrar desde tu celular.</p>
            <p className="text-xl text-muted-foreground text-balance">
              En cuanto abramos la primera pregunta aparecerá aquí.
            </p>
          </div>
        ) : datos.agregado ? (
          <Visualizacion datos={datos.agregado} />
        ) : null}
      </main>

      {!enLinea ? (
        <p className="shrink-0 text-center text-sm text-muted-foreground">
          Reconectando… se muestra el último resultado recibido.
        </p>
      ) : null}
    </div>
  )
}
