import Link from 'next/link'

import { Wordmark } from '@/components/marca/wordmark'
import { Button } from '@/components/ui/button'

/**
 * La página de «no encontrado» de toda la plataforma (M23, 20-oct-2026).
 *
 * Antes no había ninguna y cada `notFound()` pintaba la de Next.js: negra y en
 * inglés («This page could not be found»), sin marca y sin salida. Un alumno
 * llega aquí por una liga vieja, por un curso al que ya no tiene acceso o por
 * una lección que se despublicó; lo que necesita es saber que no rompió nada y
 * un botón de regreso. «Ir al inicio» va a `/`, que manda a cada quien a su
 * lugar (Inicio, el panel o el login).
 */
export default function NoEncontrado() {
  return (
    <main
      id="contenido"
      className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-6 py-16 text-center"
    >
      <Wordmark alto={24} />
      <div className="flex max-w-md flex-col gap-3">
        <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">Error 404</p>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-balance">
          No encontramos esta página
        </h1>
        <p className="text-pretty text-muted-foreground">
          Puede que la liga sea vieja, que la página ya no exista o que tu cuenta no tenga acceso a ella. Desde el
          inicio llegas a todo lo tuyo.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <Button asChild size="lg" variant="acento" className="h-11 px-6 text-base">
          <Link href="/">Ir al inicio</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-11 px-6 text-base">
          <a href="mailto:ayuda@vadai.com.mx">Escribir a ayuda@vadai.com.mx</a>
        </Button>
      </div>
    </main>
  )
}
