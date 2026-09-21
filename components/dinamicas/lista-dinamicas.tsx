import { Badge } from '@/components/ui/badge'
import { Seccion, TarjetaEnlace } from '@/components/ui-vadai/superficie'
import { formatearPonderado } from '@/lib/dinamicas/comun'
import type { DinamicaEnListaAlumno } from '@/lib/dinamicas/consultas-alumno'
import { cn } from '@/lib/utils'

/**
 * Las dinámicas del alumno, en dos secciones: abiertas y cerradas.
 *
 * Cada fila es un enlace entero (TarjetaEnlace): en el teléfono apuntar a un
 * renglón de texto es justo lo que se quiere evitar. La tercera línea dice en
 * qué va el tablero propio y cuándo cierra; a menos de 24 horas la fecha se
 * vuelve la única urgencia de la pantalla.
 *
 * Toda fecha en CDMX con su literal: el servidor y el navegador pintarían
 * distinto y React 418 se quejaría (21-sep-2026).
 */

const ZONA = 'America/Mexico_City'
const UN_DIA_MS = 24 * 60 * 60 * 1000

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ZONA,
  }).format(new Date(iso))
}

function horaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: ZONA,
  }).format(new Date(iso))
}

function diaCdmx(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: ZONA,
  }).format(new Date(ms))
}

/** "Cierra el jue 24 sep, 19:00" o, a menos de un día, "Cierra hoy a las 19:00". */
function describirCierre(iso: string, ahora: number): { texto: string; urgente: boolean } {
  const faltan = new Date(iso).getTime() - ahora
  if (faltan <= 0) return { texto: `Cerró el ${fechaCorta(iso)}`, urgente: false }
  if (faltan < UN_DIA_MS) {
    const hoy = diaCdmx(ahora) === diaCdmx(new Date(iso).getTime())
    return { texto: `Cierra ${hoy ? 'hoy' : 'mañana'} a las ${horaCorta(iso)}`, urgente: true }
  }
  return { texto: `Cierra el ${fechaCorta(iso)}`, urgente: false }
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

function lineaDeAvance(d: DinamicaEnListaAlumno): string {
  if (d.avance) {
    return `${plural(d.avance.columnas, 'proyecto', 'proyectos')} · ${plural(d.avance.completas, 'calificado', 'calificados')} por completo`
  }
  return d.tablero.tipo === 'empresa'
    ? 'Tu empresa todavía no empieza el tablero'
    : 'Todavía no empiezas tu tablero'
}

function EstadoDeDinamica({ d }: { d: DinamicaEnListaAlumno }) {
  if (d.estado === 'closed') return <Badge variant="outline">Cerrada</Badge>
  if (!d.vigente) {
    return (
      <Badge variant="outline">
        <Candado />
        Solo lectura
      </Badge>
    )
  }
  return <Badge>Abierta</Badge>
}

function Derecha({ d }: { d: DinamicaEnListaAlumno }) {
  if (d.estado === 'closed') {
    return d.mejorPonderado !== null ? (
      <span className="shrink-0 text-sm font-medium text-primary tabular-nums">
        {formatearPonderado(d.mejorPonderado)}
      </span>
    ) : (
      <span className="shrink-0 text-sm text-primary">Ver resultado →</span>
    )
  }
  return <span className="shrink-0 text-sm text-primary">{d.vigente ? 'Entrar →' : 'Ver →'}</span>
}

function Fila({
  d,
  omitirCurso,
  equipo,
  ahora,
}: {
  d: DinamicaEnListaAlumno
  omitirCurso: boolean
  equipo: boolean
  ahora: number
}) {
  const href = equipo ? `/admin/dinamicas/${d.id}/tableros` : `/dinamicas/${d.id}`
  const deQuien = d.tablero.tipo === 'empresa' ? `Tablero de ${d.tablero.empresa}` : 'Tu tablero'
  const cierre =
    d.estado === 'open' && d.cierraEn
      ? describirCierre(d.cierraEn, ahora)
      : d.estado === 'closed' && d.cerroEn
        ? { texto: `Cerró el ${fechaCorta(d.cerroEn)}`, urgente: false }
        : null

  return (
    <li>
      <TarjetaEnlace
        href={href}
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{d.titulo}</span>
            <EstadoDeDinamica d={d} />
          </span>
          <span className="text-xs text-muted-foreground">
            {omitirCurso ? deQuien : `${d.cursoTitulo} · ${deQuien}`}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {lineaDeAvance(d)}
            {cierre ? (
              <>
                {' · '}
                <span className={cn(cierre.urgente && 'font-medium text-destructive')}>
                  {cierre.texto} <span className="text-xs">(CDMX)</span>
                </span>
              </>
            ) : null}
          </span>
        </span>
        <Derecha d={d} />
      </TarjetaEnlace>
    </li>
  )
}

export function ListaDinamicas({
  dinamicas,
  omitirCurso = false,
  equipo = false,
}: {
  dinamicas: DinamicaEnListaAlumno[]
  /** Bajo /curso/[slug] el curso ya está en el encabezado. */
  omitirCurso?: boolean
  /** El equipo entra por el admin, a ver todos los tableros. */
  equipo?: boolean
}) {
  const ahora = Date.now()
  const abiertas = dinamicas.filter((d) => d.estado === 'open')
  const cerradas = dinamicas.filter((d) => d.estado === 'closed')

  return (
    <>
      {abiertas.length > 0 ? (
        <Seccion titulo="Abiertas">
          <ul className="flex flex-col gap-3">
            {abiertas.map((d) => (
              <Fila key={d.id} d={d} omitirCurso={omitirCurso} equipo={equipo} ahora={ahora} />
            ))}
          </ul>
        </Seccion>
      ) : null}

      {cerradas.length > 0 ? (
        <Seccion titulo="Cerradas">
          <ul className="flex flex-col gap-3">
            {cerradas.map((d) => (
              <Fila key={d.id} d={d} omitirCurso={omitirCurso} equipo={equipo} ahora={ahora} />
            ))}
          </ul>
        </Seccion>
      ) : null}
    </>
  )
}

function Candado() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
