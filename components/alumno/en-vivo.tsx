import Link from 'next/link'

import { AgregarAlCalendario } from '@/components/alumno/agregar-al-calendario'
import { BotonUnirse } from '@/components/alumno/boton-unirse'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import type { SesionDelAlumno } from '@/lib/alumno/sesiones'
import { estadoDe, type EstadoSesion } from '@/lib/calendario/estado'
import {
  celdasDelMes,
  ENCABEZADO_SEMANA,
  etiquetaRelativa,
  horaCorta,
  mesDe,
  mesVecino,
  nombreMes,
  partesCdmx,
  rangoHorario,
} from '@/lib/calendario/mes'
import { cn } from '@/lib/utils'

/**
 * La pestaña "En vivo" de un curso (M14 · Fase 2).
 *
 * Las sesiones vivían dentro de "Contenido", encima del temario: con ocho
 * sesiones, para llegar a la primera lección había que pasar por ocho tarjetas
 * que no eran lo que se venía a ver. Ahora tienen su lugar: arriba la que
 * toca, en grande; abajo el mes con sus días marcados, o la lista.
 *
 * Todo esto se pinta en el SERVIDOR y en hora de la Ciudad de México. Lo único
 * que sabe la hora del navegador es `BotonUnirse`.
 */

type Datos = (s: SesionDelAlumno) => {
  id: string
  titulo: string
  descripcion: string | null
  inicio: string
  ligaUrl: string | null
  curso: string
}

const paraCalendario: Datos = (s) => ({
  id: s.id,
  titulo: s.titulo,
  descripcion: s.descripcion,
  inicio: s.programadaEn,
  ligaUrl: s.meetUrl,
  curso: s.cohorteNombre,
})

const CDMX = '(hora de la Ciudad de México)'

function Insignia({ estado }: { estado: EstadoSesion }) {
  if (estado === 'enCurso') return <Badge className="bg-vadai-lima text-vadai-navy">En curso</Badge>
  if (estado === 'porEmpezar') return <Badge variant="secondary">Empieza pronto</Badge>
  return null
}

/** El punto que late mientras algo está por pasar. */
function PuntoVivo() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
      <span className="relative inline-flex size-2 rounded-full bg-primary" />
    </span>
  )
}

/** El bloque de fecha: jue / 24 / sep. */
function BloqueFecha({ iso, grande = false, apagado = false }: { iso: string; grande?: boolean; apagado?: boolean }) {
  const p = partesCdmx(iso)
  return (
    <span
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-[10px] leading-none',
        grande ? 'w-20 gap-1 bg-primary/10 py-3 text-primary' : 'w-14 gap-0.5 bg-muted py-2',
        apagado && 'opacity-60'
      )}
    >
      <span className="text-xs">{p.diaSemanaCorto.replace('.', '')}</span>
      <span className={cn('font-medium tabular-nums', grande ? 'text-[2.25rem]' : 'text-xl')}>{p.diaNumero}</span>
      <span className="text-xs">{p.mesCorto.replace('.', '')}</span>
    </span>
  )
}

/** La que toca, en grande. */
export function HeroSesion({
  sesion,
  estado,
  hoy,
  icsDeTodas,
}: {
  sesion: SesionDelAlumno
  estado: EstadoSesion
  hoy: string
  icsDeTodas?: string
}) {
  const p = partesCdmx(sesion.programadaEn)

  return (
    <Tarjeta className="flex flex-col gap-4 p-5 sm:p-6">
      <span className="flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-primary uppercase">
        <PuntoVivo />
        {estado === 'enCurso' ? 'Está pasando ahora' : `Próxima sesión · ${etiquetaRelativa(p.fecha, hoy)}`}
      </span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <BloqueFecha iso={sesion.programadaEn} grande />

        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="flex flex-wrap items-center gap-2 text-[1.75rem] leading-tight font-medium tracking-tight text-balance">
            {sesion.titulo}
            <Insignia estado={estado} />
          </h2>
          <p className="text-sm text-muted-foreground">
            {p.diaSemanaLargo} {p.diaNumero} de {p.mesLargo} · {rangoHorario(sesion.programadaEn)} {CDMX}
          </p>
          {sesion.descripcion ? (
            <p className="text-sm whitespace-pre-line text-muted-foreground">{sesion.descripcion}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <BotonUnirse inicioIso={sesion.programadaEn} meetUrl={sesion.meetUrl} estadoInicial={estado} />
        <AgregarAlCalendario sesion={paraCalendario(sesion)} />
        {icsDeTodas ? (
          <a
            href={icsDeTodas}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Agregar todas a mi calendario
          </a>
        ) : null}
      </div>
    </Tarjeta>
  )
}

/** Cuando ya pasaron todas. */
export function SesionesTerminadas({ cursoSlug, conGrabacion }: { cursoSlug: string; conGrabacion: number }) {
  return (
    <Tarjeta className="flex flex-col items-start gap-3 border-dashed p-5 sm:p-6">
      <h2 className="text-lg font-medium">Ya terminaron las sesiones en vivo de tu generación</h2>
      <p className="text-sm text-muted-foreground">
        {conGrabacion > 0
          ? 'Las grabaciones se quedan aquí y en el temario del curso, para cuando las necesites.'
          : 'Las grabaciones aparecen aquí en cuanto el equipo las publique.'}
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href={`/curso/${cursoSlug}`}>Ir al temario</Link>
      </Button>
    </Tarjeta>
  )
}

export function SinSesiones() {
  return (
    <Tarjeta className="border-dashed px-5 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        Todavía no hay sesiones agendadas. Te avisamos aquí y en la campana en cuanto se publiquen.
      </p>
    </Tarjeta>
  )
}

/** Calendario | Lista. Dos enlaces que parecen un control, no dos botones sueltos. */
export function SelectorVista({ base, vista }: { base: string; vista: 'calendario' | 'lista' }) {
  const opciones = [
    { valor: 'calendario' as const, etiqueta: 'Calendario', href: base },
    { valor: 'lista' as const, etiqueta: 'Lista', href: `${base}?vista=lista` },
  ]

  return (
    <nav
      aria-label="Cómo ver las sesiones"
      className="grid w-full grid-cols-2 gap-1 rounded-[10px] border border-border bg-muted p-1 sm:inline-grid sm:w-auto"
    >
      {opciones.map((o) => {
        const activa = o.valor === vista
        return (
          <Link
            key={o.valor}
            href={o.href}
            scroll={false}
            aria-current={activa ? 'true' : undefined}
            data-slot="button"
            className={cn(
              buttonVariants({ variant: activa ? 'default' : 'ghost', size: 'lg' }),
              'w-full min-h-11 sm:min-h-9 sm:min-w-32 hover:translate-y-0 hover:shadow-none',
              !activa && 'text-muted-foreground hover:bg-card'
            )}
          >
            {o.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}

/** El detalle de una sesión, en la capa de arriba. Se abre desde el calendario. */
function DetalleSesion({
  sesion,
  estado,
  hoy,
  cursoSlug,
}: {
  sesion: SesionDelAlumno
  estado: EstadoSesion
  hoy: string
  cursoSlug: string
}) {
  const p = partesCdmx(sesion.programadaEn)
  const id = `sesion-${sesion.id}`

  return (
    // Sin clase de `display`: pisaría el `display:none` del popover cerrado.
    <div
      id={id}
      popover="auto"
      role="dialog"
      aria-labelledby={`${id}-titulo`}
      className="m-auto max-h-[85dvh] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-[12px] border border-border bg-popover p-0 text-popover-foreground shadow-[0_8px_32px_rgba(0,0,0,0.14)] backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs tracking-wider text-muted-foreground uppercase">
            {etiquetaRelativa(p.fecha, hoy)}
          </span>
          <h3 id={`${id}-titulo`} className="text-lg leading-snug font-medium text-balance">
            {sesion.titulo}
          </h3>
        </div>
        <button
          type="button"
          popoverTarget={id}
          popoverTargetAction="hide"
          aria-label="Cerrar"
          data-slot="icono-boton"
          className="size-11 shrink-0 rounded-md text-muted-foreground hover:bg-muted sm:size-9"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <p className="text-sm">
          {p.diaSemanaLargo} {p.diaNumero} de {p.mesLargo}
          <span className="block text-muted-foreground">
            {rangoHorario(sesion.programadaEn)} {CDMX}
          </span>
        </p>

        {sesion.descripcion ? (
          <p className="text-sm whitespace-pre-line text-muted-foreground">{sesion.descripcion}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <BotonUnirse
            inicioIso={sesion.programadaEn}
            meetUrl={sesion.meetUrl}
            estadoInicial={estado}
            tamano="sm"
          />
          {sesion.grabacionLeccionId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/curso/${cursoSlug}/${sesion.grabacionLeccionId}`}>Ver grabación</Link>
            </Button>
          ) : null}
        </div>

        {estado !== 'pasada' ? <AgregarAlCalendario sesion={paraCalendario(sesion)} /> : null}
      </div>
    </div>
  )
}

/** Un mes, con sus días y lo que cae en ellos. */
function Mes({
  anioMes,
  porDia,
  hoy,
  ahora,
}: {
  anioMes: string
  porDia: Map<string, SesionDelAlumno[]>
  hoy: string
  ahora: number
}) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-1">
      <caption className="mb-2 text-left text-lg font-medium tracking-tight">{nombreMes(anioMes)}</caption>
      <thead>
        <tr>
          {ENCABEZADO_SEMANA.map((d) => (
            <th key={d} scope="col" className="py-1 text-center text-xs font-medium text-muted-foreground">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {celdasDelMes(anioMes).map((fila, i) => (
          <tr key={i}>
            {fila.map((celda, j) =>
              celda === null ? (
                <td key={`v${j}`} className="h-14 sm:h-20" />
              ) : (
                <td
                  key={celda.fecha}
                  data-fecha={celda.fecha}
                  aria-current={celda.fecha === hoy ? 'date' : undefined}
                  className="h-14 rounded-md border border-border/60 p-1 align-top sm:h-20"
                >
                  <span
                    className={cn(
                      'inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                      celda.fecha === hoy ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {celda.dia}
                  </span>

                  {(porDia.get(celda.fecha) ?? []).map((s) => {
                    const estado = estadoDe(s.programadaEn, ahora)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        popoverTarget={`sesion-${s.id}`}
                        aria-haspopup="dialog"
                        data-sesion={s.id}
                        aria-label={`${s.titulo}, ${rangoHorario(s.programadaEn)}`}
                        className={cn(
                          'mt-1 flex min-h-11 w-full flex-col items-start justify-center rounded-md px-1 py-0.5 text-left text-[11px] leading-tight sm:min-h-8 sm:text-xs',
                          estado === 'pasada'
                            ? 'bg-muted text-muted-foreground'
                            : estado === 'proxima'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-accent text-accent-foreground'
                        )}
                      >
                        <span className="tabular-nums">{horaCorta(s.programadaEn)}</span>
                        <span className="hidden w-full truncate sm:block">{s.titulo}</span>
                      </button>
                    )
                  })}
                </td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** ← y → para moverse de mes. Son enlaces: funcionan sin JavaScript. */
function FlechaDeMes({
  href,
  hacia,
  etiqueta,
}: {
  href: string
  hacia: 'anterior' | 'siguiente'
  etiqueta: string
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={etiqueta}
      title={etiqueta}
      className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:size-9"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden
      >
        <path d={hacia === 'anterior' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </Link>
  )
}

/**
 * El calendario: UN SOLO MES, con flechas para recorrerlos.
 *
 * Antes se pintaban todos los meses del curso lado a lado. Con dos ya obligaba
 * a barrer la pantalla de un lado al otro para encontrar la siguiente sesión, y
 * en el teléfono se apilaban en una columna larguísima. Alejandro lo pidió así:
 * "solo debe verse un mes y puede moverse con botones laterales... así la
 * navegación es más atractiva para el alumno".
 *
 * El mes vive en la URL (`?mes=2026-10`), así que se comparte, el botón de
 * atrás del navegador funciona y no hace falta una línea de JavaScript.
 */
export function CalendarioSesiones({
  sesiones,
  hoy,
  ahora,
  cursoSlug,
  mes,
  base,
}: {
  sesiones: SesionDelAlumno[]
  hoy: string
  ahora: number
  cursoSlug: string
  /** El mes que se está viendo, 'YYYY-MM'. */
  mes: string
  /** La ruta de la pestaña, para armar los enlaces de las flechas. */
  base: string
}) {
  const porDia = new Map<string, SesionDelAlumno[]>()
  for (const s of sesiones) {
    const dia = partesCdmx(s.programadaEn).fecha
    porDia.set(dia, [...(porDia.get(dia) ?? []), s])
  }

  const hrefMes = (m: string) => `${base}?mes=${m}`
  const anterior = mesVecino(mes, -1)
  const siguiente = mesVecino(mes, 1)

  // Cuántas sesiones caen en el mes que se está viendo, y en los vecinos: es lo
  // que evita que alguien se pierda dando flechazos al vacío.
  const cuantasEn = (m: string) =>
    sesiones.filter((s) => mesDe(partesCdmx(s.programadaEn).fecha) === m).length

  const enEste = cuantasEn(mes)
  const mesDeHoy = mesDe(hoy)

  return (
    <div className="flex flex-col gap-4">
      {/* El encabezado del mes ES el control: nombre al centro, flechas a los
          lados. Los blancos son de 44 px para el dedo. */}
      <div className="flex items-center justify-between gap-3">
        <FlechaDeMes
          href={hrefMes(anterior)}
          hacia="anterior"
          etiqueta={`Ver ${nombreMes(anterior)}`}
        />

        <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
          <h3 className="text-lg leading-tight font-medium tracking-tight">{nombreMes(mes)}</h3>
          <span className="text-xs text-muted-foreground">
            {enEste === 0
              ? 'Sin sesiones este mes'
              : `${enEste} sesión${enEste === 1 ? '' : 'es'}`}
          </span>
        </div>

        <FlechaDeMes
          href={hrefMes(siguiente)}
          hacia="siguiente"
          etiqueta={`Ver ${nombreMes(siguiente)}`}
        />
      </div>

      <Mes anioMes={mes} porDia={porDia} hoy={hoy} ahora={ahora} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Toca un día con sesión para ver su horario, entrar y agregarla a tu calendario.
        </p>

        {/* Solo cuando hace falta: estando en el mes de hoy, sobra. */}
        {mes !== mesDeHoy ? (
          <Link
            href={hrefMes(mesDeHoy)}
            scroll={false}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Volver a {nombreMes(mesDeHoy)}
          </Link>
        ) : null}
      </div>

      {/* Los detalles viven fuera de la tabla: el navegador los sube a la capa
          de arriba y no los recorta ninguna celda. */}
      {sesiones.map((s) => (
        <DetalleSesion
          key={s.id}
          sesion={s}
          estado={estadoDe(s.programadaEn, ahora)}
          hoy={hoy}
          cursoSlug={cursoSlug}
        />
      ))}
    </div>
  )
}

function Renglon({
  sesion,
  estado,
  cursoSlug,
}: {
  sesion: SesionDelAlumno
  estado: EstadoSesion
  cursoSlug: string
}) {
  const p = partesCdmx(sesion.programadaEn)
  const pasada = estado === 'pasada'

  return (
    <Tarjeta className="flex flex-wrap items-start gap-4 p-4">
      <BloqueFecha iso={sesion.programadaEn} apagado={pasada} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{sesion.titulo}</span>
          <Insignia estado={estado} />
          {sesion.grabacionLeccionId ? (
            <Badge variant="outline" className="text-[11px]">
              Grabación
            </Badge>
          ) : null}
        </span>
        <span className="text-sm text-muted-foreground">
          {p.diaSemanaLargo} {p.diaNumero} de {p.mesLargo} · {rangoHorario(sesion.programadaEn)} {CDMX}
        </span>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <BotonUnirse
            inicioIso={sesion.programadaEn}
            meetUrl={sesion.meetUrl}
            estadoInicial={estado}
            tamano="sm"
          />
          {sesion.grabacionLeccionId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/curso/${cursoSlug}/${sesion.grabacionLeccionId}`}>Ver grabación</Link>
            </Button>
          ) : null}
          {!pasada ? <AgregarAlCalendario sesion={paraCalendario(sesion)} compacto /> : null}
        </div>
      </div>
    </Tarjeta>
  )
}

export function ListaSesiones({
  sesiones,
  ahora,
  cursoSlug,
}: {
  sesiones: SesionDelAlumno[]
  ahora: number
  cursoSlug: string
}) {
  const proximas = sesiones.filter((s) => estadoDe(s.programadaEn, ahora) !== 'pasada')
  const pasadas = sesiones.filter((s) => estadoDe(s.programadaEn, ahora) === 'pasada')

  return (
    <div className="flex flex-col gap-5">
      {proximas.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No hay sesiones próximas.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {proximas.map((s) => (
            <li key={s.id}>
              <Renglon sesion={s} estado={estadoDe(s.programadaEn, ahora)} cursoSlug={cursoSlug} />
            </li>
          ))}
        </ul>
      )}

      {pasadas.length > 0 ? (
        <details className="rounded-[10px] border border-border">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
            Sesiones anteriores ({pasadas.length})
          </summary>
          <ul className="flex flex-col gap-3 border-t border-border p-4">
            {pasadas.map((s) => (
              <li key={s.id}>
                <Renglon sesion={s} estado="pasada" cursoSlug={cursoSlug} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

/**
 * La línea que queda en "Contenido" para no perder de vista lo que sigue.
 *
 * Es UNA línea a propósito: el bloque de ocho tarjetas que vivía aquí era
 * justo lo que estorbaba para llegar al temario.
 */
export function ProximaSesionEnlace({
  sesion,
  href,
  hoy,
}: {
  sesion: SesionDelAlumno
  href: string
  hoy: string
}) {
  const p = partesCdmx(sesion.programadaEn)
  return (
    <Link
      href={href}
      className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-card px-4 py-3 transition-colors hover:border-primary/60"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-primary uppercase">
          <PuntoVivo /> Próxima sesión en vivo · {etiquetaRelativa(p.fecha, hoy)}
        </span>
        <span className="truncate text-sm">
          {sesion.titulo} · {p.diaSemanaCorto} {p.diaNumero} de {p.mesCorto}, {p.hora}
        </span>
      </span>
      <span className="text-sm text-primary">Ver sesiones →</span>
    </Link>
  )
}
