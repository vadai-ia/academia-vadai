import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CodigoQr } from '@/components/encuestas/codigo-qr'
import { PantallaEnVivo } from '@/components/encuestas/pantalla-en-vivo'
import { CambiarTema } from '@/components/marca/cambiar-tema'
import { Button } from '@/components/ui/button'
import { exigirAdmin } from '@/lib/auth/sesion'
import { nuevaCorrida } from '@/lib/encuestas/acciones'
import { urlDeEncuesta } from '@/lib/encuestas/comun'
import { cuantosEntraron, encuestaPorToken, payloadDeProyeccion } from '@/lib/encuestas/publico'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx` en esta ruta: el notFound() es control de acceso y un límite
// de Suspense lo convertiría en un 200 con esqueleto.

export const metadata: Metadata = {
  title: 'Proyección',
  robots: { index: false, follow: false },
}

/**
 * La pantalla que se proyecta, y desde la que se corre la dinámica.
 *
 * EXIGE SESIÓN DE ADMIN (decidido 3-sep-2026). Durante un tiempo bastó el token,
 * para poder mandar la pantalla a otra máquina sin iniciar sesión ahí. Se cambió
 * por dos razones que se refuerzan: quien proyecta suele hacerlo en una ventana
 * con la barra de direcciones a la vista, así que el token es fotografiable
 * desde la sala; y desde que la pantalla trae los controles, ese token dejaría
 * manejar la dinámica a quien lo copiara.
 *
 * AL ABRIRLA CON UNA DINÁMICA A MEDIAS, PREGUNTA QUÉ HACER. Reanudar sola sería
 * un error el día que se cierra la pestaña sin querer entre dos eventos; y
 * empezar sola sería peor, porque se llevaría por delante lo que la sala está
 * contestando. Nadie puede adivinar cuál de las dos quería quien acaba de abrir
 * la pantalla, así que se pregunta — una sola vez, y solo cuando hay algo que
 * decidir.
 */
export default async function PaginaProyectar({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ continuar?: string }>
}) {
  await exigirAdmin()

  const { token } = await params
  const { continuar } = await searchParams
  const encuesta = await encuestaPorToken(token)

  if (!encuesta) notFound()

  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const url = urlDeEncuesta(base, encuesta.joinCode)

  // "Avance" es cualquier señal de que esta corrida ya empezó: una pregunta
  // tocada o gente adentro. Sin nada de eso no hay nada que decidir.
  const abiertas = encuesta.preguntas.filter((p) => p.status !== 'pending')
  const dentro = await cuantosEntraron(encuesta.id)
  const hayAvance = abiertas.length > 0 || dentro > 0

  if (hayAvance && continuar !== '1') {
    const cerradas = encuesta.preguntas.filter((p) => p.status === 'closed').length

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-8 px-6 py-12">
        <div className="absolute top-4 right-4">
          <CambiarTema />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm tracking-wider text-muted-foreground">
            CORRIDA {encuesta.corrida}
          </span>
          <h1 className="text-[1.75rem] leading-tight font-medium text-balance">
            {encuesta.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Esta corrida ya empezó: {cerradas} de {encuesta.preguntas.length} pregunta(s)
            cerrada(s) y {dentro} persona(s) dentro.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href={`/proyectar/${token}?continuar=1`}>Continuar donde iba</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Retoma la dinámica tal como quedó. Es lo que quieres si se cerró la pestaña sin
            querer.
          </p>

          <div className="flex items-center gap-3 pt-2" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">o</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form action={nuevaCorrida}>
            <input type="hidden" name="id" value={encuesta.id} />
            <Button type="submit" variant="outline" size="lg" className="w-full">
              Empezar la corrida {encuesta.corrida + 1}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Arranca desde la pregunta 1 con la sala vacía, para otro grupo.{' '}
            <span className="font-medium text-foreground">No borra nada</span>: las respuestas de
            la corrida {encuesta.corrida} se quedan guardadas y salen en el Excel con su número.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          ¿Querías dejarla como nueva, sin historial? Eso es{' '}
          <Link
            href={`/admin/encuestas/${encuesta.id}/configuracion`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Reiniciar
          </Link>
          , en la configuración de la encuesta.
        </p>
      </main>
    )
  }

  const inicial = await payloadDeProyeccion(encuesta)

  return (
    <div className="relative bg-background">
      {/*
        El tema NO se fuerza a oscuro. Da la tentación —"un proyector se ve mejor
        en oscuro"— pero depende del salón: con las luces prendidas y un cañón
        flojo, el claro se lee mejor. Quien presenta sabe cuál es su caso.
      */}
      <div className="absolute top-4 right-4 z-10 print:hidden">
        <CambiarTema />
      </div>

      <PantallaEnVivo
        token={token}
        encuestaId={encuesta.id}
        inicial={inicial}
        codigo={encuesta.joinCode}
        // La URL se muestra sin el esquema: en una pared, "https://" son ocho
        // caracteres que nadie teclea y que le roban tamaño a lo que sí importa.
        url={url.replace(/^https?:\/\//, '')}
        qr={<CodigoQr texto={url} tamano={200} />}
      />
    </div>
  )
}
