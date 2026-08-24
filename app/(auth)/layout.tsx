import type { ReactNode } from 'react'

import { CambiarTema } from '@/components/marca/cambiar-tema'
import { SaltarAlContenido } from '@/components/marca/saltar-al-contenido'
import { EtiquetaAcademia, Wordmark } from '@/components/marca/wordmark'

/**
 * Marco de las pantallas de acceso.
 *
 * Es la puerta de la plataforma, así que hace dos trabajos a la vez: dejar
 * entrar a quien ya compró, y contarle a quien llega de rebote qué es esto.
 * Antes había una portada aparte que además publicaba el avance interno del
 * proyecto; eso se fue.
 *
 * En móvil la marca va arriba y el formulario abajo, en una sola columna: quien
 * ya tiene cuenta hace scroll de nada y entra. En escritorio se parte en dos,
 * con el relato a la izquierda y el acceso a la derecha, que es donde el ojo
 * busca la acción.
 */

/**
 * Cifras de marca, no de un curso.
 *
 * Antes esto decía "5 módulos · 8 sesiones · 2.5 h", que son los datos de
 * "Claude en tu Empresa". La academia es multi-curso desde el día uno (§1), así
 * que la portada tenía fecha de caducidad: al segundo curso, mentía.
 *
 * Las tres salen de vadai.com.mx y de la landing del curso — son afirmaciones
 * que VADAI ya hace públicamente, no inventadas aquí.
 */
const CREDENCIALES = [
  { valor: '+40', etiqueta: 'empresas capacitadas' },
  { valor: '4.9', etiqueta: 'de calificación' },
  { valor: '#1', etiqueta: 'agencia de IA en México' },
] as const

/**
 * Lo que la academia da, en su lenguaje.
 *
 * La voz de VADAI es concreta y anti-teoría: nombra objetos que el dueño de una
 * empresa reconoce —Excel, Word, correo— en vez de hablar de "transformación
 * digital". Se respeta eso: cada línea dice algo que se puede comprobar, no una
 * promesa abstracta.
 */
const INCLUYE = [
  'Cursos en video a tu ritmo, con sesiones en vivo para resolver dudas.',
  'Aplicado al Excel, el Word y el correo que tu equipo ya usa todos los días.',
  'Ejercicios revisados uno por uno por el equipo, no autocalificados.',
  'Certificado con folio verificable al completar cada curso.',
] as const

export default function LayoutAuth({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* En móvil el relato va antes que el formulario, así que quien navega
          con teclado agradece saltárselo para ir directo a entrar. */}
      <SaltarAlContenido destino="#acceso" />
      {/* Fijo y por encima de todo: se alcanza sin importar en qué mitad estés. */}
      <div className="absolute top-4 right-4 z-20 sm:top-5 sm:right-5">
        <CambiarTema />
      </div>

      {/* --- Relato ------------------------------------------------------- */}
      <section className="relative flex flex-col justify-center overflow-hidden bg-muted/40 px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
        {/* Halo de marca. `aria-hidden` y sin interacción: es atmósfera, no contenido. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative flex max-w-xl flex-col gap-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Wordmark alto={26} prioridad />
            <EtiquetaAcademia />
          </div>

          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              La IA ya cambió las reglas.{' '}
              <span className="text-primary">Enséñale a tu equipo a jugar.</span>
            </h1>
            <p className="max-w-[54ch] text-pretty text-base text-muted-foreground sm:text-lg">
              La academia de <strong className="font-medium text-foreground">VADAI</strong>, la
              agencia #1 de inteligencia artificial en México. Tu equipo aprende a usarla dentro de
              la operación que ya tienes: sin cambiar de programas, sin saber de tecnología y sin
              contratar a nadie nuevo.
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-4">
            {CREDENCIALES.map((dato) => (
              <div key={dato.etiqueta} className="flex flex-col">
                <dt className="sr-only">{dato.etiqueta}</dt>
                <dd className="text-2xl font-semibold tabular-nums text-primary">{dato.valor}</dd>
                <dd className="text-xs tracking-wide text-muted-foreground uppercase">
                  {dato.etiqueta}
                </dd>
              </div>
            ))}
          </dl>

          <ul className="flex flex-col gap-2.5">
            {INCLUYE.map((linea) => (
              <li key={linea} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <Palomita />
                <span className="text-pretty">{linea}</span>
              </li>
            ))}
          </ul>

          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center rounded-full bg-vadai-lima px-3 py-1 text-xs font-semibold text-vadai-navy">
              Próxima cohorte
            </span>
            <span className="text-muted-foreground">
              <strong className="font-medium text-foreground">Claude en tu Empresa</strong> · 21 de
              septiembre de 2026
            </span>
          </p>
        </div>
      </section>

      {/* --- Acceso ------------------------------------------------------- */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
        <main id="acceso" className="mx-auto flex w-full max-w-sm flex-col gap-6">
          {children}
        </main>

        <p className="mx-auto mt-10 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
          Plataforma privada de VADAI. El acceso se obtiene comprando un curso o por invitación.
        </p>
      </section>
    </div>
  )
}

function Palomita() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-4 shrink-0 text-primary"
      aria-hidden
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}
