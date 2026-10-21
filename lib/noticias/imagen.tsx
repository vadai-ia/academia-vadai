import 'server-only'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { ImageResponse } from 'next/og'

/**
 * La imagen de cada noticia y de cada aviso de V-AI-P, dibujada con código
 * (M24). Alejandro (20-oct-2026): «una imagen hecha a full code pero que tenga
 * un diseño innovador, impecable y muy bonito». No se usa la foto del medio:
 * todas las imágenes del muro hablan el mismo idioma visual y nunca dependen de
 * los derechos de otro.
 *
 * Navy de marca con luces de color, una retícula de puntos y el destello de la
 * IA en grande; arriba el pase de V-AI-P y el tipo; al centro el título en
 * Inter; abajo el medio, la fecha y la academia. La composición (dónde caen las
 * luces, qué acento domina, de qué lado va el destello) sale de un hash del
 * título: cada noticia se ve distinta, pero todas son de la misma familia.
 *
 * 1200×675 (16:9), el formato de la tarjeta del muro. `next/og` ya viene con
 * Next: ninguna dependencia nueva.
 */

export type DatosDeImagen = {
  tipo: 'noticia' | 'aviso'
  titulo: string
  /** «The Verge», «Anthropic», «YouTube · Canal». */
  medio?: string | null
  fecha: Date
}

const ANCHO = 1200
const ALTO = 675

const NAVY = '#0A1A2F'
const CYAN = '#00A0DB'
const AZUL = '#006E96'
const LIMA = '#C6F24E'
const TEXTO = '#F5F8FB'

let fuentes: Promise<{ name: string; data: Buffer; weight: 500 | 700 | 800; style: 'normal' }[]> | null = null

function cargarFuentes() {
  fuentes ??= Promise.all(
    (
      [
        ['Inter-Medium.ttf', 500],
        ['Inter-Bold.ttf', 700],
        ['Inter-ExtraBold.ttf', 800],
      ] as const
    ).map(async ([archivo, peso]) => ({
      name: 'Inter',
      data: await readFile(path.join(process.cwd(), 'lib', 'noticias', 'fuentes', archivo)),
      weight: peso,
      style: 'normal' as const,
    }))
  )
  return fuentes
}

/** Números estables de 0 a 1 a partir del título: la «semilla» de la composición. */
function semillas(texto: string): number[] {
  const h = createHash('sha256').update(texto).digest()
  return Array.from({ length: 8 }, (_, i) => (h[i] ?? 0) / 255)
}

function fechaLarga(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' }).format(d)
}

/** Más corto el título, más grande la letra. */
function tamanoDelTitulo(t: string): number {
  if (t.length <= 42) return 68
  if (t.length <= 64) return 60
  if (t.length <= 90) return 52
  if (t.length <= 120) return 46
  return 40
}

const BOLETO =
  'M11 1H109A10 10 0 0 1 119 11V18A6 6 0 0 0 119 30V37A10 10 0 0 1 109 47H11A10 10 0 0 1 1 37V30A6 6 0 0 0 1 18V11A10 10 0 0 1 11 1Z'
const DESTELLO = 'M0 -6C0.6 -2 2 -0.6 6 0C2 0.6 0.6 2 0 6C-0.6 2 -2 0.6 -6 0C-2 -0.6 -0.6 -2 0 -6Z'

/**
 * El pase de V-AI-P (components/marca/logo-vaip.tsx) a escala 1.25. `next/og`
 * no dibuja `<text>` dentro de un SVG: el contorno, la placa y el destello van
 * en SVG y las letras encima, como texto con Inter.
 */
function Logo() {
  const letra = { position: 'absolute', top: 0, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 } as const
  return (
    <div style={{ position: 'relative', display: 'flex', width: 150, height: 60 }}>
      <svg width="150" height="60" viewBox="0 0 120 48" style={{ position: 'absolute', top: 0, left: 0 }}>
        <path d={BOLETO} fill="none" stroke={TEXTO} strokeWidth="2.2" />
        <rect x="38" y="10" width="44" height="28" rx="8" fill={LIMA} />
        <path d={DESTELLO} transform="translate(81 10) scale(0.85)" fill={TEXTO} />
      </svg>
      <div style={{ ...letra, left: 0, width: 57, color: TEXTO }}>V</div>
      <div style={{ ...letra, left: 47, width: 56, fontSize: 24, color: NAVY, letterSpacing: 0.6 }}>AI</div>
      <div style={{ ...letra, left: 93, width: 57, color: TEXTO }}>P</div>
    </div>
  )
}

function Lienzo({ d }: { d: DatosDeImagen }) {
  const [s0 = 0.5, s1 = 0.5, s2 = 0.5, s3 = 0.5, s4 = 0.5, s5 = 0.5] = semillas(`${d.tipo}:${d.titulo}`)
  const aviso = d.tipo === 'aviso'
  // El acento de las formas: lima para avisos; para noticias, cyan o lima según
  // la semilla. Las luces del fondo siempre son azules: el lima difuminado
  // sobre navy se ve verde oliva.
  const acento = aviso ? LIMA : s0 > 0.55 ? LIMA : CYAN
  const destelloArriba = Math.round(-10 + s1 * 90)
  const luzA = { x: Math.round(5 + s2 * 40), y: Math.round(-15 + s3 * 45) }
  const luzB = { x: Math.round(62 + s4 * 30), y: Math.round(50 + s5 * 45) }
  const tamano = tamanoDelTitulo(d.titulo)
  const eyebrow = aviso ? 'AVISO DE LA COMUNIDAD' : 'NOTICIAS DE IA'

  return (
    <div
      style={{
        width: ANCHO,
        height: ALTO,
        display: 'flex',
        position: 'relative',
        backgroundColor: NAVY,
        backgroundImage: [
          `radial-gradient(circle at ${luzA.x}% ${luzA.y}%, rgba(0,160,219,0.38) 0%, rgba(10,26,47,0) 46%)`,
          `radial-gradient(circle at ${luzB.x}% ${luzB.y}%, rgba(0,110,150,0.55) 0%, rgba(10,26,47,0) 52%)`,
          `linear-gradient(135deg, ${NAVY} 0%, #0C2340 55%, ${NAVY} 100%)`,
        ].join(', '),
        fontFamily: 'Inter',
        color: TEXTO,
        overflow: 'hidden',
      }}
    >
      {/* Retícula de puntos, más tenue hacia el centro del texto. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage: 'radial-gradient(circle, rgba(245,248,251,0.10) 1.4px, rgba(10,26,47,0) 1.6px)',
          backgroundSize: '30px 30px',
        }}
      />

      {/* El destello de la IA, en grande y cortado por el borde, con sus órbitas. */}
      <svg
        width="620"
        height="620"
        viewBox="-50 -50 100 100"
        style={{ position: 'absolute', top: destelloArriba, right: -150 }}
      >
        <defs>
          <radialGradient id="halo">
            <stop offset="0%" stopColor={acento} stopOpacity="0.32" />
            <stop offset="100%" stopColor={acento} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="30" fill="url(#halo)" />
        <circle cx="0" cy="0" r="46" fill="none" stroke="rgba(245,248,251,0.07)" strokeWidth="0.35" />
        <circle cx="0" cy="0" r="35" fill="none" stroke="rgba(245,248,251,0.10)" strokeWidth="0.35" />
        <circle cx="0" cy="0" r="23" fill="none" stroke={acento === LIMA ? 'rgba(198,242,78,0.38)' : 'rgba(0,160,219,0.5)'} strokeWidth="0.45" />
        <circle cx={s2 > 0.5 ? 35 : -35} cy="0" r="1.1" fill={acento} />
        <circle cx="0" cy={s3 > 0.5 ? 46 : -46} r="0.9" fill={TEXTO} opacity="0.7" />
        <path d={DESTELLO} transform="scale(2.9)" fill={acento} />
        <path d={DESTELLO} transform="translate(-27 -26) scale(0.75)" fill={TEXTO} opacity="0.85" />
        <path d={DESTELLO} transform="translate(30 24) scale(0.5)" fill={acento === LIMA ? CYAN : LIMA} opacity="0.85" />
      </svg>

      {/* Velo para que el título siempre se lea sobre el destello. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage: 'linear-gradient(90deg, rgba(10,26,47,0.9) 0%, rgba(10,26,47,0.7) 50%, rgba(10,26,47,0) 80%)',
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
          padding: '56px 72px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Logo />
          <div style={{ display: 'flex', width: 2, height: 34, backgroundColor: 'rgba(245,248,251,0.25)' }} />
          <div style={{ display: 'flex', fontSize: 21, fontWeight: 700, letterSpacing: 4.2, color: acento }}>{eyebrow}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 860 }}>
          <div style={{ display: 'flex', width: 84, height: 7, borderRadius: 4, backgroundColor: LIMA }} />
          <div
            style={{
              display: 'flex',
              fontSize: tamano,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -tamano * 0.025,
              color: TEXTO,
            }}
          >
            {d.titulo}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 22, fontWeight: 500 }}>
          {d.medio ? (
            <div
              style={{
                display: 'flex',
                padding: '9px 18px',
                borderRadius: 999,
                border: `1.5px solid ${acento === LIMA ? 'rgba(198,242,78,0.6)' : 'rgba(0,160,219,0.7)'}`,
                backgroundColor: acento === LIMA ? 'rgba(198,242,78,0.10)' : 'rgba(0,160,219,0.14)',
                color: TEXTO,
              }}
            >
              {aviso ? d.medio : `Fuente: ${d.medio}`}
            </div>
          ) : null}
          <div style={{ display: 'flex', color: 'rgba(245,248,251,0.72)' }}>{fechaLarga(d.fecha)}</div>
          <div style={{ display: 'flex', color: 'rgba(245,248,251,0.45)' }}>·</div>
          <div style={{ display: 'flex', color: 'rgba(245,248,251,0.72)' }}>academia.vadai.com.mx</div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, display: 'flex', backgroundImage: `linear-gradient(90deg, ${CYAN} 0%, ${AZUL} 45%, ${LIMA} 100%)` }} />
    </div>
  )
}

/** Dibuja la imagen y regresa el PNG. */
export async function dibujarImagen(d: DatosDeImagen): Promise<Buffer> {
  const respuesta = new ImageResponse(<Lienzo d={{ ...d, titulo: d.titulo.trim().slice(0, 160), medio: d.medio?.slice(0, 60) ?? null }} />, {
    width: ANCHO,
    height: ALTO,
    fonts: await cargarFuentes(),
  })
  return Buffer.from(await respuesta.arrayBuffer())
}

/** La misma imagen como respuesta HTTP (vista previa del panel). */
export async function respuestaDeImagen(d: DatosDeImagen): Promise<Response> {
  return new Response(new Uint8Array(await dibujarImagen(d)), {
    headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=300' },
  })
}
