import Link from 'next/link'

import { Wordmark } from '@/components/marca/wordmark'
import { Button } from '@/components/ui/button'
import { RUTAS } from '@/lib/auth/rutas'
import { verificarConexion } from '@/lib/supabase/estado'

// La sonda consulta Supabase en vivo: nunca debe quedar cacheada en el build.
export const dynamic = 'force-dynamic'

/**
 * Se lista lo construido, no el plan. Un tablero que promete cosas que aún no
 * existen envejece mal, y esta página es pública.
 */
const HITOS = [
  { clave: 'M1–M4', nombre: 'Schema, acceso, admin y player', estado: 'listo' },
  { clave: 'M5–M6', nombre: 'Quizzes y tareas', estado: 'listo' },
  { clave: 'M8–M9', nombre: 'Cohortes y pagos', estado: 'listo' },
  { clave: 'M7', nombre: 'Comunidad y blog', estado: 'en curso' },
] as const

export default async function Inicio() {
  const conexion = await verificarConexion()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-4">
        <Wordmark />
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          IA aplicada para tu empresa
        </h1>
        <p className="max-w-md text-pretty text-muted-foreground">
          Primer curso: <span className="text-foreground">Claude en tu Empresa</span>,
          21 de septiembre de 2026.
        </p>
        <div>
          <Button asChild>
            <Link href={RUTAS.login}>Entrar a mi academia</Link>
          </Button>
        </div>
      </header>

      <section
        aria-labelledby="estado-plataforma"
        className="rounded-lg border border-border bg-card p-5"
      >
        <h2 id="estado-plataforma" className="sr-only">
          Estado de la plataforma
        </h2>

        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
              conexion.ok ? 'bg-vadai-lima' : 'bg-destructive'
            }`}
          />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{conexion.titulo}</p>
            <p className="text-sm text-muted-foreground">{conexion.detalle}</p>
            {conexion.comoArreglar ? (
              <p className="text-sm text-vadai-cyan">{conexion.comoArreglar}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="avance" className="flex flex-col gap-3">
        <h2
          id="avance"
          className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase"
        >
          Avance
        </h2>
        <ul className="flex flex-col gap-2">
          {HITOS.map((hito) => (
            <li
              key={hito.clave}
              className="flex items-center justify-between rounded-md border border-border px-4 py-3"
            >
              <span className="flex items-center gap-3">
                <span className="font-mono text-sm text-vadai-cyan">{hito.clave}</span>
                <span className="text-sm">{hito.nombre}</span>
              </span>
              <span className="text-xs text-muted-foreground">{hito.estado}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-xs text-muted-foreground">
        Plataforma privada. El acceso se obtiene comprando un curso o por invitación.
      </footer>
    </main>
  )
}
