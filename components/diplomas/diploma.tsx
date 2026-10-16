/* eslint-disable @next/next/no-img-element */
import { Great_Vibes } from 'next/font/google'

import type { Programa } from '@/lib/diplomas/programas'

/**
 * El diploma de certificación VADAI · Total Coach (15-oct-2026).
 *
 * LOS COLORES VAN A MANO, como en el QR y el wordmark: es un documento, no una
 * pantalla. Se ve igual en tema claro u oscuro y al imprimirse, en hoja blanca.
 *
 * Todo escala con el ancho (unidades `cqw` dentro de un contenedor): el mismo
 * diploma se lee en un teléfono y se imprime en carta horizontal.
 */

const firma = Great_Vibes({ weight: '400', subsets: ['latin'], display: 'swap' })

const NAVY = '#0A1A2F'
const AZUL = '#006E96'
const CYAN = '#00A0DB'
const LIMA = '#C6F24E'

function SelloPartner() {
  const texto = 'PARTNER DE CLAUDE · MÉXICO · PARTNER DE CLAUDE · MÉXICO · '
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label="VADAI, partner de Claude en México">
      <defs>
        <path id="vt-circulo" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill={NAVY} />
      <circle cx="60" cy="60" r="52" fill="none" stroke={LIMA} strokeWidth="1.2" />
      <circle cx="60" cy="60" r="33" fill="none" stroke={CYAN} strokeWidth="0.8" />
      <text fill="#F5F8FB" fontSize="8.2" fontWeight="700" letterSpacing="1.6" fontFamily="Inter, Arial, sans-serif">
        <textPath href="#vt-circulo">{texto}</textPath>
      </text>
      <path
        d="M60 36c1.6 8.6 4.8 11.8 13.4 13.4-8.6 1.6-11.8 4.8-13.4 13.4-1.6-8.6-4.8-11.8-13.4-13.4 8.6-1.6 11.8-4.8 13.4-13.4Z"
        fill={LIMA}
      />
      <text x="60" y="79" textAnchor="middle" fill="#F5F8FB" fontSize="11" fontWeight="800" letterSpacing="1.5" fontFamily="Inter, Arial, sans-serif">
        VADAI
      </text>
    </svg>
  )
}

export function Diploma({
  programa,
  nombre,
  folio,
  urlDeVerificacion,
}: {
  programa: Programa
  nombre: string
  folio: string
  urlDeVerificacion: string
}) {
  return (
    <div className="vt-imprimible @container w-full">
      <article
        className="relative aspect-[11/8.5] w-full overflow-hidden bg-white"
        style={{ color: NAVY, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
        aria-label={`Diploma de certificación de ${nombre}`}
      >
        {/* Marco: doble filete navy y cyan, con esquinas lima. */}
        <div className="absolute inset-[2.2cqw] rounded-[0.6cqw] border-[0.35cqw]" style={{ borderColor: NAVY }} />
        <div className="absolute inset-[3.1cqw] rounded-[0.4cqw] border-[0.12cqw]" style={{ borderColor: CYAN }} />
        {[
          'left-[2.2cqw] top-[2.2cqw]',
          'right-[2.2cqw] top-[2.2cqw] rotate-90',
          'right-[2.2cqw] bottom-[2.2cqw] rotate-180',
          'left-[2.2cqw] bottom-[2.2cqw] -rotate-90',
        ].map((pos) => (
          <svg key={pos} viewBox="0 0 40 40" className={`absolute size-[4.5cqw] ${pos}`} aria-hidden>
            <path d="M0 0h40v6H6v34H0Z" fill={LIMA} />
          </svg>
        ))}
        {/* Halo suave de marca. */}
        <div
          aria-hidden
          className="absolute -top-[12cqw] left-1/2 size-[40cqw] -translate-x-1/2 rounded-full opacity-[0.07] blur-[6cqw]"
          style={{ background: CYAN }}
        />

        <div className="relative flex h-full flex-col items-center px-[8cqw] pt-[6.2cqw] pb-[5.4cqw] text-center">
          <div className="flex items-center gap-[2.4cqw]">
            <img src="/vadai-wordmark.png" alt="VADAI" className="h-[3.6cqw] w-auto" />
            <span className="h-[3.4cqw] w-[0.12cqw]" style={{ background: '#B3D0DE' }} aria-hidden />
            <img src="/totalcoach-logo.png" alt="Total Coach" className="h-[3.2cqw] w-auto" />
          </div>

          <p className="mt-[3.2cqw] text-[1.45cqw] font-bold tracking-[0.42em] uppercase" style={{ color: AZUL }}>
            Diploma de certificación
          </p>
          <p className="mt-[1.6cqw] text-[1.5cqw]" style={{ color: '#4E6572' }}>
            Se otorga a
          </p>
          <h2 className="mt-[0.6cqw] max-w-[78cqw] text-[5.2cqw] leading-[1.05] font-semibold tracking-tight text-balance">
            {nombre}
          </h2>
          <div className="mt-[1.2cqw] h-[0.45cqw] w-[16cqw] rounded-full" style={{ background: LIMA }} aria-hidden />

          <p className="mt-[2cqw] max-w-[66cqw] text-[1.6cqw] leading-[1.5] text-pretty" style={{ color: '#2B3E52' }}>
            por haber cursado el programa{' '}
            <strong className="font-semibold" style={{ color: NAVY }}>
              {programa.curso}
            </strong>
            , {programa.generacion} ({programa.periodo.toLowerCase()}), en el que aplicó la inteligencia artificial
            de Claude al trabajo real de su empresa.
          </p>

          <div className="mt-auto grid w-full grid-cols-[1fr_1fr_auto_1fr] items-end gap-[2.6cqw]">
            {programa.firmantes.slice(0, 2).map((f) => (
              <Firma key={f.nombre} nombre={f.nombre} cargo={f.cargo} />
            ))}
            <div className="mb-[0.4cqw] size-[11cqw]">
              <SelloPartner />
            </div>
            {programa.firmantes.slice(2).map((f) => (
              <Firma key={f.nombre} nombre={f.nombre} cargo={f.cargo} />
            ))}
          </div>

          <p className="mt-[2.2cqw] text-[1.05cqw]" style={{ color: '#4E6572' }}>
            Emitido el {programa.emitido} · Folio{' '}
            <span className="font-mono font-semibold" style={{ color: NAVY }}>
              {folio}
            </span>{' '}
            · Verifícalo en {urlDeVerificacion.replace(/^https?:\/\//, '')}
          </p>
        </div>
      </article>
    </div>
  )
}

function Firma({ nombre, cargo }: { nombre: string; cargo: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <span className={`${firma.className} text-[3.6cqw] leading-none whitespace-nowrap`} style={{ color: AZUL }}>
        {nombre}
      </span>
      <span className="mt-[0.5cqw] h-[0.1cqw] w-full" style={{ background: NAVY }} aria-hidden />
      <span className="mt-[0.7cqw] text-[1.2cqw] font-semibold">{nombre}</span>
      <span className="text-[1.05cqw]" style={{ color: '#4E6572' }}>
        {cargo}
      </span>
    </div>
  )
}
