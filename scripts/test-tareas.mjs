#!/usr/bin/env node
/**
 * test-tareas.mjs — Criterio de cierre de M6.
 *
 * El criterio del master document es "entrega con archivo revisada y aprobada
 * end-to-end". Aquí se recorre completo: el alumno entrega texto y un archivo
 * real, el admin pide correcciones, el alumno reentrega, el admin aprueba.
 *
 * Se verifica además lo que el ciclo feliz no toca: que el archivo caiga en la
 * carpeta privada del alumno y que una tarea aprobada ya no se pueda reenviar.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-tareas.mjs
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))
const RUTA_LECCION = `/curso/${CURSO_QA.slug}/${IDS.leccionTarea}`
const RUTA_BANDEJA = '/admin/entregas'

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

function leerFormulario(html, contiene) {
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!bloque[1].includes(contiene)) continue
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

async function enviar(ruta, formulario, frasco, extra = {}, archivo = null) {
  const cuerpo = new FormData()
  for (const [nombre, valor] of Object.entries(formulario.campos)) cuerpo.append(nombre, valor)
  for (const [nombre, valor] of Object.entries(extra)) cuerpo.set(nombre, valor)
  if (archivo) cuerpo.append('archivos', archivo, archivo.name)

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
  console.log('  PRUEBA DE TAREAS — M6')
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
      ? `  M6 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- limpieza --------------------------------------------------------------

async function purgar(bd) {
  const { rows } = await bd.query(
    `select files from academia.assignment_submissions where assignment_id = $1`,
    [IDS.tarea]
  )

  const rutas = rows.flatMap((r) =>
    Array.isArray(r.files) ? r.files.map((f) => f.storage_path).filter(Boolean) : []
  )

  if (rutas.length > 0) {
    await fetch(`${SUPABASE}/storage/v1/object/academia-adjuntos`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: rutas }),
    })
  }

  await bd.query(`delete from academia.assignment_submissions where assignment_id = $1`, [
    IDS.tarea,
  ])
}

// --- main ------------------------------------------------------------------

async function main() {
  const bd = await conectarPostgres(vars)

  try {
    await purgar(bd)
    await bd.query(
      `update academia.assignments set allow_files = true, allow_text = true where id = $1`,
      [IDS.tarea]
    )

    const alumno = await iniciarSesion(correo.alumnoVigente)
    const admin = await iniciarSesion(correo.admin)

    // ================================================================
    const G1 = 'EL ALUMNO ENTREGA'

    const pagina = await texto(RUTA_LECCION, alumno)
    afirmar(G1, 'la tarea se renderiza', true, pagina.includes('Entregar tarea'))
    afirmar(G1, 'ofrece texto y archivos', true,
      pagina.includes('Tu respuesta') && pagina.includes('name="archivos"'))

    const formulario = leerFormulario(pagina, 'name="assignment_id"')
    afirmar(G1, 'el formulario admite envío sin JS', true, Boolean(formulario))

    if (!formulario) {
      process.exitCode = imprimir() ? 0 : 1
      return
    }

    const archivo = new File(
      ['Mi entrega de prueba para VADAI Academia.\n'],
      'entrega-qa.txt',
      { type: 'text/plain' }
    )

    await enviar(
      RUTA_LECCION,
      formulario,
      alumno,
      { texto: 'Aquí está mi primera versión.' },
      archivo
    )

    const { rows: entrega } = await bd.query(
      `select id, status, text_content, files, reviewed_by from academia.assignment_submissions
        where assignment_id = $1`,
      [IDS.tarea]
    )

    afirmar(G1, 'se creó la entrega', 1, entrega.length)
    afirmar(G1, 'en estado entregada', 'submitted', entrega[0]?.status)
    afirmar(G1, 'con el texto', 'Aquí está mi primera versión.', entrega[0]?.text_content)
    afirmar(G1, 'con un archivo', 1, Array.isArray(entrega[0]?.files) ? entrega[0].files.length : 0)

    // El archivo tiene que caer en la carpeta privada del alumno.
    const { rows: perfilAlumno } = await bd.query(
      `select user_id from academia.profiles where email = $1`,
      [correo.alumnoVigente]
    )
    const ruta = entrega[0]?.files?.[0]?.storage_path ?? ''
    afirmar(G1, 'el archivo va a su carpeta privada', true,
      ruta.startsWith(`entregas/${perfilAlumno[0].user_id}/`))

    // ================================================================
    const G2 = 'EL ADMIN PIDE CORRECCIONES'

    const bandeja = await texto(RUTA_BANDEJA, admin)
    afirmar(G2, 'la entrega aparece en la bandeja', true,
      bandeja.includes('primera versión'))
    afirmar(G2, 'con el nombre del alumno', true, bandeja.includes('QA Alumno Vigente'))
    afirmar(G2, 'y su archivo descargable', true, bandeja.includes('entrega-qa.txt'))

    const revision = leerFormulario(bandeja, 'name="feedback"')
    afirmar(G2, 'hay formulario de revisión', true, Boolean(revision))

    if (revision) {
      await enviar(RUTA_BANDEJA, revision, admin, {
        decision: 'rejected',
        feedback: 'Falta el ejemplo del módulo 2. Agrégalo y reenvía.',
      })

      const { rows } = await bd.query(
        `select status, feedback, reviewed_by, reviewed_at from academia.assignment_submissions
          where assignment_id = $1`,
        [IDS.tarea]
      )
      afirmar(G2, 'queda rechazada', 'rejected', rows[0]?.status)
      afirmar(G2, 'con feedback guardado', true, Boolean(rows[0]?.feedback))
      afirmar(G2, 'registra quién revisó', true, Boolean(rows[0]?.reviewed_by))
      afirmar(G2, 'y cuándo', true, Boolean(rows[0]?.reviewed_at))
    }

    // ================================================================
    const G3 = 'EL ALUMNO REENTREGA'

    const conFeedback = await texto(RUTA_LECCION, alumno)
    afirmar(G3, 've el feedback', true, conFeedback.includes('Falta el ejemplo'))
    afirmar(G3, 'puede reenviar', true, conFeedback.includes('Reenviar tarea'))

    const reenvio = leerFormulario(conFeedback, 'name="assignment_id"')
    if (reenvio) {
      await enviar(RUTA_LECCION, reenvio, alumno, {
        texto: 'Corregido: agregué el ejemplo del módulo 2.',
      })

      const { rows } = await bd.query(
        `select status, text_content, files from academia.assignment_submissions
          where assignment_id = $1`,
        [IDS.tarea]
      )
      afirmar(G3, 'vuelve a estado entregada', 'submitted', rows[0]?.status)
      afirmar(G3, 'con el texto nuevo', true,
        String(rows[0]?.text_content).includes('Corregido'))
      // No subió archivo nuevo, así que conserva el anterior.
      afirmar(G3, 'conserva su archivo', 1,
        Array.isArray(rows[0]?.files) ? rows[0].files.length : 0)
    }

    // ================================================================
    const G4 = 'EL ADMIN APRUEBA'

    const bandeja2 = await texto(RUTA_BANDEJA, admin)
    const revision2 = leerFormulario(bandeja2, 'name="feedback"')

    if (revision2) {
      await enviar(RUTA_BANDEJA, revision2, admin, {
        decision: 'approved',
        feedback: 'Quedó muy bien. Aprobada.',
      })

      const { rows } = await bd.query(
        `select status from academia.assignment_submissions where assignment_id = $1`,
        [IDS.tarea]
      )
      afirmar(G4, 'queda aprobada', 'approved', rows[0]?.status)
    }

    const aprobada = await texto(RUTA_LECCION, alumno)
    afirmar(G4, 'el alumno la ve aprobada', true, aprobada.includes('quedó aprobada'))
    afirmar(G4, 'y ya no puede reenviar', false, aprobada.includes('Reenviar tarea'))

    // ================================================================
    const G5 = 'BANDEJA'

    const soloPendientes = await texto(RUTA_BANDEJA, admin)
    afirmar(G5, 'ya no hay pendientes', true, soloPendientes.includes('Nada por revisar'))

    const todas = await texto(`${RUTA_BANDEJA}?todas=1`, admin)
    afirmar(G5, 'pero sí aparece en "todas"', true, todas.includes('Aprobada'))

    await purgar(bd)
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
