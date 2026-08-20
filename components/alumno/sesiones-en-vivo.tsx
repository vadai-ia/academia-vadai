'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SesionDelAlumno } from '@/lib/alumno/sesiones'

/**
 * Calendario de sesiones en vivo (§3.10).
 *
 * Es client component por dos razones, ambas de reloj:
 *
 *   1. La hora se muestra en la zona DEL ALUMNO, con CDMX como referencia. En el
 *      servidor no sabemos dónde está; el navegador sí.
 *   2. El botón "Unirse" se habilita 15 minutos antes. Si eso se calculara al
 *      renderizar, una página abierta desde antes nunca lo activaría. Aquí el
 *      componente se re-evalúa cada 30 segundos.
 */

const ZONA_CDMX = 'America/Mexico_City'
const MINUTOS_ANTES = 15
/** Se considera "en curso" hasta 3 horas después: las sesiones duran 2.5 h (§0). */
const HORAS_DE_GRACIA = 3

function formatear(iso: string, zona?: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(zona ? { timeZone: zona } : {}),
  }).format(new Date(iso))
}

function zonaDelNavegador(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return ZONA_CDMX
  }
}

type Estado = 'proxima' | 'porEmpezar' | 'enCurso' | 'pasada'

function estadoDe(iso: string, ahora: number): Estado {
  const inicio = new Date(iso).getTime()
  const abre = inicio - MINUTOS_ANTES * 60_000
  const cierra = inicio + HORAS_DE_GRACIA * 60 * 60_000

  if (ahora >= cierra) return 'pasada'
  if (ahora >= inicio) return 'enCurso'
  if (ahora >= abre) return 'porEmpezar'
  return 'proxima'
}

function Fila({ sesion, ahora }: { sesion: SesionDelAlumno; ahora: number }) {
  const estado = estadoDe(sesion.programadaEn, ahora)
  const zona = zonaDelNavegador()
  const mismaZona = zona === ZONA_CDMX

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{sesion.titulo}</span>
            {estado === 'enCurso' ? (
              <Badge className="bg-vadai-lima text-vadai-navy">En curso</Badge>
            ) : null}
            {estado === 'porEmpezar' ? <Badge variant="secondary">Empieza pronto</Badge> : null}
          </span>

          <span className="text-sm text-muted-foreground">
            {formatear(sesion.programadaEn)}
            {!mismaZona ? (
              <span className="text-xs"> · {formatear(sesion.programadaEn, ZONA_CDMX)} CDMX</span>
            ) : null}
          </span>

          {sesion.descripcion ? (
            <span className="text-sm text-muted-foreground">{sesion.descripcion}</span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {sesion.grabacionLeccionId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/curso/${sesion.cursoSlug}/${sesion.grabacionLeccionId}`}>
                Ver grabación
              </Link>
            </Button>
          ) : null}

          {sesion.meetUrl && estado !== 'pasada' ? (
            estado === 'proxima' ? (
              <Button variant="outline" size="sm" disabled title="Se activa 15 minutos antes">
                Unirse
              </Button>
            ) : (
              <Button asChild size="sm">
                <a href={sesion.meetUrl} target="_blank" rel="noopener noreferrer">
                  Unirse
                </a>
              </Button>
            )
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function SesionesEnVivo({ sesiones }: { sesiones: SesionDelAlumno[] }) {
  // Se arranca en 0 y se fija tras montar: si el servidor rindiera una hora y el
  // navegador otra, React se quejaría de hidratación.
  const [ahora, setAhora] = useState(0)

  useEffect(() => {
    setAhora(Date.now())
    const reloj = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(reloj)
  }, [])

  if (sesiones.length === 0) return null

  const listo = ahora > 0
  const proximas = listo
    ? sesiones.filter((s) => estadoDe(s.programadaEn, ahora) !== 'pasada')
    : sesiones
  const pasadas = listo
    ? sesiones.filter((s) => estadoDe(s.programadaEn, ahora) === 'pasada')
    : []

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Sesiones en vivo</h2>

      {proximas.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {proximas.map((sesion) => (
            <Fila key={sesion.id} sesion={sesion} ahora={ahora} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No hay sesiones próximas.
        </p>
      )}

      {pasadas.length > 0 ? (
        <details className="rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Sesiones anteriores ({pasadas.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {pasadas.map((sesion) => (
              <Fila key={sesion.id} sesion={sesion} ahora={ahora} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
