'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { COMO_GANAR, NIVELES, type Actividad, type Nivel } from '@/lib/gamificacion/reglas'

/**
 * "Tu nivel": la tarjeta de puntos del tablero del alumno.
 *
 * Es la pieza emocional de la pantalla, y por eso es de cliente: el número
 * sube de 0 a los puntos reales al cargar, la barra se llena y brilla, y la
 * insignia del nivel entra con un pequeño zoom. Nada de eso hace falta para
 * leerla —el HTML del servidor ya trae el número final (`data-puntos`)—, así
 * que sin JavaScript se ve igual, quieta. Todo se apaga con reduced-motion.
 *
 * Lo que dice es concreto: cuántos puntos, qué nivel, cuánto falta para el
 * siguiente, y en qué lugar vas en cada grupo. La lista de "cómo gano puntos"
 * vive en un <details>: quien ya lo sabe no la ve.
 */

function useContador(final: number, duracionMs = 900): number {
  const [valor, setValor] = useState(final)

  useEffect(() => {
    if (final <= 0) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
    let inicio: number | null = null
    let cuadro = 0
    const paso = (t: number) => {
      if (inicio === null) inicio = t
      const avance = Math.min(1, (t - inicio) / duracionMs)
      // Sale rápido y frena al final: se siente como algo que "llega".
      const suavizado = 1 - Math.pow(1 - avance, 3)
      setValor(Math.round(final * suavizado))
      if (avance < 1) cuadro = requestAnimationFrame(paso)
    }
    setValor(0)
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [final, duracionMs])

  return valor
}

export function TarjetaNivel({
  puntos,
  nivel,
  actividad,
  porCurso,
}: {
  puntos: number
  nivel: Nivel
  actividad: Actividad
  porCurso: Array<{ cursoTitulo: string; cursoSlug: string; puntos: number; posicion: number; total: number }>
}) {
  const contador = useContador(puntos)

  return (
    <section
      aria-labelledby="tu-nivel"
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-10 size-56 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="tu-nivel" className="text-xs font-medium tracking-[0.15em] text-muted-foreground uppercase">
              Tu nivel
            </h2>
            <div className="flex items-baseline gap-2">
              <span
                data-puntos={puntos}
                className="text-4xl leading-none font-semibold text-primary tabular-nums"
              >
                {contador}
              </span>
              <span className="text-sm text-muted-foreground">puntos</span>
            </div>
          </div>

          <span className="inline-flex animate-in items-center gap-2 rounded-full bg-vadai-lima px-3.5 py-1.5 text-sm font-semibold text-vadai-navy zoom-in duration-500">
            <Estrella /> Nivel {nivel.numero} · {nivel.nombre}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div
            className="vadai-brillo relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={nivel.progreso}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={
              nivel.siguiente
                ? `${nivel.progreso}% del camino a ${nivel.siguiente.nombre}`
                : 'Nivel máximo alcanzado'
            }
          >
            <span
              className="block h-full rounded-full bg-gradient-to-r from-vadai-azul to-primary transition-[width] duration-1000 ease-out"
              style={{ width: `${Math.max(nivel.progreso, puntos > 0 ? 4 : 0)}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {nivel.siguiente
                ? `Te faltan ${nivel.faltan} puntos para ${nivel.siguiente.nombre}`
                : 'Llegaste al nivel más alto. Ahora es cosa de mantenerse arriba.'}
            </span>
            <span className="tabular-nums">
              Nivel {nivel.numero} de {NIVELES.length}
            </span>
          </div>
        </div>

        {porCurso.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {porCurso.map((c) => (
              <li key={c.cursoSlug}>
                <Link
                  href={`/curso/${c.cursoSlug}/comunidad`}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="font-semibold text-primary tabular-nums">{`#${c.posicion}`}</span>
                  <span className="text-muted-foreground">
                    de {c.total} en {c.cursoTitulo}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <details className="group/como text-sm">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-primary select-none underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            ¿Cómo gano puntos?
            <span aria-hidden className="transition-transform group-open/como:rotate-90">›</span>
          </summary>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {COMO_GANAR.map((c) => (
              <li key={c.que} className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-pretty">{c.que}</span>
                <span className="shrink-0 font-medium text-primary tabular-nums">+{c.puntos}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Llevas {actividad.lecciones} lección{actividad.lecciones === 1 ? '' : 'es'},{' '}
            {actividad.comentarios} comentario{actividad.comentarios === 1 ? '' : 's'},{' '}
            {actividad.publicaciones} publicación{actividad.publicaciones === 1 ? '' : 'es'} y{' '}
            {actividad.dinamicas} dinámica{actividad.dinamicas === 1 ? '' : 's'}.
          </p>
        </details>
      </div>
    </section>
  )
}

function Estrella() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden>
      <path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2Z" />
    </svg>
  )
}
