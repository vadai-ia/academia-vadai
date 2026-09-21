'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { AgregarAlCalendario } from '@/components/alumno/agregar-al-calendario'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SesionDelAlumno } from '@/lib/alumno/sesiones'

/**
 * Calendario de sesiones en vivo (§3.10).
 *
 * Es client component por el reloj: el botón "Unirse" se habilita 15 minutos
 * antes, y si eso se calculara al renderizar, una página abierta desde antes
 * nunca lo activaría. Aquí el componente se re-evalúa cada 30 segundos.
 *
 * LA HORA VA SIEMPRE EN CDMX (corregido 21-sep-2026, día del lanzamiento).
 * Antes se mostraba en la zona del navegador "con CDMX como referencia". Dos
 * problemas, y los dos reales:
 *
 *   1. El servidor pintaba la fecha en UTC y el navegador en su zona: el texto
 *      no coincidía al hidratar (error 418 de React) y la página ENTERA del
 *      curso se caía con "Algo falló al cargar la página". Apareció el día
 *      que se agendaron las ocho sesiones; con la lista vacía no había nada
 *      que no coincidiera.
 *   2. Muchas PCs en México tienen la zona "Central Time (US & Canada)", con
 *      horario de verano que aquí ya no existe: la sesión de las 6 salía a
 *      las 7. Bayón lo reportó al minuto.
 *
 * Todos los alumnos están en México. Una sola hora, la de CDMX, y se dice.
 */

const ZONA_CDMX = 'America/Mexico_City'
const MINUTOS_ANTES = 15
/** Se considera "en curso" hasta 3 horas después: las sesiones duran 2.5 h (§0). */
const HORAS_DE_GRACIA = 3

function formatear(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: ZONA_CDMX,
  }).format(new Date(iso))
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
            {formatear(sesion.programadaEn)}{' '}
            <span className="text-xs">(hora de la Ciudad de México)</span>
          </span>

          {sesion.descripcion ? (
            <span className="text-sm text-muted-foreground">{sesion.descripcion}</span>
          ) : null}

          {/* Para que no se les pase ninguna: Google, Outlook o .ics (20-sep-2026). */}
          {estado !== 'pasada' ? (
            <AgregarAlCalendario
              compacto
              sesion={{
                id: sesion.id,
                titulo: sesion.titulo,
                descripcion: sesion.descripcion,
                inicio: sesion.programadaEn,
                ligaUrl: sesion.meetUrl,
                curso: sesion.cohorteNombre,
              }}
            />
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
