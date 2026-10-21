import Link from 'next/link'

import { Tarjeta } from '@/components/ui-vadai/superficie'
import type { SesionDelAlumno } from '@/lib/alumno/sesiones'
import { describirHorario } from '@/lib/calendario/enlaces'
import { cn } from '@/lib/utils'
import type { EtiquetaDeHerramienta, GrabacionEnLista, HerramientaEnLista, LoNuevo, MesDeGrabaciones } from '@/lib/vaip/contenido'
import { duracionCorta, fechaDeClase, partesDeFecha, RUTA_CLASES, RUTA_HERRAMIENTAS, rutaDeContenido } from '@/lib/vaip/rutas'

/**
 * Las piezas del contenido de V-AI-P para el miembro (M26, 21-oct-2026): las
 * clases grabadas por mes y las herramientas como galería de videos cortos.
 *
 * Nada aquí parece un curso: no hay barra de avance, ni «lección 3 de 12», ni
 * módulos numerados. Una grabación se reconoce por su FECHA —la ficha del día
 * es su portada— y una herramienta por su portada dibujada y sus etiquetas.
 * El color sigue los tres papeles de la marca: cyan para orientar (la ficha,
 * la etiqueta activa), lima para lo logrado («Vista»).
 */

function Palomita({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-3.5', className)}
      aria-hidden
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}

/** Disco lima con palomita: ya la viste. La forma cambia, no solo el color. */
export function DiscoVista({ className }: { className?: string }) {
  return (
    <span
      className={cn('flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground', className)}
      aria-label="Vista"
      role="img"
    >
      <Palomita />
    </span>
  )
}

/** La ficha del día: mes, número y día de la semana. Es la portada de cada grabación. */
export function FichaDeFecha({ fecha, grande = false }: { fecha: string; grande?: boolean }) {
  const p = partesDeFecha(fecha)
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-[10px] border border-primary/25 bg-primary/10 text-primary',
        grande ? 'size-20 gap-0.5' : 'size-14'
      )}
    >
      <span className={cn('font-medium tracking-wider uppercase', grande ? 'text-xs' : 'text-[0.65rem]')}>{p.mesCorto}</span>
      <span className={cn('leading-none font-semibold tabular-nums', grande ? 'text-3xl' : 'text-xl')}>{p.dia}</span>
      <span className={cn('text-muted-foreground', grande ? 'text-xs' : 'text-[0.65rem]')}>{p.diaDeLaSemana.slice(0, 3)}</span>
    </span>
  )
}

function metaDeGrabacion(g: GrabacionEnLista): string {
  return [duracionCorta(g.duracionSeg), g.materiales > 0 ? `${g.materiales} ${g.materiales === 1 ? 'material' : 'materiales'}` : null]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Un renglón de grabación: la ficha del día, el título y si ya la viste.
 * `compacto`, en la columna de «Este mes»: solo el día y el título.
 */
export function RenglonDeGrabacion({
  g,
  activa = false,
  compacto = false,
}: {
  g: GrabacionEnLista
  activa?: boolean
  compacto?: boolean
}) {
  const meta = metaDeGrabacion(g)
  const p = partesDeFecha(g.fecha)
  return (
    <Link
      href={rutaDeContenido('mes', g.id)}
      aria-current={activa ? 'page' : undefined}
      data-grabacion={g.id}
      className={cn(
        'flex items-center rounded-[10px] border transition-colors',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        compacto ? 'gap-3 px-3 py-2.5 text-sm pointer-coarse:min-h-11' : 'gap-4 p-3',
        activa ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
      )}
    >
      {compacto ? (
        <span className="flex w-9 shrink-0 flex-col items-center text-primary" aria-hidden>
          <span className="text-lg leading-none font-semibold tabular-nums">{p.dia}</span>
          <span className="text-[0.65rem] text-muted-foreground">{p.diaDeLaSemana.slice(0, 3)}</span>
        </span>
      ) : (
        <FichaDeFecha fecha={g.fecha} />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {compacto ? <span className="sr-only">{fechaDeClase(g.fecha)}</span> : <span className="text-xs text-muted-foreground">{fechaDeClase(g.fecha)}</span>}
        <span className={cn('text-pretty', compacto ? (activa ? 'font-medium' : '') : 'font-medium')}>{g.titulo}</span>
        {meta && !compacto ? <span className="text-sm text-muted-foreground">{meta}</span> : null}
      </span>
      {g.vista ? <DiscoVista /> : null}
    </Link>
  )
}

/**
 * Las grabaciones, un `<details>` por mes, del más nuevo al más viejo. Abierto
 * solo el mes que se pide (el más nuevo, o el de la grabación que estás
 * viendo): abiertos todos, doce meses son una lista sin fin.
 */
export function GrabacionesPorMes({ meses, abierto }: { meses: MesDeGrabaciones[]; abierto: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      {meses.map((m) => {
        const vistas = m.grabaciones.filter((g) => g.vista).length
        return (
          <details
            key={m.id}
            id={`mes-${m.mes.slice(0, 7)}`}
            open={m.id === abierto || undefined}
            className="group/mes rounded-[10px] border border-border bg-card"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{m.titulo}</span>
                <span className="text-sm text-muted-foreground">
                  {m.grabaciones.length} {m.grabaciones.length === 1 ? 'clase grabada' : 'clases grabadas'}
                  {vistas > 0 ? ` · ${vistas === m.grabaciones.length ? 'todas vistas' : `${vistas} vistas`}` : ''}
                </span>
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open/mes:rotate-180"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <ul className="flex flex-col gap-2 border-t border-border p-3">
              {m.grabaciones.map((g) => (
                <li key={g.id}>
                  <RenglonDeGrabacion g={g} />
                </li>
              ))}
            </ul>
          </details>
        )
      })}
    </div>
  )
}

// ==========================================================================
// Herramientas
// ==========================================================================

/** Las etiquetas como pastillas: «Todas» y las que tienen videos. Ligas: funcionan sin JS. */
export function FiltroDeEtiquetas({
  etiquetas,
  activa,
  total,
}: {
  etiquetas: Array<EtiquetaDeHerramienta & { cuantas: number }>
  activa: string | null
  total: number
}) {
  if (etiquetas.length === 0) return null
  const opciones = [{ slug: null as string | null, nombre: 'Todas', cuantas: total }, ...etiquetas]
  return (
    <nav
      aria-label="Etiquetas de las herramientas"
      className={cn(
        'relative -mx-5 overflow-x-auto px-5 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        '[mask-image:linear-gradient(to_right,transparent,black_1.25rem,black_calc(100%-2.5rem),transparent)]',
        'md:mx-0 md:overflow-visible md:px-0 md:pr-0 md:[mask-image:none]'
      )}
    >
      <ul className="flex min-w-max gap-2 md:min-w-0 md:flex-wrap">
        {opciones.map((e) => {
          const elegida = e.slug === activa
          return (
            <li key={e.slug ?? 'todas'}>
              <Link
                href={e.slug ? `${RUTA_HERRAMIENTAS}?etiqueta=${e.slug}` : RUTA_HERRAMIENTAS}
                aria-current={elegida ? 'true' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors pointer-coarse:min-h-11',
                  elegida ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border hover:border-primary/50'
                )}
              >
                {e.nombre}
                <span className={cn('text-xs tabular-nums', elegida ? 'text-primary' : 'text-muted-foreground')}>{e.cuantas}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Un marco del formato del video: alto y angosto (vertical) o ancho. */
function IconoFormato({ orientacion }: { orientacion: 'horizontal' | 'vertical' }) {
  return orientacion === 'vertical' ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden>
      <rect x="7" y="3" width="10" height="18" rx="2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
    </svg>
  )
}

/**
 * La portada de una herramienta, 3:4. Si todavía no hay dibujo (o falló), un
 * fondo navy con el título: la tarjeta nunca sale vacía. Es una imagen, no una
 * superficie del tema: navy en los dos temas, por eso los colores de marca van
 * por nombre (como el héroe de la venta) y el contraste no depende del tema.
 */
export function PortadaDeHerramienta({ h, className }: { h: HerramientaEnLista; className?: string }) {
  return (
    <span className={cn('relative block aspect-[3/4] overflow-hidden rounded-[10px] border border-border bg-vadai-navy', className)}>
      {h.portada ? (
        // eslint-disable-next-line @next/next/no-img-element -- PNG dibujado por nosotros en el bucket público
        <img src={h.portada} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <span className="flex size-full flex-col justify-end gap-2 bg-[radial-gradient(circle_at_30%_20%,rgba(0,160,219,0.45),transparent_55%)] p-4 text-vadai-texto">
          <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-vadai-lima uppercase">Herramienta</span>
          <span className="line-clamp-4 text-lg leading-tight font-semibold">{h.titulo}</span>
        </span>
      )}
      {/* Arriba a la derecha: a la izquierda va el pase de V-AI-P de la portada. */}
      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[0.7rem] font-medium text-white">
        <IconoFormato orientacion={h.orientacion} />
        {duracionCorta(h.duracionSeg) ?? (h.orientacion === 'vertical' ? 'Vertical' : 'Horizontal')}
      </span>
      {h.vista ? <DiscoVista className="absolute right-2 bottom-3 ring-2 ring-black/30" /> : null}
    </span>
  )
}

export function TarjetaDeHerramienta({ h, etiqueta }: { h: HerramientaEnLista; etiqueta: string | null }) {
  return (
    <Link
      href={rutaDeContenido('herramientas', h.id, etiqueta)}
      data-herramienta={h.id}
      className="group flex flex-col gap-2 rounded-[10px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <PortadaDeHerramienta h={h} className="transition-[border-color] group-hover:border-primary/60" />
      <span className="flex flex-col gap-1 px-0.5">
        <span className="line-clamp-2 text-[0.95rem] leading-snug font-medium text-pretty">{h.titulo}</span>
        {h.etiquetas.length > 0 ? (
          <span className="truncate text-xs text-primary">{h.etiquetas.map((e) => e.nombre).join(' · ')}</span>
        ) : null}
      </span>
    </Link>
  )
}

export function GaleriaDeHerramientas({ herramientas, etiqueta }: { herramientas: HerramientaEnLista[]; etiqueta: string | null }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {herramientas.map((h) => (
        <li key={h.id}>
          <TarjetaDeHerramienta h={h} etiqueta={etiqueta} />
        </li>
      ))}
    </ul>
  )
}

// ==========================================================================
// «Lo nuevo», arriba del muro
// ==========================================================================

/**
 * Lo que hay de nuevo al abrir V-AI-P: la próxima clase, la última grabación y
 * las herramientas de la semana. En el teléfono se desliza de lado; si no hay
 * nada que enseñar, no se pinta.
 */
export function LoNuevoVaip({ clase, nuevo }: { clase: SesionDelAlumno | null; nuevo: LoNuevo }) {
  if (!clase && !nuevo.grabacion && nuevo.herramientas.length === 0) return null
  const tarjeta = 'w-[16.5rem] shrink-0 snap-start sm:w-auto sm:min-w-0 sm:flex-1'
  return (
    <section aria-labelledby="lo-nuevo" className="flex flex-col gap-3" data-lo-nuevo>
      <h2 id="lo-nuevo" className="text-lg font-medium tracking-tight">
        Lo nuevo
      </h2>
      <div className="relative -mx-5 snap-x snap-mandatory overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-3">
          {clase ? (
            <li className={tarjeta}>
              <Link
                href={RUTA_CLASES}
                className="flex h-full flex-col gap-1 rounded-[10px] border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <span className="text-xs font-medium tracking-[0.14em] text-primary uppercase">Próxima clase</span>
                <span className="font-medium text-pretty">{clase.titulo}</span>
                <span className="text-sm text-muted-foreground">{describirHorario(clase.programadaEn)}</span>
              </Link>
            </li>
          ) : null}
          {nuevo.grabacion ? (
            <li className={tarjeta}>
              <Link
                href={rutaDeContenido('mes', nuevo.grabacion.id)}
                data-nueva-grabacion={nuevo.grabacion.id}
                className="flex h-full items-center gap-3 rounded-[10px] border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <FichaDeFecha fecha={nuevo.grabacion.fecha} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs font-medium tracking-[0.14em] text-primary uppercase">Clase grabada</span>
                  <span className="line-clamp-2 font-medium text-pretty">{nuevo.grabacion.titulo}</span>
                </span>
              </Link>
            </li>
          ) : null}
          {nuevo.herramientas.length > 0 ? (
            <li className={cn(tarjeta, 'w-[19rem] sm:flex-[1.4]')}>
              <Tarjeta className="flex h-full flex-col gap-3 p-4">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
                    {nuevo.herramientasDeLaSemana === 1 ? 'Herramienta nueva' : 'Herramientas de la semana'}
                  </span>
                  <Link href={RUTA_HERRAMIENTAS} className="text-sm text-primary underline-offset-4 hover:underline">
                    Ver {nuevo.herramientasDeLaSemana > 1 ? `las ${nuevo.herramientasDeLaSemana}` : 'todas'}
                  </Link>
                </span>
                <ul className="grid grid-cols-4 gap-2">
                  {nuevo.herramientas.map((h) => (
                    <li key={h.id}>
                      <Link
                        href={rutaDeContenido('herramientas', h.id)}
                        data-nueva-herramienta={h.id}
                        title={h.titulo}
                        className="block rounded-[10px] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <PortadaDeHerramienta h={h} />
                        <span className="sr-only">{h.titulo}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  )
}
