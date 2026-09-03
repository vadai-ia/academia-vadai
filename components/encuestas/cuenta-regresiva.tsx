'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * La cuenta regresiva antes de la primera pregunta.
 *
 * Miles de partículas vagan por la pantalla y, en cada segundo, se reúnen para
 * dibujar el número. Es el único momento "de espectáculo" de toda la dinámica,
 * y está ahí a propósito: es la señal para que la sala deje de platicar y mire
 * la pared. Por eso ocurre solo antes de la primera pregunta y nunca entre
 * preguntas —ahí lo que importa es el resultado, no el efecto—.
 *
 * TRES DECISIONES QUE NO SON DE GUSTO:
 *
 *   - Se puede SALTAR con Escape o con el botón, y avisa al padre de inmediato.
 *     Una animación que no se puede interrumpir es una animación que en algún
 *     evento va a sobrar (Apple HIG: interrumpible; y la guía de diseño pide
 *     "skip option" para experiencias inmersivas).
 *
 *   - Con `prefers-reduced-motion` no hay partículas: los números aparecen con
 *     un fundido sencillo y el mismo ritmo. El ritual se conserva, el mareo no.
 *
 *   - LOS COLORES VAN A MANO. Este es un lienzo `<canvas>` sobre una superficie
 *     navy forzada, y un canvas no puede consumir tokens CSS. Es la misma
 *     excepción que el QR y el PDF: no es texto de interfaz, es una superficie
 *     de marca. Cyan sobre navy da 6.4:1 y lima 13:1, los dos pasan AA.
 *
 * El motor es canvas 2D sin ninguna dependencia. Para lo que hace —puntos,
 * resortes y un muestreo de píxeles— una librería de partículas sería medio
 * megabyte para ahorrar cien líneas.
 */

const NAVY = '#0A1A2F'
const TONOS = ['#00A0DB', '#C6F24E', '#F5F8FB'] as const

/**
 * Los números, a nivel de módulo y NO como literal en los parámetros.
 *
 * Un `= ['3','2','1']` por defecto crea un arreglo NUEVO en cada render. El
 * motor de partículas dependía de él, así que cada vez que el reloj repintaba
 * —una vez por segundo— el efecto se desmontaba, se volvía a montar y `inicio`
 * arrancaba de cero: el índice era siempre 0 y la pantalla dibujaba un 3, otro
 * 3 y otro 3. Se veía como si contara, y no contaba.
 */
const NUMEROS_POR_DEFECTO: readonly string[] = ['3', '2', '1']

/** Cuánto dura cada número, y qué parte de ese tiempo tarda en formarse. */
const DURACION_NUMERO_MS = 1000
const TIEMPO_DE_FORMARSE_MS = 320
const TIEMPO_DE_SOLTARSE_MS = 180
const FUNDIDO_FINAL_MS = 350

type Particula = {
  x: number
  y: number
  vx: number
  vy: number
  tx: number
  ty: number
  formando: boolean
  tono: number
  radio: number
}

/**
 * Los puntos que dibujan un número.
 *
 * Se pinta el dígito en un lienzo fuera de pantalla, se lee píxel por píxel y
 * se toman muestras a intervalos regulares de lo que quedó cubierto. Así la
 * forma sale de la fuente real y no de una tabla de coordenadas a mano — y se
 * ve bien a cualquier tamaño, porque el muestreo sigue al tamaño de la letra.
 */
function puntosDelNumero(texto: string, ancho: number, alto: number): Array<[number, number]> {
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const c = lienzo.getContext('2d')
  if (!c) return []

  c.fillStyle = '#ffffff'
  c.font = `600 ${Math.round(Math.min(ancho, alto) * 0.78)}px Inter, system-ui, sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(texto, ancho / 2, alto / 2)

  const datos = c.getImageData(0, 0, ancho, alto).data
  // Un punto cada N píxeles. Más denso se ve como un bloque sólido y deja de
  // parecer hecho de partículas; menos denso deja huecos en las curvas.
  const paso = Math.max(4, Math.round(Math.min(ancho, alto) / 120))
  const puntos: Array<[number, number]> = []

  for (let y = 0; y < alto; y += paso) {
    for (let x = 0; x < ancho; x += paso) {
      if ((datos[(y * ancho + x) * 4 + 3] ?? 0) > 128) puntos.push([x, y])
    }
  }
  return puntos
}

function barajar<T>(lista: T[]): T[] {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j]!, copia[i]!]
  }
  return copia
}

export function CuentaRegresiva({
  numeros = NUMEROS_POR_DEFECTO,
  alTerminar,
}: {
  numeros?: readonly string[]
  /** Se llama UNA vez: al acabar o al saltar. */
  alTerminar: () => void
}) {
  const lienzoRef = useRef<HTMLCanvasElement>(null)
  const terminado = useRef(false)

  // En una ref para que los efectos no dependan de la IDENTIDAD del arreglo.
  // Aunque quien lo use pase una lista en línea, el motor no se reinicia.
  const numerosRef = useRef(numeros)
  numerosRef.current = numeros
  const [numeroVisible, setNumeroVisible] = useState(numeros[0] ?? '')
  const [saliendo, setSaliendo] = useState(false)
  const [sinMovimiento, setSinMovimiento] = useState(false)

  useEffect(() => {
    setSinMovimiento(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Termina una sola vez, venga de donde venga: del reloj, de Escape o del botón.
  const terminar = () => {
    if (terminado.current) return
    terminado.current = true
    setSaliendo(true)
    window.setTimeout(alTerminar, FUNDIDO_FINAL_MS)
  }

  useEffect(() => {
    function alTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        terminar()
      }
    }
    window.addEventListener('keydown', alTeclado)
    return () => window.removeEventListener('keydown', alTeclado)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El reloj de los números. Va aparte del motor de partículas para que con
  // movimiento reducido siga existiendo y el ritmo sea el mismo.
  useEffect(() => {
    const lista = numerosRef.current
    const relojes = lista.map((n, i) =>
      window.setTimeout(() => setNumeroVisible(n), i * DURACION_NUMERO_MS)
    )
    const fin = window.setTimeout(terminar, lista.length * DURACION_NUMERO_MS)
    return () => {
      for (const r of relojes) window.clearTimeout(r)
      window.clearTimeout(fin)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El motor de partículas.
  useEffect(() => {
    if (sinMovimiento) return
    const lienzo = lienzoRef.current
    if (!lienzo) return
    const ctx = lienzo.getContext('2d')
    if (!ctx) return

    // Tope de 2: en una pantalla 4K a dpr 3 serían doce millones de píxeles por
    // cuadro para un efecto que a esa distancia no se distingue.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let ancho = 0
    let alto = 0
    let particulas: Particula[] = []
    let objetivos: Array<Array<[number, number]>> = []
    let cuadro = 0
    const inicio = performance.now()

    function medir() {
      ancho = window.innerWidth
      alto = window.innerHeight
      lienzo!.width = Math.round(ancho * dpr)
      lienzo!.height = Math.round(alto * dpr)
      lienzo!.style.width = `${ancho}px`
      lienzo!.style.height = `${alto}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      // El número ocupa el centro, en un cuadro de tres cuartos del lado corto.
      const lado = Math.round(Math.min(ancho, alto) * 0.75)
      const dx = (ancho - lado) / 2
      const dy = (alto - lado) / 2
      objetivos = numerosRef.current.map((n) =>
        puntosDelNumero(n, lado, lado).map(([x, y]) => [x + dx, y + dy] as [number, number])
      )

      // Tantas partículas como puntos tenga el número más denso, más un
      // colchón de ambiente que nunca se forma y se queda vagando: es lo que
      // hace que la pantalla no se vea vacía alrededor del dígito.
      const maximo = Math.max(...objetivos.map((o) => o.length), 600)
      const total = Math.round(maximo * 1.25)
      if (particulas.length !== total) {
        particulas = Array.from({ length: total }, () => ({
          x: Math.random() * ancho,
          y: Math.random() * alto,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          tx: 0,
          ty: 0,
          formando: false,
          tono: Math.random() < 0.72 ? 0 : Math.random() < 0.6 ? 1 : 2,
          radio: 1.4 + Math.random() * 1.6,
        }))
      }
    }

    /** Reparte los puntos del número entre las partículas, al azar. */
    function asignar(indice: number) {
      const puntos = barajar(objetivos[indice] ?? [])
      const orden = barajar(particulas)
      for (let i = 0; i < orden.length; i += 1) {
        const p = orden[i]!
        const punto = puntos[i]
        if (punto) {
          p.tx = punto[0]
          p.ty = punto[1]
          p.formando = true
        } else {
          p.formando = false
        }
      }
    }

    function soltar() {
      for (const p of particulas) {
        p.formando = false
        // Un empujón hacia afuera al soltarse, para que el número "explote"
        // en vez de disolverse sin más.
        const ang = Math.atan2(p.y - alto / 2, p.x - ancho / 2)
        p.vx += Math.cos(ang) * (2 + Math.random() * 3)
        p.vy += Math.sin(ang) * (2 + Math.random() * 3)
      }
    }

    let numeroActual = -1

    function pintar(ahora: number) {
      const t = ahora - inicio
      const total = numerosRef.current.length
      const indice = Math.min(Math.floor(t / DURACION_NUMERO_MS), total - 1)
      const dentro = t - indice * DURACION_NUMERO_MS

      if (indice !== numeroActual) {
        numeroActual = indice
        asignar(indice)
      }
      // Al final de cada número, se sueltan para volver a formarse en el
      // siguiente. En el último no: se quedan formadas hasta el fundido.
      if (
        indice < total - 1 &&
        dentro > DURACION_NUMERO_MS - TIEMPO_DE_SOLTARSE_MS &&
        particulas.some((p) => p.formando)
      ) {
        soltar()
      }

      ctx!.fillStyle = NAVY
      ctx!.fillRect(0, 0, ancho, alto)

      // Un halo tenue al centro, para que el número no flote en negro plano.
      const halo = ctx!.createRadialGradient(
        ancho / 2,
        alto / 2,
        0,
        ancho / 2,
        alto / 2,
        Math.max(ancho, alto) * 0.55
      )
      halo.addColorStop(0, 'rgba(0, 160, 219, 0.14)')
      halo.addColorStop(1, 'rgba(0, 160, 219, 0)')
      ctx!.fillStyle = halo
      ctx!.fillRect(0, 0, ancho, alto)

      // Qué tan formado está el número, de 0 a 1, con salida suave. Gobierna la
      // fuerza del resorte: al principio tira fuerte, luego solo sostiene.
      const progreso = Math.min(1, dentro / TIEMPO_DE_FORMARSE_MS)
      const suave = 1 - Math.pow(1 - progreso, 3)

      for (const p of particulas) {
        if (p.formando) {
          const k = 0.045 + 0.09 * suave
          p.vx += (p.tx - p.x) * k
          p.vy += (p.ty - p.y) * k
          p.vx *= 0.78
          p.vy *= 0.78
        } else {
          p.vx += (Math.random() - 0.5) * 0.18
          p.vy += (Math.random() - 0.5) * 0.18
          const v = Math.hypot(p.vx, p.vy)
          if (v > 1.6) {
            p.vx = (p.vx / v) * 1.6
            p.vy = (p.vy / v) * 1.6
          }
        }
        p.x += p.vx
        p.y += p.vy

        // Las que vagan dan la vuelta por el otro lado; las que se están
        // formando no, porque su destino está adentro.
        if (!p.formando) {
          if (p.x < -10) p.x = ancho + 10
          if (p.x > ancho + 10) p.x = -10
          if (p.y < -10) p.y = alto + 10
          if (p.y > alto + 10) p.y = -10
        }

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.formando ? p.radio * 1.15 : p.radio, 0, Math.PI * 2)
        ctx!.fillStyle = TONOS[p.tono] ?? TONOS[0]
        ctx!.globalAlpha = p.formando ? 0.95 : 0.35
        ctx!.fill()
      }
      ctx!.globalAlpha = 1

      cuadro = window.requestAnimationFrame(pintar)
    }

    medir()
    window.addEventListener('resize', medir)
    cuadro = window.requestAnimationFrame(pintar)

    return () => {
      window.cancelAnimationFrame(cuadro)
      window.removeEventListener('resize', medir)
    }
  }, [sinMovimiento])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Empezamos en ${numeroVisible}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-vadai-navy transition-opacity duration-300 ease-in"
      style={{ opacity: saliendo ? 0 : 1 }}
    >
      {sinMovimiento ? (
        // Movimiento reducido: el mismo ritmo, sin partículas. Un número grande
        // que se funde al siguiente.
        <span
          key={numeroVisible}
          className="animate-in fade-in text-[min(60vw,60vh)] leading-none font-semibold text-vadai-texto tabular-nums duration-300"
        >
          {numeroVisible}
        </span>
      ) : (
        <canvas ref={lienzoRef} className="absolute inset-0" aria-hidden />
      )}

      {/* Solo lectores de pantalla: el canvas no dice nada. */}
      <span className="sr-only">Empezamos en {numeroVisible}</span>

      <button
        type="button"
        onClick={terminar}
        className="absolute top-5 right-5 rounded-full border border-vadai-texto/30 px-4 py-2 text-sm text-vadai-texto/80 transition-colors hover:border-vadai-texto/60 hover:text-vadai-texto focus-visible:ring-3 focus-visible:ring-vadai-cyan/60 focus-visible:outline-none"
      >
        Saltar · Esc
      </button>
    </div>
  )
}
