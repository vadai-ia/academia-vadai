#!/usr/bin/env node
/**
 * test-certificados.mjs — Criterio de cierre de M10.
 *
 * El criterio del master document es: "Certificado PDF descargable y verificable
 * por folio". Las dos mitades se prueban de verdad —el PDF se descarga y se le
 * revisan los bytes, la verificación se abre SIN sesión— y además se prueba lo
 * que el spec da por hecho y es lo más fácil de romper: que no se emita antes de
 * tiempo.
 *
 *   PORT=3117 pnpm start
 *   pnpm db:seed && node scripts/test-certificados.mjs
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))
const RUTA_CURSO = `/curso/${CURSO_QA.slug}`

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
  frasco.guardar(
    await fetch(`${APP}/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`, {
      redirect: 'manual',
    })
  )
  return frasco
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

// --- formularios -----------------------------------------------------------

function leerFormulario(html, contiene, indice = 0) {
  let vistos = 0
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!bloque[1].includes(contiene)) continue
    if (vistos++ < indice) continue
    const campos = {}
    let accion = null
    for (const etiqueta of bloque[1].matchAll(/<input\b[^>]*>/g)) {
      const nombre = etiqueta[0].match(/name="([^"]*)"/)?.[1]
      if (!nombre) continue
      if (nombre.startsWith('$ACTION')) accion = accion ?? nombre
      const valor = etiqueta[0].match(/value="([^"]*)"/)?.[1] ?? ''
      campos[nombre] = valor.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    }
    if (accion) return { campos }
  }
  return null
}

async function enviar(ruta, formulario, frasco, extra = {}) {
  const cuerpo = new FormData()
  for (const [n, v] of Object.entries(formulario.campos)) cuerpo.append(n, v)
  for (const [n, v] of Object.entries(extra)) cuerpo.set(n, v)
  const respuesta = await pedir(ruta, frasco, { method: 'POST', body: cuerpo })
  frasco.guardar(respuesta)
  return respuesta
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
  console.log('  PRUEBA DE CERTIFICADOS — M10')
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
      ? `  M10 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- main ------------------------------------------------------------------

async function idDe(bd, email) {
  const { rows } = await bd.query(`select user_id from academia.profiles where email = $1`, [email])
  return rows[0]?.user_id ?? null
}

/** Deja al alumno como recién sembrado: sin progreso, sin intentos, sin entregas. */
async function limpiar(bd, alumnoId) {
  // Los PDFs primero: una vez borrada la fila ya no hay de dónde sacar la ruta,
  // y el archivo se quedaría en el bucket para siempre sin nadie que lo nombre.
  // Cada corrida dejaba uno más — cuatro llevaba acumulados cuando se detectó.
  const { rows } = await bd.query(
    `select pdf_path from academia.certificates where user_id = $1 and pdf_path is not null`,
    [alumnoId]
  )

  if (rows.length > 0) {
    await fetch(`${SUPABASE}/storage/v1/object/academia-certificados`, {
      method: 'DELETE',
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: rows.map((f) => f.pdf_path) }),
    }).catch(() => {})
  }

  await bd.query(`delete from academia.certificates where user_id = $1`, [alumnoId])
  await bd.query(`delete from academia.lesson_progress where user_id = $1`, [alumnoId])
  await bd.query(`delete from academia.quiz_attempts where user_id = $1`, [alumnoId])
  await bd.query(`delete from academia.assignment_submissions where user_id = $1`, [alumnoId])
}

async function main() {
  const bd = await conectarPostgres(vars)

  try {
    const alumnoId = await idDe(bd, correo.alumnoVigente)
    const otroId = await idDe(bd, correo.alumnoVencido)
    if (!alumnoId) throw new Error('Falta el alumno QA. Corre pnpm db:seed.')

    await limpiar(bd, alumnoId)

    const alumno = await iniciarSesion(correo.alumnoVigente)
    const admin = await iniciarSesion(correo.admin)
    const otro = await iniciarSesion(correo.alumnoVencido)

    // ================================================================
    const G1 = 'ANTES DE TERMINAR'

    const inicial = await texto(RUTA_CURSO, alumno)
    afirmar(G1, 'el bloque de certificado existe', true, inicial.includes('Certificado'))
    afirmar(G1, 'NO ofrece obtenerlo', false, inicial.includes('Obtener certificado'))
    afirmar(G1, 'dice qué falta, no solo "completa"', true, inicial.includes('Falta aprobar el quiz'))

    afirmar(
      G1,
      'la acción rechaza emitir aunque se fuerce',
      0,
      (await bd.query(`select 1 from academia.certificates where user_id = $1`, [alumnoId])).rowCount
    )

    // ================================================================
    // Marcar completadas TODAS las obligatorias, sin aprobar quiz ni tarea.
    // Es el atajo que un alumno tiene a mano: el botón "Marcar como completada"
    // existe en toda lección (§3.3), incluidas las de quiz y tarea.
    const G2 = 'MARCAR COMPLETADA NO BASTA'

    for (const leccion of [IDS.leccionVideo, IDS.leccionTexto, IDS.leccionQuiz, IDS.leccionTarea]) {
      await bd.query(
        `insert into academia.lesson_progress (user_id, lesson_id, completed, completed_at)
         values ($1, $2, true, now())
         on conflict (user_id, lesson_id) do update set completed = true, completed_at = now()`,
        [alumnoId, leccion]
      )
    }

    const conTodoMarcado = await texto(RUTA_CURSO, alumno)
    afirmar(G2, 'el curso marca 100%', true, /100\s*%/.test(conTodoMarcado.replace(/<!--.*?-->/g, '')))
    afirmar(G2, 'y AUN ASÍ no ofrece el certificado', false,
      conTodoMarcado.includes('Obtener certificado'))
    afirmar(G2, 'porque falta aprobar el quiz', true,
      conTodoMarcado.includes('Falta aprobar el quiz'))
    afirmar(G2, 'y falta la tarea aprobada', true,
      conTodoMarcado.includes('La tarea todavía no está aprobada'))

    // ================================================================
    const G3 = 'APROBAR DE VERDAD'

    // Quiz: se contesta por la app, la calificación es server-side.
    const rutaQuiz = `${RUTA_CURSO}/${IDS.leccionQuiz}`
    const paginaQuiz = await texto(rutaQuiz, alumno)
    const formQuiz = leerFormulario(paginaQuiz, 'name="quiz_id"')
    afirmar(G3, 'el quiz se puede contestar', true, Boolean(formQuiz))

    if (formQuiz) {
      // El radio no viene en los inputs copiados: se agrega la respuesta buena.
      await enviar(rutaQuiz, formQuiz, alumno, { [IDS.pregunta]: 'b' })
      const { rows } = await bd.query(
        `select passed from academia.quiz_attempts where user_id = $1 and quiz_id = $2`,
        [alumnoId, IDS.quiz]
      )
      afirmar(G3, 'el intento quedó aprobado', true, rows[0]?.passed)
    }

    // Tarea: el alumno entrega, el admin aprueba.
    const rutaTarea = `${RUTA_CURSO}/${IDS.leccionTarea}`
    const paginaTarea = await texto(rutaTarea, alumno)
    const formTarea = leerFormulario(paginaTarea, 'name="texto"')
    afirmar(G3, 'la tarea se puede entregar', true, Boolean(formTarea))

    if (formTarea) {
      await enviar(rutaTarea, formTarea, alumno, {
        texto: 'Entrega QA para probar el certificado de M10.',
      })
    }

    // Al entregar, la lección se des-marca? No: se respeta lo que ya había.
    // Lo que importa es que aprobar la marque, aunque no estuviera marcada.
    await bd.query(
      `delete from academia.lesson_progress where user_id = $1 and lesson_id = $2`,
      [alumnoId, IDS.leccionTarea]
    )

    const bandeja = await texto('/admin/entregas', admin)
    const formRevision = leerFormulario(bandeja, 'name="decision"')
    afirmar(G3, 'la entrega llega a la bandeja', true, Boolean(formRevision))

    if (formRevision) {
      await enviar('/admin/entregas', formRevision, admin, { decision: 'approved' })

      const { rows } = await bd.query(
        `select status from academia.assignment_submissions
         where user_id = $1 and assignment_id = $2`,
        [alumnoId, IDS.tarea]
      )
      afirmar(G3, 'la entrega quedó aprobada', 'approved', rows[0]?.status)

      // El hueco de M6: aprobar tiene que completar la lección, como el quiz.
      const { rows: progreso } = await bd.query(
        `select completed from academia.lesson_progress
         where user_id = $1 and lesson_id = $2`,
        [alumnoId, IDS.leccionTarea]
      )
      afirmar(G3, 'aprobar completó la lección de tarea', true, progreso[0]?.completed)
    }

    // ================================================================
    const G4 = 'EMISIÓN'

    const listo = await texto(RUTA_CURSO, alumno)
    afirmar(G4, 'ahora sí ofrece el certificado', true, listo.includes('Obtener certificado'))

    const formCert = leerFormulario(listo, 'name="curso_id"')
    afirmar(G4, 'hay formulario para obtenerlo', true, Boolean(formCert))

    let folio = null

    if (formCert) {
      await enviar(RUTA_CURSO, formCert, alumno)

      const { rows } = await bd.query(
        `select folio, pdf_path from academia.certificates
         where user_id = $1 and course_id = $2`,
        [alumnoId, IDS.curso]
      )
      afirmar(G4, 'se emitió el certificado', 1, rows.length)
      folio = rows[0]?.folio ?? null

      afirmar(G4, 'el folio tiene el formato público', true,
        /^VADAI-\d{4}-[0-9A-HJKMNP-TV-Z]{10}$/.test(folio ?? ''))
      afirmar(G4, 'sin letras confundibles (I, L, O, U)', false, /[ILOU]/.test((folio ?? '').slice(11)))
      afirmar(G4, 'el PDF quedó guardado', true, Boolean(rows[0]?.pdf_path))

      // Idempotencia: pedirlo otra vez no emite un segundo certificado.
      const otraVez = await texto(RUTA_CURSO, alumno)
      const formSegundo = leerFormulario(otraVez, 'name="curso_id"')
      if (formSegundo) await enviar(RUTA_CURSO, formSegundo, alumno)

      const { rows: despues } = await bd.query(
        `select folio from academia.certificates where user_id = $1 and course_id = $2`,
        [alumnoId, IDS.curso]
      )
      afirmar(G4, 'no se emite un segundo', 1, despues.length)
      afirmar(G4, 'y el folio es el mismo', folio, despues[0]?.folio)
    }

    // ================================================================
    if (folio) {
      const G5 = 'DESCARGA DEL PDF'

      const descarga = await pedir(`/api/certificados/${folio}`, alumno)
      afirmar(G5, 'el dueño recibe redirección firmada', 302, descarga.status)

      const firmada = descarga.headers.get('location')
      afirmar(G5, 'la URL viene firmada', true, (firmada ?? '').includes('token='))

      if (firmada) {
        const archivo = await fetch(firmada)
        afirmar(G5, 'el archivo se descarga', 200, archivo.status)

        const bytes = new Uint8Array(await archivo.arrayBuffer())
        const cabecera = String.fromCharCode(...bytes.slice(0, 5))
        afirmar(G5, 'y ES un PDF, no un HTML de error', '%PDF-', cabecera)
        afirmar(G5, 'con contenido real', true, bytes.length > 2000)
      }

      afirmar(G5, 'el equipo también puede descargarlo', 302,
        (await pedir(`/api/certificados/${folio}`, admin)).status)
      afirmar(G5, 'otro alumno NO', 404,
        (await pedir(`/api/certificados/${folio}`, otro)).status)
      afirmar(G5, 'sin sesión tampoco', 401,
        (await pedir(`/api/certificados/${folio}`, null)).status)

      // ============================================================
      const G6 = 'VERIFICACIÓN PÚBLICA'

      const publica = await pedir(`/certificado/${folio}`, null)
      afirmar(G6, 'abre SIN sesión', 200, publica.status)

      const html = await publica.text()
      afirmar(G6, 'dice que es válido', true, html.includes('Certificado válido'))
      afirmar(G6, 'muestra el nombre', true, html.includes('QA Alumno Vigente'))
      afirmar(G6, 'muestra el curso', true, html.includes(CURSO_QA.title))
      afirmar(G6, 'muestra el folio', true, html.includes(folio))
      afirmar(G6, 'NO filtra el correo del alumno', false, html.includes(correo.alumnoVigente))
      afirmar(G6, 'ni el user_id', false, html.includes(alumnoId))
      afirmar(G6, 'y pide no indexarse', true, /noindex/i.test(html))

      // Minúsculas y espacios: se teclea desde un PDF impreso.
      afirmar(G6, 'tolera minúsculas al teclearlo', true,
        (await (await pedir(`/certificado/${folio.toLowerCase()}`, null)).text())
          .includes('Certificado válido'))

      // ============================================================
      const G7 = 'FOLIO INVÁLIDO'

      const inexistente = await pedir('/certificado/VADAI-2026-ZZZZZZZZZZ', null)
      afirmar(G7, 'no es 404, es una respuesta útil', 200, inexistente.status)
      afirmar(G7, 'y dice que no lo encontró', true,
        (await inexistente.text()).includes('Sin resultados'))

      const basura = await pedir('/certificado/no-es-un-folio', null)
      afirmar(G7, 'la basura tampoco revienta', 200, basura.status)
      afirmar(G7, 'la API rechaza folio mal formado', 400,
        (await pedir('/api/certificados/no-es-un-folio', alumno)).status)

      // ============================================================
      const G8 = 'PERFIL'

      const perfil = await texto('/perfil', alumno)
      afirmar(G8, 'el certificado aparece en el perfil', true, perfil.includes(folio))
      afirmar(G8, 'con liga de descarga', true,
        perfil.includes(`/api/certificados/${folio}`))
      afirmar(G8, 'y el nombre es editable', true, perfil.includes('name="full_name"'))
      afirmar(G8, 'otro alumno no lo ve en el suyo', false,
        (await texto('/perfil', otro)).includes(folio))
    }

    await limpiar(bd, alumnoId)
    if (otroId) await limpiar(bd, otroId)
  } finally {
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
