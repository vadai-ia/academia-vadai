import { verificarConexion } from '@/lib/supabase/estado'

// La sonda consulta Supabase en vivo: nunca debe quedar cacheada en el build.
export const dynamic = 'force-dynamic'

const HITOS = [
  { clave: 'M0', nombre: 'Infraestructura', estado: 'en curso' },
  { clave: 'M1', nombre: 'Schema y RLS', estado: 'siguiente' },
  { clave: 'M2', nombre: 'Autenticación', estado: 'pendiente' },
] as const

export default async function Inicio() {
  const conexion = await verificarConexion()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-[0.2em] text-vadai-cyan uppercase">
          VADAI
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Academia
        </h1>
        <p className="max-w-md text-pretty text-muted-foreground">
          IA aplicada para dueños de negocio. Primer curso:{' '}
          <span className="text-foreground">Claude en tu Empresa</span>, 21 de septiembre
          de 2026.
        </p>
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
