'use client'

import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { CuentaRegresiva } from '@/components/encuestas/cuenta-regresiva'
import { SalaDeEspera } from '@/components/encuestas/sala-de-espera'
import { Visualizacion } from '@/components/encuestas/visualizaciones'
import { Button } from '@/components/ui/button'
import type { PayloadProyeccion } from '@/lib/encuestas/agregados'
import { avanzarEncuesta, cerrarPregunta } from '@/lib/encuestas/acciones'

/**
 * La pantalla que se proyecta, con sus controles.
 *
 * SONDEA, no usa websockets. La razón está en el master document: las dos vías
 * de Supabase Realtime exigen tocar objetos fuera del schema `academia`
 * —`alter publication supabase_realtime` o policies en el schema `realtime`— y
 * eso cae del lado prohibido de la Regla Cero. Sondear un route handler cada
 * segundo no lo requiere, y además sobrevive al wifi de un hotel, que es donde
 * esto se va a usar de verdad.
 *
 * Los controles están AQUÍ y no solo en el panel porque quien presenta está
 * mirando la pared, no su laptop. La página exige sesión de admin, así que
 * llegar hasta acá ya es prueba suficiente para mostrarlos; el servidor los
 * valida otra vez de todos modos.
 *
 * LA PRIMERA VEZ ES DISTINTA. "Empezar" no abre la pregunta: lanza la cuenta
 * regresiva, y la pregunta se abre cuando termina (o cuando se salta). Es la
 * señal para que la sala deje de platicar y mire la pared. Las siguientes
 * preguntas avanzan directo, sin ceremonia: ahí lo que importa es el resultado.
 */

const CADENCIA_MS = 1000

function BotonAvanzar({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Un momento…' : children}
    </Button>
  )
}

function BotonCerrar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" size="lg" disabled={pending}>
      {pending ? '…' : 'Cerrar pregunta'}
    </Button>
  )
}

export function PantallaEnVivo({
  token,
  encuestaId,
  inicial,
  qr,
  codigo,
  url,
}: {
  token: string
  encuestaId: string
  inicial: PayloadProyeccion
  qr: ReactNode
  codigo: string
  url: string
}) {
  const [datos, setDatos] = useState<PayloadProyeccion>(inicial)
  const [enLinea, setEnLinea] = useState(true)
  const [contando, setContando] = useState(false)

  // En una ref y no en el estado: cambiarlo no debe repintar la pantalla, solo
  // sirve para decidir si el intervalo sigue vivo.
  const vivo = useRef(true)
  const formAvanzar = useRef<HTMLFormElement>(null)

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
  const terminada = datos.estado === 'closed'
  const hayPendientes = datos.pendientes > 0

  /** Abre la primera pregunta. Lo dispara el final de la cuenta regresiva. */
  function abrirLaPrimera() {
    setContando(false)
    const formulario = new FormData()
    formulario.set('poll_id', encuestaId)
    startTransition(() => {
      void avanzarEncuesta(formulario)
    })
  }

  /**
   * Avanzar con el control remoto de presentaciones.
   *
   * Un clicker manda flecha derecha o AvPág, exactamente como para pasar una
   * diapositiva. Sin esto, quien presenta tendría que volver a la laptop para
   * abrir cada pregunta, que es justo lo que esta pantalla vino a evitar.
   *
   * Mientras corre la cuenta regresiva no hace nada: ella tiene su propio
   * atajo (Escape para saltarla) y un clic accidental no debe abrir dos veces.
   */
  useEffect(() => {
    function alTeclado(evento: KeyboardEvent) {
      const objetivo = evento.target as HTMLElement | null
      if (objetivo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(objetivo.tagName)) return
      if (evento.key !== 'ArrowRight' && evento.key !== 'PageDown' && evento.key !== ' ') return
      if (contando || terminada) return

      evento.preventDefault()
      if (esperando) setContando(true)
      else formAvanzar.current?.requestSubmit()
    }

    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
  }, [contando, esperando, terminada])

  // Un solo botón que siempre hace lo que toca. Quien está de pie frente a una
  // sala no puede ponerse a decidir entre "abrir la 3" y "cerrar la 2".
  const textoAvanzar = hayPendientes
    ? `Siguiente pregunta (${datos.pendientes} más)`
    : 'Terminar la dinámica'

  return (
    <div className="flex min-h-dvh flex-col gap-6 p-8 lg:p-12">
      {contando ? <CuentaRegresiva alTerminar={abrirLaPrimera} /> : null}

      {/* El QR vive aquí SIEMPRE, no solo al principio: la gente llega tarde, se
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
          <SalaDeEspera llegados={datos.recienLlegados} total={datos.participantes} />
        ) : datos.agregado ? (
          <Visualizacion datos={datos.agregado} />
        ) : null}
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-3">
          {terminada ? (
            <p className="text-lg text-muted-foreground">
              Dinámica terminada. Los resultados están en el panel.
            </p>
          ) : esperando ? (
            // La primera vez no es un envío: es el botón que lanza la cuenta
            // regresiva. La pregunta se abre cuando ella termina.
            <Button type="button" size="lg" onClick={() => setContando(true)} disabled={contando}>
              {contando ? 'Empezando…' : 'Empezar'}
            </Button>
          ) : (
            <>
              <form action={avanzarEncuesta} ref={formAvanzar}>
                <input type="hidden" name="poll_id" value={encuestaId} />
                <BotonAvanzar>{textoAvanzar}</BotonAvanzar>
              </form>

              {datos.pregunta?.abierta ? (
                <form action={cerrarPregunta}>
                  <input type="hidden" name="id" value={datos.pregunta.id} />
                  <input type="hidden" name="poll_id" value={encuestaId} />
                  <BotonCerrar />
                </form>
              ) : null}
            </>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {terminada ? null : 'Avanza con → o con tu control de presentaciones.'}
          {!enLinea ? ' · Reconectando; se muestra el último resultado recibido.' : ''}
        </p>
      </footer>
    </div>
  )
}
