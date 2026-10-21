import 'server-only'

import { ImageResponse } from 'next/og'

import { AZUL, cargarFuentes, CYAN, DESTELLO, LIMA, Logo, NAVY, semillas, TEXTO } from '@/lib/noticias/imagen'

/**
 * La portada de cada herramienta de V-AI-P (M26, 21-oct-2026), dibujada con
 * código como las imágenes de las noticias: «dibujada con código» fue la
 * decisión de Alejandro. Todas las tarjetas de la galería hablan el mismo
 * idioma visual y ninguna depende de una captura del video.
 *
 * 720×960 (3:4) para las dos orientaciones: en la galería todas las tarjetas
 * miden lo mismo, sea el video vertical u horizontal. Arriba el pase de V-AI-P;
 * al centro el disco de «play» y la etiqueta; abajo el título. La composición
 * (luces, acento, de qué lado cae el destello) sale de un hash del título.
 */

export type DatosDePortada = {
  titulo: string
  /** La primera etiqueta de la herramienta («Contables»); null si no lleva. */
  etiqueta: string | null
  orientacion: 'horizontal' | 'vertical'
}

export const ANCHO_PORTADA = 720
export const ALTO_PORTADA = 960

/** Más corto el título, más grande la letra. */
function tamanoDelTitulo(t: string): number {
  if (t.length <= 28) return 66
  if (t.length <= 48) return 58
  if (t.length <= 72) return 50
  if (t.length <= 100) return 44
  return 38
}

function Lienzo({ d }: { d: DatosDePortada }) {
  const [s0 = 0.5, s1 = 0.5, s2 = 0.5, s3 = 0.5, s4 = 0.5] = semillas(`herramienta:${d.titulo}`)
  const acento = s0 > 0.5 ? LIMA : CYAN
  const otro = acento === LIMA ? CYAN : LIMA
  const luzA = { x: Math.round(10 + s1 * 70), y: Math.round(-10 + s2 * 35) }
  const luzB = { x: Math.round(20 + s3 * 70), y: Math.round(60 + s4 * 35) }
  const destelloIzquierda = s2 > 0.5
  const tamano = tamanoDelTitulo(d.titulo)

  return (
    <div
      style={{
        width: ANCHO_PORTADA,
        height: ALTO_PORTADA,
        display: 'flex',
        position: 'relative',
        backgroundColor: NAVY,
        backgroundImage: [
          `radial-gradient(circle at ${luzA.x}% ${luzA.y}%, rgba(0,160,219,0.42) 0%, rgba(10,26,47,0) 50%)`,
          `radial-gradient(circle at ${luzB.x}% ${luzB.y}%, rgba(0,110,150,0.55) 0%, rgba(10,26,47,0) 55%)`,
          `linear-gradient(160deg, ${NAVY} 0%, #0C2340 60%, ${NAVY} 100%)`,
        ].join(', '),
        fontFamily: 'Inter',
        color: TEXTO,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage: 'radial-gradient(circle, rgba(245,248,251,0.10) 1.4px, rgba(10,26,47,0) 1.6px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* El destello de la IA, grande y cortado por el borde. */}
      <svg
        width="560"
        height="560"
        viewBox="-50 -50 100 100"
        style={{ position: 'absolute', top: 150, ...(destelloIzquierda ? { left: -230 } : { right: -230 }) }}
      >
        <defs>
          <radialGradient id="halo">
            <stop offset="0%" stopColor={acento} stopOpacity="0.30" />
            <stop offset="100%" stopColor={acento} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="30" fill="url(#halo)" />
        <circle cx="0" cy="0" r="46" fill="none" stroke="rgba(245,248,251,0.07)" strokeWidth="0.35" />
        <circle cx="0" cy="0" r="34" fill="none" stroke="rgba(245,248,251,0.10)" strokeWidth="0.35" />
        <circle cx="0" cy="0" r="22" fill="none" stroke={acento === LIMA ? 'rgba(198,242,78,0.38)' : 'rgba(0,160,219,0.5)'} strokeWidth="0.45" />
        <path d={DESTELLO} transform="scale(2.6)" fill={acento} />
        <path d={DESTELLO} transform="translate(26 -24) scale(0.6)" fill={otro} opacity="0.85" />
      </svg>

      {/* Velo de abajo hacia arriba: el título siempre se lee. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage: 'linear-gradient(0deg, rgba(10,26,47,0.95) 0%, rgba(10,26,47,0.75) 38%, rgba(10,26,47,0) 68%)',
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '52px 56px 64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Logo />
          <div style={{ display: 'flex', width: 2, height: 30, backgroundColor: 'rgba(245,248,251,0.25)' }} />
          <div style={{ display: 'flex', fontSize: 19, fontWeight: 700, letterSpacing: 3.6, color: acento }}>HERRAMIENTA</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* El disco de «play»: es un video. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 76,
                height: 76,
                borderRadius: 999,
                backgroundColor: LIMA,
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24">
                <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" fill={NAVY} />
              </svg>
            </div>
            {d.etiqueta ? (
              <div
                style={{
                  display: 'flex',
                  padding: '10px 20px',
                  borderRadius: 999,
                  border: `1.5px solid ${acento === LIMA ? 'rgba(198,242,78,0.6)' : 'rgba(0,160,219,0.7)'}`,
                  backgroundColor: acento === LIMA ? 'rgba(198,242,78,0.12)' : 'rgba(0,160,219,0.16)',
                  fontSize: 24,
                  fontWeight: 500,
                }}
              >
                {d.etiqueta}
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: tamano,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -tamano * 0.025,
            }}
          >
            {d.titulo}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 20, fontWeight: 500, color: 'rgba(245,248,251,0.7)' }}>
            {/* Un marco del formato del video: alto y angosto, o ancho. */}
            <div
              style={{
                display: 'flex',
                width: d.orientacion === 'vertical' ? 14 : 26,
                height: d.orientacion === 'vertical' ? 24 : 16,
                borderRadius: 3,
                border: '2px solid rgba(245,248,251,0.7)',
              }}
            />
            <div style={{ display: 'flex' }}>{d.orientacion === 'vertical' ? 'Video vertical' : 'Video horizontal'}</div>
            <div style={{ display: 'flex', color: 'rgba(245,248,251,0.4)' }}>·</div>
            <div style={{ display: 'flex' }}>academia.vadai.com.mx</div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 10,
          display: 'flex',
          backgroundImage: `linear-gradient(90deg, ${CYAN} 0%, ${AZUL} 45%, ${LIMA} 100%)`,
        }}
      />
    </div>
  )
}

/** Dibuja la portada y regresa el PNG. */
export async function dibujarPortada(d: DatosDePortada): Promise<Buffer> {
  const respuesta = new ImageResponse(
    <Lienzo d={{ ...d, titulo: d.titulo.trim().slice(0, 140), etiqueta: d.etiqueta?.slice(0, 40) ?? null }} />,
    { width: ANCHO_PORTADA, height: ALTO_PORTADA, fonts: await cargarFuentes() }
  )
  return Buffer.from(await respuesta.arrayBuffer())
}
