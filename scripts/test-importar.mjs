#!/usr/bin/env node
/**
 * test-importar.mjs — El lector de padrones para el alta masiva.
 *
 * Se prueba con Node puro, sin la app corriendo: es lógica pura y no toca la
 * base ni la red.
 *
 * Por qué existe: el lector de `.xlsx` está escrito a mano —un xlsx es un ZIP
 * con XML, y Node ya trae lo necesario— para no meter `xlsx` como dependencia,
 * que arrastra CVEs de prototype pollution y medio megabyte. Un parser propio
 * sin pruebas es una promesa; con pruebas es una decisión.
 *
 * El archivo de prueba lo genera `python` con `zipfile`, o sea OTRA herramienta:
 * si el lector solo supiera leer lo que él mismo escribe, no probaría nada.
 *
 *   node scripts/test-importar.mjs
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))

// Node 24 quita los tipos de un .ts al importarlo, así que se prueba el módulo
// REAL y no una copia. `padron.ts` está separado de `importar.ts` justo para
// esto: no importa `server-only` ni toca `File`.
const { filasDeCsv, filasDeXlsx, interpretar } = await import('../lib/admin/padron.ts')

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) =>
  resultados.push({
    grupo,
    descripcion,
    esperado: JSON.stringify(esperado),
    real: JSON.stringify(real),
    ok: JSON.stringify(esperado) === JSON.stringify(real),
  })

function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) {
    if (!porGrupo.has(r.grupo)) porGrupo.set(r.grupo, [])
    porGrupo.get(r.grupo).push(r)
  }
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))

  console.log('')
  console.log('  PRUEBA DEL LECTOR DE PADRONES')

  for (const [grupo, casos] of porGrupo) {
    console.log('')
    console.log(`  ${grupo}`)
    console.log('  ' + '─'.repeat(ancho + 30))
    for (const c of casos) {
      console.log(
        `  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ` +
          (c.ok ? c.real : `esperado ${c.esperado}, obtuvo ${c.real}`)
      )
    }
  }

  const fallidas = resultados.filter((r) => !r.ok)
  console.log('')
  console.log('  ' + '─'.repeat(ancho + 30))
  console.log(
    fallidas.length === 0
      ? `  EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- CSV -------------------------------------------------------------------

const G1 = 'CSV'

const csv = readFileSync(path.join(AQUI, '_fixtures/padron.csv'), 'utf8')
const filasCsv = filasDeCsv(csv)

afirmar(G1, 'quita el BOM de Excel', 'Correo electrónico', filasCsv[0][0])
afirmar(G1, 'detecta el punto y coma', 2, filasCsv[0].length)
afirmar(G1, 'respeta la coma dentro de comillas', 'Pérez, Ana', filasCsv[1][1])
// Cinco, no cuatro: la fila ";Sin correo" NO está vacía —tiene texto en la
// columna de nombre— y conservarla es lo correcto. Se descarta después, al
// interpretar, y con su motivo. Filtrar aquí escondería el problema.
afirmar(G1, 'conserva las filas con algo escrito', 5, filasCsv.length)
// Con `,,` y no `;;`: el separador se deduce de la primera línea, que aquí es
// "Correo" y no trae ninguno, así que cae a coma. Con coma, `;;` sería el
// texto literal ";;" — una celda con contenido, y conservarla sería correcto.
afirmar(G1, 'pero sí tira las totalmente vacías', 2,
  filasDeCsv('Correo\nana@empresa.com\n\n   \n,,\n').length)

const leidoCsv = interpretar(filasCsv)
afirmar(G1, 'saca las dos personas buenas', 2, leidoCsv.personas.length)
afirmar(G1, 'con su nombre', 'Pérez, Ana', leidoCsv.personas[0].nombre)
afirmar(G1, 'y descarta la que no es correo', 1, leidoCsv.descartadas.length)
afirmar(G1, 'diciendo por qué', 'No parece un correo.', leidoCsv.descartadas[0].motivo)

// --- XLSX ------------------------------------------------------------------

const G2 = 'XLSX'

const xlsx = readFileSync(path.join(AQUI, '_fixtures/padron.xlsx'))
const salidaXlsx = filasDeXlsx(xlsx)

afirmar(G2, 'lee el ZIP y su XML', true, salidaXlsx.ok)

if (salidaXlsx.ok) {
  const filas = salidaXlsx.filas
  afirmar(G2, 'encuentra las 5 filas', 5, filas.length)
  afirmar(G2, 'resuelve las cadenas compartidas', 'Correo', filas[0][0])
  afirmar(G2, 'conserva los acentos', 'Ana Pérez', filas[1][1])
  afirmar(G2, 'desescapa las comillas', 'Luis "El Jefe" Núñez', filas[2][2])

  // La fila 3 tiene la celda B vacía —no escrita— y datos en C. Sin respetar
  // la referencia r="C3", el valor se correría a la columna B y el nombre
  // acabaría en la columna equivocada.
  afirmar(G2, 'respeta la columna saltada', '', filas[2][1])

  const leido = interpretar(filas)
  afirmar(G2, 'saca las personas válidas', 2, leido.personas.length)
  afirmar(G2, 'descarta el correo inválido', true,
    leido.descartadas.some((d) => d.motivo === 'No parece un correo.'))
  afirmar(G2, 'y el repetido del propio archivo', true,
    leido.descartadas.some((d) => d.motivo === 'Repetido en el archivo.'))
}

// --- Casos que sí pasan en la vida real ------------------------------------

const G3 = 'PADRONES DESORDENADOS'

const sinCabecera = filasDeCsv('ana@empresa.com,Ana\nluis@empresa.com,Luis\n')
afirmar(G3, 'sin fila de encabezado', 2, interpretar(sinCabecera).personas.length)
afirmar(G3, 'toma el nombre igual', 'Ana', interpretar(sinCabecera).personas[0].nombre)

const alReves = filasDeCsv('Nombre,E-mail\nAna,ana@empresa.com\n')
afirmar(G3, 'columnas al revés', 'ana@empresa.com', interpretar(alReves).personas[0]?.email)

const soloCorreos = filasDeCsv('ana@empresa.com\nluis@empresa.com\n')
afirmar(G3, 'una sola columna de correos', 2, interpretar(soloCorreos).personas.length)

const conEspacios = filasDeCsv('Correo\n  ANA@Empresa.COM  \n')
afirmar(G3, 'normaliza espacios y mayúsculas', 'ana@empresa.com',
  interpretar(conEspacios).personas[0]?.email)

const vacio = interpretar(filasDeCsv(''))
afirmar(G3, 'un archivo vacío no revienta', 0, vacio.personas.length)

const sinCorreos = interpretar(filasDeCsv('Producto,Precio\nSilla,100\n'))
afirmar(G3, 'un archivo sin correos avisa', 1, sinCorreos.descartadas.length)

// --- La columna de nombre no es "la primera que se le parezca" ---------------
//
// El padrón real del lanzamiento traía `Número de alumno, Empresa, Nombre, Mail`.
// El lector tomaba como nombre el primer encabezado que CONTUVIERA "alumno", que
// era el número: a cada persona se le guardaba "17" como nombre, que es lo que
// saluda el correo de bienvenida y lo que se imprime en el certificado.

const G4 = 'CUÁL COLUMNA ES EL NOMBRE'

const padronReal = interpretar(
  filasDeCsv('Número de alumno,Empresa,Nombre,Mail\n17,Acme SA,Ana Pérez,ana@acme.com\n')
)
afirmar(G4, 'el padrón real: toma "Nombre", no "Número de alumno"', 'Ana Pérez',
  padronReal.personas[0]?.nombre)
afirmar(G4, 'y el correo sale de "Mail"', 'ana@acme.com', padronReal.personas[0]?.email)

const nombreDeEmpresa = interpretar(
  filasDeCsv('Nombre de la empresa,Nombre completo,Correo\nAcme SA,Ana Pérez,ana@acme.com\n')
)
afirmar(G4, '"Nombre de la empresa" no es el nombre de la persona', 'Ana Pérez',
  nombreDeEmpresa.personas[0]?.nombre)

const soloIdentificador = interpretar(
  filasDeCsv('No. de participante,Correo\n17,ana@acme.com\n')
)
afirmar(G4, 'si solo hay un identificador, el nombre queda vacío', '',
  soloIdentificador.personas[0]?.nombre)

const conGato = interpretar(filasDeCsv('# de alumno,Correo\n17,ana@acme.com\n'))
afirmar(G4, 'tampoco "# de alumno"', '', conGato.personas[0]?.nombre)

const conApellido = interpretar(
  filasDeCsv('Nombre y apellido,Correo\nAna Pérez,ana@acme.com\n')
)
afirmar(G4, '"apellido" contiene "id" y aun así es nombre', 'Ana Pérez',
  conApellido.personas[0]?.nombre)

const alumnoComoNombre = interpretar(filasDeCsv('Alumno,Correo\nAna Pérez,ana@acme.com\n'))
afirmar(G4, 'sigue aceptando "Alumno" como encabezado de nombre', 'Ana Pérez',
  alumnoComoNombre.personas[0]?.nombre)

// --- Empresa (20-sep-2026) -------------------------------------------------

const G5 = 'EMPRESA'

const conEmpresa = interpretar(
  filasDeCsv(
    'Número de alumnos,Empresa,Nombre,Mail\n1,Innovaglass,Zaid Valencia,sistemas@inovaglass.mx\n2,,Ana Pérez,ana@acme.com\n'
  )
)
afirmar(G5, 'lee la columna Empresa', 'Innovaglass', conEmpresa.personas[0]?.empresa)
afirmar(G5, 'y queda vacía cuando la celda está vacía', '', conEmpresa.personas[1]?.empresa)
afirmar(G5, 'el nombre sigue siendo el nombre', 'Zaid Valencia', conEmpresa.personas[0]?.nombre)

const sinEmpresa = interpretar(filasDeCsv('Nombre,Correo\nAna Pérez,ana@acme.com\n'))
afirmar(G5, 'sin columna Empresa no inventa nada', '', sinEmpresa.personas[0]?.empresa)

process.exitCode = imprimir() ? 0 : 1
