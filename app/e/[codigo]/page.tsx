import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EntrarAEncuesta } from '@/components/encuestas/entrar-a-encuesta'
import { Pulso } from '@/components/encuestas/pulso'
import { ResponderPregunta } from '@/components/encuestas/responder-pregunta'
import { CambiarTema } from '@/components/marca/cambiar-tema'
import { EtiquetaAcademia, Wordmark } from '@/components/marca/wordmark'
import { nombreVisible, obtenerSesion } from '@/lib/auth/sesion'
import { encuestaPorCodigo, participanteActual, preguntasContestadas } from '@/lib/encuestas/publico'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() de abajo es control de acceso.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>
}): Promise<Metadata> {
  const { codigo } = await params
  const encuesta = await encuestaPorCodigo(codigo)
  return {
    title: encuesta?.title ?? 'Encuesta',
    robots: { index: false, follow: false },
  }
}

/**
 * La pantalla del celular de quien escaneó el QR.
 *
 * Sin sesión a propósito (§ `PREFIJOS_PUBLICOS`): quien está de pie en una sala
 * no va a crearse una cuenta para contestar una pregunta. La llave es el código
 * de la encuesta, verificado en el servidor, igual que el folio de un
 * certificado.
 *
 * Mobile-first sin discusión: esto SOLO se ve en un teléfono.
 */
export default async function PaginaEncuestaPublica({
  params,
}: {
  params: Promise<{ codigo: string }>
}) {
  const { codigo } = await params
  const encuesta = await encuestaPorCodigo(codigo)

  if (!encuesta) notFound()

  const [sesion, participante] = await Promise.all([
    obtenerSesion(),
    participanteActual(encuesta),
  ])

  const abierta = encuesta.preguntas.find((p) => p.status === 'open')

  // "La siguiente pregunta" solo tiene sentido si ya hubo una. Quien se registró
  // mientras el instructor todavía presentaba el tema no ha visto ninguna.
  const yaHuboAlguna = encuesta.preguntas.some((p) => p.status === 'closed')
  const contestadas = participante ? await preguntasContestadas(participante) : new Set<string>()
  const yaContesto = abierta ? contestadas.has(abierta.id) : false

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-5 py-8">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <span className="flex items-center gap-2.5">
          <Wordmark alto={20} prioridad />
          <EtiquetaAcademia className="text-[0.6rem] tracking-[0.28em]" />
        </span>
        <CambiarTema />
      </header>

      <div className="flex flex-1 flex-col justify-center gap-6">
        {encuesta.status === 'closed' ? (
          <Espera
            titulo="Esta encuesta ya terminó"
            detalle="Gracias por participar. Los resultados se quedaron en la pantalla de adelante."
          />
        ) : !participante ? (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl leading-tight font-medium text-balance">{encuesta.title}</h1>
              <p className="text-sm text-muted-foreground">
                Déjanos tus datos para participar. Toma quince segundos.
              </p>
            </div>
            <EntrarAEncuesta
              codigo={encuesta.joinCode}
              permiteInvitados={encuesta.allowGuests}
              sesion={
                sesion.tipo === 'activo'
                  ? { nombre: nombreVisible(sesion.perfil), email: sesion.perfil.email }
                  : null
              }
            />
          </>
        ) : abierta && !yaContesto ? (
          <ResponderPregunta codigo={encuesta.joinCode} pregunta={abierta} />
        ) : abierta && yaContesto ? (
          <Espera
            titulo="¡Listo, ya quedó!"
            detalle="Mira la pantalla de adelante: tu respuesta está ahí con la de todos."
          />
        ) : (
          <Espera
            titulo={`Ya estás dentro, ${participante.nombre.split(' ')[0]}`}
            detalle={
              yaHuboAlguna
                ? 'Espera a que abramos la siguiente pregunta. Esta pantalla se actualiza sola.'
                : 'En cuanto abramos la primera pregunta aparece aquí. Esta pantalla se actualiza sola.'
            }
          />
        )}
      </div>

      <footer className="flex shrink-0 flex-col items-center gap-2">
        {/*
          El enlace de recarga a mano NO sobra por tener el sondeo: `Pulso` es
          JavaScript, y en un salón hay teléfonos con el navegador en modo
          ahorro, con extensiones o con la pestaña congelada. Sin esto, esa
          persona se queda mirando una pantalla que no avanza sin saber que
          bastaba con recargar.
        */}
        <a
          href={`/e/${encuesta.joinCode}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Actualizar
        </a>
        <p className="text-center text-xs text-muted-foreground">
          Código <span className="font-mono tracking-wider">{encuesta.joinCode}</span>
        </p>
      </footer>

      <Pulso codigo={encuesta.joinCode} version={encuesta.stateVersion} />
    </main>
  )
}

function Espera({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-border px-5 py-12 text-center">
      <h1 className="text-xl font-medium text-balance">{titulo}</h1>
      <p className="text-sm text-muted-foreground text-balance">{detalle}</p>
    </div>
  )
}
