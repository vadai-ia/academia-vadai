/**
 * Lectura de padrones: CSV y XLSX.
 *
 * Vive aparte de `importar.ts` y SIN `server-only` a propósito. Es lógica pura
 * —entra texto o bytes, sale una matriz— sin secretos, sin base y sin red, así
 * que se puede probar con `node scripts/test-importar.mjs` sin levantar la app.
 *
 * Eso importa más de lo que parece: el lector de `.xlsx` está escrito a mano
 * para no meter la librería `xlsx` como dependencia —arrastra CVEs de prototype
 * pollution y medio megabyte de bundle— y un parser propio sin pruebas es una
 * promesa, no una decisión.
 *
 * POR QUÉ NO SE INSTALA UNA LIBRERÍA DE EXCEL
 *
 * CLAUDE.md prohíbe dependencias fuera del stack sin justificación. Un `.xlsx`
 * es un ZIP con XML adentro, y Node trae `inflateRawSync`: solo falta recorrer
 * el directorio central del ZIP y sacar dos entradas. Son unas cien líneas, no
 * ejecutan nada del archivo, y no pueden hacer más daño que devolver texto.
 */

import { inflateRawSync } from 'node:zlib'

/**
 * Lectura de archivos para el alta masiva.
 *
 * POR QUÉ NO SE INSTALA UNA LIBRERÍA DE EXCEL
 *
 * CLAUDE.md prohíbe dependencias fuera del stack sin justificación, y la
 * candidata obvia (`xlsx`) arrastra un historial de CVEs de prototype pollution
 * y medio megabyte de bundle. Para lo que se necesita —leer dos columnas de una
 * hoja— es desproporcionado.
 *
 * Un `.xlsx` es un ZIP con XML adentro. Node trae `inflateRawSync`, así que solo
 * falta recorrer el directorio central del ZIP y sacar dos entradas. Son unas
 * cien líneas, no ejecutan nada del archivo, y no pueden hacer más daño que
 * devolver texto.
 *
 * Se aceptan las dos rutas a propósito: `.csv` porque es lo que sale de
 * cualquier sistema, y `.xlsx` porque es lo que la gente tiene de verdad en el
 * escritorio. Pedir "guárdalo como CSV" justo cuando alguien va a dar de alta a
 * 40 alumnos es fricción en el peor momento.
 */

export type FilasLeidas =
  | { ok: true; filas: string[][] }
  | { ok: false; motivo: string }

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Parser de CSV con comillas.
 *
 * No se parte por comas a secas: un nombre como `"Pérez, Juan"` rompería la
 * fila, y ese es exactamente el dato que va a venir en un padrón real.
 *
 * El separador se detecta de la primera línea. Excel en español guarda con
 * punto y coma, no con coma, y eso solo se descubre cuando alguien sube el
 * archivo y sale todo en una columna.
 */
export function filasDeCsv(texto: string): string[][] {
  // El BOM de Excel se pega a la primera celda y arruina el nombre de columna.
  const limpio = texto.replace(/^﻿/, '')

  const primeraLinea = limpio.split(/\r?\n/)[0] ?? ''
  const separador = [';', '\t', ','].find((s) => primeraLinea.includes(s)) ?? ','

  const filas: string[][] = []
  let celda = ''
  let fila: string[] = []
  let entreComillas = false

  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i]

    if (entreComillas) {
      if (c === '"') {
        // Dos comillas seguidas dentro de un campo son una comilla literal.
        if (limpio[i + 1] === '"') {
          celda += '"'
          i += 1
        } else {
          entreComillas = false
        }
      } else {
        celda += c
      }
      continue
    }

    if (c === '"') {
      entreComillas = true
    } else if (c === separador) {
      fila.push(celda)
      celda = ''
    } else if (c === '\n') {
      fila.push(celda)
      filas.push(fila)
      fila = []
      celda = ''
    } else if (c !== '\r') {
      celda += c
    }
  }

  if (celda !== '' || fila.length > 0) {
    fila.push(celda)
    filas.push(fila)
  }

  return filas.map((f) => f.map((c) => c.trim())).filter((f) => f.some((c) => c !== ''))
}

// ---------------------------------------------------------------------------
// XLSX (ZIP + XML, sin dependencias)
// ---------------------------------------------------------------------------

/**
 * Saca una entrada del ZIP por nombre.
 *
 * Se recorre el directorio central y no las cabeceras locales: las locales
 * pueden traer el tamaño en cero y remitir a un descriptor posterior, que es
 * justo lo que hacen varias herramientas al escribir en streaming.
 */
function entradaDeZip(zip: Buffer, nombre: string): string | null {
  // Fin del directorio central: se busca su firma desde el final.
  let fin = -1
  for (let i = zip.length - 22; i >= 0 && i > zip.length - 66_000; i -= 1) {
    if (zip.readUInt32LE(i) === 0x0605_4b50) {
      fin = i
      break
    }
  }
  if (fin === -1) return null

  const total = zip.readUInt16LE(fin + 10)
  let puntero = zip.readUInt32LE(fin + 16)

  for (let n = 0; n < total; n += 1) {
    if (zip.readUInt32LE(puntero) !== 0x0201_4b50) return null

    const metodo = zip.readUInt16LE(puntero + 10)
    const comprimido = zip.readUInt32LE(puntero + 20)
    const largoNombre = zip.readUInt16LE(puntero + 28)
    const largoExtra = zip.readUInt16LE(puntero + 30)
    const largoComentario = zip.readUInt16LE(puntero + 32)
    const offsetLocal = zip.readUInt32LE(puntero + 42)
    const suNombre = zip.subarray(puntero + 46, puntero + 46 + largoNombre).toString('utf8')

    if (suNombre === nombre) {
      const nLocal = zip.readUInt16LE(offsetLocal + 26)
      const eLocal = zip.readUInt16LE(offsetLocal + 28)
      const inicio = offsetLocal + 30 + nLocal + eLocal
      const datos = zip.subarray(inicio, inicio + comprimido)

      // 0 = guardado tal cual, 8 = deflate. No hay más en un xlsx.
      if (metodo === 0) return datos.toString('utf8')
      if (metodo === 8) return inflateRawSync(datos).toString('utf8')
      return null
    }

    puntero += 46 + largoNombre + largoExtra + largoComentario
  }

  return null
}

const desescapar = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')

/** El texto de un nodo, ignorando las etiquetas de formato de adentro. */
function textoDeNodo(xml: string): string {
  const partes = [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1])
  return desescapar(partes.join(''))
}

export function filasDeXlsx(zip: Buffer): FilasLeidas {
  const hoja = entradaDeZip(zip, 'xl/worksheets/sheet1.xml')
  if (!hoja) {
    return { ok: false, motivo: 'No se pudo leer la primera hoja del Excel.' }
  }

  // Las celdas de texto guardan un índice a esta tabla, no el texto.
  const compartidas: string[] = []
  const xmlCompartidas = entradaDeZip(zip, 'xl/sharedStrings.xml')
  if (xmlCompartidas) {
    for (const m of xmlCompartidas.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      compartidas.push(textoDeNodo(m[1] ?? ''))
    }
  }

  const filas: string[][] = []

  for (const filaXml of hoja.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const fila: string[] = []

    for (const celdaXml of (filaXml[1] ?? '').matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const atributos = celdaXml[1] ?? ''
      const cuerpo = celdaXml[2] ?? ''

      // La referencia (A1, C3…) dice en qué columna va: una celda vacía no se
      // escribe, así que sin esto las columnas se recorren.
      const ref = atributos.match(/r="([A-Z]+)\d+"/)?.[1]
      if (ref) {
        let indice = 0
        for (const letra of ref) indice = indice * 26 + (letra.charCodeAt(0) - 64)
        while (fila.length < indice - 1) fila.push('')
      }

      const tipo = atributos.match(/t="([^"]+)"/)?.[1]

      if (tipo === 's') {
        const i = Number(cuerpo.match(/<v>(\d+)<\/v>/)?.[1] ?? -1)
        fila.push(compartidas[i] ?? '')
      } else if (tipo === 'inlineStr') {
        fila.push(textoDeNodo(cuerpo))
      } else {
        fila.push(desescapar(cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ''))
      }
    }

    filas.push(fila.map((c) => c.trim()))
  }

  return { ok: true, filas: filas.filter((f) => f.some((c) => c !== '')) }
}

// ---------------------------------------------------------------------------
// Interpretación
// ---------------------------------------------------------------------------

export type PersonaImportada = { email: string; nombre: string; linea: number }

export type Interpretacion = {
  personas: PersonaImportada[]
  /** Filas que no se pudieron usar, con el motivo. */
  descartadas: Array<{ linea: number; valor: string; motivo: string }>
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const normaliza = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

/**
 * Convierte las filas crudas en personas.
 *
 * No exige un formato: busca las columnas de correo y nombre por su encabezado,
 * y si no hay encabezado reconocible, toma la primera celda que parezca un
 * correo. Un padrón real llega con las columnas en cualquier orden y con
 * cabeceras como "Correo electrónico", "E-mail" o "mail".
 *
 * Los duplicados dentro del mismo archivo se descartan aquí: dar de alta dos
 * veces al mismo correo no rompe nada —`darDeAlta` es idempotente— pero llenaría
 * el reporte de ruido.
 */
export function interpretar(filas: string[][]): Interpretacion {
  const personas: PersonaImportada[] = []
  const descartadas: Interpretacion['descartadas'] = []
  const vistos = new Set<string>()

  if (filas.length === 0) return { personas, descartadas }

  const primera = filas[0] ?? []
  const cabecera = primera.map(normaliza)

  /**
   * Busca una columna por su encabezado.
   *
   * CORREGIDO 18-sep-2026. Antes era "el primer encabezado, de izquierda a
   * derecha, que CONTENGA cualquiera de las claves". Con un padrón real —
   * `Número de alumno, Empresa, Nombre, Mail`— la columna de nombre resultaba
   * ser "número de alumno", porque contiene "alumno" y va primero: a cada
   * persona se le guardaba su número como nombre, que es lo que saluda el correo
   * y lo que se imprime en el certificado.
   *
   * Ahora manda la CLAVE, no la posición: primero un encabezado que sea
   * exactamente la clave, luego uno que la contenga, y siempre en el orden de
   * prioridad de `claves`. Y una columna que por sus palabras es un
   * identificador o una empresa nunca se toma como nombre, aunque diga "nombre
   * de la empresa" o "no. de participante".
   */
  const buscaColumna = (claves: string[], palabrasVetadas: string[] = []) => {
    const candidatas = cabecera
      .map((texto, indice) => ({ texto, indice, palabras: texto.split(/[^a-z0-9]+/) }))
      .filter(
        (c) =>
          !c.palabras.some((p) => palabrasVetadas.includes(p)) &&
          // "# de alumno": el signo se pierde al partir en palabras.
          !(palabrasVetadas.length > 0 && c.texto.includes('#'))
      )

    for (const clave of claves) {
      const exacta = candidatas.find((c) => c.texto === clave)
      if (exacta) return exacta.indice
    }
    for (const clave of claves) {
      const parcial = candidatas.find((c) => c.texto.includes(clave))
      if (parcial) return parcial.indice
    }
    return -1
  }

  let iCorreo = buscaColumna(['correo', 'email', 'e-mail', 'mail'])
  let iNombre = buscaColumna(
    ['nombre', 'name', 'alumno', 'participante'],
    // Por palabra completa, no por fragmento: "apellido" contiene "id".
    [
      'numero', 'num', 'no', 'nro', 'id', 'matricula', 'folio', 'clave', 'codigo',
      'empresa', 'compania', 'company', 'organizacion', 'razon',
    ]
  )

  // Sin encabezado: se deduce de la primera fila con datos.
  const conCabecera = iCorreo !== -1
  if (!conCabecera) {
    iCorreo = primera.findIndex((c) => CORREO.test(c.trim()))
    if (iCorreo === -1) {
      return {
        personas,
        descartadas: [
          {
            linea: 1,
            valor: primera.join(' · '),
            motivo: 'No se encontró ninguna columna de correo.',
          },
        ],
      }
    }
    iNombre = primera.findIndex((c, i) => i !== iCorreo && c.trim() !== '')
  }

  for (let f = conCabecera ? 1 : 0; f < filas.length; f += 1) {
    const linea = f + 1
    const fila = filas[f] ?? []
    const email = (fila[iCorreo] ?? '').trim().toLowerCase()

    if (email === '') continue

    if (!CORREO.test(email)) {
      descartadas.push({ linea, valor: email, motivo: 'No parece un correo.' })
      continue
    }

    if (vistos.has(email)) {
      descartadas.push({ linea, valor: email, motivo: 'Repetido en el archivo.' })
      continue
    }

    vistos.add(email)
    personas.push({
      email,
      nombre: iNombre >= 0 ? (fila[iNombre] ?? '').trim() : '',
      linea,
    })
  }

  return { personas, descartadas }
}
