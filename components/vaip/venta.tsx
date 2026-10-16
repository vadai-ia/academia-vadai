import Image from 'next/image'

import { LogoVaip } from '@/components/marca/logo-vaip'
import { PrecioDelPlan } from '@/components/membresias/precio'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import type { PlanPublico } from '@/lib/membresia/consultas'

/**
 * La página de venta de VADAI V-AI-P (M17; flyer y precio de graduado en M18).
 *
 * Arriba, el flyer: la foto (generada con Higgsfield, public/vaip/flyer.jpg)
 * con un velo navy, y encima en HTML el logo, el mensaje y el precio. El precio
 * NO va dentro de la imagen: así es exacto, se lee con lector de pantalla y
 * cambia con el plan sin volver a generar nada. $349 con $499 tachado es el
 * «precio de graduado», para todos (decidido por Alejandro, 16-oct-2026).
 *
 * Voz de la marca: directa, en segunda persona, cosas comprobables. Cada línea
 * describe algo que la membresía trae.
 */

const INCLUYE = [
  {
    titulo: 'Una clase en vivo cada quince días',
    detalle: 'Por Meet, con la liga en tu correo y el evento en tu calendario. Si no llegas, queda la grabación.',
  },
  {
    titulo: 'Noticias de IA casi a diario',
    detalle: 'Lo que cambió en Claude, ChatGPT y Gemini, explicado para tu negocio y con su fuente. Las comentas en el muro.',
  },
  {
    titulo: 'Herramientas creativas, administrativas y comerciales',
    detalle: 'Cada una con su video: para tus presentaciones, tus reportes en Excel, tu correo y tus ventas.',
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
      'Desde Mi perfil, en «Tu membresía», con «Administrar membresía». Son tres pasos dentro de la plataforma, sin llamadas ni correos, y sigues dentro hasta que termine el mes que ya pagaste.',
  },
  {
    pregunta: '¿El precio me puede subir?',
    respuesta:
      'Mientras sigas suscrito, pagas lo mismo cada mes. Si el precio de V-AI-P cambia después, tu suscripción se queda con el tuyo.',
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

export function VentaVaip({
  plan,
  enlace,
  conSesion,
}: {
  plan: PlanPublico
  /** El link de pago ya personalizado, o null si la suscripción no abre todavía. */
  enlace: string | null
  conSesion: boolean
}) {
  return (
    <div className="flex flex-col gap-14">
      {/* --- El flyer ---------------------------------------------------- */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-border bg-vadai-navy text-white">
        {/* En teléfono la foto va arriba, entera; en escritorio es el fondo y
            el texto ocupa el tercio oscuro de la izquierda. */}
        <div className="relative aspect-[16/9] lg:absolute lg:inset-0 lg:aspect-auto">
          <Image
            src={plan.imagen ?? '/vaip/flyer.jpg'}
            // Una imagen de otro dominio (la pone el admin) no pasa por el optimizador.
            unoptimized={Boolean(plan.imagen && !plan.imagen.startsWith('/'))}
            alt="Cuatro dueños de negocio revisan juntos un reporte en la laptop."
            fill
            priority
            sizes="(min-width: 1024px) 1200px, 100vw"
            className="object-cover object-[70%_center]"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-vadai-navy via-vadai-navy/10 to-transparent lg:hidden" />
          <div
            aria-hidden
            className="absolute inset-0 hidden bg-gradient-to-r from-vadai-navy via-vadai-navy/85 to-transparent lg:block"
          />
        </div>

        <div className="relative flex flex-col gap-7 p-6 sm:p-8 lg:min-h-[560px] lg:max-w-[54%] lg:justify-center lg:p-12">
          <div className="flex flex-col gap-4">
            {/* self-start: en una columna flex el SVG se estira a todo el ancho y centra su dibujo. */}
            <LogoVaip className="h-12 self-start text-white sm:h-14" />
            <h1 className="text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]">
              Invierte en tu educación. <span className="text-vadai-lima">Avanzamos juntos.</span>
            </h1>
            <p className="max-w-[52ch] text-base text-pretty text-white/80 sm:text-lg">
              La comunidad de la academia VADAI: una clase en vivo cada quince días, noticias de IA casi a
              diario y herramientas con su video para tu Excel, tu correo y tus ventas.
            </p>
          </div>
          <PrecioDelPlan
            precioMxn={plan.precioMxn}
            tachadoMxn={plan.precioTachadoMxn}
            frase={plan.frase}
            enlace={enlace}
            conSesion={conSesion}
            sobreFoto
          />
        </div>
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
