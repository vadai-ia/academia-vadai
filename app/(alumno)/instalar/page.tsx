import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'

import { InstalarEnUnToque } from '@/components/alumno/instalar-app'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Instala la app' }

type Telefono = 'iphone' | 'android'

/**
 * Cómo poner la academia en la pantalla de inicio (22-oct-2026).
 *
 * Alejandro: «un wizard que puedan leer fácilmente para, dependiendo de su
 * teléfono, instalar la app web en su inicio». Cuatro pasos por teléfono, uno
 * por renglón, con el botón que hay que tocar dibujado tal como se ve. El
 * teléfono se elige con `?en=`, y si no viene, por el user-agent: así abre ya
 * en el suyo y funciona sin JavaScript. En Android con Chrome, además, arriba
 * aparece «Instalar la app» de un toque (`InstalarEnUnToque`).
 */
export default async function PaginaInstalar({
  searchParams,
}: {
  searchParams: Promise<{ en?: string }>
}) {
  const { en } = await searchParams
  const agente = (await headers()).get('user-agent') ?? ''
  const telefono: Telefono =
    en === 'iphone' || en === 'android' ? en : /Android/i.test(agente) ? 'android' : 'iphone'

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <header className="flex flex-col items-center gap-4 text-center">
        <Image
          src="/vadai-app-192.png"
          alt=""
          width={72}
          height={72}
          priority
          className="size-18 rounded-[18px] border border-border shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
        />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[1.75rem] leading-tight font-medium tracking-tight text-balance">
            La academia en tu pantalla de inicio
          </h1>
          <p className="text-[1.0625rem] text-muted-foreground text-balance">
            Un icono de VADAI junto a tus apps. Lo tocas y entras directo, sin buscar la página.
          </p>
        </div>
      </header>

      <nav aria-label="Tu teléfono" className="grid grid-cols-2 gap-1 rounded-full border border-border bg-muted/60 p-1">
        <Opcion href="/instalar?en=iphone" activa={telefono === 'iphone'}>
          iPhone
        </Opcion>
        <Opcion href="/instalar?en=android" activa={telefono === 'android'}>
          Android
        </Opcion>
      </nav>

      <InstalarEnUnToque />

      {telefono === 'iphone' ? (
        <ol className="flex flex-col gap-3">
          <Paso n={1} titulo="Ábrela en Safari" dibujo={<Direccion />}>
            Escribe <strong className="font-medium">academia.vadai.com.mx</strong> en Safari. Si llegaste desde
            WhatsApp o el correo, toca el botón de compartir de esa pantalla y elige «Abrir en Safari».
          </Paso>
          <Paso n={2} titulo="Toca Compartir" dibujo={<BotonDibujado icono={<IconoCompartir />} texto="Compartir" />}>
            Es el cuadro con la flecha hacia arriba, en la barra de Safari. Si no lo ves, toca primero{' '}
            <strong className="font-medium">⋯</strong>.
          </Paso>
          <Paso n={3} titulo="Elige «Agregar a inicio»" dibujo={<Renglon icono={<IconoAgregar />} texto="Agregar a inicio" />}>
            Desliza la lista hacia arriba si no aparece. En algunos iPhone dice «Agregar a pantalla de inicio».
          </Paso>
          <Paso n={4} titulo="Toca «Agregar»" dibujo={<Confirmar texto="Agregar" />}>
            Listo: el icono de VADAI queda en tu pantalla de inicio.
          </Paso>
        </ol>
      ) : (
        <ol className="flex flex-col gap-3">
          <Paso n={1} titulo="Ábrela en Chrome" dibujo={<Direccion />}>
            Escribe <strong className="font-medium">academia.vadai.com.mx</strong> en Chrome. Si llegaste desde
            WhatsApp o el correo, toca <strong className="font-medium">⋮</strong> y elige «Abrir en Chrome».
          </Paso>
          <Paso n={2} titulo="Toca el menú ⋮" dibujo={<BotonDibujado icono={<IconoMenu />} texto="Menú" />}>
            Son los tres puntos, arriba a la derecha.
          </Paso>
          <Paso n={3} titulo="Elige «Instalar app»" dibujo={<Renglon icono={<IconoInstalar />} texto="Instalar app" />}>
            En algunos teléfonos dice «Agregar a la pantalla principal».
          </Paso>
          <Paso n={4} titulo="Toca «Instalar»" dibujo={<Confirmar texto="Instalar" />}>
            Listo: el icono de VADAI queda con tus apps.
          </Paso>
        </ol>
      )}

      <section className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-5">
        <h2 className="text-[1.0625rem] font-medium">La primera vez que la abras</h2>
        <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
          {telefono === 'iphone'
            ? 'El iPhone guarda la app aparte de Safari, así que te va a pedir entrar una vez. Usa el mismo correo de siempre; después ya no te lo pide.'
            : 'Entra con el mismo correo de siempre. Si ya tenías la sesión abierta en Chrome, entras directo.'}
        </p>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/mis-cursos" className="text-primary underline-offset-4 hover:underline">
          Volver al inicio
        </Link>
      </p>
    </div>
  )
}

function Opcion({ href, activa, children }: { href: string; activa: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={activa ? 'page' : undefined}
      data-slot="destino"
      className={cn(
        'flex h-10 items-center justify-center rounded-full text-[0.95rem] font-medium transition-colors',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        activa ? 'bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-muted-foreground'
      )}
    >
      {children}
    </Link>
  )
}

/** Un paso: número, qué hacer, y a la derecha el botón como se ve en la pantalla. */
function Paso({
  n,
  titulo,
  dibujo,
  children,
}: {
  n: number
  titulo: string
  dibujo: ReactNode
  children: ReactNode
}) {
  return (
    <li className="flex flex-col gap-4 rounded-[14px] border border-border bg-card p-5">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[0.95rem] font-medium text-primary-foreground tabular-nums"
        >
          {n}
        </span>
        <div className="flex min-w-0 flex-col gap-1 pt-0.5">
          <h2 className="text-[1.0625rem] leading-snug font-medium">
            <span className="sr-only">Paso {n}: </span>
            {titulo}
          </h2>
          <p className="text-[0.95rem] leading-relaxed text-muted-foreground">{children}</p>
        </div>
      </div>
      <div aria-hidden className="flex h-20 items-center justify-center rounded-[10px] bg-muted/70">
        {dibujo}
      </div>
    </li>
  )
}

// --- Los botones dibujados -------------------------------------------------
// Imitan lo que la persona va a buscar en su pantalla; son decorativos
// (`aria-hidden` en el contenedor): el texto del paso ya lo dice.

function Direccion() {
  return (
    <span className="flex h-10 w-[85%] max-w-72 items-center gap-2 rounded-full bg-card px-4 text-sm text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      academia.vadai.com.mx
    </span>
  )
}

function BotonDibujado({ icono, texto }: { icono: ReactNode; texto: string }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="flex size-12 items-center justify-center rounded-full bg-card text-primary ring-2 ring-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {icono}
      </span>
      <span className="text-xs text-muted-foreground">{texto}</span>
    </span>
  )
}

function Renglon({ icono, texto }: { icono: ReactNode; texto: string }) {
  return (
    <span className="flex h-11 w-[85%] max-w-72 items-center justify-between rounded-[10px] bg-card px-4 text-[0.95rem] ring-2 ring-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      {texto}
      <span className="text-foreground">{icono}</span>
    </span>
  )
}

function Confirmar({ texto }: { texto: string }) {
  return (
    <span className="flex h-11 w-[85%] max-w-72 items-center justify-between rounded-[10px] bg-card px-4 text-[0.95rem] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <span className="text-muted-foreground">Cancelar</span>
      <span className="rounded-full px-3 py-1 font-medium text-primary ring-2 ring-primary">{texto}</span>
    </span>
  )
}

function trazo(hijos: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {hijos}
    </svg>
  )
}

function IconoCompartir() {
  return trazo(
    <>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
    </>
  )
}

function IconoAgregar() {
  return trazo(
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  )
}

function IconoMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

function IconoInstalar() {
  return trazo(
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M12 7v7" />
      <path d="m9 11 3 3 3-3" />
    </>
  )
}
