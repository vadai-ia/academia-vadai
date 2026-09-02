import qrcode from 'qrcode-generator'

/**
 * Generación del código QR que se proyecta.
 *
 * POR QUÉ UNA DEPENDENCIA Y NO CÓDIGO PROPIO (decidido 2-sep-2026)
 * Este repo tiene el precedente contrario: para leer `.xlsx` en el alta masiva
 * se escribió el parser a mano (`lib/admin/padron.ts`) en vez de instalar la
 * librería. Aquí se decidió al revés, y la diferencia es real: leer un xlsx era
 * recorrer un ZIP y sacar dos columnas de un XML —código aburrido y verificable
 * de un vistazo—. Un QR lleva corrección Reed–Solomon sobre GF(256), ocho
 * máscaras con sus penalizaciones y bits de formato con BCH. Un error sutil en
 * la aritmética de campos finitos no lanza una excepción: produce un código que
 * **no escanea**, frente a la sala y en vivo.
 *
 * `qrcode-generator` es la implementación de referencia de Kazuhiko Arase, MIT,
 * sin dependencias propias, y es un puerto directo del algoritmo de la norma.
 *
 * Este módulo es PURO: no toca red, disco ni `node:*`. Por eso lo pueden usar
 * igual un server component, la pantalla de proyección y —en la etapa 3— el
 * generador de PDF, que necesita la misma matriz para redibujarla en vector.
 */

/**
 * Nivel de corrección de errores.
 *
 * 'M' (~15%) y no 'H' (~30%): un QR proyectado en una pantalla no se mancha ni
 * se arruga, que es contra lo que protege la corrección alta. Subirlo solo
 * agregaría módulos, y más módulos significa cuadros más chicos para la cámara
 * del que está hasta atrás del salón — justo lo contrario de lo que queremos.
 */
const CORRECCION = 'M'

/**
 * Zona de silencio. La norma pide 4 módulos de margen claro alrededor.
 *
 * No es decorativo: sin ese margen muchos lectores no encuentran el símbolo. Va
 * dentro del viewBox para que quien use el componente no tenga que acordarse.
 */
export const MARGEN = 4

export type MatrizQr = {
  /** `true` = módulo oscuro. Indexada [fila][columna]. */
  modulos: boolean[][]
  /** Módulos por lado, sin contar el margen. */
  lado: number
  /** Lado + el margen de los dos costados. Es el viewBox del SVG. */
  ladoConMargen: number
}

export function matrizQr(texto: string): MatrizQr {
  // typeNumber 0 = que la librería elija la versión más chica que quepa.
  const codigo = qrcode(0, CORRECCION)
  codigo.addData(texto)
  codigo.make()

  const lado = codigo.getModuleCount()
  const modulos: boolean[][] = []

  for (let fila = 0; fila < lado; fila += 1) {
    const renglon: boolean[] = []
    for (let columna = 0; columna < lado; columna += 1) {
      renglon.push(codigo.isDark(fila, columna))
    }
    modulos.push(renglon)
  }

  return { modulos, lado, ladoConMargen: lado + MARGEN * 2 }
}

/**
 * La matriz como un solo `d` de SVG.
 *
 * Un `<path>` con todos los módulos en vez de cientos de `<rect>`: para un QR
 * de versión 3 son 841 celdas, y novecientos elementos en el DOM de una pantalla
 * que además se está repintando con resultados en vivo se nota.
 *
 * Los módulos contiguos de un mismo renglón se funden en un solo rectángulo.
 * Además de acortar el path, elimina las costuras de un píxel que aparecen entre
 * rectángulos vecinos cuando el navegador redondea al escalar — y esas costuras
 * sí llegan a estropear una lectura.
 */
export function rutaQr({ modulos, lado }: MatrizQr): string {
  const partes: string[] = []

  for (let fila = 0; fila < lado; fila += 1) {
    const renglon = modulos[fila]
    if (!renglon) continue

    let columna = 0
    while (columna < lado) {
      if (!renglon[columna]) {
        columna += 1
        continue
      }
      let ancho = 1
      while (columna + ancho < lado && renglon[columna + ancho]) ancho += 1

      partes.push(`M${columna + MARGEN} ${fila + MARGEN}h${ancho}v1h-${ancho}z`)
      columna += ancho
    }
  }

  return partes.join('')
}

/**
 * Decodifica el texto de vuelta desde la matriz.
 *
 * Existe para la suite: sin esto, "el QR se genera" es un acto de fe —se puede
 * dibujar algo cuadrado y negro que ningún teléfono lee—. Comparar la matriz
 * contra la que produce la propia librería no probaría nada, así que lo que se
 * verifica es la propiedad que de verdad importa: que un símbolo generado para
 * un texto sea DISTINTO del generado para otro, y estable para el mismo.
 *
 * La decodificación completa (deshacer máscara, leer bloques, corregir con
 * Reed–Solomon) sería reimplementar justo lo que decidimos no escribir. Ver
 * `scripts/test-encuestas.mjs` para qué se afirma en su lugar.
 */
export function huellaQr(matriz: MatrizQr): string {
  return matriz.modulos.map((f) => f.map((m) => (m ? '1' : '0')).join('')).join('')
}
