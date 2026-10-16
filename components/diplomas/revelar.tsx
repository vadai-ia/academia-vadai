'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

/**
 * La sorpresa al abrir el diploma (15-oct-2026).
 *
 * Primero un sobre sellado con su nombre; al abrirlo, el sello se rompe, cae
 * confeti con los colores de la marca y aparece el diploma con su felicitación.
 *
 * Sin JavaScript el sobre no aparece (lo esconde el <noscript>) y el diploma
 * se ve directo. Con «reducir movimiento», se abre sin confeti ni saltos.
 */

const COLORES = ['#C6F24E', '#00A0DB', '#006E96', '#FFFFFF', '#FFB489']

type Fase = 'cerrado' | 'abriendo' | 'abierto'

function Confeti() {
  const piezas = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        i,
        x: Math.random() * 100,
        retraso: Math.random() * 0.6,
        duracion: 2.4 + Math.random() * 1.8,
        giro: Math.random() * 720 - 360,
        deriva: Math.random() * 30 - 15,
        color: COLORES[i % COLORES.length],
        ancho: 6 + Math.random() * 6,
        redondo: Math.random() > 0.7,
      })),
    []
  )
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {piezas.map((p) => (
        <span
          key={p.i}
          className="vt-confeti absolute -top-6 block"
          style={
            {
              left: `${p.x}%`,
              width: p.ancho,
              height: p.redondo ? p.ancho : p.ancho * 1.8,
              borderRadius: p.redondo ? '999px' : '2px',
              background: p.color,
              animationDelay: `${p.retraso}s`,
              animationDuration: `${p.duracion}s`,
              '--giro': `${p.giro}deg`,
              '--deriva': `${p.deriva}vw`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

export function RevelarDiploma({
  nombre,
  programa,
  children,
}: {
  nombre: string
  programa: string
  children: ReactNode
}) {
  const [fase, setFase] = useState<Fase>('cerrado')
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre

  function abrir() {
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (sinMovimiento) {
      setFase('abierto')
      return
    }
    setFase('abriendo')
    window.setTimeout(() => setFase('abierto'), 1100)
  }

  return (
    <div className="relative">
      <style>{ESTILOS}</style>
      <noscript>
        <style>{'.vt-sobre{display:none!important}.vt-contenido{opacity:1!important;transform:none!important}'}</style>
      </noscript>

      {fase !== 'cerrado' ? <Confeti /> : null}

      {fase !== 'abierto' ? (
        <div className="vt-sobre absolute inset-0 z-10 flex items-center justify-center">
          <div
            className={`relative flex w-full max-w-xl flex-col items-center gap-5 overflow-hidden rounded-2xl px-6 py-10 text-center text-white shadow-xl sm:px-10 ${
              fase === 'abriendo' ? 'vt-sobre-sale' : 'vt-sobre-entra'
            }`}
            style={{ background: 'linear-gradient(135deg, #0A1A2F 0%, #006E96 70%, #00A0DB 100%)' }}
          >
            <div aria-hidden className="absolute -top-20 -right-16 size-56 rounded-full bg-[#C6F24E]/25 blur-3xl" />
            <span className="text-xs font-semibold tracking-[0.3em] text-[#C6F24E] uppercase">Para {primerNombre}</span>
            <div className={`relative grid size-24 place-items-center ${fase === 'abriendo' ? 'vt-sello-rompe' : 'vt-sello-late'}`}>
              <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden>
                <circle cx="50" cy="50" r="46" fill="#C6F24E" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#0A1A2F" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
              <svg viewBox="0 0 24 24" className="relative size-10" aria-hidden>
                <path
                  d="M12 2c.6 4.7 2.6 6.7 7.3 7.3-4.7.6-6.7 2.6-7.3 7.3-.6-4.7-2.6-6.7-7.3-7.3 4.7-.6 6.7-2.6 7.3-7.3Z"
                  fill="#0A1A2F"
                />
              </svg>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Tienes algo que te ganaste.</p>
            <p className="max-w-sm text-sm text-pretty text-white/80">
              VADAI y Total Coach prepararon tu diploma de {programa}. Ábrelo cuando estés listo.
            </p>
            <Button
              type="button"
              variant="acento"
              size="lg"
              className="h-11 px-6 text-base"
              onClick={abrir}
              disabled={fase === 'abriendo'}
            >
              {fase === 'abriendo' ? 'Abriendo…' : 'Abrir mi diploma'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className={`vt-contenido flex flex-col gap-6 ${fase === 'abierto' ? 'vt-aparece' : 'pointer-events-none opacity-0'}`}>
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            ¡Felicidades, <span className="text-primary">{primerNombre}</span>!
          </p>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Llegaste al final de {programa}. Lo que aprendiste ya está trabajando en tu empresa; este diploma
            es para que se note.
          </p>
        </div>
        {children}
        <div className="flex flex-wrap justify-center gap-3 print:hidden">
          <Button type="button" variant="acento" size="lg" onClick={() => window.print()}>
            Descargar en PDF
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => setFase('cerrado')}>
            Abrirlo otra vez
          </Button>
        </div>
      </div>
    </div>
  )
}

const ESTILOS = `
@keyframes vt-cae { 0% { transform: translate3d(0,-10vh,0) rotate(0); opacity: 1 }
  100% { transform: translate3d(var(--deriva), 110vh, 0) rotate(var(--giro)); opacity: .9 } }
.vt-confeti { animation-name: vt-cae; animation-timing-function: cubic-bezier(.2,.6,.4,1); animation-fill-mode: forwards }
@keyframes vt-entra { from { opacity: 0; transform: translateY(16px) scale(.97) } to { opacity: 1; transform: none } }
.vt-sobre-entra { animation: vt-entra .6s cubic-bezier(.2,.8,.2,1) both }
@keyframes vt-sale { 0% { transform: none; opacity: 1 } 60% { transform: scale(1.04); opacity: 1 } 100% { transform: scale(.9) translateY(-30px); opacity: 0 } }
.vt-sobre-sale { animation: vt-sale 1.1s cubic-bezier(.4,0,.2,1) forwards }
@keyframes vt-late { 0%,100% { transform: scale(1) } 50% { transform: scale(1.07) } }
.vt-sello-late { animation: vt-late 1.8s ease-in-out infinite }
@keyframes vt-rompe { 0% { transform: scale(1) rotate(0) } 35% { transform: scale(1.3) rotate(-12deg) } 100% { transform: scale(0) rotate(160deg); opacity: 0 } }
.vt-sello-rompe { animation: vt-rompe .8s cubic-bezier(.5,-0.4,.5,1.4) forwards }
@keyframes vt-aparece { from { opacity: 0; transform: translateY(24px) scale(.96) } to { opacity: 1; transform: none } }
.vt-aparece { animation: vt-aparece .9s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) {
  .vt-confeti { display: none } .vt-sobre-entra, .vt-sobre-sale, .vt-sello-late, .vt-sello-rompe, .vt-aparece { animation: none }
}
@media print {
  @page { size: letter landscape; margin: 0 }
  body * { visibility: hidden !important }
  .vt-imprimible, .vt-imprimible * { visibility: visible !important }
  .vt-imprimible { position: fixed; inset: 0; width: 100vw }
  .vt-imprimible article { width: 100vw; height: 100vh; aspect-ratio: auto }
}
`
