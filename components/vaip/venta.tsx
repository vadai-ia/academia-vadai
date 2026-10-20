import Image from 'next/image'
import Link from 'next/link'

import { LogoVaip } from '@/components/marca/logo-vaip'
import { BarraSuscribir, BotonSuscribir, SuscripcionCerrada } from '@/components/membresias/boton-suscribir'
import { moneda, PrecioConTachado } from '@/components/membresias/precio'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import type { PlanPublico } from '@/lib/membresia/consultas'
import type { SituacionDeVenta } from '@/lib/membresia/venta'

/**
 * La página de venta de VADAI V-AI-P (M17; flyer y precio de graduado en M18;
 * rehecha para vender en el teléfono en M23).
 *
 * M23 (20-oct-2026), pedido de Alejandro: «que la gente sepa exactamente dónde
 * hacer clic», con el botón de compra 3 o 4 veces y distinto en cada lugar, y
 * todo pensado primero para el teléfono. Antes había UN botón, y a 390 px
 * quedaba bajo el pliegue: la foto iba arriba como bloque, luego el logo, el
 * título, seis renglones y el precio.
 *
 *   1. Encabezado: la foto es el fondo (también en el teléfono), el precio y
 *      el botón caben sin hacer scroll. Debajo, «Menos de $12 al día».
 *   2. Credenciales.
 *   3. Qué incluye → «Quiero todo esto por $349 al mes».
 *   4. Por qué en comunidad.
 *   5. Cómo funciona y «Sin letras chiquitas» → «Empezar hoy».
 *   6. Preguntas.
 *   7. Cierre → «Unirme a la comunidad».
 *
 * Más la barra pegada abajo en teléfono y tableta (components/membresias/
 * boton-suscribir.tsx). Todos los botones son el mismo link de pago; si la
 * suscripción no abre, el encabezado y el cierre lo dicen y los demás no se
 * pintan.
 *
 * Voz de la marca: directa, en segunda persona, cosas comprobables. Nada de
 * testimonios ni de garantía de devolución mientras no existan de verdad.
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

/** Cada línea ya es verdad hoy: es lo que hace la plataforma, no una promesa. */
const SIN_LETRAS_CHIQUITAS = [
  'Cancelas desde Mi perfil en tres pasos, sin llamadas ni correos.',
  'Sigues dentro hasta que termina el mes que ya pagaste.',
  'Tu precio no sube mientras sigas suscrito.',
  'Pagas con tarjeta en la página segura de Stripe.',
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
    pregunta: '¿Entro desde el celular?',
    respuesta:
      'Sí. Es una página web: entras desde el navegador de tu celular, tu tableta o tu computadora, sin instalar nada.',
  },
  {
    pregunta: '¿Cómo cancelo?',
    respuesta:
      'Desde Mi perfil → Membresía, con «Administrar membresía». Son tres pasos dentro de la plataforma, sin llamadas ni correos, y sigues dentro hasta que termine el mes que ya pagaste.',
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

/** El botón del encabezado dice lo que esa persona va a hacer. */
const CTA_DEL_ENCABEZADO: Record<SituacionDeVenta, string> = {
  nueva: 'Unirme a V-AI-P',
  vencida: 'Volver a V-AI-P',
  sinTerminar: 'Terminar mi suscripción',
}

const ENTRAR = '/login?destino=%2Fvaip'

export function VentaVaip({
  plan,
  enlace,
  conSesion,
  situacion,
  terminoEl,
  costoDia,
}: {
  plan: PlanPublico
  /** El link de pago ya personalizado, o null si la suscripción no abre todavía. */
  enlace: string | null
  conSesion: boolean
  situacion: SituacionDeVenta
  /** A quien ya fue miembro: la fecha en que terminó su acceso, ya con formato. */
  terminoEl: string | null
  /** El tope entero de lo que cuesta al día (lib/membresia/venta.ts). */
  costoDia: number
}) {
  const precio = moneda(plan.precioMxn)
  const alDia = `Menos de ${moneda(costoDia)} al día`

  return (
    <div className="venta-con-barra flex flex-col gap-12 sm:gap-14">
      {/* --- 1. El encabezado ------------------------------------------------ */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-border bg-vadai-navy text-white">
        {/* La foto es el fondo en todos los tamaños: arriba como bloque se
            comía el primer tercio del teléfono y empujaba el botón fuera. */}
        <Image
          src={plan.imagen ?? '/vaip/flyer.jpg'}
          // Una imagen de otro dominio (la pone el admin) no pasa por el optimizador.
          unoptimized={Boolean(plan.imagen && !plan.imagen.startsWith('/'))}
          alt=""
          fill
          priority
          quality={70}
          sizes="(min-width: 1152px) 1112px, 100vw"
          className="-z-10 object-cover object-[70%_center]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-vadai-navy/80 lg:hidden" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-vadai-navy via-vadai-navy/85 to-transparent lg:block"
        />

        <div className="flex flex-col gap-5 p-6 sm:gap-7 sm:p-8 lg:min-h-[560px] lg:max-w-[54%] lg:justify-center lg:p-12">
          <div className="flex flex-col gap-3 sm:gap-4">
            {situacion === 'vencida' && terminoEl ? (
              <p className="text-sm text-white/80">
                Tu membresía terminó el {terminoEl}.{' '}
                <Link href="/perfil/membresia" className="underline underline-offset-4 hover:text-white">
                  Ver mi membresía
                </Link>
              </p>
            ) : null}
            {/* self-start: en una columna flex el SVG se estira a todo el ancho y centra su dibujo. */}
            <LogoVaip className="h-9 self-start text-white sm:h-14" />
            <h1 className="text-[1.75rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]">
              Invierte en tu educación. <span className="text-vadai-lima">Avanzamos juntos.</span>
            </h1>
            <p className="max-w-[52ch] text-base text-pretty text-white/80 sm:hidden">
              Clases en vivo con tus casos, el equipo de VADAI que te responde y una comunidad de negocios que ya usa IA.
            </p>
            <p className="hidden max-w-[52ch] text-lg text-pretty text-white/80 sm:block">
              Con la IA nadie debería aprender solo. En V-AI-P el equipo de VADAI te acompaña mes con mes: clases en
              vivo personalizadas, lo nuevo de todas las plataformas de IA y una comunidad de negocios que ya la usa en
              su día a día.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <PrecioConTachado
              precioMxn={plan.precioMxn}
              tachadoMxn={plan.precioTachadoMxn}
              frase={plan.frase}
              sobreFoto
              tamano="mediano"
            />
            {enlace ? (
              <div className="flex flex-col gap-2.5">
                <BotonSuscribir enlace={enlace} lugar="hero" sobreFoto>
                  {CTA_DEL_ENCABEZADO[situacion]}
                </BotonSuscribir>
                <p className="text-sm text-white/75">{alDia} · Cancelas desde tu perfil cuando quieras</p>
              </div>
            ) : (
              <SuscripcionCerrada sobreFoto />
            )}
            {!conSesion ? (
              <p className="text-sm text-white/75">
                ¿Ya eres miembro?{' '}
                <Link
                  href={ENTRAR}
                  className="font-medium text-white underline underline-offset-4 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                >
                  Entra
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* --- 2 a 6, con la barra pegada al final del bloque --------------------- */}
      <div className="flex flex-col gap-12 sm:gap-14">
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
                  <Palomita />
                  <span className="flex flex-col gap-1">
                    <span className="font-medium">{cosa.titulo}</span>
                    <span className="text-sm text-pretty text-muted-foreground">{cosa.detalle}</span>
                  </span>
                </Tarjeta>
              </li>
            ))}
          </ul>
          {enlace ? (
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <BotonSuscribir enlace={enlace} lugar="incluye">
                Quiero todo esto por {precio} al mes
              </BotonSuscribir>
              <p className="text-sm text-muted-foreground">{alDia}</p>
            </div>
          ) : null}
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
                  <Numero n={i + 1} />
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
                <Numero n={i + 1} />
                <span className="text-sm text-pretty text-muted-foreground">{paso}</span>
              </li>
            ))}
          </ol>

          <Tarjeta className="flex flex-col gap-4 p-5 sm:p-6">
            <h3 className="font-medium">Sin letras chiquitas</h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {SIN_LETRAS_CHIQUITAS.map((linea) => (
                <li key={linea} className="flex gap-3 text-sm text-pretty text-muted-foreground">
                  <Palomita />
                  {linea}
                </li>
              ))}
            </ul>
            {enlace ? (
              <BotonSuscribir enlace={enlace} lugar="confianza">
                Empezar hoy
              </BotonSuscribir>
            ) : null}
          </Tarjeta>
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

        <BarraSuscribir enlace={enlace} precio={precio} />
      </div>

      {/* --- 7. El cierre ------------------------------------------------------ */}
      {/* Borde lima y no un plano navy: el único plano de marca de la página es
          el encabezado (CLAUDE.md · Branding). */}
      <Tarjeta className="flex flex-col items-center gap-5 border-2 border-accent px-6 py-10 text-center sm:px-10">
        <LogoVaip className="h-10 text-foreground" />
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">Empieza este mes</h2>
          <p className="max-w-[48ch] text-sm text-pretty text-muted-foreground">
            Clases en vivo, el equipo de VADAI que te responde y una comunidad que ya usa IA en su negocio.
          </p>
        </div>
        <PrecioConTachado precioMxn={plan.precioMxn} tachadoMxn={plan.precioTachadoMxn} frase={null} tamano="mediano" />
        {enlace ? (
          <div className="flex w-full flex-col items-center gap-2">
            <BotonSuscribir enlace={enlace} lugar="cierre">
              Unirme a la comunidad
            </BotonSuscribir>
            <p className="text-sm text-muted-foreground">{alDia} · Cancelas cuando quieras</p>
          </div>
        ) : (
          <SuscripcionCerrada />
        )}
        <p className="text-xs text-muted-foreground">{CREDENCIALES.map((c) => `${c.cifra} ${c.etiqueta}`).join(' · ')}</p>
        {!conSesion ? (
          <p className="text-sm text-muted-foreground">
            ¿Ya eres miembro?{' '}
            <Link
              href={ENTRAR}
              className="font-medium text-primary underline underline-offset-4 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
            >
              Entra
            </Link>
          </p>
        ) : null}
      </Tarjeta>
    </div>
  )
}

function Palomita() {
  return (
    <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  )
}

function Numero({ n }: { n: number }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/40 text-sm font-medium text-primary tabular-nums">
      {n}
    </span>
  )
}
