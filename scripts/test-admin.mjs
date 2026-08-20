#!/usr/bin/env node
/**
 * test-admin.mjs — Criterio de cierre de M3.
 *
 * Prueba el admin ejecutando sus server actions DE VERDAD.
 *
 * El truco: cuando Next renderiza un `<form action={serverAction}>` incluye un
 * campo oculto `$ACTION_ID_<hash>`. Ese campo es la ruta de mejora progresiva:
 * es lo que permite que el formulario funcione sin JavaScript. Aquí se lee el
 * formulario del HTML y se reenvía tal cual, así que se ejecuta exactamente el
 * mismo código que correría un navegador con JS apagado.
 *
 * Requiere la app corriendo:
 *   PORT=3117 pnpm start
 *   node scripts/test-admin.mjs
 */

import { cargarEnv, exigir } from './lib/entorno.mjs'
import { CLAVE_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

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
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
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

const pedir = (ruta, frasco, opciones = {}) =>
  fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    ...opciones,
    headers: { ...(frasco?.tamano ? { cookie: frasco.encabezado() } : {}), ...(opciones.headers ?? {}) },
  })

const rutaDestino = (respuesta) => {
  const ubicacion = respuesta.headers.get('location')
  return ubicacion ? new URL(ubicacion, APP).pathname : null
}

// --- lectura de formularios del HTML ---------------------------------------

/** Extrae todos los `<form>` con sus inputs ocultos. */
function leerFormularios(html) {
  const formularios = []
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    const campos = {}
    let accion = null

    for (const input of bloque[1].matchAll(/<input\b[^>]*>/g)) {
      const etiqueta = input[0]
      const nombre = etiqueta.match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      if (nombre.startsWith('$ACTION_ID_')) {
        accion = nombre
        campos[nombre] = ''
        continue
      }
      const valor = etiqueta.match(/value="([^"]*)"/)?.[1] ?? ''
      campos[nombre] = valor.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    }

    // Los botones también viajan; aquí no hacen falta porque las acciones leen
    // solo los ocultos.
    if (accion) formularios.push({ accion, campos, html: bloque[0] })
  }
  return formularios
}

/** Reenvía un formulario como lo haría un navegador sin JavaScript. */
async function enviarFormulario(ruta, formulario, frasco) {
  const cuerpo = new FormData()
  for (const [nombre, valor] of Object.entries(formulario.campos)) {
    cuerpo.append(nombre, valor)
  }
  const respuesta = await pedir(ruta, frasco, { method: 'POST', body: cuerpo })
  frasco.guardar(respuesta)
  return respuesta
}

// --- lectura directa de la base (para comprobar efectos) -------------------

async function posicionesDeModulos() {
  const token = await tokenDeAdmin()
  const respuesta = await fetch(
    `${SUPABASE}/rest/v1/modules?course_id=eq.${IDS.curso}&select=id,title,position&order=position`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Accept-Profile': 'academia' } }
  )
  return await respuesta.json()
}

let tokenCache = null
async function tokenDeAdmin() {
  if (tokenCache) return tokenCache
  const respuesta = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo.admin, password: CLAVE_QA }),
  })
  const cuerpo = await respuesta.json()
  tokenCache = cuerpo.access_token
  return tokenCache
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
  console.log('  PRUEBA DEL ADMIN — M3')
  console.log(`  App: ${APP}`)

  for (const [grupo, casos] of porGrupo) {
    console.log('')
    console.log(`  ${grupo}`)
    console.log('  ' + '─'.repeat(ancho + 30))
    for (const c of casos) {
      console.log(
        `  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ` +
          (c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`)
      )
    }
  }

  const fallidas = resultados.filter((r) => !r.ok)
  console.log('')
  console.log('  ' + '─'.repeat(ancho + 30))
  console.log(
    fallidas.length === 0
      ? `  M3 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

// --- main ------------------------------------------------------------------

async function main() {
  const admin = await iniciarSesion(correo.admin)
  const alumno = await iniciarSesion(correo.alumnoVigente)

  // ======================================================================
  const G1 = 'ACCESO AL ADMIN'

  afirmar(G1, 'el admin ve el listado', 200, (await pedir('/admin/cursos', admin)).status)
  afirmar(G1, 'el admin ve el formulario de alta', 200, (await pedir('/admin/cursos/nuevo', admin)).status)
  afirmar(
    G1,
    'el alumno no entra al admin',
    '/mis-cursos',
    rutaDestino(await pedir('/admin/cursos', alumno))
  )
  afirmar(
    G1,
    'el alumno no entra a una lección',
    '/mis-cursos',
    rutaDestino(await pedir(`/admin/lecciones/${IDS.leccionVideo}`, alumno))
  )

  // ======================================================================
  const G2 = 'LISTADO Y DETALLE'

  const listado = await (await pedir('/admin/cursos', admin)).text()
  afirmar(G2, 'aparece el curso sembrado', true, listado.includes('Curso de prueba'))
  afirmar(G2, 'aparece el curso ajeno', true, listado.includes('Curso ajeno'))

  const detalle = await (await pedir(`/admin/cursos/${IDS.curso}`, admin)).text()
  afirmar(G2, 'aparecen los dos módulos', true,
    detalle.includes('Fundamentos') && detalle.includes('Implementaci'))
  afirmar(G2, 'aparecen las lecciones', true, detalle.includes('Video de bienvenida'))
  afirmar(G2, 'la lección en borrador se marca', true, detalle.includes('Borrador'))

  const leccion = await (await pedir(`/admin/lecciones/${IDS.leccionVideo}`, admin)).text()
  afirmar(G2, 'la lección abre su editor', true, leccion.includes('GUID de Bunny'))
  afirmar(G2, 'muestra su adjunto', true, leccion.includes('guia-qa.pdf'))

  // ======================================================================
  // Lo más delicado que escribí en M3: el intercambio de posiciones.
  const G3 = 'REORDENAR (server action real, sin JavaScript)'

  const antes = await posicionesDeModulos()
  const primeroAntes = antes[0]?.title ?? ''

  const formularios = leerFormularios(detalle)
  const bajar = formularios.find(
    (f) => f.campos.id === antes[0]?.id && f.campos.direccion === 'abajo'
  )

  afirmar(G3, 'se encontró el formulario de mover', true, Boolean(bajar))

  if (bajar) {
    const respuesta = await enviarFormulario(`/admin/cursos/${IDS.curso}`, bajar, admin)
    afirmar(G3, 'la acción responde sin error', true, respuesta.status < 400)

    const despues = await posicionesDeModulos()
    afirmar(G3, 'el primer módulo bajó', true, despues[0]?.title !== primeroAntes)
    afirmar(G3, 'no se perdió ningún módulo', antes.length, despues.length)
    afirmar(
      G3,
      'las posiciones siguen siendo únicas',
      despues.length,
      new Set(despues.map((m) => m.position)).size
    )

    // Se deja como estaba, para que el script sea re-corrible.
    const detalle2 = await (await pedir(`/admin/cursos/${IDS.curso}`, admin)).text()
    const subir = leerFormularios(detalle2).find(
      (f) => f.campos.id === antes[0]?.id && f.campos.direccion === 'arriba'
    )
    if (subir) await enviarFormulario(`/admin/cursos/${IDS.curso}`, subir, admin)

    const restaurado = await posicionesDeModulos()
    afirmar(G3, 'el orden se restauró', primeroAntes, restaurado[0]?.title ?? '')
  }

  process.exitCode = imprimir() ? 0 : 1
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
