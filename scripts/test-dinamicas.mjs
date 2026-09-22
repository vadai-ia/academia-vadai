#!/usr/bin/env node
/**
 * test-dinamicas.mjs — Criterio de cierre de M13, "Dinámicas empresariales".
 *
 * La matriz de decisión ponderada de la sesión 1, pero colaborativa: el admin
 * fija criterios con peso, cada EMPRESA agrega proyectos y califica el mismo
 * tablero, y abajo sale el ponderado. Lo que esta suite defiende, en orden de
 * importancia:
 *
 *   1. Que RLS y los triggers de academia_0028 sostienen las reglas sin ayuda
 *      de la aplicación: un miembro no ve tableros ajenos, un vencido no
 *      escribe, una cerrada no acepta calificaciones, una celda fuera de escala
 *      no entra. Por eso buena parte habla directo con PostgREST (con el JWT de
 *      cada alumno) y con Postgres, no con la pantalla.
 *   2. Que todo funciona SIN JavaScript: cada mutación se prueba reenviando el
 *      <form> real con su $ACTION_ID.
 *   3. Que el ponderado que pinta la página, el que exporta el Excel y el que
 *      calcula esta suite por su cuenta dicen lo mismo.
 *
 * Datos PROPIOS y con marca exacta: una dinámica, una empresa y cuatro cuentas
 * `qa-din-*` creadas aquí. No toca ninguna cuenta del seed (qa-alumno2 está
 * suspendida y qa-alumno1 no tiene empresa: darles una rompería otras suites).
 * Las aserciones son propiedades ("el admin ve todos los perfiles"), no
 * números fijos.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-dinamicas.mjs
 *   APP_URL=http://localhost:3118 node scripts/test-dinamicas.mjs   (otro puerto)
 */

import { inflateRawSync } from 'node:zlib'

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CLAVE_QA, DOMINIO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

/**
 * Las marcas de esta suite. EXACTAS, no patrones: `like 'QA %'` también
 * casaría lo que siembra seed.mjs y lo que crea test-encuestas.
 */
const TITULO_QA = 'QA · Dinámica de prueba (test-dinamicas)'
const EMPRESA_QA = 'QA · Dinámicas (test-dinamicas)'

/**
 * Las cuatro cuentas de la suite. a1 y a2 son de la misma empresa (colaboran
 * en el mismo tablero); g1 no tiene empresa ("General", tablero propio); v1 es
 * de la empresa pero con el acceso al curso vencido (lee, no puntúa).
 */
const CUENTAS_QA = {
  a1: { email: `qa-din-a1@${DOMINIO_QA}`, nombre: 'QA Din A1', empresa: true, vencido: false },
  a2: { email: `qa-din-a2@${DOMINIO_QA}`, nombre: 'QA Din A2', empresa: true, vencido: false },
  g1: { email: `qa-din-g1@${DOMINIO_QA}`, nombre: 'QA Din G1', empresa: false, vencido: false },
  v1: { email: `qa-din-v1@${DOMINIO_QA}`, nombre: 'QA Din V1', empresa: true, vencido: true },
}
const CORREOS_QA = Object.values(CUENTAS_QA).map((c) => c.email)

const cabecerasAdmin = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}

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

async function enlaceDeRecuperacion(email) {
  const enlace = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: cabecerasAdmin,
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const cuerpo = await enlace.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) throw new Error(`No se pudo generar enlace para ${email}`)
  return hash
}

async function iniciarSesion(email) {
  const hash = await enlaceDeRecuperacion(email)
  const frasco = crearFrasco()
  const respuesta = await fetch(
    `${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`,
    { redirect: 'manual' }
  )
  frasco.guardar(respuesta)
  if (frasco.tamano === 0) throw new Error(`No se pudo iniciar sesión como ${email}`)
  return frasco
}

/** JWT de un usuario, para hablarle a PostgREST como él y probar RLS de verdad. */
async function jwtDe(email) {
  const hash = await enlaceDeRecuperacion(email)
  const verificado = await fetch(`${SUPABASE}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', token_hash: hash }),
  })
  const sesion = await verificado.json()
  if (!sesion.access_token) throw new Error(`No se obtuvo JWT para ${email}`)
  return sesion.access_token
}

/** Lee una tabla del schema `academia` por PostgREST, con la llave que se le dé. */
async function leerTabla(tabla, { jwt, llave = ANON, select = 'id', filtro = '' } = {}) {
  const respuesta = await fetch(
    `${SUPABASE}/rest/v1/${tabla}?select=${encodeURIComponent(select)}${filtro ? `&${filtro}` : ''}`,
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

/**
 * Escribe en una tabla del schema `academia` por PostgREST como un usuario.
 *
 * Es la manera de probar RLS de escritura de verdad: la server action ya
 * traduce las negativas a mensajes amables, y aquí lo que se quiere ver es el
 * errcode crudo (42501 de una policy, 22023 de un trigger, 23514 de un check).
 * `Prefer: return=representation` hace visible el "0 filas" de un UPDATE o
 * DELETE que RLS filtró en silencio.
 */
async function escribirTabla(
  tabla,
  { jwt, metodo = 'POST', cuerpo, filtro = '', prefer = 'return=representation' } = {}
) {
  const respuesta = await fetch(`${SUPABASE}/rest/v1/${tabla}${filtro ? `?${filtro}` : ''}`, {
    method: metodo,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${jwt}`,
      'Content-Profile': 'academia',
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const texto = await respuesta.text()
  let json = null
  try {
    json = JSON.parse(texto)
  } catch {
    json = null
  }
  return {
    status: respuesta.status,
    filas: Array.isArray(json) ? json : null,
    codigo: json && !Array.isArray(json) ? (json.code ?? null) : null,
    mensaje: json && !Array.isArray(json) ? (json.message ?? null) : null,
  }
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

/**
 * React separa el texto de una interpolación con un comentario HTML, así que
 * "Pesos: 85 de 100" llega como "85<!-- --> de 100". Se quitan antes de buscar.
 */
const sinComentarios = (html) => html.replace(/<!--.*?-->/g, '')

// --- reenvío de formularios (mejora progresiva) ----------------------------

function limpiarValor(valor) {
  return valor
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
}

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
      campos[nombre] = limpiarValor(valor)
    }

    if (accion) formularios.push({ accion, campos, html: bloque[0] })
  }
  return formularios
}

/**
 * El tablero es especial: su <form id="matriz"> va VACÍO y las celdas viven
 * fuera, asociadas por `form="matriz"` (así ningún <form> queda dentro de un
 * <th>). `leerFormularios` solo mira dentro del <form>, así que las entradas
 * `celda:` y `orig:` se recogen de la página entera, como haría el navegador.
 */
function leerMatriz(html) {
  const form = leerFormularios(html).find((f) => f.html.includes('id="matriz"')) ?? null
  const celdas = {}
  for (const etiqueta of html.matchAll(/<input\b[^>]*>/g)) {
    const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
    if (!nombre || !(nombre.startsWith('celda:') || nombre.startsWith('orig:'))) continue
    celdas[nombre] = limpiarValor(etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? '')
  }
  return { form, celdas }
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

// --- lectura de ZIP, para verificar el Excel -------------------------------

/**
 * CRC-32 escrito AQUÍ, aparte del que usa `lib/encuestas/xlsx.ts`.
 *
 * Si la prueba reusara la implementación del escritor, un error en el
 * polinomio se cancelaría solo y el archivo pasaría estando corrupto. Dos
 * implementaciones independientes que coinciden sí dicen algo.
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
 * Devuelve `{ ok, entradas: Map<nombre, Buffer>, crcOk }`.
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
  console.log('  PRUEBA DE DINÁMICAS EMPRESARIALES — M13')
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
      ? `  M13 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- cuentas y limpieza ----------------------------------------------------

/**
 * Busca una cuenta por correo con `?filter=`, como seed.mjs. Listar 200 sin
 * filtro dejó de servir cuando el padrón pasó de 150 cuentas.
 */
async function buscarCuenta(email) {
  const r = await fetch(
    `${SUPABASE}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=200`,
    { headers: cabecerasAdmin }
  )
  const cuerpo = await r.json().catch(() => ({}))
  return (cuerpo.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase()) ?? null
}

/**
 * `auth.users` está fuera de `academia` y la Regla Cero prohíbe tocarlo por
 * SQL: se borra por la Admin API. El perfil, la inscripción y todo lo que
 * cuelga del usuario se van por las FK en cascada.
 */
async function borrarCuentaQa(email) {
  const usuario = await buscarCuenta(email)
  if (!usuario) return
  await fetch(`${SUPABASE}/auth/v1/admin/users/${usuario.id}`, {
    method: 'DELETE',
    headers: cabecerasAdmin,
  })
}

/** Crea la cuenta como seed.mjs: Admin API, contraseña QA, correo confirmado. */
async function crearCuentaQa({ email, nombre }) {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: cabecerasAdmin,
    body: JSON.stringify({
      email,
      password: CLAVE_QA,
      email_confirm: true,
      user_metadata: { full_name: nombre, qa: true },
    }),
  })
  const cuerpo = await r.json()
  if (!r.ok) throw new Error(`No se pudo crear ${email}: ${cuerpo.msg ?? cuerpo.message ?? r.status}`)
  return cuerpo.id
}

/**
 * Borra SOLO lo de esta suite, por marca exacta. Se corre al empezar y al
 * final: una corrida anterior que murió a medias no debe envenenar la
 * siguiente.
 *
 * Orden obligado por las FK: la dinámica (cascada a filas, tableros, columnas
 * y celdas) antes que la empresa, porque `dynamic_boards.company_id` es
 * `on delete restrict`. Los tableros de la empresa QA en cualquier otra
 * dinámica se quitan también, por si una corrida vieja los dejó.
 */
async function limpiar(bd) {
  await bd.query('delete from academia.dynamics where title = $1', [TITULO_QA])
  await bd.query(
    `delete from academia.dynamic_boards
      where company_id in (select id from academia.companies where name = $1)`,
    [EMPRESA_QA]
  )
  await bd.query('delete from academia.companies where name = $1', [EMPRESA_QA])
  for (const email of CORREOS_QA) await borrarCuentaQa(email)
}

/**
 * Siembra la empresa, las cuatro cuentas, sus perfiles y sus inscripciones al
 * curso QA. Todo con service role y SQL directo: es provisioning, igual que el
 * seed, y el trigger de perfiles deja pasar al servicio.
 */
async function sembrar(bd) {
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  await bd.query(
    `insert into academia.companies (id, name) values ($1, $2)
     on conflict (id) do update set name = excluded.name`,
    [IDS.empresaDinamicas, EMPRESA_QA]
  )

  const cuentas = {}
  for (const [llave, cuenta] of Object.entries(CUENTAS_QA)) {
    const id = await crearCuentaQa(cuenta)
    await bd.query(
      `insert into academia.profiles (user_id, email, full_name, role, status, company_id)
       values ($1, $2, $3, 'alumno', 'active', $4)`,
      [id, cuenta.email, cuenta.nombre, cuenta.empresa ? IDS.empresaDinamicas : null]
    )
    await bd.query(
      `insert into academia.enrollments (user_id, course_id, source, expires_at, status)
       values ($1, $2, 'manual', $3, 'active')`,
      [id, IDS.curso, cuenta.vencido ? ayer : null]
    )
    cuentas[llave] = { ...cuenta, id }
  }
  return cuentas
}

/** Espera a que la app conteste. Sin esto la suite fallaría por arrancar antes. */
async function esperarApp(maximoMs = 120_000) {
  const inicio = Date.now()
  while (Date.now() - inicio < maximoMs) {
    try {
      const r = await fetch(`${APP}/login`, { redirect: 'manual' })
      if (r.status === 200) return true
    } catch {
      // Todavía no levanta.
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

/**
 * El ponderado calculado POR LA SUITE, aparte de lib/dinamicas/comun.ts: si la
 * prueba importara `ponderado()`, un error de redondeo ahí se cancelaría solo.
 * Aritmética entera (pesos y valores enteros) y redondeo a un decimal.
 */
function ponderadoIndependiente(pesos, valores) {
  let numerador = 0
  let denominador = 0
  for (let i = 0; i < pesos.length; i += 1) {
    numerador += pesos[i] * valores[i]
    denominador += pesos[i]
  }
  return Math.round((numerador * 10) / denominador) / 10
}

// --- main ------------------------------------------------------------------

async function main() {
  if (!(await esperarApp())) {
    throw new Error(`La app no contestó 200 en ${APP}/login en dos minutos.`)
  }

  const bd = await conectarPostgres(vars)

  try {
    await limpiar(bd)
    const cuentas = await sembrar(bd)

    const admin = await iniciarSesion(correo.admin)
    const a1 = await iniciarSesion(cuentas.a1.email)
    const a2 = await iniciarSesion(cuentas.a2.email)
    const g1 = await iniciarSesion(cuentas.g1.email)
    const v1 = await iniciarSesion(cuentas.v1.email)

    const jwtA1 = await jwtDe(cuentas.a1.email)
    const jwtA2 = await jwtDe(cuentas.a2.email)
    const jwtG1 = await jwtDe(cuentas.g1.email)
    const jwtV1 = await jwtDe(cuentas.v1.email)

    const { rows: perfilAdmin } = await bd.query(
      'select user_id from academia.profiles where email = $1',
      [correo.admin]
    )
    const idAdmin = perfilAdmin[0]?.user_id ?? null

    // ====================================================================
    const G1 = 'ACCESO Y NAVEGACIÓN'

    afirmar(G1, 'el admin entra a /admin/dinamicas', 200, (await pedir('/admin/dinamicas', admin)).status)
    afirmar(G1, 'un alumno es rebotado', 307, (await pedir('/admin/dinamicas', a1)).status)
    afirmar(G1, 'sin sesión, al login', 307, (await pedir('/admin/dinamicas', null)).status)
    afirmar(
      G1,
      'la navegación de admin ofrece Dinámicas',
      true,
      (await texto('/admin', admin)).includes('href="/admin/dinamicas"')
    )
    afirmar(
      G1,
      'la navegación del alumno ofrece Dinámicas',
      true,
      (await texto('/dinamicas', a1)).includes('href="/dinamicas"')
    )
    afirmar(
      G1,
      'la pestaña Dinámicas del curso abre para un inscrito',
      200,
      (await pedir('/curso/qa-curso-prueba/dinamicas', a1)).status
    )

    // Las encuestas dejaron de llamarse "dinámica": son dos cosas distintas.
    const misEncuestas = await texto('/mis-encuestas', a1)
    afirmar(G1, '/mis-encuestas se llama "Mis encuestas"', true, misEncuestas.includes('Mis encuestas'))
    afirmar(G1, 'y ya no "Mis dinámicas"', false, misEncuestas.includes('Mis dinámicas'))

    // ====================================================================
    // Se crea reenviando el formulario real, sin JavaScript.
    const G2 = 'CREACIÓN (server action real, sin JavaScript)'

    const listado = await texto('/admin/dinamicas', admin)
    const formNueva = leerFormularios(listado).find(
      (f) => f.html.includes('name="title"') && f.html.includes('Crear dinámica')
    )
    afirmar(G2, 'el formulario "Nueva dinámica" está en la página', true, Boolean(formNueva))

    if (formNueva) {
      const r = await enviar('/admin/dinamicas', formNueva, admin, {
        title: TITULO_QA,
        course_id: IDS.curso,
        cohort_id: '',
        description: 'Sembrada por scripts/test-dinamicas.mjs',
      })
      afirmar(G2, 'crear redirige a la dinámica nueva', true, r.status === 303 || r.status === 200)
    }

    const { rows: creadas } = await bd.query('select * from academia.dynamics where title = $1', [
      TITULO_QA,
    ])
    afirmar(G2, 'la dinámica existe en Postgres', 1, creadas.length)

    const dinamica = creadas[0] ?? {}
    afirmar(G2, 'nace en borrador', 'draft', dinamica.status ?? null)
    afirmar(G2, 'con escala del 1 al 10', '1-10', `${dinamica.scale_min}-${dinamica.scale_max}`)
    afirmar(G2, 'queda ligada al curso QA', IDS.curso, dinamica.course_id ?? null)
    afirmar(G2, 'y firmada por el admin', idAdmin, dinamica.created_by ?? null)

    let escalaInvertida = null
    try {
      await bd.query('update academia.dynamics set scale_max = scale_min where id = $1', [dinamica.id])
    } catch (error) {
      escalaInvertida = error.code
    }
    afirmar(G2, 'una escala con máximo <= mínimo se rechaza', '23514', escalaInvertida)

    let escalaAlNacer = null
    try {
      await bd.query(
        `insert into academia.dynamics (id, course_id, title, scale_min, scale_max)
         values ($1, $2, $3, 5, 5)`,
        [IDS.dinamica, IDS.curso, TITULO_QA]
      )
    } catch (error) {
      escalaAlNacer = error.code
    }
    afirmar(G2, 'tampoco al nacer', '23514', escalaAlNacer)

    const rutaAdmin = `/admin/dinamicas/${dinamica.id}`
    const rutaConfig = `${rutaAdmin}/configuracion`
    const rutaAlumno = `/dinamicas/${dinamica.id}`

    // ====================================================================
    const G3 = 'CRITERIOS Y APERTURA'

    afirmar(G3, 'el editor de criterios abre', 200, (await pedir(rutaAdmin, admin)).status)

    const editor = await texto(rutaAdmin, admin)
    // El alta es el único formulario con `row_kind` que NO trae `id`: los de
    // edición llevan el id de su fila.
    const formFila = leerFormularios(editor).find(
      (f) => f.html.includes('name="row_kind"') && !('id' in f.campos)
    )
    afirmar(G3, 'el formulario de alta de fila está', true, Boolean(formFila))
    afirmar(
      G3,
      'el peso NO lleva required (está oculto en informativas)',
      false,
      /<input\b[^>]*name="weight"[^>]*\brequired\b/.test(formFila?.html ?? '')
    )

    const PESOS = [20, 15, 15, 30, 20]
    const filasAAgregar = [
      ...PESOS.map((peso, i) => ({ label: `QA criterio ${i + 1}`, row_kind: 'criterio', weight: String(peso) })),
      { label: 'QA dato inversión', row_kind: 'informativa', weight: '' },
      { label: 'QA dato horas', row_kind: 'informativa', weight: '' },
    ]
    for (const fila of filasAAgregar) {
      if (!formFila) break
      await enviar(rutaAdmin, formFila, admin, { dynamic_id: dinamica.id, ...fila })
    }

    const { rows: filas } = await bd.query(
      'select * from academia.dynamic_rows where dynamic_id = $1 order by position, created_at',
      [dinamica.id]
    )
    const criterios = filas.filter((f) => f.row_kind === 'criterio')
    const informativas = filas.filter((f) => f.row_kind === 'informativa')
    afirmar(G3, 'se guardaron las siete filas', 7, filas.length)
    afirmar(G3, 'cinco criterios con su peso', PESOS.join(','), criterios.map((c) => Number(c.weight)).join(','))
    afirmar(G3, 'dos informativas sin peso', true, informativas.length === 2 && informativas.every((f) => f.weight === null))
    afirmar(
      G3,
      'las posiciones son estrictamente crecientes',
      true,
      filas.every((f, i) => i === 0 || f.position > filas[i - 1].position)
    )

    // Un criterio sin peso se rechaza por la acción; una informativa CON peso
    // la rechaza la base, que es donde vive la regla.
    if (formFila) {
      await enviar(rutaAdmin, formFila, admin, {
        dynamic_id: dinamica.id,
        label: 'QA criterio sin peso',
        row_kind: 'criterio',
        weight: '',
      })
    }
    const { rows: trasSinPeso } = await bd.query(
      'select count(*)::int n from academia.dynamic_rows where dynamic_id = $1',
      [dinamica.id]
    )
    afirmar(G3, 'un criterio sin peso no se guarda', 7, trasSinPeso[0].n)

    let informativaConPeso = null
    try {
      await bd.query(
        `insert into academia.dynamic_rows (dynamic_id, row_kind, label, weight)
         values ($1, 'informativa', 'QA informativa con peso', 10)`,
        [dinamica.id]
      )
    } catch (error) {
      informativaConPeso = error.code
    }
    afirmar(G3, 'una informativa con peso la rechaza la base', '23514', informativaConPeso)

    // Mover: intercambio de posición con la vecina, por el formulario real.
    const primera = filas[0]
    const segunda = filas[1]
    const posicionDe = async (id) =>
      (await bd.query('select position from academia.dynamic_rows where id = $1', [id])).rows[0]?.position

    // El editor se vuelve a leer: el de arriba se capturó sin filas.
    const editorConFilas = await texto(rutaAdmin, admin)
    const formBajar = leerFormularios(editorConFilas).find(
      (f) => f.campos.id === primera.id && f.campos.direccion === 'abajo'
    )
    afirmar(G3, 'cada fila trae su botón de bajar', true, Boolean(formBajar))
    if (formBajar) await enviar(rutaAdmin, formBajar, admin)
    afirmar(
      G3,
      'bajar la primera intercambia posiciones con la segunda',
      `${segunda.position},${primera.position}`,
      `${await posicionDe(primera.id)},${await posicionDe(segunda.id)}`
    )

    const editorMovido = await texto(rutaAdmin, admin)
    const formSubir = leerFormularios(editorMovido).find(
      (f) => f.campos.id === primera.id && f.campos.direccion === 'arriba'
    )
    if (formSubir) await enviar(rutaAdmin, formSubir, admin)
    afirmar(G3, 'y subirla la devuelve a su lugar', primera.position, await posicionDe(primera.id))

    // Pesos que no suman 100: se baja uno a 5 por el formulario de edición.
    const ajustado = criterios[0]
    const formEditar = (html, idFila) =>
      leerFormularios(html).find((f) => f.campos.id === idFila && f.html.includes('name="label"'))

    const edicion = formEditar(await texto(rutaAdmin, admin), ajustado.id)
    afirmar(G3, 'cada fila trae su formulario de edición', true, Boolean(edicion))
    if (edicion) {
      await enviar(rutaAdmin, edicion, admin, {
        id: ajustado.id,
        dynamic_id: dinamica.id,
        label: ajustado.label,
        row_kind: 'criterio',
        weight: '5',
      })
    }
    const { rows: suma85 } = await bd.query(
      "select coalesce(sum(weight), 0)::numeric s from academia.dynamic_rows where dynamic_id = $1 and row_kind = 'criterio'",
      [dinamica.id]
    )
    afirmar(G3, 'con un peso en 5 los criterios suman 85', 85, Number(suma85[0].s))

    const editor85 = sinComentarios(await texto(rutaAdmin, admin))
    afirmar(G3, 'la página dice cuánto falta para 100', true, editor85.includes('85 de 100'))
    afirmar(G3, 'y lo dice como algo por corregir', true, editor85.includes('faltan 15'))

    // Abrir con 85: la acción lo rechaza con un mensaje, y si alguien se salta
    // la acción, el trigger lo rechaza con 22023.
    const formConTexto = (html, marca) =>
      leerFormularios(html).find((f) => f.campos.id === dinamica.id && f.html.includes(marca))

    const formAbrir85 = formConTexto(await texto(rutaConfig, admin), 'Abrir la dinámica')
    afirmar(G3, 'configuración ofrece "Abrir la dinámica"', true, Boolean(formAbrir85))
    if (formAbrir85) {
      const r = await enviar(rutaConfig, formAbrir85, admin, { id: dinamica.id })
      const cuerpo = await r.text()
      afirmar(G3, 'abrir con 85 contesta con un mensaje, no un 500', true, r.status < 500)
      afirmar(G3, 'y el mensaje nombra la suma', true, cuerpo.includes('Los pesos suman 85'))
    }
    const estadoDe = async () =>
      (await bd.query('select status, opened_at, closed_at, closes_at from academia.dynamics where id = $1', [dinamica.id])).rows[0]
    afirmar(G3, 'con 85 sigue en borrador', 'draft', (await estadoDe()).status)

    let abrirDirecto85 = null
    try {
      await bd.query("update academia.dynamics set status = 'open' where id = $1", [dinamica.id])
    } catch (error) {
      abrirDirecto85 = error.code
    }
    afirmar(G3, 'y la base tampoco la deja abrir (trigger)', '22023', abrirDirecto85)

    // De vuelta a 20: suman 100.
    const edicionDeVuelta = formEditar(await texto(rutaAdmin, admin), ajustado.id)
    if (edicionDeVuelta) {
      await enviar(rutaAdmin, edicionDeVuelta, admin, {
        id: ajustado.id,
        dynamic_id: dinamica.id,
        label: ajustado.label,
        row_kind: 'criterio',
        weight: String(PESOS[0]),
      })
    }
    const { rows: suma100 } = await bd.query(
      "select coalesce(sum(weight), 0)::numeric s from academia.dynamic_rows where dynamic_id = $1 and row_kind = 'criterio'",
      [dinamica.id]
    )
    afirmar(G3, 'con el peso de vuelta suman 100', 100, Number(suma100[0].s))

    // ====================================================================
    // RLS: antes de abrir, el alumno no ve NADA de la dinámica (borrador).
    const G4 = 'RLS DIRECTO (PostgREST con el JWT de cada alumno)'

    const dinamicasDe = async (jwt) =>
      ((await leerTabla('dynamics', { jwt, select: 'id,title' })).filas ?? []).filter(
        (d) => d.title === TITULO_QA
      ).length
    const filasVisibles = async (jwt) =>
      ((await leerTabla('dynamic_rows', { jwt, select: 'id,dynamic_id' })).filas ?? []).filter(
        (f) => f.dynamic_id === dinamica.id
      ).length

    afirmar(G4, 'en borrador, el alumno inscrito no ve la dinámica', 0, await dinamicasDe(jwtA1))
    afirmar(G4, 'ni sus filas', 0, await filasVisibles(jwtA1))

    // --- abrir con 100 -------------------------------------------------
    const formAbrir = formConTexto(await texto(rutaConfig, admin), 'Abrir la dinámica')
    if (formAbrir) await enviar(rutaConfig, formAbrir, admin, { id: dinamica.id })

    const abierta = await estadoDe()
    afirmar(G3, 'con 100 el formulario la abre', 'open', abierta.status)
    afirmar(G3, 'y le pone hora de apertura', true, Boolean(abierta.opened_at))

    afirmar(G4, 'abierta, el alumno inscrito la ve', 1, await dinamicasDe(jwtA1))
    afirmar(G4, 'y ve todas sus filas', filas.length, await filasVisibles(jwtA1))

    const filaIntrusa = await escribirTabla('dynamic_rows', {
      jwt: jwtA1,
      cuerpo: { dynamic_id: dinamica.id, row_kind: 'informativa', label: 'QA intruso' },
    })
    afirmar(G4, 'un alumno no puede crear filas', '42501', filaIntrusa.codigo)

    // ====================================================================
    const G5 = 'COLABORACIÓN POR EMPRESA'

    afirmar(G5, 'el alumno entra a la dinámica', 200, (await pedir(rutaAlumno, a1)).status)

    const paginaA1 = await texto(rutaAlumno, a1)
    const formEmpezar = leerFormularios(paginaA1).find(
      (f) => f.campos.dynamic_id === dinamica.id && !('board_id' in f.campos)
    )
    afirmar(G5, 'sin tablero, ofrece "Empezar el tablero"', true, Boolean(formEmpezar))
    afirmar(G5, 'con el nombre de la empresa', true, paginaA1.includes(`Empezar el tablero de ${EMPRESA_QA}`))

    if (formEmpezar) {
      const r = await enviar(rutaAlumno, formEmpezar, a1, { dynamic_id: dinamica.id })
      afirmar(G5, 'empezar redirige al tablero', true, r.status === 303 || r.status === 200)
    }

    const tablerosDe = async () =>
      (
        await bd.query(
          'select id, company_id, owner_user_id, version from academia.dynamic_boards where dynamic_id = $1 order by created_at',
          [dinamica.id]
        )
      ).rows

    let tableros = await tablerosDe()
    afirmar(G5, 'nace UN tablero', 1, tableros.length)
    afirmar(G5, 'y es de la empresa, no de la persona', IDS.empresaDinamicas, tableros[0]?.company_id ?? null)
    const boardId = tableros[0]?.id ?? null

    // El compañero reenvía el mismo formulario: el índice único lo convierte
    // en "ya existe, es el mismo", no en un segundo tablero.
    if (formEmpezar) await enviar(rutaAlumno, formEmpezar, a2, { dynamic_id: dinamica.id })
    tableros = await tablerosDe()
    afirmar(G5, 'el compañero no crea otro', 1, tableros.length)
    afirmar(G5, 'es el mismo tablero', boardId, tableros[0]?.id ?? null)

    // Y quien no tiene empresa abre el suyo, personal.
    const paginaG1 = await texto(rutaAlumno, g1)
    afirmar(G5, 'quien no tiene empresa ve "Empezar mi tablero"', true, paginaG1.includes('Empezar mi tablero'))
    const formEmpezarG1 = leerFormularios(paginaG1).find(
      (f) => f.campos.dynamic_id === dinamica.id && !('board_id' in f.campos)
    )
    if (formEmpezarG1) await enviar(rutaAlumno, formEmpezarG1, g1, { dynamic_id: dinamica.id })
    tableros = await tablerosDe()
    const tableroG1 = tableros.find((t) => t.owner_user_id === cuentas.g1.id) ?? null
    afirmar(G5, 'el tablero de General es personal', true, Boolean(tableroG1) && tableroG1.company_id === null)
    afirmar(G5, 'y solo hay esos dos', 2, tableros.length)

    // --- RLS entre tableros --------------------------------------------
    const tablerosVisibles = async (jwt) =>
      ((await leerTabla('dynamic_boards', { jwt, select: 'id,dynamic_id' })).filas ?? [])
        .filter((b) => b.dynamic_id === dinamica.id)
        .map((b) => b.id)

    afirmar(G4, 'a1 ve solo el tablero de su empresa', boardId, (await tablerosVisibles(jwtA1)).join(','))
    afirmar(G4, 'g1 ve solo el suyo', tableroG1?.id ?? '?', (await tablerosVisibles(jwtG1)).join(','))

    // Abrir un tablero a nombre de OTRA empresa: la policy lo corta.
    const { rows: otraEmpresa } = await bd.query(
      'select id from academia.companies where id <> $1 order by created_at limit 1',
      [IDS.empresaDinamicas]
    )
    const empresaAjena = otraEmpresa[0]?.id ?? '00000000-0000-4000-8000-00000000dead'
    const tableroAjeno = await escribirTabla('dynamic_boards', {
      jwt: jwtA1,
      cuerpo: { dynamic_id: dinamica.id, company_id: empresaAjena, owner_user_id: null },
    })
    afirmar(G4, 'un alumno no abre tablero de otra empresa', true, tableroAjeno.status >= 400 && (tableroAjeno.filas?.length ?? 0) === 0)
    const { rows: colados } = await bd.query(
      'select count(*)::int n from academia.dynamic_boards where dynamic_id = $1 and company_id = $2',
      [dinamica.id, empresaAjena]
    )
    afirmar(G4, 'y no quedó ninguno colado', 0, colados[0].n)

    // Tampoco uno personal teniendo empresa: sería un tablero aparte del equipo.
    const personalConEmpresa = await escribirTabla('dynamic_boards', {
      jwt: jwtA1,
      cuerpo: { dynamic_id: dinamica.id, company_id: null, owner_user_id: cuentas.a1.id },
    })
    afirmar(G4, 'quien tiene empresa no abre uno personal', '42501', personalConEmpresa.codigo)

    // --- proyectos (columnas) ------------------------------------------
    const formNuevoProyecto = (html) =>
      leerFormularios(html).find(
        (f) => f.campos.board_id === boardId && f.html.includes('name="label"') && !('column_id' in f.campos)
      )
    const columnasDe = async () =>
      (
        await bd.query(
          'select id, label, created_by, position from academia.dynamic_columns where board_id = $1 order by position, created_at, id',
          [boardId]
        )
      ).rows

    const conTablero = await texto(rutaAlumno, a1)
    const formProyectoA1 = formNuevoProyecto(conTablero)
    afirmar(G5, 'el tablero ofrece "Agregar proyecto"', true, Boolean(formProyectoA1))
    if (formProyectoA1) await enviar(rutaAlumno, formProyectoA1, a1, { label: 'QA Proyecto A' })

    let columnas = await columnasDe()
    afirmar(G5, 'el proyecto se guardó', 1, columnas.length)
    afirmar(G5, 'firmado por quien lo creó', cuentas.a1.id, columnas[0]?.created_by ?? null)
    const colA = columnas[0] ?? {}

    const paginaA2 = await texto(rutaAlumno, a2)
    afirmar(G5, 'el compañero lo ve en su pantalla', true, paginaA2.includes('QA Proyecto A'))
    afirmar(
      G5,
      'y por PostgREST',
      true,
      ((await leerTabla('dynamic_columns', { jwt: jwtA2, select: 'id' })).filas ?? []).some((c) => c.id === colA.id)
    )
    afirmar(
      G5,
      'a quien no lo creó se le dice quién puede borrarlo',
      true,
      sinComentarios(paginaA2).includes(`Solo ${cuentas.a1.nombre} o el equipo pueden borrarlo`)
    )

    const formRenombrar = leerFormularios(paginaA2).find(
      (f) => f.campos.column_id === colA.id && f.html.includes('name="label"')
    )
    afirmar(G5, 'el compañero sí puede renombrarlo', true, Boolean(formRenombrar))
    if (formRenombrar) await enviar(rutaAlumno, formRenombrar, a2, { label: 'QA Proyecto A2' })
    columnas = await columnasDe()
    afirmar(G5, 'el nombre cambió', 'QA Proyecto A2', columnas[0]?.label ?? null)

    const borradoA2 = await escribirTabla('dynamic_columns', {
      jwt: jwtA2,
      metodo: 'DELETE',
      filtro: `id=eq.${colA.id}`,
    })
    afirmar(G5, 'pero no puede borrarlo: RLS filtra en silencio', 0, borradoA2.filas?.length ?? -1)
    afirmar(G5, 'y la columna sigue ahí', 1, (await columnasDe()).length)
    afirmar(
      G5,
      'en su pantalla no hay botón de eliminar para ese proyecto',
      false,
      leerFormularios(paginaA2).some((f) => f.campos.column_id === colA.id && !f.html.includes('name="label"'))
    )

    const formEliminarA1 = leerFormularios(await texto(rutaAlumno, a1)).find(
      (f) => f.campos.column_id === colA.id && !f.html.includes('name="label"')
    )
    afirmar(G5, 'quien lo creó sí tiene el botón', true, Boolean(formEliminarA1))
    if (formEliminarA1) await enviar(rutaAlumno, formEliminarA1, a1)
    afirmar(G5, 'y lo borra', 0, (await columnasDe()).length)

    // El equipo también: crea uno desde el admin y lo borra.
    const rutaTableroAdmin = `${rutaAdmin}/tableros/${boardId}`
    afirmar(G5, 'el admin abre el tablero de la empresa', 200, (await pedir(rutaTableroAdmin, admin)).status)
    const formProyectoAdmin = formNuevoProyecto(await texto(rutaTableroAdmin, admin))
    if (formProyectoAdmin) await enviar(rutaTableroAdmin, formProyectoAdmin, admin, { label: 'QA Proyecto admin' })
    columnas = await columnasDe()
    afirmar(G5, 'el admin agrega un proyecto', 1, columnas.length)
    afirmar(G5, 'firmado por él', idAdmin, columnas[0]?.created_by ?? null)
    const formEliminarAdmin = leerFormularios(await texto(rutaTableroAdmin, admin)).find(
      (f) => f.campos.column_id === columnas[0]?.id && !f.html.includes('name="label"')
    )
    if (formEliminarAdmin) await enviar(rutaTableroAdmin, formEliminarAdmin, admin)
    afirmar(G5, 'y lo borra', 0, (await columnasDe()).length)

    // ====================================================================
    const G6 = 'CELDAS: UNA CALIFICACIÓN COMPARTIDA, CON VERSIÓN Y FIRMA'

    // Dos proyectos: uno de cada miembro.
    const formProyecto1 = formNuevoProyecto(await texto(rutaAlumno, a1))
    if (formProyecto1) await enviar(rutaAlumno, formProyecto1, a1, { label: 'QA Proyecto 1' })
    const formProyecto2 = formNuevoProyecto(await texto(rutaAlumno, a2))
    if (formProyecto2) await enviar(rutaAlumno, formProyecto2, a2, { label: 'QA Proyecto 2' })
    columnas = await columnasDe()
    afirmar(G6, 'hay dos proyectos para calificar', 2, columnas.length)
    const col1 = columnas.find((c) => c.label === 'QA Proyecto 1') ?? {}
    const col2 = columnas.find((c) => c.label === 'QA Proyecto 2') ?? {}

    const [c1, c2, c3, c4] = criterios
    const clave = (fila, col) => `${fila.id}:${col.id}`
    const celdaDe = async (fila, col) =>
      (
        await bd.query(
          'select numeric_value, text_value, updated_by from academia.dynamic_cells where row_id = $1 and column_id = $2',
          [fila.id, col.id]
        )
      ).rows[0] ?? null
    const versionDe = async () =>
      Number((await bd.query('select version from academia.dynamic_boards where id = $1', [boardId])).rows[0].version)

    const matrizA1 = leerMatriz(await texto(rutaAlumno, a1))
    afirmar(G6, 'el tablero trae el <form id="matriz">', true, Boolean(matrizA1.form))
    afirmar(
      G6,
      'con una entrada por celda fuera del form (form="matriz")',
      criterios.length * 2 + informativas.length * 2,
      Object.keys(matrizA1.celdas).filter((n) => n.startsWith('celda:')).length
    )

    const versionAntes = await versionDe()
    if (matrizA1.form) {
      const r = await enviar(rutaAlumno, matrizA1.form, a1, {
        [`celda:${clave(c1, col1)}`]: '8',
        [`orig:${clave(c1, col1)}`]: '',
      })
      afirmar(G6, 'guardar sin JavaScript confirma cuántos cambios', true, (await r.text()).includes('Guardado: 1 cambio'))
    }
    const x = await celdaDe(c1, col1)
    afirmar(G6, 'la celda se guardó', 8, x?.numeric_value ?? null)
    afirmar(G6, 'firmada por quien la puso', cuentas.a1.id, x?.updated_by ?? null)
    afirmar(G6, 'y la versión del tablero subió', true, (await versionDe()) > versionAntes)

    // Fuera de escala: la acción avisa y no escribe; la base también lo corta.
    if (matrizA1.form) {
      const r = await enviar(rutaAlumno, matrizA1.form, a1, {
        [`celda:${clave(c3, col1)}`]: '11',
        [`orig:${clave(c3, col1)}`]: '',
      })
      const cuerpo = await r.text()
      afirmar(G6, 'un 11 en escala 1–10 contesta con el mensaje', true, cuerpo.includes('entre 1 y 10'))
      afirmar(G6, 'en un aviso role="status"', true, /role="status"[^>]*>[^<]*entre 1 y 10/.test(cuerpo))
    }
    afirmar(G6, 'y la celda no se escribe', null, await celdaDe(c3, col1))

    const onceDirecto = await escribirTabla('dynamic_cells', {
      jwt: jwtA1,
      filtro: 'on_conflict=column_id,row_id',
      prefer: 'resolution=merge-duplicates,return=representation',
      cuerpo: { board_id: boardId, column_id: col1.id, row_id: c3.id, numeric_value: 11, updated_by: cuentas.a1.id },
    })
    afirmar(G6, 'saltándose la acción, el trigger rechaza el 11', '22023', onceDirecto.codigo)

    const textoEnCriterio = await escribirTabla('dynamic_cells', {
      jwt: jwtA1,
      cuerpo: { board_id: boardId, column_id: col1.id, row_id: c3.id, text_value: 'hola', updated_by: cuentas.a1.id },
    })
    afirmar(G6, 'texto en un criterio también', '22023', textoEnCriterio.codigo)
    if (matrizA1.form) {
      const r = await enviar(rutaAlumno, matrizA1.form, a1, {
        [`celda:${clave(c3, col1)}`]: 'abc',
        [`orig:${clave(c3, col1)}`]: '',
      })
      afirmar(G6, 'y por el formulario se explica', true, (await r.text()).includes('Escribe un número entero'))
    }

    // Dos guardados cruzados. a2 manda un formulario VIEJO (de antes del 8 de
    // a1) donde solo cambió Y: la celda X viaja vacía con orig vacío, o sea
    // "sin tocar", y no debe pisar el 8.
    const matrizA2 = leerMatriz(paginaA2)
    if (matrizA2.form) {
      await enviar(rutaAlumno, matrizA2.form, a2, {
        [`celda:${clave(c1, col1)}`]: '',
        [`orig:${clave(c1, col1)}`]: '',
        [`celda:${clave(c2, col1)}`]: '5',
        [`orig:${clave(c2, col1)}`]: '',
      })
    }
    const xDespues = await celdaDe(c1, col1)
    const y = await celdaDe(c2, col1)
    afirmar(G6, 'lo que no se tocó no se pisa: X sigue en 8', 8, xDespues?.numeric_value ?? null)
    afirmar(G6, 'y sigue firmada por a1', cuentas.a1.id, xDespues?.updated_by ?? null)
    afirmar(G6, 'Y quedó en 5', 5, y?.numeric_value ?? null)
    afirmar(G6, 'firmada por a2', cuentas.a2.id, y?.updated_by ?? null)

    const paginaA1Firmas = await texto(rutaAlumno, a1)
    afirmar(
      G6,
      'a1 ve las iniciales de a2 en la celda ajena',
      true,
      paginaA1Firmas.includes(`title="Calificó ${cuentas.a2.nombre}"`)
    )
    afirmar(
      G6,
      'pero no las suyas en la propia',
      false,
      paginaA1Firmas.includes(`title="Calificó ${cuentas.a1.nombre}"`)
    )
    afirmar(
      G6,
      'y el lector de pantalla también sabe quién fue',
      true,
      sinComentarios(paginaA1Firmas).includes(`Calificó ${cuentas.a2.nombre}`)
    )

    // ====================================================================
    const G7 = 'PONDERADO: PÁGINA = CÁLCULO INDEPENDIENTE'

    const VECTOR = [10, 4, 7, 8, 9]
    const esperado = ponderadoIndependiente(PESOS, VECTOR)
    afirmar(G7, 'la suite calcula 7.9 por su cuenta', 7.9, esperado)

    const matrizLlena = leerMatriz(await texto(rutaAlumno, a1))
    if (matrizLlena.form) {
      const cambios = {}
      criterios.forEach((c, i) => {
        cambios[`celda:${clave(c, col1)}`] = String(VECTOR[i])
        cambios[`orig:${clave(c, col1)}`] = matrizLlena.celdas[`orig:${clave(c, col1)}`] ?? ''
      })
      await enviar(rutaAlumno, matrizLlena.form, a1, cambios)
    }
    const { rows: llenas } = await bd.query(
      'select numeric_value from academia.dynamic_cells where column_id = $1 and row_id = any($2) order by row_id',
      [col1.id, criterios.map((c) => c.id)]
    )
    afirmar(G7, 'la columna quedó completa', criterios.length, llenas.length)

    const paginaPonderado = sinComentarios(await texto(rutaAlumno, a1))
    afirmar(G7, 'la página pinta el ponderado', true, paginaPonderado.includes(esperado.toFixed(1)))
    afirmar(G7, 'y lo marca como el mejor', true, paginaPonderado.includes('Mejor'))
    afirmar(G7, 'la columna incompleta muestra "—"', true, paginaPonderado.includes('—'))
    afirmar(G7, 'y cuántos criterios le faltan', true, paginaPonderado.includes(`faltan ${criterios.length}`))

    // ====================================================================
    const G8 = 'ACCESO VENCIDO: ESTRUCTURA SÍ, CONTENIDO NO'

    const respuestaV1 = await pedir(rutaAlumno, v1)
    afirmar(G8, 'el vencido entra a la dinámica (200)', 200, respuestaV1.status)
    const paginaV1 = await respuestaV1.text()
    afirmar(G8, 'se le dice que su acceso venció', true, paginaV1.includes('Tu acceso a este curso venció'))
    afirmar(G8, 've el tablero de su empresa', true, paginaV1.includes('QA Proyecto 1'))
    afirmar(G8, 'pero sin una sola celda editable', false, paginaV1.includes('name="celda:'))
    afirmar(G8, 'ni el formulario de guardar', false, paginaV1.includes('id="matriz"'))

    if (matrizLlena.form) {
      await enviar(rutaAlumno, matrizLlena.form, v1, {
        [`celda:${clave(c1, col2)}`]: '3',
        [`orig:${clave(c1, col2)}`]: '',
      })
    }
    afirmar(G8, 'si reenvía el formulario de otro, no escribe', null, await celdaDe(c1, col2))

    const celdaV1 = await escribirTabla('dynamic_cells', {
      jwt: jwtV1,
      cuerpo: { board_id: boardId, column_id: col2.id, row_id: c1.id, numeric_value: 3, updated_by: cuentas.v1.id },
    })
    afirmar(G8, 'y por PostgREST la policy lo corta', '42501', celdaV1.codigo)
    afirmar(
      G8,
      'aunque sí puede LEER el tablero (estructura)',
      true,
      ((await leerTabla('dynamic_boards', { jwt: jwtV1, select: 'id' })).filas ?? []).some((b) => b.id === boardId)
    )

    // ====================================================================
    const G9 = 'CIERRE: MANUAL, POR FECHA Y REAPERTURA'

    const formCerrar = formConTexto(await texto(rutaConfig, admin), 'Cerrar la dinámica')
    afirmar(G9, 'abierta, configuración ofrece "Cerrar la dinámica"', true, Boolean(formCerrar))
    if (formCerrar) await enviar(rutaConfig, formCerrar, admin, { id: dinamica.id })
    const cerrada = await estadoDe()
    afirmar(G9, 'cerrar la cierra', 'closed', cerrada.status)
    afirmar(G9, 'con hora de cierre', true, Boolean(cerrada.closed_at))

    const escrituraCerrada = await escribirTabla('dynamic_cells', {
      jwt: jwtA1,
      cuerpo: { board_id: boardId, column_id: col2.id, row_id: c2.id, numeric_value: 6, updated_by: cuentas.a1.id },
    })
    afirmar(G9, 'cerrada, el alumno ya no escribe', '42501', escrituraCerrada.codigo)
    const paginaCerrada = await texto(rutaAlumno, a1)
    afirmar(G9, 'y su pantalla no trae celdas editables', false, paginaCerrada.includes('name="celda:'))
    afirmar(G9, 'le dice que cerró', true, paginaCerrada.includes('Esta dinámica cerró'))

    const formReabrir = formConTexto(await texto(rutaConfig, admin), 'Reabrir la dinámica')
    afirmar(G9, 'cerrada, ofrece "Reabrir la dinámica"', true, Boolean(formReabrir))
    if (formReabrir) await enviar(rutaConfig, formReabrir, admin, { id: dinamica.id })
    const reabierta = await estadoDe()
    afirmar(G9, 'reabrir la abre', 'open', reabierta.status)
    afirmar(
      G9,
      'y renueva la hora de apertura (la campana vuelve a avisar)',
      true,
      new Date(reabierta.opened_at).getTime() > new Date(abierta.opened_at).getTime()
    )
    const escrituraReabierta = await escribirTabla('dynamic_cells', {
      jwt: jwtA1,
      cuerpo: { board_id: boardId, column_id: col2.id, row_id: c2.id, numeric_value: 6, updated_by: cuentas.a1.id },
    })
    afirmar(G9, 'reabierta, el alumno vuelve a escribir', 6, escrituraReabierta.filas?.[0]?.numeric_value ?? null)

    // Cierre por fecha: perezoso, evaluado al leer, en UNA función.
    await bd.query(
      "update academia.dynamics set closes_at = now() - interval '1 minute' where id = $1",
      [dinamica.id]
    )
    const { rows: abiertaSegunBase } = await bd.query('select academia.dinamica_abierta($1) abierta', [dinamica.id])
    afirmar(G9, 'con fecha límite pasada, la base la da por cerrada', false, abiertaSegunBase[0].abierta)
    afirmar(G9, 'aunque el status siga en open', 'open', (await estadoDe()).status)

    const escrituraVencida = await escribirTabla('dynamic_cells', {
      jwt: jwtA1,
      cuerpo: { board_id: boardId, column_id: col2.id, row_id: c3.id, numeric_value: 5, updated_by: cuentas.a1.id },
    })
    afirmar(G9, 'y ya no deja escribir', '42501', escrituraVencida.codigo)
    afirmar(G9, 'la lista del alumno la muestra "Cerrada"', true, (await texto('/dinamicas', a1)).includes('>Cerrada<'))

    const configVencida = await texto(rutaConfig, admin)
    const formReabrirVencida = formConTexto(configVencida, 'Reabrir la dinámica')
    afirmar(G9, 'configuración la trata como cerrada: ofrece reabrir', true, Boolean(formReabrirVencida))
    afirmar(G9, 'y pide fecha nueva', true, configVencida.includes('name="cierra_fecha"') && configVencida.includes('La fecha límite ya pasó'))
    if (formReabrirVencida) {
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const r = await enviar(rutaConfig, formReabrirVencida, admin, {
        id: dinamica.id,
        cierra_fecha: ayer,
        cierra_hora: '10:00',
      })
      afirmar(G9, 'reabrir con una fecha pasada se rechaza con mensaje', true, (await r.text()).includes('ya pasó'))
      const sinFecha = await enviar(rutaConfig, formReabrirVencida, admin, {
        id: dinamica.id,
        cierra_fecha: '',
        cierra_hora: '',
      })
      afirmar(G9, 'y sin fecha también', true, (await sinFecha.text()).includes('ya pasó'))
    }
    afirmar(G9, 'la fecha vencida sigue puesta', true, new Date((await estadoDe()).closes_at).getTime() < Date.now())

    // Se le quita la fecha: vuelve a estar abierta de verdad.
    await bd.query('update academia.dynamics set closes_at = null where id = $1', [dinamica.id])
    const { rows: abiertaDeNuevo } = await bd.query('select academia.dinamica_abierta($1) abierta', [dinamica.id])
    afirmar(G9, 'sin fecha límite vuelve a estar abierta', true, abiertaDeNuevo[0].abierta)

    // ====================================================================
    const G10 = 'SONDEO DEL TABLERO (ETag)'

    const rutaEstado = `/api/dinamicas/${boardId}/estado`
    afirmar(G10, 'sin sesión, 401', 401, (await pedir(rutaEstado, null)).status)
    afirmar(G10, 'quien no es miembro, 404', 404, (await pedir(rutaEstado, g1)).status)

    const estado1 = await pedir(rutaEstado, a1)
    const etag = estado1.headers.get('etag')
    afirmar(G10, 'el miembro, 200', 200, estado1.status)
    afirmar(G10, 'con ETag', true, Boolean(etag))
    afirmar(G10, 'que dice que está abierta', true, (etag ?? '').endsWith('-open"'))
    const estado2 = await pedir(rutaEstado, a1, { headers: { 'if-none-match': etag ?? '' } })
    afirmar(G10, 'con el mismo ETag contesta 304', 304, estado2.status)

    const puntuada = await escribirTabla('dynamic_cells', {
      jwt: jwtA1,
      cuerpo: { board_id: boardId, column_id: col2.id, row_id: c3.id, numeric_value: 5, updated_by: cuentas.a1.id },
    })
    afirmar(G10, 'una calificación entra', 5, puntuada.filas?.[0]?.numeric_value ?? null)
    const estado3 = await pedir(rutaEstado, a1, { headers: { 'if-none-match': etag ?? '' } })
    afirmar(G10, 'y el ETag cambia: ya no es 304', 200, estado3.status)
    afirmar(G10, 'con una etiqueta distinta', true, Boolean(estado3.headers.get('etag')) && estado3.headers.get('etag') !== etag)

    // Un proyecto cuyo nombre empieza con "=": para el Excel de G13.
    const formulaComoNombre = await escribirTabla('dynamic_columns', {
      jwt: jwtA1,
      cuerpo: { board_id: boardId, label: '=1+1 QA fórmula', position: 99, created_by: cuentas.a1.id },
    })
    afirmar(G10, 'un proyecto llamado "=1+1…" se guarda como texto', '=1+1 QA fórmula', formulaComoNombre.filas?.[0]?.label ?? null)

    // ====================================================================
    // Abierta y recién reabierta: la campana tiene que avisar.
    const G12 = 'CAMPANA'

    const inicioA1 = await texto('/mis-cursos', a1)
    const nuevasEn = (html) => Number(html.match(/data-nuevas="(\d+)"/)?.[1] ?? -1)
    const nuevasAntes = nuevasEn(inicioA1)
    afirmar(G12, 'la campana cuenta algo nuevo', true, nuevasAntes >= 1)
    afirmar(G12, 'lista la dinámica con su etiqueta', true, sinComentarios(inicioA1).includes('Dinámica ·'))
    afirmar(G12, 'con su título', true, inicioA1.includes(TITULO_QA))
    afirmar(G12, 'y enlaza a su tablero', true, inicioA1.includes(`href="${rutaAlumno}"`))

    const formVistas = leerFormularios(inicioA1).find((f) => f.html.includes('Marcar como vistas'))
    afirmar(G12, 'ofrece "Marcar como vistas" sin JavaScript', true, Boolean(formVistas))
    if (formVistas) await enviar('/mis-cursos', formVistas, a1)
    const { rows: vistas } = await bd.query(
      'select notifications_seen_at from academia.profiles where user_id = $1',
      [cuentas.a1.id]
    )
    afirmar(G12, 'marcarlas sella la hora en el perfil', true, Boolean(vistas[0]?.notifications_seen_at))
    const nuevasDespues = nuevasEn(await texto('/mis-cursos', a1))
    afirmar(G12, 'y la dinámica deja de contar como nueva', true, nuevasDespues >= 0 && nuevasDespues < nuevasAntes)

    // ====================================================================
    const G11 = 'PUNTOS: CALCULADOS AL CIERRE, NUNCA GUARDADOS'

    const dinamicasDeActividad = async (jwt, userId) =>
      ((await leerTabla('actividad_por_curso', {
        jwt,
        select: 'user_id,course_id,dinamicas',
        filtro: `course_id=eq.${IDS.curso}`,
      })).filas ?? []).find((f) => f.user_id === userId)?.dinamicas ?? null

    afirmar(G11, 'abierta, todavía no suma', 0, await dinamicasDeActividad(jwtA1, cuentas.a1.id))

    const formCerrar2 = formConTexto(await texto(rutaConfig, admin), 'Cerrar la dinámica')
    if (formCerrar2) await enviar(rutaConfig, formCerrar2, admin, { id: dinamica.id })
    afirmar(G11, 'se cierra', 'closed', (await estadoDe()).status)

    afirmar(G11, 'cerrada con un proyecto completo, a1 suma 1', 1, await dinamicasDeActividad(jwtA1, cuentas.a1.id))
    afirmar(G11, 'y a2, que comparte tablero, también', 1, await dinamicasDeActividad(jwtA2, cuentas.a2.id))
    afirmar(G11, 'g1, sin proyecto completo, no', 0, await dinamicasDeActividad(jwtG1, cuentas.g1.id))
    afirmar(
      G11,
      'la pantalla de a1 anuncia los puntos',
      true,
      /\+\s*(<!--\s*-->)?30(<!--\s*-->)?\s*puntos/.test(await texto(rutaAlumno, a1))
    )

    const formReabrir2 = formConTexto(await texto(rutaConfig, admin), 'Reabrir la dinámica')
    if (formReabrir2) await enviar(rutaConfig, formReabrir2, admin, { id: dinamica.id })
    afirmar(G11, 'reabrir la deja abierta', 'open', (await estadoDe()).status)
    afirmar(G11, 'y los puntos vuelven a 0: es cálculo vivo', 0, await dinamicasDeActividad(jwtA1, cuentas.a1.id))

    const formCerrar3 = formConTexto(await texto(rutaConfig, admin), 'Cerrar la dinámica')
    if (formCerrar3) await enviar(rutaConfig, formCerrar3, admin, { id: dinamica.id })
    afirmar(G11, 'se vuelve a cerrar', 'closed', (await estadoDe()).status)

    // ====================================================================
    const G13 = 'EXPORTACIÓN A EXCEL'

    const rutaExcel = `/api/reportes/dinamicas/${dinamica.id}/excel`
    afirmar(G13, 'sin sesión, 401', 401, (await pedir(rutaExcel, null)).status)
    afirmar(G13, 'un alumno, 404', 404, (await pedir(rutaExcel, a1)).status)

    const excel = await pedir(rutaExcel, admin)
    afirmar(G13, 'el admin lo descarga', 200, excel.status)
    afirmar(
      G13,
      'con el content-type de xlsx',
      true,
      (excel.headers.get('content-type') ?? '').includes('spreadsheetml.sheet')
    )
    afirmar(
      G13,
      'como adjunto con nombre legible',
      true,
      /attachment; filename="dinamica-qa-dinamica-de-prueba-test-dinamicas-\d{4}-\d{2}-\d{2}\.xlsx"/.test(
        excel.headers.get('content-disposition') ?? ''
      )
    )

    const bytes = Buffer.from(await excel.arrayBuffer())
    afirmar(G13, 'los bytes son un ZIP', 'PK', bytes.subarray(0, 2).toString('latin1'))
    const libro = leerZip(bytes)
    afirmar(G13, 'el directorio central se recorre entero', true, libro.ok)
    afirmar(G13, 'el CRC de cada entrada cuadra', true, libro.crcOk)

    const workbook = libro.entradas.get('xl/workbook.xml')?.toString('utf8') ?? ''
    afirmar(G13, 'la primera hoja es el resumen', true, workbook.includes('name="Resumen" sheetId="1"'))
    const { rows: totalTableros } = await bd.query(
      'select count(*)::int n from academia.dynamic_boards where dynamic_id = $1',
      [dinamica.id]
    )
    afirmar(G13, 'una hoja por tablero, más el resumen', totalTableros[0].n + 1, (workbook.match(/<sheet /g) ?? []).length)
    afirmar(G13, 'la hoja de la empresa lleva su nombre', true, workbook.includes(`name="${EMPRESA_QA}"`))

    const hojas = [...libro.entradas.entries()]
      .filter(([n]) => n.startsWith('xl/worksheets/sheet'))
      .map(([, b]) => b.toString('utf8'))
    const todasLasHojas = hojas.join('')
    afirmar(G13, 'el resumen trae el título', true, (libro.entradas.get('xl/worksheets/sheet1.xml')?.toString('utf8') ?? '').includes(TITULO_QA))
    afirmar(G13, 'ninguna celda es fórmula', false, todasLasHojas.includes('<f>'))
    afirmar(
      G13,
      'el proyecto "=1+1…" viaja como texto literal',
      true,
      todasLasHojas.includes('t="inlineStr"><is><t xml:space="preserve">=1+1 QA fórmula</t>')
    )
    afirmar(G13, 'el ponderado va como número, el mismo de la página', true, todasLasHojas.includes(`<v>${esperado}</v>`))
    afirmar(G13, 'y dice quién calificó', true, todasLasHojas.includes(cuentas.a2.nombre))

    // ====================================================================
    const G14 = 'EL EQUIPO EDITA AUNQUE ESTÉ CERRADA'

    const respuestaTableroAdmin = await pedir(rutaTableroAdmin, admin)
    afirmar(G14, 'el admin abre el tablero cerrado', 200, respuestaTableroAdmin.status)
    const paginaTableroAdmin = await respuestaTableroAdmin.text()
    afirmar(G14, 'y se le avisa que está cerrada', true, paginaTableroAdmin.includes('Esta dinámica está cerrada'))
    afirmar(G14, 'un alumno no entra ahí', 307, (await pedir(rutaTableroAdmin, a1)).status)

    const matrizAdmin = leerMatriz(paginaTableroAdmin)
    afirmar(G14, 'con el tablero editable', true, Boolean(matrizAdmin.form) && paginaTableroAdmin.includes('name="celda:'))
    if (matrizAdmin.form) {
      const r = await enviar(rutaTableroAdmin, matrizAdmin.form, admin, {
        [`celda:${clave(c4, col2)}`]: '7',
        [`orig:${clave(c4, col2)}`]: matrizAdmin.celdas[`orig:${clave(c4, col2)}`] ?? '',
      })
      afirmar(G14, 'guardar confirma el cambio', true, (await r.text()).includes('Guardado: 1 cambio'))
    }
    const celdaAdmin = await celdaDe(c4, col2)
    afirmar(G14, 'la celda cambió aunque esté cerrada', 7, celdaAdmin?.numeric_value ?? null)
    afirmar(G14, 'firmada por el admin', idAdmin, celdaAdmin?.updated_by ?? null)

    // ====================================================================
    const G15 = 'LIMPIEZA'

    // "Ajeno" = todo lo que esta suite NO creó.
    const contarPerfilesAjenos = async () =>
      (await bd.query('select count(*)::int n from academia.profiles where email <> all($1)', [CORREOS_QA])).rows[0].n
    const contarCursos = async () => (await bd.query('select count(*)::int n from academia.courses')).rows[0].n
    const contarEmpresasAjenas = async () =>
      (await bd.query('select count(*)::int n from academia.companies where name <> $1', [EMPRESA_QA])).rows[0].n

    const perfilesAntes = await contarPerfilesAjenos()
    const cursosAntes = await contarCursos()
    const empresasAntes = await contarEmpresasAjenas()

    await limpiar(bd)

    const { rows: quedan } = await bd.query('select count(*)::int n from academia.dynamics where title = $1', [TITULO_QA])
    afirmar(G15, 'la dinámica de prueba ya no existe', 0, quedan[0].n)
    const { rows: tablerosHuerfanos } = await bd.query(
      'select count(*)::int n from academia.dynamic_boards where dynamic_id = $1',
      [dinamica.id]
    )
    afirmar(G15, 'sus tableros se fueron en cascada', 0, tablerosHuerfanos[0].n)
    const { rows: celdasHuerfanas } = await bd.query(
      'select count(*)::int n from academia.dynamic_cells where board_id = $1',
      [boardId]
    )
    afirmar(G15, 'y sus calificaciones también', 0, celdasHuerfanas[0].n)
    const { rows: empresaQueda } = await bd.query('select count(*)::int n from academia.companies where name = $1', [EMPRESA_QA])
    afirmar(G15, 'la empresa de prueba ya no existe', 0, empresaQueda[0].n)
    const { rows: perfilesQa } = await bd.query('select count(*)::int n from academia.profiles where email = any($1)', [CORREOS_QA])
    afirmar(G15, 'ni los perfiles qa-din-*', 0, perfilesQa[0].n)
    let cuentasVivas = 0
    for (const email of CORREOS_QA) if (await buscarCuenta(email)) cuentasVivas += 1
    afirmar(G15, 'ni sus cuentas de auth', 0, cuentasVivas)

    afirmar(G15, 'no se tocó ningún perfil ajeno', perfilesAntes, await contarPerfilesAjenos())
    afirmar(G15, 'ni ningún curso', cursosAntes, await contarCursos())
    afirmar(G15, 'ni ninguna otra empresa', empresasAntes, await contarEmpresasAjenas())
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
