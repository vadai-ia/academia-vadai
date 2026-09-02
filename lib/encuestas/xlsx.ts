import { deflateRawSync } from 'node:zlib'

/**
 * Escritor mínimo de `.xlsx`, a mano.
 *
 * Es el espejo del lector de `lib/admin/padron.ts`, y por la misma razón: un
 * `.xlsx` es un ZIP con XML adentro, Node trae `deflateRawSync`, y la candidata
 * obvia (`xlsx`) arrastra CVEs de prototype pollution y medio megabyte de bundle
 * para lo que aquí son cinco archivos de texto y un directorio central.
 *
 * Se eligió `.xlsx` de verdad sobre un CSV con BOM porque Alejandro pidió "un
 * excel" y porque el CSV es una sola hoja plana: aquí queremos una hoja por
 * pregunta más una de participantes, y que los acentos no dependan de que Excel
 * adivine la codificación.
 *
 * DOS COSAS QUE NO HACE, a propósito:
 *
 *   - No usa tabla de cadenas compartidas (`sharedStrings.xml`). Con inline
 *     strings el archivo pesa un poco más y se escribe en una pasada. Para un
 *     padrón de cien respuestas la diferencia es de kilobytes.
 *
 *   - No escribe fórmulas. Eso vuelve imposible la inyección por CSV: un texto
 *     que empieza con `=` viaja dentro de `<is><t>`, que Excel trata como texto
 *     literal sin importar su contenido. En un CSV ese mismo texto sí se
 *     evaluaría, y esta exportación lleva respuestas escritas por cualquiera que
 *     escaneó un QR.
 */

// --------------------------------------------------------------------------
// CRC-32, que es lo que el ZIP exige por cada entrada
// --------------------------------------------------------------------------

const TABLA_CRC = (() => {
  const tabla = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabla[n] = c
  }
  return tabla
})()

function crc32(datos: Buffer): number {
  let c = -1
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

// --------------------------------------------------------------------------
// XML
// --------------------------------------------------------------------------

/** Tope de caracteres por celda que impone el propio formato. */
const TOPE_CELDA = 32767

/**
 * Escapa para XML y quita lo que rompería el archivo.
 *
 * Los caracteres de control (salvo tabulador, salto de línea y retorno) no son
 * XML válido: si uno se cuela, Excel declara el libro corrupto y no muestra
 * nada. Alguien puede pegar uno desde su teléfono sin darse cuenta, así que se
 * filtran aquí y no se confía en la entrada.
 */
function escapar(texto: string): string {
  return texto
    .slice(0, TOPE_CELDA)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 0 -> A, 25 -> Z, 26 -> AA. */
function columna(indice: number): string {
  let n = indice + 1
  let nombre = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    nombre = String.fromCharCode(65 + resto) + nombre
    n = Math.floor((n - 1) / 26)
  }
  return nombre
}

export type Celda = string | number | null | undefined

export type Hoja = {
  nombre: string
  filas: Celda[][]
}

/**
 * Sanea el nombre de una hoja.
 *
 * Excel rechaza el archivo entero —no la hoja— si un nombre pasa de 31
 * caracteres o trae `: \ / ? * [ ]`. Como estos nombres salen del texto de una
 * pregunta que escribió el admin, recortarlos aquí es obligatorio.
 */
export function nombreDeHoja(crudo: string, respaldo = 'Hoja'): string {
  const limpio = crudo
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31)
  return limpio || respaldo
}

function hojaXml(hoja: Hoja): string {
  const filas = hoja.filas
    .map((fila, y) => {
      const celdas = fila
        .map((valor, x) => {
          if (valor === null || valor === undefined || valor === '') return ''
          const ref = `${columna(x)}${y + 1}`

          if (typeof valor === 'number' && Number.isFinite(valor)) {
            return `<c r="${ref}"><v>${valor}</v></c>`
          }
          // `xml:space="preserve"` para que no se coman los espacios de orilla:
          // sin él, " sí " se guarda como "sí" y una respuesta cambia.
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapar(
            String(valor)
          )}</t></is></c>`
        })
        .join('')
      return `<row r="${y + 1}">${celdas}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filas}</sheetData></worksheet>`
}

// --------------------------------------------------------------------------
// ZIP
// --------------------------------------------------------------------------

type Entrada = { nombre: string; contenido: Buffer }

/**
 * Fecha y hora en el formato MS-DOS que guarda el ZIP.
 *
 * Se pasa como parámetro y no se toma del reloj para que el mismo libro
 * produzca los mismos bytes: es lo que permite afirmar en la suite que la
 * generación es determinista, y de paso hace comparables dos exportaciones.
 */
function fechaDos(fecha: Date): { hora: number; dia: number } {
  const hora =
    (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2)
  const dia =
    ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate()
  return { hora, dia }
}

function empaquetar(entradas: Entrada[], fecha: Date): Buffer {
  const { hora, dia } = fechaDos(fecha)
  const locales: Buffer[] = []
  const central: Buffer[] = []
  let desplazamiento = 0

  for (const entrada of entradas) {
    const nombre = Buffer.from(entrada.nombre, 'utf8')
    const crudo = entrada.contenido
    const comprimido = deflateRawSync(crudo, { level: 9 })
    const suma = crc32(crudo)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0) // firma de cabecera local
    local.writeUInt16LE(20, 4) // versión necesaria
    local.writeUInt16LE(0x0800, 6) // bandera: nombres en UTF-8
    local.writeUInt16LE(8, 8) // método: deflate
    local.writeUInt16LE(hora, 10)
    local.writeUInt16LE(dia, 12)
    local.writeUInt32LE(suma, 14)
    local.writeUInt32LE(comprimido.length, 18)
    local.writeUInt32LE(crudo.length, 22)
    local.writeUInt16LE(nombre.length, 26)
    local.writeUInt16LE(0, 28) // sin campo extra

    locales.push(local, nombre, comprimido)

    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0) // firma de directorio central
    dir.writeUInt16LE(20, 4) // versión del creador
    dir.writeUInt16LE(20, 6) // versión necesaria
    dir.writeUInt16LE(0x0800, 8)
    dir.writeUInt16LE(8, 10)
    dir.writeUInt16LE(hora, 12)
    dir.writeUInt16LE(dia, 14)
    dir.writeUInt32LE(suma, 16)
    dir.writeUInt32LE(comprimido.length, 20)
    dir.writeUInt32LE(crudo.length, 24)
    dir.writeUInt16LE(nombre.length, 28)
    dir.writeUInt16LE(0, 30) // extra
    dir.writeUInt16LE(0, 32) // comentario
    dir.writeUInt16LE(0, 34) // disco
    dir.writeUInt16LE(0, 36) // atributos internos
    dir.writeUInt32LE(0, 38) // atributos externos
    dir.writeUInt32LE(desplazamiento, 42)

    central.push(dir, nombre)
    desplazamiento += local.length + nombre.length + comprimido.length
  }

  const cuerpo = Buffer.concat(locales)
  const directorio = Buffer.concat(central)

  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0) // firma de fin de directorio central
  fin.writeUInt16LE(0, 4) // disco
  fin.writeUInt16LE(0, 6) // disco donde empieza el directorio
  fin.writeUInt16LE(entradas.length, 8)
  fin.writeUInt16LE(entradas.length, 10)
  fin.writeUInt32LE(directorio.length, 12)
  fin.writeUInt32LE(cuerpo.length, 16)
  fin.writeUInt16LE(0, 20) // sin comentario

  return Buffer.concat([cuerpo, directorio, fin])
}

// --------------------------------------------------------------------------
// El libro
// --------------------------------------------------------------------------

const XML = (s: string) => Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`, 'utf8')

/**
 * Arma un `.xlsx` con las hojas que se le den.
 *
 * Los nombres de hoja se sanean y se hacen únicos: dos preguntas que empiezan
 * igual producirían el mismo nombre recortado a 31 caracteres, y Excel rechaza
 * un libro con hojas repetidas.
 */
export function libroXlsx(hojas: Hoja[], fecha = new Date()): Buffer {
  if (hojas.length === 0) throw new Error('Un libro necesita al menos una hoja.')

  const usados = new Set<string>()
  const limpias = hojas.map((hoja, i) => {
    let nombre = nombreDeHoja(hoja.nombre, `Hoja ${i + 1}`)
    if (usados.has(nombre)) {
      // Se le pega un sufijo y se recorta de nuevo, porque el tope de 31 manda.
      let n = 2
      let candidato = `${nombre.slice(0, 27)} (${n})`
      while (usados.has(candidato)) {
        n += 1
        candidato = `${nombre.slice(0, 27)} (${n})`
      }
      nombre = candidato
    }
    usados.add(nombre)
    return { ...hoja, nombre }
  })

  const refHojas = limpias
    .map((h, i) => `<sheet name="${escapar(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')

  const relHojas = limpias
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join('')

  const tipos = limpias
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('')

  const entradas: Entrada[] = [
    {
      nombre: '[Content_Types].xml',
      contenido: XML(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tipos}</Types>`
      ),
    },
    {
      nombre: '_rels/.rels',
      contenido: XML(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
      ),
    },
    {
      nombre: 'xl/workbook.xml',
      contenido: XML(
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${refHojas}</sheets></workbook>`
      ),
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido: XML(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relHojas}</Relationships>`
      ),
    },
    ...limpias.map((hoja, i) => ({
      nombre: `xl/worksheets/sheet${i + 1}.xml`,
      contenido: Buffer.from(hojaXml(hoja), 'utf8'),
    })),
  ]

  return empaquetar(entradas, fecha)
}
