#!/usr/bin/env node
/**
 * test-encuestas.mjs — Criterio de cierre de M12, etapas 1, 2 y 3.
 *
 * Etapa 1: modelo de datos, RLS y administración de encuestas.
 * Etapa 2: QR, los tres caminos de identidad, control en vivo y proyección.
 * Etapa 3: exportación a .xlsx y a PDF con las gráficas redibujadas en vector.
 *
 * Lo más frágil de esta etapa no es el CRUD: es la promesa de que NADIE SE
 * ADELANTA. Esa promesa no la sostiene la aplicación, la sostienen un índice
 * único parcial y un trigger. Por eso la mitad de esta suite habla directo con
 * Postgres: si mañana alguien "arregla" el builder y quita el índice, el
 * formulario seguiría viéndose bien y la garantía habría desaparecido.
 *
 * Las aserciones son propiedades, no números fijos: "cero respuestas a
 * preguntas no abiertas" sigue siendo cierto con dos participantes y con
 * doscientos.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-encuestas.mjs
 */

import { inflateRawSync, inflateSync } from 'node:zlib'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { DOMINIO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

/**
 * La marca de esta suite. EXACTA, no un patrón.
 *
 * `like 'QA %'` también casaría lo que siembra seed.mjs, y una suite que borra
 * datos de otra es un fallo intermitente esperando a ocurrir.
 */
const TITULO_QA = 'QA · Encuesta de prueba (test-encuestas)'

// --- sesión ----------------------------------------------------------------

function crearFrasco() {
  const cookies = new Map()
  return {
    guardar(respuesta) {
      for (const cruda of respuesta.headers.getSetCookie?.() ?? []) {
        const [par] = cruda.split(';')
        const i = par.indexOf('=')
        if (i === -1) continue
        const nombre = par.slice(0, i).trim()
        const valor = par.slice(i + 1).trim()
        if (valor === '' || /Max-Age=0/i.test(cruda)) cookies.delete(nombre)
        else cookies.set(nombre, valor)
      }
    },
    encabezado() {
      return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join('; ')
    },
    get tamano() {
      return cookies.size
    },
  }
}

async function iniciarSesion(email) {
  const enlace = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const cuerpo = await enlace.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) throw new Error(`No se pudo generar enlace para ${email}`)

  const frasco = crearFrasco()
  const respuesta = await fetch(
    `${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`,
    { redirect: 'manual' }
  )
  frasco.guardar(respuesta)
  return frasco
}

/** JWT de un usuario, para hablarle a PostgREST como él y probar RLS de verdad. */
async function jwtDe(email) {
  const enlace = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const cuerpo = await enlace.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token

  const verificado = await fetch(`${SUPABASE}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', token_hash: hash }),
  })
  const sesion = await verificado.json()
  return sesion.access_token ?? null
}

/** Lee una tabla del schema `academia` por PostgREST, con la llave que se le dé. */
async function leerTabla(tabla, { jwt, llave = ANON, select = 'id' } = {}) {
  const respuesta = await fetch(
    `${SUPABASE}/rest/v1/${tabla}?select=${encodeURIComponent(select)}`,
    {
      headers: {
        apikey: llave,
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        'Accept-Profile': 'academia',
      },
    }
  )
  const cuerpo = await respuesta.json().catch(() => null)
  return { status: respuesta.status, filas: Array.isArray(cuerpo) ? cuerpo : null }
}

const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    ...opciones,
    headers: {
      ...(frasco?.tamano ? { cookie: frasco.encabezado() } : {}),
      ...(opciones.headers ?? {}),
    },
  })

const texto = async (ruta, frasco) => await (await pedir(ruta, frasco)).text()

// --- reenvío de formularios (mejora progresiva) ----------------------------

function leerFormularios(html) {
  const formularios = []
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    const campos = {}
    let accion = null

    for (const etiqueta of bloque[1].matchAll(/<(?:input|select)\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      if (nombre.startsWith('$ACTION')) accion = accion ?? nombre

      const valor = etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? ''
      campos[nombre] = valor
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
    }

    if (accion) formularios.push({ accion, campos, html: bloque[0] })
  }
  return formularios
}

async function enviar(ruta, formulario, frasco, extra = {}) {
  const cuerpo = new FormData()
  for (const [nombre, valor] of Object.entries({ ...formulario.campos, ...extra })) {
    cuerpo.append(nombre, valor)
  }
  const respuesta = await pedir(ruta, frasco, { method: 'POST', body: cuerpo })
  frasco.guardar(respuesta)
  return respuesta
}

// --- lectura de ZIP y de PDF, para verificar las exportaciones -------------

/**
 * CRC-32 escrito AQUÍ, aparte del que usa `lib/encuestas/xlsx.ts`.
 *
 * Es a propósito: si la prueba reusara la implementación del escritor, un error
 * en el polinomio se cancelaría solo y el archivo pasaría la revisión estando
 * corrupto. Dos implementaciones independientes que coinciden sí dicen algo.
 */
const TABLA_CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

/**
 * Abre el ZIP por su directorio central y verifica el CRC de cada entrada.
 *
 * Devuelve `{ ok, entradas: Map<nombre, Buffer>, crcOk }`. Recorre el directorio
 * central y no las cabeceras locales por la misma razón que el lector de
 * `padron.ts`: las locales pueden traer los tamaños en cero.
 */
function leerZip(zip) {
  let fin = -1
  for (let i = zip.length - 22; i >= 0 && i > zip.length - 66_000; i -= 1) {
    if (zip.readUInt32LE(i) === 0x0605_4b50) {
      fin = i
      break
    }
  }
  if (fin === -1) return { ok: false, entradas: new Map(), crcOk: false }

  const total = zip.readUInt16LE(fin + 10)
  let puntero = zip.readUInt32LE(fin + 16)
  const entradas = new Map()
  let crcOk = true

  for (let n = 0; n < total; n += 1) {
    if (zip.readUInt32LE(puntero) !== 0x0201_4b50) return { ok: false, entradas, crcOk: false }
    const metodo = zip.readUInt16LE(puntero + 10)
    const crcEsperado = zip.readUInt32LE(puntero + 16)
    const comprimido = zip.readUInt32LE(puntero + 20)
    const largoNombre = zip.readUInt16LE(puntero + 28)
    const largoExtra = zip.readUInt16LE(puntero + 30)
    const largoComentario = zip.readUInt16LE(puntero + 32)
    const offsetLocal = zip.readUInt32LE(puntero + 42)
    const nombre = zip.subarray(puntero + 46, puntero + 46 + largoNombre).toString('utf8')

    const nLocal = zip.readUInt16LE(offsetLocal + 26)
    const eLocal = zip.readUInt16LE(offsetLocal + 28)
    const inicio = offsetLocal + 30 + nLocal + eLocal
    const datos = zip.subarray(inicio, inicio + comprimido)
    const crudo = metodo === 8 ? inflateRawSync(datos) : Buffer.from(datos)

    if (crc32(crudo) !== crcEsperado) crcOk = false
    entradas.set(nombre, crudo)
    puntero += 46 + largoNombre + largoExtra + largoComentario
  }

  return { ok: true, entradas, crcOk }
}

/**
 * Cuenta operadores de dibujo dentro de un PDF.
 *
 * Sin esto, "el PDF trae las gráficas" es un acto de fe: un archivo con solo
 * texto también pesa y también abre. Se descomprimen los flujos con
 * `/FlateDecode` y se cuentan los trazos.
 *
 * Se cuentan `m` y `l` —mover y trazar— y NO `re`, aunque el rectángulo tenga su
 * propio operador: react-pdf convierte sus `<Rect>` y `<Path>` de SVG en trazos,
 * así que un PDF con gráficas trae cientos de `l` y prácticamente ningún `re`.
 * Medirlo por `re` daba cero y parecía que las gráficas no estaban ahí.
 */
function analizarPdf(pdf) {
  const crudo = pdf.toString('latin1')
  let trazos = 0
  let flujos = 0

  const marca = /stream\r?\n/g
  let m
  while ((m = marca.exec(crudo)) !== null) {
    const inicio = m.index + m[0].length
    const fin = crudo.indexOf('endstream', inicio)
    if (fin === -1) break
    const bytes = pdf.subarray(inicio, fin)
    try {
      const texto = inflateSync(bytes).toString('latin1')
      flujos += 1
      trazos += (texto.match(/(?<=[\s\d.])[ml](?=[\s\n])/g) ?? []).length
    } catch {
      // No todos los flujos son deflate; los que no, se ignoran.
    }
  }

  return {
    trazos,
    flujos,
    paginas: (crudo.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    tieneImagenes: crudo.includes('/Subtype /Image'),
    fuentes: [...new Set((crudo.match(/\/BaseFont\s*\/([A-Za-z0-9+-]+)/g) ?? []))],
  }
}

// --- reporte ---------------------------------------------------------------

const resultados = []
const afirmar = (grupo, descripcion, esperado, real) =>
  resultados.push({ grupo, descripcion, esperado, real, ok: esperado === real })

function imprimir() {
  const porGrupo = new Map()
  for (const r of resultados) {
    if (!porGrupo.has(r.grupo)) porGrupo.set(r.grupo, [])
    porGrupo.get(r.grupo).push(r)
  }
  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))

  console.log('')
  console.log('  PRUEBA DE ENCUESTAS EN VIVO — M12 completo')
  console.log(`  App: ${APP}`)

  for (const [grupo, casos] of porGrupo) {
    console.log('')
    console.log(`  ${grupo}`)
    console.log('  ' + '─'.repeat(ancho + 34))
    for (const c of casos) {
      console.log(
        `  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ` +
          (c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`)
      )
    }
  }

  const fallidas = resultados.filter((r) => !r.ok)
  console.log('')
  console.log('  ' + '─'.repeat(ancho + 34))
  console.log(
    fallidas.length === 0
      ? `  M12 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- limpieza --------------------------------------------------------------

/**
 * Borra SOLO lo de esta suite, por título exacto.
 *
 * El `on delete cascade` de la migración se lleva preguntas, participantes y
 * respuestas, así que basta con la encuesta. Se corre también al empezar: una
 * corrida anterior que murió a medias no debe envenenar la siguiente.
 */
/**
 * Los correos que esta suite —y solo esta— siembra.
 *
 * Llevan `qa-enc` para poder recogerlos aunque una corrida muera a medias. NO es
 * el patrón amplio que prohíbe CLAUDE.md: `qa-` marca lo de prueba y `enc`
 * acota a esta suite, así que no puede casar con lo que siembra seed.mjs
 * (`qa-superadmin@`, `qa-alumno1@`…). El sufijo cambia en cada corrida porque
 * lleva el código de la encuesta, y por eso hace falta el patrón: borrar solo el
 * correo de HOY dejaría huérfanos los de las corridas que fallaron.
 */
const PATRON_CORREOS_QA = 'qa-enc%@' + DOMINIO_QA

async function limpiar(bd) {
  await bd.query('delete from academia.polls where title = $1', [TITULO_QA])

  // Las cuentas de auth se van por la Admin API antes que su perfil: al borrar
  // el usuario, la FK con `on delete cascade` se lleva el perfil solo.
  const { rows: cuentas } = await bd.query(
    'select email from academia.profiles where email like $1',
    [PATRON_CORREOS_QA]
  )
  for (const fila of cuentas) await borrarCuentaQa(fila.email)

  await bd.query('delete from academia.participants where email like $1', [PATRON_CORREOS_QA])
}

/**
 * Borra la cuenta que crea el camino "crear cuenta".
 *
 * `auth.users` está fuera del schema `academia` y la Regla Cero prohíbe tocarlo
 * por SQL, así que se hace por la Admin API, que es su interfaz legítima. Sin
 * esto, cada corrida dejaría un usuario huérfano y la siguiente encontraría el
 * correo ya tomado.
 */
async function borrarCuentaQa(email) {
  const lista = await fetch(`${SUPABASE}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  })
  const cuerpo = await lista.json().catch(() => ({}))
  const usuario = (cuerpo.users ?? []).find(
    (u) => (u.email ?? '').toLowerCase() === email.toLowerCase()
  )
  if (!usuario) return

  await fetch(`${SUPABASE}/auth/v1/admin/users/${usuario.id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  })
}

// --- main ------------------------------------------------------------------

async function main() {
  const admin = await iniciarSesion(correo.admin)
  const alumno = await iniciarSesion(correo.alumnoVigente)

  const bd = await conectarPostgres(vars)

  try {
    await limpiar(bd)

    // ====================================================================
    const G1 = 'ACCESO A LA SECCIÓN'

    afirmar(G1, 'el admin entra a /admin/encuestas', 200, (await pedir('/admin/encuestas', admin)).status)
    afirmar(G1, 'un alumno es rebotado', 307, (await pedir('/admin/encuestas', alumno)).status)
    afirmar(G1, 'sin sesión, al login', 307, (await pedir('/admin/encuestas', null)).status)
    afirmar(
      G1,
      'la navegación de admin ofrece Encuestas',
      true,
      (await texto('/admin', admin)).includes('/admin/encuestas')
    )

    // ====================================================================
    // Se crea reenviando el formulario real, sin JavaScript: es el camino que
    // CLAUDE.md exige que funcione.
    const G2 = 'CREACIÓN (server action real, sin JavaScript)'

    const listado = await texto('/admin/encuestas', admin)
    const formNueva = leerFormularios(listado).find((f) => 'title' in f.campos || f.html.includes('name="title"'))
    afirmar(G2, 'el formulario de alta está en la página', true, Boolean(formNueva))

    if (formNueva) {
      await enviar('/admin/encuestas', formNueva, admin, {
        title: TITULO_QA,
        course_id: IDS.curso,
        cohort_id: '',
        description: 'Sembrada por scripts/test-encuestas.mjs',
      })
    }

    const { rows: creada } = await bd.query(
      'select * from academia.polls where title = $1',
      [TITULO_QA]
    )
    afirmar(G2, 'la encuesta existe en Postgres', 1, creada.length)

    const encuesta = creada[0] ?? {}
    afirmar(G2, 'nace en borrador', 'draft', encuesta.status ?? null)
    afirmar(G2, 'queda ligada al curso QA', IDS.curso, encuesta.course_id ?? null)
    afirmar(G2, 'el código mide 6 caracteres', 6, (encuesta.join_code ?? '').length)
    afirmar(
      G2,
      'el código no trae letras confundibles (I, L, O, U)',
      false,
      /[ILOU]/.test(encuesta.join_code ?? '')
    )
    afirmar(
      G2,
      'el token de proyección NO es el código',
      true,
      Boolean(encuesta.projection_token) && encuesta.projection_token !== encuesta.join_code
    )
    afirmar(G2, 'y es largo, porque no se dicta', 64, (encuesta.projection_token ?? '').length)

    // El unique es lo que hace seguro reintentar en crearEncuesta().
    let codigoRepetido = null
    try {
      await bd.query(
        `insert into academia.polls (course_id, title, join_code, projection_token)
         values ($1, 'choque', $2, 'otro-token-distinto')`,
        [IDS.curso, encuesta.join_code]
      )
    } catch (error) {
      codigoRepetido = error.code
    }
    afirmar(G2, 'dos encuestas no pueden compartir código', '23505', codigoRepetido)

    // ====================================================================
    const G3 = 'PREGUNTAS'

    const rutaEncuesta = `/admin/encuestas/${encuesta.id}`
    afirmar(G3, 'el editor de la encuesta abre', 200, (await pedir(rutaEncuesta, admin)).status)

    const editor = await texto(rutaEncuesta, admin)
    const formPregunta = leerFormularios(editor).find((f) => f.html.includes('name="prompt"'))
    afirmar(G3, 'el formulario de preguntas está', true, Boolean(formPregunta))

    const aAgregar = [
      { prompt: 'QA nube', question_type: 'nube', extra: { nube_palabras: '2' } },
      {
        prompt: 'QA opción',
        question_type: 'opcion',
        extra: { opcion_a: 'Sí', opcion_b: 'No', opcion_c: '' },
      },
      {
        prompt: 'QA escala',
        question_type: 'escala',
        extra: { escala_min: '1', escala_max: '10', escala_etiqueta_min: 'Nada' },
      },
      { prompt: 'QA muro', question_type: 'muro', extra: {} },
    ]

    for (const p of aAgregar) {
      if (!formPregunta) break
      await enviar(rutaEncuesta, formPregunta, admin, {
        poll_id: encuesta.id,
        prompt: p.prompt,
        question_type: p.question_type,
        ...p.extra,
      })
    }

    const { rows: preguntas } = await bd.query(
      'select * from academia.poll_questions where poll_id = $1 order by position',
      [encuesta.id]
    )
    afirmar(G3, 'se guardaron las cuatro clases de pregunta', 4, preguntas.length)
    afirmar(
      G3,
      'cada una con su tipo',
      'nube,opcion,escala,muro',
      preguntas.map((p) => p.question_type).join(',')
    )
    afirmar(
      G3,
      'la de opción múltiple guardó sus dos opciones',
      2,
      (preguntas.find((p) => p.question_type === 'opcion')?.options ?? []).length
    )
    afirmar(
      G3,
      'la escala guardó su etiqueta',
      'Nada',
      preguntas.find((p) => p.question_type === 'escala')?.settings?.etiquetaMin ?? null
    )
    afirmar(
      G3,
      'la nube respeta el tope de 3 palabras por persona',
      true,
      (preguntas.find((p) => p.question_type === 'nube')?.settings?.maxPalabras ?? 0) <= 3
    )
    afirmar(
      G3,
      'nacen todas sin abrir',
      true,
      preguntas.every((p) => p.status === 'pending')
    )
    afirmar(
      G3,
      'las posiciones son estrictamente crecientes',
      true,
      preguntas.every((p, i) => i === 0 || p.position > preguntas[i - 1].position)
    )

    // Una de opción múltiple con una sola opción no se puede contestar.
    const antesDeRechazo = preguntas.length
    if (formPregunta) {
      await enviar(rutaEncuesta, formPregunta, admin, {
        poll_id: encuesta.id,
        prompt: 'QA opción coja',
        question_type: 'opcion',
        opcion_a: 'Única',
      })
    }
    const { rows: trasRechazo } = await bd.query(
      'select id from academia.poll_questions where poll_id = $1',
      [encuesta.id]
    )
    afirmar(G3, 'una opción múltiple con una sola opción se rechaza', antesDeRechazo, trasRechazo.length)

    // ====================================================================
    // El corazón del milestone. Lo garantiza la base, no la aplicación.
    const G4 = 'NADIE SE ADELANTA (garantías de la base)'

    const primera = preguntas[0]
    const segunda = preguntas[1]

    await bd.query("update academia.poll_questions set status = 'open' where id = $1", [primera.id])

    let dosAbiertas = null
    try {
      await bd.query("update academia.poll_questions set status = 'open' where id = $1", [
        segunda.id,
      ])
    } catch (error) {
      dosAbiertas = error.code
    }
    afirmar(G4, 'dos preguntas abiertas a la vez se rechazan', '23505', dosAbiertas)

    const { rows: abiertas } = await bd.query(
      "select count(*)::int n from academia.poll_questions where poll_id = $1 and status = 'open'",
      [encuesta.id]
    )
    afirmar(G4, 'nunca hay más de una abierta', true, abiertas[0].n <= 1)

    await bd.query("update academia.poll_questions set status = 'closed' where id = $1", [
      primera.id,
    ])

    let reabrir = false
    try {
      await bd.query("update academia.poll_questions set status = 'open' where id = $1", [
        primera.id,
      ])
    } catch {
      reabrir = true
    }
    afirmar(G4, 'una pregunta cerrada no se reabre', true, reabrir)

    let retroceder = false
    try {
      await bd.query("update academia.poll_questions set status = 'pending' where id = $1", [
        segunda.id,
      ])
      await bd.query("update academia.poll_questions set status = 'open' where id = $1", [
        segunda.id,
      ])
      await bd.query("update academia.poll_questions set status = 'pending' where id = $1", [
        segunda.id,
      ])
    } catch {
      retroceder = true
    }
    afirmar(G4, 'una abierta no puede volver a "sin abrir"', true, retroceder)

    afirmar(
      G4,
      'abrir una pregunta le pone hora de apertura',
      true,
      Boolean(
        (
          await bd.query('select opened_at from academia.poll_questions where id = $1', [
            primera.id,
          ])
        ).rows[0].opened_at
      )
    )

    // ====================================================================
    // Si el contador subiera con cada respuesta, cien personas contestando
    // despertarían a las otras noventa y nueve. Esta prueba protege la
    // decisión de transporte, no un detalle de implementación.
    const G5 = 'EL CONTADOR DE ESTADO NO SE MUEVE CON LAS RESPUESTAS'

    const versionDe = async () =>
      (await bd.query('select state_version from academia.polls where id = $1', [encuesta.id]))
        .rows[0].state_version

    // La pregunta 2 quedó abierta por el recorrido de G4. Se cierra y se abre
    // una que sigue sin estrenar: si se "abriera" la que ya está abierta, el
    // estado no cambiaría, el trigger no se dispararía —correctamente— y la
    // prueba estaría midiendo su propio desorden en vez del contador.
    const tercera = preguntas[2]

    const antesDeAbrir = await versionDe()
    await bd.query("update academia.poll_questions set status = 'closed' where id = $1", [
      segunda.id,
    ])
    await bd.query("update academia.poll_questions set status = 'open' where id = $1", [tercera.id])
    const trasAbrir = await versionDe()
    afirmar(G5, 'abrir una pregunta sí lo mueve', true, Number(trasAbrir) > Number(antesDeAbrir))

    const participante = await bd.query(
      `insert into academia.participants (email, first_name, last_name)
       values ($1, 'QA', 'Participante') returning id`,
      [`qa-encuesta-${encuesta.join_code.toLowerCase()}@academia.vadai.com.mx`]
    )
    const asistencia = await bd.query(
      `insert into academia.poll_participants (poll_id, participant_id, session_token, display_name)
       values ($1, $2, $3, 'QA Participante') returning id`,
      [encuesta.id, participante.rows[0].id, `qa-token-${encuesta.join_code}`]
    )

    const antesDeResponder = await versionDe()
    await bd.query(
      `insert into academia.poll_answers (question_id, poll_participant_id, text_value)
       values ($1, $2, 'automatización')`,
      [tercera.id, asistencia.rows[0].id]
    )
    afirmar(G5, 'una respuesta NO lo mueve', antesDeResponder, await versionDe())

    // ====================================================================
    const G6 = 'ANTI-DOBLE-ENVÍO'

    let duplicado = null
    try {
      await bd.query(
        `insert into academia.poll_answers (question_id, poll_participant_id, text_value)
         values ($1, $2, 'otra cosa')`,
        [tercera.id, asistencia.rows[0].id]
      )
    } catch (error) {
      duplicado = error.code
    }
    afirmar(G6, 'la misma persona no contesta dos veces la misma pregunta', '23505', duplicado)

    let dosValores = null
    try {
      await bd.query(
        `insert into academia.poll_answers (question_id, poll_participant_id, text_value, numeric_value)
         values ($1, $2, 'texto', 5)`,
        [primera.id, asistencia.rows[0].id]
      )
    } catch (error) {
      dosValores = error.code
    }
    afirmar(G6, 'una respuesta no puede traer dos valores a la vez', '23514', dosValores)

    let mismaPersonaDosVeces = null
    try {
      await bd.query(
        `insert into academia.poll_participants (poll_id, participant_id, session_token)
         values ($1, $2, 'qa-token-repetido')`,
        [encuesta.id, participante.rows[0].id]
      )
    } catch (error) {
      mismaPersonaDosVeces = error.code
    }
    afirmar(G6, 'una persona entra una sola vez a una encuesta', '23505', mismaPersonaDosVeces)

    // ====================================================================
    const G7 = 'RLS'

    const anon = await leerTabla('polls')
    afirmar(G7, 'anon no lee encuestas', 0, anon.filas?.length ?? 0)
    for (const tabla of ['participants', 'poll_answers', 'poll_participants']) {
      const r = await leerTabla(tabla)
      afirmar(G7, `anon no lee ${tabla}`, 0, r.filas?.length ?? 0)
    }

    const jwtAlumno = await jwtDe(correo.alumnoVigente)
    const comoAlumno = await leerTabla('polls', { jwt: jwtAlumno, select: 'id,title' })
    afirmar(
      G7,
      'un alumno inscrito SÍ ve la encuesta de su curso',
      true,
      (comoAlumno.filas ?? []).some((f) => f.title === TITULO_QA)
    )

    const respuestasComoAlumno = await leerTabla('poll_answers', { jwt: jwtAlumno })
    afirmar(G7, 'pero NO ve las respuestas de nadie', 0, respuestasComoAlumno.filas?.length ?? 0)

    const participantesComoAlumno = await leerTabla('participants', { jwt: jwtAlumno })
    afirmar(G7, 'ni el padrón de participantes', 0, participantesComoAlumno.filas?.length ?? 0)

    const escritura = await fetch(`${SUPABASE}/rest/v1/polls`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${jwtAlumno}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'academia',
      },
      body: JSON.stringify({
        course_id: IDS.curso,
        title: 'QA intento de alumno',
        join_code: 'ZZZZZZ',
        projection_token: 'intento-de-alumno',
      }),
    })
    afirmar(G7, 'un alumno no puede crear encuestas', true, escritura.status >= 400)

    // ====================================================================
    // ETAPA 2 — la dinámica en vivo
    // ====================================================================
    const G9 = 'RUTAS PÚBLICAS (sin sesión, a propósito)'

    const rutaPublica = `/e/${encuesta.join_code}`
    const rutaProyeccion = `/proyectar/${encuesta.projection_token}`

    afirmar(G9, 'el QR abre sin sesión', 200, (await pedir(rutaPublica, null)).status)
    afirmar(G9, 'la proyección abre sin sesión', 200, (await pedir(rutaProyeccion, null)).status)
    afirmar(G9, 'un código inventado da 404', 404, (await pedir('/e/ZZZZZZ', null)).status)
    afirmar(
      G9,
      'un token de proyección inventado da 404',
      404,
      (await pedir(`/proyectar/${'f'.repeat(64)}`, null)).status
    )

    // Se puede registrar ANTES de que el instructor abra nada. La pared dice
    // "ya puedes entrar" desde que se proyecta; si el celular contestara
    // "todavía no empezamos", quien escaneó con ganas al minuto uno no lo
    // vuelve a intentar, y ahí se pierde justo la captura de datos.
    const { rows: enBorrador } = await bd.query(
      'select status from academia.polls where id = $1',
      [encuesta.id]
    )
    afirmar(G9, 'la encuesta todavía está en borrador', 'draft', enBorrador[0].status)
    afirmar(
      G9,
      'y aun así el QR ya deja registrarse',
      true,
      (await texto(rutaPublica, null)).includes('name="nombre"')
    )

    const estado1 = await pedir(`/api/encuestas/${encuesta.join_code}/estado`, null)
    const etag = estado1.headers.get('etag')
    afirmar(G9, 'el endpoint de estado contesta', 200, estado1.status)
    afirmar(G9, 'y manda ETag', true, Boolean(etag))

    const estado2 = await pedir(`/api/encuestas/${encuesta.join_code}/estado`, null, {
      headers: { 'if-none-match': etag ?? '' },
    })
    afirmar(G9, 'con el mismo ETag contesta 304, sin cuerpo', 304, estado2.status)

    // La decisión de arquitectura, comprobada de punta a punta: el celular pide
    // un JSON diminuto; los agregados son solo para la proyección.
    const cuerpoEstado = await (
      await pedir(`/api/encuestas/${encuesta.join_code}/estado`, null)
    ).json()
    afirmar(
      G9,
      'el estado del celular NO trae agregados',
      false,
      Object.prototype.hasOwnProperty.call(cuerpoEstado, 'agregado')
    )

    // ====================================================================
    const G10 = 'EL CÓDIGO QR'

    const proyeccion1 = await texto(rutaProyeccion, null)
    const rutaSvg = (html) => html.match(/<path d="(M[^"]+)"/)?.[1] ?? null
    const dibujo1 = rutaSvg(proyeccion1)

    afirmar(G10, 'la proyección dibuja un QR', true, Boolean(dibujo1))
    afirmar(
      G10,
      'con su zona de silencio en el viewBox',
      true,
      /viewBox="0 0 (\d+) \1"/.test(proyeccion1)
    )
    afirmar(
      G10,
      'sobre placa blanca, para que se pueda leer',
      true,
      proyeccion1.includes('fill="#ffffff"')
    )

    const dibujo2 = rutaSvg(await texto(rutaProyeccion, null))
    afirmar(G10, 'el mismo texto produce el mismo símbolo', dibujo1, dibujo2)

    // Un símbolo distinto para un texto distinto. Es lo que descarta que se esté
    // dibujando un cuadro decorativo cualquiera.
    const otroDibujo = rutaSvg(await texto(rutaPublica, null))
    afirmar(G10, 'y otra página no dibuja el mismo', true, otroDibujo !== dibujo1)

    // ====================================================================
    const G11 = 'CONTROL EN VIVO (desde la pantalla del admin)'

    const rutaControl = `/admin/encuestas/${encuesta.id}/control`
    afirmar(G11, 'el control abre para el admin', 200, (await pedir(rutaControl, admin)).status)
    afirmar(G11, 'un alumno no entra al control', 307, (await pedir(rutaControl, alumno)).status)

    const control = await texto(rutaControl, admin)
    afirmar(G11, 'ofrece abrir la proyección', true, control.includes(rutaProyeccion))
    afirmar(G11, 'y muestra el código para la sala', true, control.includes(encuesta.join_code))

    // Abrir la última pregunta cierra la que estaba abierta. Se hace con el
    // formulario real y no con un UPDATE: es el camino que usa el admin.
    const muro = preguntas[3]
    const formAbrir = leerFormularios(control).find(
      (f) => f.campos.id === muro.id && f.campos.poll_id === encuesta.id
    )
    afirmar(G11, 'el botón de abrir está en la página', true, Boolean(formAbrir))
    if (formAbrir) await enviar(rutaControl, formAbrir, admin)

    const { rows: estados } = await bd.query(
      'select id, status from academia.poll_questions where poll_id = $1',
      [encuesta.id]
    )
    const estadoDe = (idPregunta) => estados.find((e) => e.id === idPregunta)?.status
    afirmar(G11, 'la pregunta se abrió', 'open', estadoDe(muro.id))
    afirmar(G11, 'y la anterior se cerró sola', 'closed', estadoDe(tercera.id))
    afirmar(
      G11,
      'sigue habiendo a lo sumo una abierta',
      true,
      estados.filter((e) => e.status === 'open').length <= 1
    )

    const { rows: viva } = await bd.query('select status from academia.polls where id = $1', [
      encuesta.id,
    ])
    afirmar(G11, 'abrir una pregunta pone la encuesta en vivo', 'live', viva[0].status)

    // ====================================================================
    const G12 = 'LOS TRES CAMINOS DE IDENTIDAD'

    const correoInvitado = `qa-enc-invitado-${encuesta.join_code.toLowerCase()}@${DOMINIO_QA}`
    const correoNuevo = `qa-enc-cuenta-${encuesta.join_code.toLowerCase()}@${DOMINIO_QA}`

    const formEntrada = (html) => leerFormularios(html).find((f) => f.html.includes('name="nombre"'))

    // (c) invitado: deja sus datos pero NO se le crea cuenta.
    const celInvitado = crearFrasco()
    const formInvitado = formEntrada(await texto(rutaPublica, celInvitado))
    afirmar(G12, 'el formulario de entrada está', true, Boolean(formInvitado))

    if (formInvitado) {
      const r = await enviar(rutaPublica, formInvitado, celInvitado, {
        codigo: encuesta.join_code,
        nombre: 'QA',
        apellido: 'Invitado',
        email: correoInvitado,
        telefono: '5512345678',
      })
      afirmar(G12, 'entrar como invitado no revienta', true, r.status < 500)
    }

    const { rows: invitado } = await bd.query(
      'select id, user_id, phone from academia.participants where email = $1',
      [correoInvitado]
    )
    afirmar(G12, 'se guardó a la persona', 1, invitado.length)
    afirmar(G12, 'con su teléfono, aunque sea invitado', '5512345678', invitado[0]?.phone ?? null)
    afirmar(G12, 'y SIN cuenta de auth', null, invitado[0]?.user_id ?? null)

    const { rows: perfilInvitado } = await bd.query(
      'select count(*)::int n from academia.profiles where email = $1',
      [correoInvitado]
    )
    afirmar(G12, 'no se creó ningún perfil para el invitado', 0, perfilInvitado[0].n)

    afirmar(
      G12,
      'la cookie lo reconoce al volver',
      true,
      (await texto(rutaPublica, celInvitado)).includes('QA')
    )

    // (b) cuenta nueva. El correo cae dentro del corte de resend.ts, así que la
    // cuenta se crea y NO sale ningún envío hacia un dominio sin MX.
    const celNuevo = crearFrasco()
    const formNuevo = formEntrada(await texto(rutaPublica, celNuevo))
    if (formNuevo) {
      await enviar(rutaPublica, formNuevo, celNuevo, {
        codigo: encuesta.join_code,
        nombre: 'QA',
        apellido: 'Cuenta',
        email: correoNuevo,
        telefono: '',
        crear_cuenta: 'si',
      })
    }

    const { rows: perfilNuevo } = await bd.query(
      'select role from academia.profiles where email = $1',
      [correoNuevo]
    )
    afirmar(G12, 'la cuenta nueva sí existe', 1, perfilNuevo.length)
    afirmar(G12, 'y nace como invitado, no como alumno', 'invitado', perfilNuevo[0]?.role ?? null)

    const { rows: sinCurso } = await bd.query(
      `select count(*)::int n from academia.enrollments e
         join academia.profiles p on p.user_id = e.user_id
        where p.email = $1`,
      [correoNuevo]
    )
    afirmar(G12, 'no le regala acceso a ningún curso', 0, sinCurso[0].n)

    // Un invitado NO es un alumno: no puede ensuciar el padrón. El día de un
    // evento con cien asistentes, mezclarlos haría inútil el buscador.
    const padron = await texto('/admin/alumnos', admin)
    afirmar(G12, 'el invitado NO aparece en el padrón de alumnos', false, padron.includes(correoNuevo))

    // Y en cuanto se le da de alta en un curso deja de ser lead: si siguiera
    // como `invitado`, tendría su inscripción pero rutaDeInicio() lo mandaría a
    // /mis-encuestas en vez de a su curso.
    const formAlta = leerFormularios(padron).find(
      (f) =>
        f.html.includes('name="email"') &&
        f.html.includes('name="course_id"') &&
        !f.html.includes('name="archivo"') &&
        !f.html.includes('name="rol"')
    )
    afirmar(G12, 'el formulario de alta manual está', true, Boolean(formAlta))

    if (formAlta) {
      await enviar('/admin/alumnos', formAlta, admin, {
        email: correoNuevo,
        nombre: 'QA Cuenta',
        course_id: IDS.curso,
        cohort_id: '',
      })
    }

    const { rows: ascendido } = await bd.query(
      'select role from academia.profiles where email = $1',
      [correoNuevo]
    )
    afirmar(G12, 'al inscribirlo deja de ser invitado', 'alumno', ascendido[0]?.role ?? null)
    afirmar(
      G12,
      'y ahora sí aparece en el padrón',
      true,
      (await texto('/admin/alumnos', admin)).includes(correoNuevo)
    )

    // (a) alumno con sesión: se identifica con su cuenta, sin llenar nada.
    const paginaAlumno = await texto(rutaPublica, alumno)
    afirmar(
      G12,
      'a quien ya trae sesión no le pide datos',
      true,
      paginaAlumno.includes('Entras como')
    )

    // ====================================================================
    const G13 = 'CONTESTAR'

    const formResponder = (html) =>
      leerFormularios(html).find((f) => f.campos.pregunta_id !== undefined)

    const respInvitado = formResponder(await texto(rutaPublica, celInvitado))
    afirmar(G13, 'al invitado ya le sale la pregunta abierta', true, Boolean(respInvitado))

    if (respInvitado) {
      await enviar(rutaPublica, respInvitado, celInvitado, {
        codigo: encuesta.join_code,
        pregunta_id: muro.id,
        valor: 'Automatización de reportes',
      })
    }

    const contarMuro = async () =>
      (
        await bd.query('select count(*)::int n from academia.poll_answers where question_id = $1', [
          muro.id,
        ])
      ).rows[0].n

    afirmar(G13, 'la respuesta se guardó', 1, await contarMuro())

    // Reenviar el formulario no duplica: choca contra el unique de la migración.
    if (respInvitado) {
      const otraVez = await enviar(rutaPublica, respInvitado, celInvitado, {
        codigo: encuesta.join_code,
        pregunta_id: muro.id,
        valor: 'Otra cosa distinta',
      })
      afirmar(G13, 'el doble envío responde, no revienta', true, otraVez.status < 500)
    }
    afirmar(G13, 'y no deja una segunda fila', 1, await contarMuro())

    // Contestar una pregunta que NO está abierta. Es el corazón del milestone.
    if (respInvitado) {
      await enviar(rutaPublica, respInvitado, celInvitado, {
        codigo: encuesta.join_code,
        pregunta_id: preguntas[0].id,
        valor: 'Adelantandome',
      })
    }
    // Se cuenta sobre la pregunta que se intentó contestar a destiempo, no
    // sobre todas las cerradas: entre esas hay una que SÍ se contestó
    // legítimamente mientras estaba abierta, y contarla aquí haría fallar la
    // prueba por un dato correcto.
    const { rows: fugas } = await bd.query(
      'select count(*)::int n from academia.poll_answers where question_id = $1',
      [preguntas[0].id]
    )
    afirmar(G13, 'contestar una pregunta cerrada no deja fila', 0, fugas[0].n)

    // ====================================================================
    const G14 = 'LO QUE VE LA PROYECCIÓN'

    const payload = async () =>
      await (await pedir(`/api/encuestas/proyeccion/${encuesta.projection_token}`, null)).json()

    const proy = await payload()
    afirmar(G14, 'la proyección sabe qué pregunta está abierta', muro.id, proy.pregunta?.id ?? null)
    afirmar(G14, 'y que está abierta', true, proy.pregunta?.abierta ?? null)
    afirmar(G14, 'trae el agregado del muro', 'muro', proy.agregado?.tipo ?? null)
    afirmar(G14, 'con la respuesta que llegó', 1, proy.agregado?.tarjetas?.length ?? 0)
    afirmar(
      G14,
      'el total del agregado cuadra con Postgres',
      await contarMuro(),
      proy.agregado?.total ?? -1
    )
    afirmar(G14, 'cuenta a quienes entraron', true, (proy.participantes ?? 0) >= 2)

    // ====================================================================
    const G15 = 'EL BOTÓN DE PÁNICO'

    const { rows: aOcultar } = await bd.query(
      'select id from academia.poll_answers where question_id = $1 limit 1',
      [muro.id]
    )
    afirmar(G15, 'hay una respuesta que moderar', 1, aOcultar.length)

    const controlConRespuestas = await texto(rutaControl, admin)
    const formOcultar = leerFormularios(controlConRespuestas).find(
      (f) => f.campos.id === aOcultar[0].id && f.campos.ocultar === 'si'
    )
    afirmar(G15, 'el admin tiene el botón de ocultar', true, Boolean(formOcultar))

    if (formOcultar) await enviar(rutaControl, formOcultar, admin)

    const trasOcultar = await payload()
    afirmar(
      G15,
      'la respuesta sale de la proyección',
      0,
      trasOcultar.agregado?.tarjetas?.length ?? -1
    )

    const { rows: sigueAhi } = aOcultar[0]
      ? await bd.query('select hidden from academia.poll_answers where id = $1', [aOcultar[0].id])
      : { rows: [] }
    afirmar(G15, 'pero NO se borró de la base', 1, sigueAhi.length)
    afirmar(G15, 'solo quedó marcada como oculta', true, sigueAhi[0]?.hidden ?? null)

    // ====================================================================
    // ETAPA 3 — exportaciones
    // ====================================================================
    const G16 = 'EXPORTACIÓN A EXCEL'

    const rutaExcel = `/api/reportes/${encuesta.id}/excel`
    const excel = await pedir(rutaExcel, admin)

    afirmar(G16, 'el admin la descarga', 200, excel.status)
    afirmar(
      G16,
      'con el content-type de xlsx',
      true,
      (excel.headers.get('content-type') ?? '').includes('spreadsheetml.sheet')
    )
    afirmar(
      G16,
      'y como adjunto, con el código en el nombre',
      true,
      new RegExp(`attachment; filename="encuesta-${encuesta.join_code}-\\d{4}-\\d{2}-\\d{2}\\.xlsx"`).test(
        excel.headers.get('content-disposition') ?? ''
      )
    )

    const bytesExcel = Buffer.from(await excel.arrayBuffer())
    afirmar(G16, 'los bytes son un ZIP', 'PK', bytesExcel.subarray(0, 2).toString('latin1'))

    const libro = leerZip(bytesExcel)
    afirmar(G16, 'el directorio central se recorre entero', true, libro.ok)
    // La verificación fuerte: un CRC-32 escrito aparte del que usa el escritor.
    afirmar(G16, 'el CRC de cada entrada cuadra', true, libro.crcOk)

    for (const parte of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml',
    ]) {
      afirmar(G16, `trae ${parte}`, true, libro.entradas.has(parte))
    }

    const workbook = libro.entradas.get('xl/workbook.xml')?.toString('utf8') ?? ''
    afirmar(G16, 'la primera hoja es el resumen', true, workbook.includes('name="Resumen"'))
    afirmar(G16, 'la segunda es el padrón', true, workbook.includes('name="Participantes"'))
    afirmar(
      G16,
      'hay una hoja por pregunta, más las dos fijas',
      preguntas.length + 2,
      (workbook.match(/<sheet /g) ?? []).length
    )

    const hojaResumen = libro.entradas.get('xl/worksheets/sheet1.xml')?.toString('utf8') ?? ''
    afirmar(G16, 'el resumen trae el título de la encuesta', true, hojaResumen.includes(TITULO_QA))
    afirmar(G16, 'y el código', true, hojaResumen.includes(encuesta.join_code))

    const hojaPadron = libro.entradas.get('xl/worksheets/sheet2.xml')?.toString('utf8') ?? ''
    afirmar(G16, 'el padrón trae el correo del invitado', true, hojaPadron.includes(correoInvitado))
    afirmar(G16, 'y su teléfono', true, hojaPadron.includes('5512345678'))

    // La respuesta que se ocultó en vivo SÍ tiene que estar en el archivo: el
    // cliente va a querer saber que ocurrió, no que desapareciera sin rastro.
    const hojasPregunta = [...libro.entradas.entries()]
      .filter(([n]) => n.startsWith('xl/worksheets/sheet'))
      .map(([, b]) => b.toString('utf8'))
      .join('')
    afirmar(
      G16,
      'la respuesta oculta SÍ se exporta',
      true,
      hojasPregunta.includes('Automatizaci')
    )
    afirmar(G16, 'y va marcada como oculta', true, hojasPregunta.includes('Oculta'))

    // Ninguna celda es fórmula: el texto va en <is><t>, así que un "=1+1"
    // escrito desde un celular no se evalúa al abrir el archivo.
    afirmar(G16, 'ninguna celda es fórmula', false, hojasPregunta.includes('<f>'))
    afirmar(G16, 'los acentos sobreviven', true, hojaPadron.includes('Invitado'))

    afirmar(G16, 'sin sesión, 401', 401, (await pedir(rutaExcel, null)).status)
    afirmar(G16, 'un alumno, 404', 404, (await pedir(rutaExcel, alumno)).status)

    // ====================================================================
    const G17 = 'EXPORTACIÓN A PDF CON GRÁFICAS'

    const rutaPdf = `/api/reportes/${encuesta.id}/pdf`
    const pdf = await pedir(rutaPdf, admin)

    afirmar(G17, 'el admin lo descarga', 200, pdf.status)
    afirmar(G17, 'con content-type de PDF', 'application/pdf', pdf.headers.get('content-type'))

    const bytesPdf = Buffer.from(await pdf.arrayBuffer())
    afirmar(G17, 'y ES un PDF, no un HTML de error', '%PDF-', bytesPdf.subarray(0, 5).toString('latin1'))
    afirmar(G17, 'con contenido real', true, bytesPdf.length > 5000)

    const analisis = analizarPdf(bytesPdf)
    afirmar(G17, 'tiene al menos una página', true, analisis.paginas >= 1)

    // Respeta el criterio de plantilla.tsx: nada de imágenes ni fuentes remotas.
    afirmar(G17, 'no embebe ninguna imagen', false, analisis.tieneImagenes)
    afirmar(
      G17,
      'solo usa las fuentes estándar del PDF',
      true,
      analisis.fuentes.every((f) => /Helvetica|Courier|Times/.test(f))
    )

    // LAS GRÁFICAS ESTÁN DIBUJADAS. Solo el QR ya son más de doscientos
    // subtrazos; un PDF de puro texto no pasa de un puñado.
    afirmar(G17, 'trae cientos de trazos vectoriales', true, analisis.trazos > 100)
    afirmar(G17, 'dentro de un flujo comprimido', true, analisis.flujos >= 1)

    afirmar(G17, 'sin sesión, 401', 401, (await pedir(rutaPdf, null)).status)
    afirmar(G17, 'un alumno, 404', 404, (await pedir(rutaPdf, alumno)).status)

    // ====================================================================
    const G8 = 'LIMPIEZA'

    // "Ajeno" = todo lo que esta suite NO creó. Contar el total incluiría la
    // cuenta que ella misma dio de alta, y entonces la prueba fallaría
    // justamente cuando la limpieza funciona bien.
    const correosDeLaSuite = [correoInvitado, correoNuevo]
    const contarPerfilesAjenos = async () =>
      (
        await bd.query('select count(*)::int n from academia.profiles where email <> all($1)', [
          correosDeLaSuite,
        ])
      ).rows[0].n

    const perfilesAntes = await contarPerfilesAjenos()
    const { rows: cursosAntes } = await bd.query('select count(*)::int n from academia.courses')

    await limpiar(bd)

    const { rows: quedan } = await bd.query(
      'select count(*)::int n from academia.polls where title = $1',
      [TITULO_QA]
    )
    afirmar(G8, 'la encuesta de prueba ya no existe', 0, quedan[0].n)

    const { rows: preguntasHuerfanas } = await bd.query(
      'select count(*)::int n from academia.poll_questions where poll_id = $1',
      [encuesta.id]
    )
    afirmar(G8, 'sus preguntas se fueron en cascada', 0, preguntasHuerfanas[0].n)

    const { rows: respuestasHuerfanas } = await bd.query(
      'select count(*)::int n from academia.poll_answers where question_id = any($1)',
      [preguntas.map((p) => p.id)]
    )
    afirmar(G8, 'y sus respuestas también', 0, respuestasHuerfanas[0].n)

    const { rows: cursosDespues } = await bd.query('select count(*)::int n from academia.courses')
    afirmar(G8, 'no se tocó ningún perfil ajeno', perfilesAntes, await contarPerfilesAjenos())
    afirmar(G8, 'ni ningún curso', cursosAntes[0].n, cursosDespues[0].n)

    const { rows: cuentaQa } = await bd.query(
      'select count(*)::int n from academia.profiles where email = any($1)',
      [correosDeLaSuite]
    )
    afirmar(G8, 'y la cuenta que creó la prueba se fue con ella', 0, cuentaQa[0].n)

    // ====================================================================
  } finally {
    // El reporte va en el finally a propósito: si algo revienta a media suite,
    // lo último que ayuda es perder también las aserciones que sí corrieron.
    if (resultados.length > 0 && !imprimir()) process.exitCode = 1
    await bd.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
