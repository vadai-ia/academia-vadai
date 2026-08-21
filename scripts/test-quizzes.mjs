#!/usr/bin/env node
/**
 * test-quizzes.mjs — Criterio de cierre de M5.
 *
 * El criterio del master document es literal: "Quiz de 5 preguntas aprobado
 * marca lección completa". Aquí se siembran esas 5 preguntas, se contesta mal,
 * se contesta bien y se verifica el efecto en el progreso.
 *
 * Lo que más importa probar no es el camino feliz sino que la respuesta correcta
 * NUNCA llegue al navegador, ni en el HTML ni tras reprobar.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-quizzes.mjs
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))
const RUTA_LECCION = `/curso/${CURSO_QA.slug}/${IDS.leccionQuiz}`

/** Las 5 preguntas, con su correcta conocida para poder contestar bien y mal. */
const PREGUNTAS = [
  { texto: '¿Cuánto es 2 + 2?', opciones: ['3', '4', '5'], correcta: 'b' },
  { texto: '¿De qué color es el cielo despejado?', opciones: ['Verde', 'Azul', 'Rojo'], correcta: 'b' },
  { texto: '¿Capital de México?', opciones: ['CDMX', 'Guadalajara', 'Monterrey'], correcta: 'a' },
  { texto: '¿Cuántos días tiene una semana?', opciones: ['5', '6', '7'], correcta: 'c' },
  { texto: '¿Qué mes sigue a enero?', opciones: ['Marzo', 'Febrero', 'Abril'], correcta: 'b' },
]

const LETRAS = ['a', 'b', 'c', 'd', 'e']

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

// --- reenvío de formularios ------------------------------------------------

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
    if (accion) return { campos, html: bloque[0] }
  }
  return null
}

async function enviarFormulario(ruta, formulario, frasco, extra) {
  const cuerpo = new FormData()
  // Los radios no se copian del HTML: cada pregunta aporta una sola respuesta,
  // y es justo lo que este test elige.
  for (const [nombre, valor] of Object.entries(formulario.campos)) {
    if (nombre.startsWith('$ACTION') || nombre.endsWith('_id') || nombre === 'curso_slug') {
      cuerpo.append(nombre, valor)
    }
  }
  for (const [nombre, valor] of Object.entries(extra)) cuerpo.set(nombre, valor)

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
  console.log('  PRUEBA DE QUIZZES — M5')
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
      ? `  M5 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
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
  const bd = await conectarPostgres(vars)

  try {
    // ================================================================
    // Punto de partida: 5 preguntas conocidas, sin intentos previos.
    await bd.query(`delete from academia.quiz_attempts where quiz_id = $1`, [IDS.quiz])
    await bd.query(`delete from academia.quiz_questions where quiz_id = $1`, [IDS.quiz])
    await bd.query(
      `update academia.quizzes set passing_score = 80, reveal_answers = false where id = $1`,
      [IDS.quiz]
    )

    const ids = []
    for (const [i, p] of PREGUNTAS.entries()) {
      const opciones = p.opciones.map((texto, j) => ({ id: LETRAS[j], text: texto }))
      const { rows } = await bd.query(
        `insert into academia.quiz_questions (quiz_id, question, options, correct_option_id, position)
         values ($1, $2, $3::jsonb, $4, $5) returning id`,
        [IDS.quiz, p.texto, JSON.stringify(opciones), p.correcta, i + 1]
      )
      ids.push(rows[0].id)
    }

    // El progreso de esta lección arranca en cero.
    const { rows: perfilVigente } = await bd.query(
      `select user_id from academia.profiles where email = $1`,
      [correo.alumnoVigente]
    )
    const idVigente = perfilVigente[0].user_id
    await bd.query(`delete from academia.lesson_progress where user_id = $1`, [idVigente])

    const vigente = await iniciarSesion(correo.alumnoVigente)
    const vencido = await iniciarSesion(correo.alumnoVencido)

    // ================================================================
    const G1 = 'LA RESPUESTA CORRECTA NO SALE AL NAVEGADOR'

    const pagina = await texto(RUTA_LECCION, vigente)
    afirmar(G1, 'el quiz se renderiza', true, pagina.includes('Enviar respuestas'))
    afirmar(G1, 'aparecen las 5 preguntas', true, pagina.includes('¿Qué mes sigue a enero?'))
    afirmar(G1, 'sin campo correct_option_id', false, pagina.includes('correct_option_id'))
    // React intercala marcadores de comentario al interpolar, así que "80%" no
    // queda contiguo en el HTML: se busca el número cerca de su etiqueta.
    afirmar(G1, 'dice el puntaje mínimo', true, /necesitas[\s\S]{0,40}80/.test(pagina))

    // ================================================================
    const G2 = 'REPROBAR'

    const formulario = leerFormulario(pagina, 'name="quiz_id"')
    afirmar(G2, 'el formulario admite envío sin JS', true, Boolean(formulario))

    if (formulario) {
      // Todas mal a propósito: se elige una opción distinta a la correcta.
      const malas = Object.fromEntries(
        ids.map((id, i) => [id, PREGUNTAS[i].correcta === 'a' ? 'b' : 'a'])
      )
      await enviarFormulario(RUTA_LECCION, formulario, vigente, malas)

      const { rows: intento } = await bd.query(
        `select score, passed from academia.quiz_attempts where quiz_id = $1 order by created_at desc limit 1`,
        [IDS.quiz]
      )
      afirmar(G2, 'se guardó el intento', 1, intento.length)
      afirmar(G2, 'con 0%', 0, intento[0]?.score)
      afirmar(G2, 'reprobado', false, intento[0]?.passed)

      const { rows: progreso } = await bd.query(
        `select completed from academia.lesson_progress where user_id = $1 and lesson_id = $2`,
        [idVigente, IDS.leccionQuiz]
      )
      afirmar(G2, 'la lección NO quedó completa', 0, progreso.length)

      // reveal_answers = false: reprobar no puede revelar las respuestas, o los
      // reintentos ilimitados se vuelven "falla una vez y copia".
      const trasReprobar = await texto(RUTA_LECCION, vigente)
      afirmar(G2, 'no revela las correctas al reprobar', false,
        trasReprobar.includes('está marcada en verde'))
    }

    // ================================================================
    const G3 = 'APROBAR MARCA LA LECCIÓN COMPLETA'

    const pagina2 = await texto(RUTA_LECCION, vigente)
    const formulario2 = leerFormulario(pagina2, 'name="quiz_id"')

    if (formulario2) {
      const buenas = Object.fromEntries(ids.map((id, i) => [id, PREGUNTAS[i].correcta]))
      await enviarFormulario(RUTA_LECCION, formulario2, vigente, buenas)

      const { rows: intento } = await bd.query(
        `select score, passed from academia.quiz_attempts where quiz_id = $1 order by created_at desc limit 1`,
        [IDS.quiz]
      )
      afirmar(G3, 'califica 100%', 100, intento[0]?.score)
      afirmar(G3, 'aprobado', true, intento[0]?.passed)

      const { rows: progreso } = await bd.query(
        `select completed from academia.lesson_progress where user_id = $1 and lesson_id = $2`,
        [idVigente, IDS.leccionQuiz]
      )
      afirmar(G3, 'la lección quedó completa', true, progreso[0]?.completed)

      const { rows: intentos } = await bd.query(
        `select count(*)::int n from academia.quiz_attempts where quiz_id = $1`,
        [IDS.quiz]
      )
      afirmar(G3, 'quedaron los dos intentos', 2, intentos[0].n)

      // 4 lecciones publicadas, una completa = 25%
      const curso = await texto(`/curso/${CURSO_QA.slug}`, vigente)
      afirmar(G3, 'el curso avanzó a 25%', true, /25\s*(%|&#x25;)/.test(curso))
    }

    // ================================================================
    const G4 = 'SIN ACCESO NO SE CALIFICA'

    const paginaVencido = await pedir(RUTA_LECCION, vencido)
    afirmar(G4, 'el alumno vencido ni abre la lección', `/curso/${CURSO_QA.slug}`,
      paginaVencido.headers.get('location')
        ? new URL(paginaVencido.headers.get('location'), APP).pathname
        : null)

    const { rows: intentosVencido } = await bd.query(
      `select count(*)::int n from academia.quiz_attempts a
         join academia.profiles p on p.user_id = a.user_id
        where p.email = $1`,
      [correo.alumnoVencido]
    )
    afirmar(G4, 'no tiene intentos', 0, intentosVencido[0].n)

    // ================================================================
    // Se deja el seed como estaba: una sola pregunta y sin intentos.
    await bd.query(`delete from academia.quiz_attempts where quiz_id = $1`, [IDS.quiz])
    await bd.query(`delete from academia.quiz_questions where quiz_id = $1`, [IDS.quiz])
    await bd.query(
      `insert into academia.quiz_questions (id, quiz_id, question, options, correct_option_id, position)
       values ($1, $2, '¿Cuál es la capital de México?',
               '[{"id":"a","text":"Guadalajara"},{"id":"b","text":"Ciudad de México"},{"id":"c","text":"Monterrey"}]'::jsonb,
               'b', 1)`,
      [IDS.pregunta, IDS.quiz]
    )
    await bd.query(`delete from academia.lesson_progress where user_id = $1`, [idVigente])
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
