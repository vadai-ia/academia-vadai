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
 *
 * El texto se reescribió el 16-oct-2026 a pedido de Alejandro: que se sienta
 * ACOMPAÑAMIENTO (el equipo y la comunidad), que las clases sean
 * «personalizadas» sin prometer una frecuencia, que hable de todas las
 * plataformas de IA y no solo de Excel y ventas, y que se vea el valor de la
 * comunidad («Por qué en comunidad»).
 */

const INCLUYE = [
  {
    titulo: 'Clases en vivo personalizadas',
    detalle: 'Se arman con lo que preguntan los miembros: llevas tu caso y lo resolvemos en vivo. Si no llegas, queda la grabación.',
  },
  {
    titulo: 'El equipo VADAI contigo',
    detalle: 'Preguntas en el muro y te responde el equipo. No te quedas atorado con un prompt ni con una herramienta.',
  },
  {
    titulo: 'Todas las plataformas de IA',
    detalle: 'Claude, ChatGPT, Gemini, Copilot y las herramientas de imagen, video y automatización que van saliendo: qué sirve, para qué y cómo usarla.',
  },
  {
    titulo: 'Noticias de IA casi a diario',
    detalle: 'Lo que cambió esta semana, explicado para tu negocio y con su fuente. Lo comentas con la comunidad.',
  },
  {
    titulo: 'Herramientas y cursos que siguen creciendo',
    detalle: 'Creativas, administrativas y comerciales, cada una con su video paso a paso. Todo lo nuevo para miembros es tuyo mientras sigas dentro.',
  },
  {
    titulo: 'Una comunidad que ya lo está haciendo',
    detalle: 'Dueños de negocio y equipos que comparten plantillas, prompts y lo que les funcionó. Sumas puntos, subes de nivel y ganas logros.',
  },
] as const

/** Por qué en comunidad y no solo: el valor que Alejandro quiere que se vea (16-oct-2026). */
const POR_QUE = [
  {
    titulo: 'La IA cambia cada semana',
    detalle: 'Lo que hoy hace ChatGPT, mañana lo hace mejor Claude o Gemini. Aquí te enteras a tiempo, sin pasarte la tarde leyendo.',
  },
  {
    titulo: 'Nadie se queda atorado',
    detalle: 'Cuando algo no sale, lo preguntas y te responden el equipo y otros miembros que ya pasaron por ahí.',
  },
  {
    titulo: 'Aprendes de casos reales',
    detalle: 'Ves cómo otros negocios ya usan IA en ventas, administración y creatividad, y te llevas lo que te sirve.',
  },
] as const

/** Lo que VADAI ya afirma en público (CLAUDE.md · Voz). */
const CREDENCIALES = [
  { cifra: '+40', etiqueta: 'empresas capacitadas' },
  { cifra: '4.9/5', etiqueta: 'de calificación' },
  { cifra: '#1', etiqueta: 'agencia de IA en México' },
] as const

const PREGUNTAS = [
  {
    pregunta: '¿Cómo son las clases?',
    respuesta:
      'En vivo, por Meet, y personalizadas: se arman con las dudas y los casos de los miembros. Te llega la liga a tu correo y el evento a tu calendario; si no llegas, queda la grabación.',
  },
  {
    pregunta: '¿Necesito saber de IA para entrar?',
    respuesta:
      'No. Hay de todo: quien apenas abrió ChatGPT y quien ya automatiza su negocio. Empiezas donde estás y el equipo te acompaña.',
  },
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
              Con la IA nadie debería aprender solo. En V-AI-P el equipo de VADAI te acompaña mes con mes:
              clases en vivo personalizadas, lo nuevo de todas las plataformas de IA y una comunidad de
              negocios que ya la usa en su día a día.
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

      <ul className="grid grid-cols-3 gap-4 border-y border-border py-6 text-center">
        {CREDENCIALES.map((c) => (
          <li key={c.etiqueta} className="flex flex-col gap-1">
            <span className="text-2xl font-semibold tracking-tight text-primary tabular-nums sm:text-3xl">{c.cifra}</span>
            <span className="text-xs text-pretty text-muted-foreground sm:text-sm">{c.etiqueta}</span>
          </li>
        ))}
      </ul>

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
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-semibold tracking-tight">Por qué en comunidad</h2>
          <p className="max-w-[60ch] text-sm text-pretty text-muted-foreground">
            Un curso te enseña una vez. Una comunidad te acompaña mientras la IA sigue cambiando.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3">
          {POR_QUE.map((razon, i) => (
            <li key={razon.titulo}>
              <Tarjeta className="flex h-full flex-col gap-2 p-5">
                <span className="grid size-7 place-items-center rounded-full border border-primary/40 text-sm font-medium text-primary tabular-nums">
                  {i + 1}
                </span>
                <span className="font-medium">{razon.titulo}</span>
                <span className="text-sm text-pretty text-muted-foreground">{razon.detalle}</span>
              </Tarjeta>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-semibold tracking-tight">Cómo funciona</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            'Te suscribes con tarjeta en la página segura de Stripe.',
            'Te llega un correo para entrar. Si ya tenías cuenta, entras con la de siempre.',
            'Entras a V-AI-P desde el menú de la plataforma, te presentas en el muro y el equipo te recibe.',
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
