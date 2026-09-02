import type { AgregadoNube } from './agregados'

/**
 * Dónde va cada palabra de la nube.
 *
 * Vive aparte de los componentes y es PURO por una razón concreta: en la etapa 3
 * el PDF tiene que dibujar la MISMA nube que la sala vio proyectada. Si el
 * navegador y el PDF calcularan posiciones por su cuenta, el reporte mostraría
 * un dibujo distinto del que se presentó, y nadie sabría cuál es el bueno.
 *
 * DETERMINISTA, sin `Math.random`. La proyección recalcula esto cada segundo:
 * con cualquier azar, las palabras brincarían de sitio en cada sondeo aunque no
 * hubiera llegado ninguna respuesta nueva. Para la misma entrada, la misma
 * salida — y la entrada ya viene ordenada por un criterio total desde
 * `agregados.ts`, así que tampoco depende del orden en que Postgres devolvió
 * las filas.
 */

/** Lienzo de la nube. Proporción de proyector, en unidades de viewBox. */
export const LIENZO = { ancho: 1000, alto: 520 } as const

const TAMANO_MIN = 22
const TAMANO_MAX = 104

/**
 * Ancho aproximado de un carácter respecto al tamaño de letra.
 *
 * Es una estimación, no una medición: medir de verdad exigiría el motor de
 * texto del navegador (que el PDF no tiene) o las tablas de la fuente (que el
 * navegador no expone). Lo que importa aquí es que los dos lados usen el MISMO
 * número, para que las cajas de colisión coincidan. 0.54 es el promedio de una
 * sans de peso medio y deja un poco de aire de sobra, que es el lado seguro:
 * sobra separación antes que encimarse.
 */
const FACTOR_ANCHO = 0.54
const FACTOR_ALTO = 1.12

/** Aire alrededor de cada palabra, para que no se toquen. */
const HOLGURA = 6

export type PalabraColocada = {
  palabra: string
  conteo: number
  /** Centro de la palabra. El SVG ancla al medio; el PDF resta media caja. */
  x: number
  y: number
  tamano: number
  ancho: number
  alto: number
  /** 1..5, para elegir --color-chart-N. Va por frecuencia, no por azar. */
  tono: 1 | 2 | 3 | 4 | 5
}

export type LayoutNube = {
  ancho: number
  alto: number
  palabras: PalabraColocada[]
  /** Las que no cupieron. Se reportan en vez de desaparecer en silencio. */
  omitidas: number
}

type Caja = { x1: number; y1: number; x2: number; y2: number }

function seEncima(a: Caja, b: Caja): boolean {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2)
}

/**
 * Tamaño de letra según cuántas veces se repitió.
 *
 * Raíz cuadrada y no proporción directa: con lineal, una palabra que sale diez
 * veces y otra que sale una vez quedan a escala 10:1 y la chica se vuelve
 * ilegible en un proyector. La raíz comprime el rango y mantiene el orden
 * visual, que es lo único que la sala necesita leer.
 */
function tamanoDe(conteo: number, maximo: number): number {
  if (maximo <= 1) return Math.round((TAMANO_MIN + TAMANO_MAX) / 2)
  const proporcion = Math.sqrt(conteo / maximo)
  return Math.round(TAMANO_MIN + (TAMANO_MAX - TAMANO_MIN) * proporcion)
}

export function acomodarNube(agregado: AgregadoNube): LayoutNube {
  const { ancho, alto } = LIENZO
  const centroX = ancho / 2
  const centroY = alto / 2

  const colocadas: PalabraColocada[] = []
  const cajas: Caja[] = []
  const maximo = agregado.palabras[0]?.conteo ?? 1
  let omitidas = 0

  for (const [indice, { palabra, conteo }] of agregado.palabras.entries()) {
    const tamano = tamanoDe(conteo, maximo)
    const anchoPalabra = palabra.length * tamano * FACTOR_ANCHO
    const altoPalabra = tamano * FACTOR_ALTO

    // Una palabra más ancha que el lienzo no cabe en ninguna posición. Se
    // descarta aquí en vez de gastar mil intentos de espiral en ella.
    if (anchoPalabra + HOLGURA * 2 > ancho) {
      omitidas += 1
      continue
    }

    let puesta = false
    let angulo = 0

    // Espiral de Arquímedes desde el centro: lo más repetido queda al medio y
    // lo raro se va a la orilla, que es como se lee una nube.
    for (let intento = 0; intento < 1400 && !puesta; intento += 1) {
      const radio = 2.4 * angulo
      // El seno se achata porque el lienzo es casi el doble de ancho que alto:
      // con una espiral circular, la nube se sale por arriba y por abajo mucho
      // antes de aprovechar los costados.
      const x = centroX + radio * Math.cos(angulo)
      const y = centroY + radio * Math.sin(angulo) * 0.58

      // El paso se acorta conforme crece el radio para que la espiral no deje
      // huecos grandes al alejarse.
      angulo += 0.32 / (1 + radio * 0.014)

      const caja: Caja = {
        x1: x - anchoPalabra / 2 - HOLGURA,
        y1: y - altoPalabra / 2 - HOLGURA,
        x2: x + anchoPalabra / 2 + HOLGURA,
        y2: y + altoPalabra / 2 + HOLGURA,
      }

      if (caja.x1 < 0 || caja.y1 < 0 || caja.x2 > ancho || caja.y2 > alto) continue
      if (cajas.some((otra) => seEncima(caja, otra))) continue

      cajas.push(caja)
      colocadas.push({
        palabra,
        conteo,
        x,
        y,
        tamano,
        ancho: anchoPalabra,
        alto: altoPalabra,
        tono: ((indice % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      })
      puesta = true
    }

    if (!puesta) omitidas += 1
  }

  return { ancho, alto, palabras: colocadas, omitidas }
}
