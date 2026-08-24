#!/usr/bin/env node
/**
 * test-alumno.mjs — Criterio de cierre de M4.
 *
 * El criterio del master document es literal: "Alumno de prueba completa una
 * lección y el % avanza". Aquí se hace exactamente eso, contra la app corriendo:
 * se lee el porcentaje de la página, se completa una lección y se vuelve a leer.
 *
 * Además comprueba lo que separa a un alumno vigente de uno vencido, que es la
 * decisión de diseño más cara de todo el proyecto.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-alumno.mjs
 */

import { cargarEnv, exigir } from './lib/entorno.mjs'
import { CLAVE_QA, CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

// --- sesión por cookies -----------------------------------------------------

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

const pedir = (ruta, frasco) =>
  fetch(`${APP}${ruta}`, {
    redirect: 'manual',
    headers: frasco?.tamano ? { cookie: frasco.encabezado() } : {},
  })

const destino = (respuesta) => {
  const ubicacion = respuesta.headers.get('location')
  return ubicacion ? new URL(ubicacion, APP).pathname : null
}

const texto = async (ruta, frasco) => await (await pedir(ruta, frasco)).text()

/** Lee el porcentaje que la página está mostrando. */
function porcentajeEn(html) {
  const m = html.match(/(\d+)\s*(?:%|&#x25;)/)
  return m ? Number(m[1]) : null
}

// --- escritura directa como el alumno (su propia llave, bajo RLS) -----------

async function tokenDe(email) {
  const r = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: CLAVE_QA }),
  })
  return (await r.json()).access_token
}

async function fijarProgreso(token, usuarioId, leccionId, completada) {
  const r = await fetch(`${SUPABASE}/rest/v1/lesson_progress?on_conflict=user_id,lesson_id`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Profile': 'academia',
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      user_id: usuarioId,
      lesson_id: leccionId,
      completed: completada,
      completed_at: completada ? new Date().toISOString() : null,
    }),
  })
  return r.ok
}

async function idDe(token) {
  const r = await fetch(`${SUPABASE}/rest/v1/profiles?select=user_id`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Accept-Profile': 'academia' },
  })
  const filas = await r.json()
  return Array.isArray(filas) ? filas[0]?.user_id : null
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
  console.log('  PRUEBA DEL ALUMNO — M4')
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
      ? `  M4 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- main ------------------------------------------------------------------

async function main() {
  const vigente = await iniciarSesion(correo.alumnoVigente)
  const vencido = await iniciarSesion(correo.alumnoVencido)

  const tokenVigente = await tokenDe(correo.alumnoVigente)
  const idVigente = await idDe(tokenVigente)

  const rutaCurso = `/curso/${CURSO_QA.slug}`
  const rutaLeccion = `${rutaCurso}/${IDS.leccionVideo}`

  // Punto de partida conocido: las 4 lecciones sin completar.
  for (const leccion of [IDS.leccionVideo, IDS.leccionTexto, IDS.leccionQuiz, IDS.leccionTarea]) {
    await fijarProgreso(tokenVigente, idVigente, leccion, false)
  }

  // ======================================================================
  const G1 = 'ALUMNO VIGENTE'

  const misCursos = await texto('/mis-cursos', vigente)
  afirmar(G1, 've su curso en mis-cursos', true, misCursos.includes(CURSO_QA.title.slice(-16)))
  afirmar(G1, 'arranca en 0%', 0, porcentajeEn(misCursos))
  afirmar(G1, 'no ve el curso ajeno', false, misCursos.includes('Curso ajeno'))

  const paginaCurso = await texto(rutaCurso, vigente)
  afirmar(G1, 'el índice abre', true, paginaCurso.includes('Contenido'))
  afirmar(G1, 've los dos módulos', true,
    paginaCurso.includes('Fundamentos') && paginaCurso.includes('Implementaci'))
  afirmar(G1, 'sin candados', false, paginaCurso.includes('Acceso vencido'))
  afirmar(G1, 'ofrece empezar el curso', true, paginaCurso.includes('Empezar el curso'))

  const paginaLeccion = await texto(rutaLeccion, vigente)
  afirmar(G1, 'la lección abre', 200, (await pedir(rutaLeccion, vigente)).status)
  afirmar(G1, 'monta el iframe de Bunny', true,
    paginaLeccion.includes('iframe.mediadelivery.net'))
  afirmar(G1, 'la URL va firmada', true, /token=[0-9a-f]{64}/.test(paginaLeccion))
  afirmar(G1, 'la firma trae expiración', true, /expires=\d{10}/.test(paginaLeccion))
  afirmar(G1, 'la llave de Bunny NO viaja', false,
    paginaLeccion.includes(vars.BUNNY_STREAM_TOKEN_KEY))
  afirmar(G1, 've el material descargable', true, paginaLeccion.includes('guia-qa.pdf'))

  // ======================================================================
  // El criterio literal del master document.
  const G2 = 'COMPLETAR UNA LECCIÓN Y QUE EL % AVANCE'

  const antes = porcentajeEn(await texto(rutaCurso, vigente))
  afirmar(G2, 'porcentaje inicial', 0, antes)

  await fijarProgreso(tokenVigente, idVigente, IDS.leccionVideo, true)

  const despues = porcentajeEn(await texto(rutaCurso, vigente))
  afirmar(G2, 'tras completar una de cuatro', 25, despues)
  // Se afirma sobre el `aria-label`, no sobre el icono. Antes buscaba el glifo
    // "✓" y se rompió al cambiarlo por un SVG — pero lo que la prueba quiere
    // saber no es qué dibujo hay, es si la lección está anunciada como hecha.
    // De paso comprueba que un lector de pantalla también lo sabe.
  afirmar(G2, 'el índice la marca hecha', true,
    (await texto(rutaCurso, vigente)).includes('aria-label="Completada"'))
  afirmar(G2, 'mis-cursos también avanzó', 25, porcentajeEn(await texto('/mis-cursos', vigente)))

  await fijarProgreso(tokenVigente, idVigente, IDS.leccionTexto, true)
  afirmar(G2, 'dos de cuatro', 50, porcentajeEn(await texto(rutaCurso, vigente)))

  // ======================================================================
  const G3 = 'ALUMNO VENCIDO — estructura sí, contenido no'

  const cursosVencido = await texto('/mis-cursos', vencido)
  afirmar(G3, 'su curso sigue apareciendo', true, cursosVencido.includes('Acceso vencido'))

  const cursoVencido = await texto(rutaCurso, vencido)
  afirmar(G3, 've el temario completo', true,
    cursoVencido.includes('Fundamentos') && cursoVencido.includes('Video de bienvenida'))
  afirmar(G3, 'las lecciones salen con candado', true,
    cursoVencido.includes('aria-label="Bloqueada"'))
  afirmar(G3, 'aparece el CTA de recompra', true, cursoVencido.includes('venció'))
  afirmar(G3, 'conserva su avance', true, cursoVencido.includes('de 4 lecciones'))
  afirmar(G3, 'no ofrece continuar', false, cursoVencido.includes('Empezar el curso'))

  afirmar(G3, 'la lección lo devuelve al índice', rutaCurso, destino(await pedir(rutaLeccion, vencido)))

  // ======================================================================
  const G4 = 'AISLAMIENTO'

  afirmar(G4, 'el curso ajeno no existe para él', 404,
    (await pedir('/curso/qa-curso-ajeno', vigente)).status)

  // Se deja como estaba.
  for (const leccion of [IDS.leccionVideo, IDS.leccionTexto]) {
    await fijarProgreso(tokenVigente, idVigente, leccion, false)
  }

  process.exitCode = imprimir() ? 0 : 1
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
