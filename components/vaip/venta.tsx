import { LogoVaip } from '@/components/marca/logo-vaip'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'

/**
 * La página de venta de VADAI V-AI-P (M17).
 *
 * Voz de la marca: directa, en segunda persona, cosas comprobables. Cada línea
 * describe algo que la membresía ya trae; nada de frecuencias que no dependan
 * de Alejandro (la única que sí: la clase cada quince días, que él decidió).
 */

const INCLUYE = [
  {
    titulo: 'Una clase en vivo cada quince días',
    detalle: 'Por Meet, con la liga en tu correo y el evento en tu calendario.',
  },
  {
    titulo: 'Los cursos y clases que se suban para miembros',
    detalle: 'Todo lo nuevo que se publique en V-AI-P es tuyo mientras seas miembro.',
  },
  {
    titulo: 'Un muro con temas',
    detalle: 'Preguntas, plantillas y lo que ya te funciona con Excel, Word o tu correo, ordenado por tema.',
  },
  {
    titulo: 'Puntos, nivel y logros',
    detalle: 'Tu actividad suma en el ranking de la comunidad y se ve en tu perfil de miembro.',
  },
] as const

const PREGUNTAS = [
  {
    pregunta: '¿Cómo cancelo?',
    respuesta:
      'Desde Mi perfil, en «Tu membresía», con el botón Administrar suscripción. Te llega un código a tu correo, cancelas y sigues dentro hasta que termine el mes que ya pagaste.',
  },
  {
    pregunta: '¿Qué pasa con mi avance si cancelo?',
    respuesta: 'Se queda guardado. Si vuelves, lo encuentras donde lo dejaste.',
  },
  {
    pregunta: '¿Necesito haber tomado un curso de la academia?',
    respuesta:
      'No. Si ya tienes cuenta, suscríbete con el mismo correo y todo queda en tu misma cuenta. Si no, la cuenta se crea sola y te llega un correo para entrar.',
  },
  {
    pregunta: '¿Incluye los cursos que se venden aparte?',
    respuesta: 'No. Incluye lo que se publica para miembros de V-AI-P. Los cursos de la academia se compran aparte.',
  },
] as const

const moneda = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

export function VentaVaip({
  precioMxn,
  enlace,
  conSesion,
}: {
  precioMxn: number
  /** El link de pago ya personalizado, o null si la suscripción no abre todavía. */
  enlace: string | null
  conSesion: boolean
}) {
  return (
    <div className="flex flex-col gap-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-6">
          <LogoVaip className="h-14 sm:h-16" />
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              Lo que sigue después del curso.{' '}
              <span className="text-primary">Cada quince días, en vivo.</span>
            </h1>
            <p className="max-w-[56ch] text-base text-pretty text-muted-foreground sm:text-lg">
              VADAI V-AI-P es la comunidad de la academia: una clase en vivo cada quince días, los cursos
              y clases nuevos que se publican para miembros, y un muro donde compartes lo que ya te
              funciona con IA en tu trabajo.
            </p>
          </div>
        </div>

        <Tarjeta className="flex flex-col gap-5 p-6 sm:p-7">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{moneda(precioMxn)}</span>
            <span className="text-muted-foreground">MXN al mes</span>
          </div>
          <p className="text-sm text-pretty text-muted-foreground">
            Se cobra con tarjeta cada mes. Cancelas desde tu perfil cuando quieras y sigues dentro hasta
            que termine el mes que pagaste.
          </p>
          {enlace ? (
            <Button asChild variant="acento" size="lg" className="h-11 text-base">
              <a href={enlace}>Suscribirme</a>
            </Button>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">
              La suscripción abre muy pronto.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {conSesion
              ? 'La suscripción queda en la cuenta con la que entraste.'
              : 'Si ya tienes cuenta en la academia, usa el mismo correo al pagar.'}
          </p>
        </Tarjeta>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-semibold tracking-tight">Qué incluye</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {INCLUYE.map((cosa) => (
            <li key={cosa.titulo}>
              <Tarjeta className="flex h-full gap-3 p-5">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"
                >
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{cosa.titulo}</span>
                  <span className="text-sm text-pretty text-muted-foreground">{cosa.detalle}</span>
                </span>
              </Tarjeta>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-semibold tracking-tight">Cómo funciona</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            'Te suscribes con tarjeta en la página segura de Stripe.',
            'Te llega un correo para entrar. Si ya tenías cuenta, entras con la de siempre.',
            'Entras a V-AI-P desde el menú de la plataforma, con todo lo que trae.',
          ].map((paso, i) => (
            <li key={paso} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/40 text-sm font-medium text-primary tabular-nums">
                {i + 1}
              </span>
              <span className="text-sm text-pretty text-muted-foreground">{paso}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Preguntas</h2>
        <div className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
          {PREGUNTAS.map((p) => (
            <details key={p.pregunta} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {p.pregunta}
                <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{p.respuesta}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
