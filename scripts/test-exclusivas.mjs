#!/usr/bin/env node
/**
 * test-exclusivas.mjs — Sesiones exclusivas (0038, 9-oct-2026).
 *
 * El criterio literal de Alejandro: ocultar una sesión desde el panel, elegir
 * a mano quiénes entran (solo inscritos de la generación), guardarlo y volver
 * a agregar o quitar cuando quiera; quien no está en la lista la ve con
 * candado. Se prueba contra la app corriendo y se verifica en Postgres.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-exclusivas.mjs
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))
const MODULO = IDS.modulo1
const LECCION = IDS.leccionVideo
const ACCESO = `/admin/modulos/${MODULO}/acceso`
const CURSO = `/curso/${CURSO_QA.slug}`

// --- sesión -----------------------------------------------------------------

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

async function entrar(email) {
  const enlace = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'recovery', email }),
  })
  const cuerpo = await enlace.json()
  const hash = cuerpo.hashed_token ?? cuerpo.properties?.hashed_token
  if (!hash) throw new Error(`No se pudo generar enlace para ${email}. ¿Corriste \`pnpm db:seed\`?`)
  const frasco = crearFrasco()
  frasco.guardar(await fetch(`${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`, { redirect: 'manual' }))
  return frasco
}

const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    ...opciones,
    headers: { ...(frasco?.tamano ? { cookie: frasco.encabezado() } : {}), ...(opciones.headers ?? {}) },
  })
const texto = async (ruta, frasco) => await (await pedir(ruta, frasco)).text()
const destino = (res) => {
  const l = res.headers.get('location')
  return l ? new URL(l, APP).pathname : null
}

/**
 * Guarda la lista como lo haría el formulario: las casillas marcadas son la
 * lista entera. Toma del HTML solo los campos de la acción (los $ACTION_*) y
 * `modulo_id`; las casillas las decide la prueba.
 */
async function guardar(frasco, { exclusiva, miembros, avisar = false }) {
  const html = await texto(ACCESO, frasco)
  const bloque = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].find((b) => b[1].includes('name="modulo_id"'))
  if (!bloque) return { status: 0, html: '' }
  const cuerpo = new FormData()
  for (const etiqueta of bloque[1].matchAll(/<input\b[^>]*>/g)) {
    const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
    if (!nombre || !(nombre.startsWith('$ACTION') || nombre === 'modulo_id')) continue
    const valor = (etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    cuerpo.append(nombre, valor)
  }
  if (exclusiva) cuerpo.append('exclusiva', 'si')
  if (avisar) cuerpo.append('avisar', 'si')
  for (const id of miembros) cuerpo.append('miembros', id)
  const res = await pedir(ACCESO, frasco, { method: 'POST', body: cuerpo })
  return { status: res.status, html: await res.text() }
}

// --- reporte ----------------------------------------------------------------

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
  console.log('  PRUEBA DE SESIONES EXCLUSIVAS — 0038')
  console.log(`  App: ${APP}`)
  for (const [grupo, casos] of porGrupo) {
    console.log('')
    console.log(`  ${grupo}`)
    console.log('  ' + '─'.repeat(ancho + 30))
    for (const c of casos) {
      console.log(`  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ` + (c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`))
    }
  }
  const fallidas = resultados.filter((r) => !r.ok)
  console.log('')
  console.log('  ' + '─'.repeat(ancho + 30))
  console.log(
    fallidas.length === 0
      ? `  EXCLUSIVAS EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  console.log('')
  return fallidas.length === 0
}

// --- main -------------------------------------------------------------------

async function main() {
  const bd = await conectarPostgres(vars)
  const id = async (email) => (await bd.query(`select user_id from academia.profiles where email = $1`, [email])).rows[0]?.user_id
  const ids = { alumno: await id(correo.alumnoVigente), cm: await id(correo.cm) }
  const { rows: [sesion] } = await bd.query(`select recording_lesson_id from academia.cohort_sessions where id = $1`, [IDS.sesionPasada])

  // Lo suyo, siempre de vuelta como estaba: otras suites usan este módulo.
  const restaurar = async () => {
    await bd.query(`delete from academia.module_members where module_id = $1`, [MODULO])
    await bd.query(`update academia.modules set is_restricted = false where id = $1`, [MODULO])
    await bd.query(`update academia.cohort_sessions set recording_lesson_id = $2 where id = $1`, [IDS.sesionPasada, sesion?.recording_lesson_id ?? null])
  }

  try {
    await restaurar()
    // La grabación de la sesión pasada vive en el módulo que se vuelve exclusivo.
    await bd.query(`update academia.cohort_sessions set recording_lesson_id = $2 where id = $1`, [IDS.sesionPasada, LECCION])

    const [admin, cm, alumno] = await Promise.all([entrar(correo.admin), entrar(correo.cm), entrar(correo.alumnoVigente)])

    // ================================================================
    const G1 = 'LA PANTALLA DE ACCESO'
    const pagina = await pedir(ACCESO, admin)
    afirmar(G1, 'abre para el admin', 200, pagina.status)
    const html = await pagina.text()
    afirmar(G1, 'enseña el interruptor «Sesión exclusiva»', true, html.includes('Sesión exclusiva'))
    afirmar(G1, 'lista a los inscritos de la generación', true, html.includes('QA Alumno Vigente'))
    afirmar(G1, 'con una casilla por persona', true, html.includes(`name="miembros" value="${ids.alumno}"`))
    afirmar(G1, 'no lista al equipo', false, html.includes(`value="${ids.cm}"`))
    afirmar(G1, 'trae buscador', true, html.includes('Nombre, correo o empresa'))
    afirmar(G1, 'abre para el community manager', 200, (await pedir(ACCESO, cm)).status)
    afirmar(G1, 'un alumno no entra', '/mis-cursos', destino(await pedir(ACCESO, alumno)))
    const temario = await texto(`/admin/cursos/${IDS.curso}?gen=${IDS.cohorte}&modulo=${MODULO}`, admin)
    afirmar(G1, 'el temario del panel lleva a la lista', true,
      temario.includes(`href="/admin/modulos/${MODULO}/acceso"`) && temario.includes('Hacerla exclusiva'))

    // ================================================================
    const G2 = 'EXCLUSIVA SIN NADIE: CANDADO PARA TODOS'
    let r = await guardar(admin, { exclusiva: true, miembros: [] })
    afirmar(G2, 'guarda', true, r.html.includes('Guardado. La sesión es exclusiva'))
    const { rows: [m1] } = await bd.query(`select is_restricted from academia.modules where id = $1`, [MODULO])
    afirmar(G2, 'queda exclusiva en la base', true, m1.is_restricted)
    let curso = await texto(CURSO, alumno)
    afirmar(G2, 'el alumno la ve con candado', true, curso.includes('Sesión exclusiva para un grupo de tu generación'))
    afirmar(G2, 'sin liga a la lección', false, curso.includes(`href="${CURSO}/${LECCION}"`))
    afirmar(G2, 'abrir la lección a mano lo regresa al curso', CURSO, destino(await pedir(`${CURSO}/${LECCION}`, alumno)))
    const envivo = await texto(`${CURSO}/en-vivo?vista=lista`, alumno)
    afirmar(G2, 'en En vivo, la grabación dice que es exclusiva', true,
      envivo.includes('Grabación exclusiva') && !envivo.includes(`href="${CURSO}/${LECCION}"`))
    afirmar(G2, 'el equipo la sigue abriendo', 200, (await pedir(`${CURSO}/${LECCION}`, admin)).status)

    // ================================================================
    const G3 = 'AGREGAR A ALGUIEN'
    r = await guardar(admin, { exclusiva: true, miembros: [ids.alumno] })
    afirmar(G3, 'dice cuántos entraron', true, r.html.includes('1 persona con acceso') && r.html.includes('1 agregada'))
    const { rows: [fila] } = await bd.query(
      `select mm.added_by = p.user_id as del_admin from academia.module_members mm join academia.profiles p on p.email = $3
        where mm.module_id = $1 and mm.user_id = $2`, [MODULO, ids.alumno, correo.admin])
    afirmar(G3, 'queda en la lista, firmado por quien lo agregó', true, fila?.del_admin)
    curso = await texto(CURSO, alumno)
    afirmar(G3, 'el alumno ya la abre', true, curso.includes(`href="${CURSO}/${LECCION}"`))
    afirmar(G3, 'y la ve marcada «Exclusiva»', true, curso.includes('>Exclusiva<'))
    afirmar(G3, 'la lección abre', 200, (await pedir(`${CURSO}/${LECCION}`, alumno)).status)
    afirmar(G3, 'la campana le avisa', true, (await texto('/blog', alumno)).includes('Sesión exclusiva'))
    const lista = await texto(ACCESO, admin)
    // El orden de los atributos lo decide React: se busca la etiqueta entera.
    const casilla = lista.match(new RegExp(`<input[^>]*value="${ids.alumno}"[^>]*>`))?.[0] ?? ''
    afirmar(G3, 'al volver, la lista lo trae marcado', true, casilla.includes('name="miembros"') && casilla.includes('checked'))

    // ================================================================
    const G4 = 'QUITAR Y VALIDAR'
    r = await guardar(cm, { exclusiva: true, miembros: [] })
    afirmar(G4, 'el community manager también guarda', true, r.html.includes('1 quitada'))
    const { rows: quedan } = await bd.query(`select 1 from academia.module_members where module_id = $1`, [MODULO])
    afirmar(G4, 'sale de la lista en la base', 0, quedan.length)
    afirmar(G4, 'el alumno vuelve al candado', false, (await texto(CURSO, alumno)).includes(`href="${CURSO}/${LECCION}"`))
    r = await guardar(admin, { exclusiva: true, miembros: [ids.cm] })
    afirmar(G4, 'no entra alguien que no está inscrito', true, r.html.includes('ya no está inscrito'))
    const { rows: ajeno } = await bd.query(`select 1 from academia.module_members where module_id = $1 and user_id = $2`, [MODULO, ids.cm])
    afirmar(G4, 'y no queda en la base', 0, ajeno.length)

    // ================================================================
    const G5 = 'APAGAR'
    r = await guardar(admin, { exclusiva: false, miembros: [] })
    afirmar(G5, 'apaga la exclusiva', true, r.html.includes('abierta a toda la generación'))
    afirmar(G5, 'el alumno la abre otra vez', true, (await texto(CURSO, alumno)).includes(`href="${CURSO}/${LECCION}"`))
  } finally {
    await restaurar().catch(() => {})
    await bd.end().catch(() => {})
  }

  process.exitCode = imprimir() ? 0 : 1
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
