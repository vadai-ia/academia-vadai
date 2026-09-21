/**
 * "Agregar a mi calendario" para una sesión en vivo.
 *
 * Tres salidas, porque la gente usa tres cosas: Google Calendar y Outlook
 * abren con una liga prellenada; el `.ics` es para Apple Calendar y para
 * cualquier otro. Las tres llevan la liga de Zoom como ubicación, así que la
 * notificación del calendario trae el botón para entrar.
 *
 * Sin `server-only`: es aritmética de URLs y un archivo de texto, y lo pinta
 * un componente que también podría ser de cliente.
 *
 * La duración: las sesiones no guardan cuánto duran. Se asume la del curso
 * (2.5 h, según el mapa). Si algún día se guarda, se lee de la sesión.
 */

export const DURACION_MIN = 150

export type DatosDeSesion = {
  id: string
  titulo: string
  descripcion?: string | null
  /** ISO en UTC. */
  inicio: string
  ligaUrl?: string | null
  curso: string
}

/** 2026-09-21T19:00:00.000Z → 20260921T190000Z */
function compacto(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function fin(inicio: string): string {
  return new Date(new Date(inicio).getTime() + DURACION_MIN * 60 * 1000).toISOString()
}

function detalle(s: DatosDeSesion): string {
  return [
    `${s.curso} · sesión en vivo de VADAI Academia.`,
    s.descripcion?.trim() || null,
    s.ligaUrl ? `Entrar: ${s.ligaUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function enlaceGoogle(s: DatosDeSesion): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: s.titulo,
    dates: `${compacto(s.inicio)}/${compacto(fin(s.inicio))}`,
    details: detalle(s),
    ctz: 'America/Mexico_City',
  })
  if (s.ligaUrl) p.set('location', s.ligaUrl)
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

export function enlaceOutlook(s: DatosDeSesion): string {
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: s.titulo,
    startdt: new Date(s.inicio).toISOString(),
    enddt: fin(s.inicio),
    body: detalle(s),
  })
  if (s.ligaUrl) p.set('location', s.ligaUrl)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`
}

/** Texto de un evento .ics (RFC 5545). Líneas con CRLF, como pide la norma. */
export function generarIcs(s: DatosDeSesion): string {
  const escapar = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VADAI Academia//Sesiones en vivo//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:sesion-${s.id}@academia.vadai.com.mx`,
    `DTSTAMP:${compacto(new Date().toISOString())}`,
    `DTSTART:${compacto(s.inicio)}`,
    `DTEND:${compacto(fin(s.inicio))}`,
    `SUMMARY:${escapar(s.titulo)}`,
    `DESCRIPTION:${escapar(detalle(s))}`,
    ...(s.ligaUrl ? [`LOCATION:${escapar(s.ligaUrl)}`, `URL:${s.ligaUrl}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapar(`En 30 minutos: ${s.titulo}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lineas.join('\r\n') + '\r\n'
}
