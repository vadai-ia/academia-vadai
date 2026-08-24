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

const DATOS_CURSO = [
  { valor: '5', etiqueta: 'módulos' },
  { valor: '8', etiqueta: 'sesiones en vivo' },
  { valor: '2.5 h', etiqueta: 'cada sesión' },
] as const

const INCLUYE = [
  'Sesiones en vivo los lunes y jueves, con grabación disponible después.',
  'Ejercicios y tareas revisadas una por una, no autocalificadas.',
  'Comunidad privada de tu cohorte para resolver dudas entre sesiones.',
  'Certificado con folio verificable al completar el curso.',
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
              Deja de leer sobre IA.{' '}
              <span className="text-primary">Ponla a trabajar.</span>
            </h1>
            <p className="max-w-[52ch] text-pretty text-base text-muted-foreground sm:text-lg">
              <strong className="font-medium text-foreground">Claude en tu Empresa</strong> es un
              curso en vivo para dueños de negocio y sus equipos. Sales con procesos funcionando en
              tu operación, no con apuntes.
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-4">
            {DATOS_CURSO.map((dato) => (
              <div key={dato.etiqueta} className="flex flex-col">
                <dt className="sr-only">{dato.etiqueta}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{dato.valor}</dd>
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
            <span className="text-muted-foreground">21 de septiembre de 2026</span>
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
