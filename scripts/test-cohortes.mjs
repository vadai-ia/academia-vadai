#!/usr/bin/env node
/**
 * test-cohortes.mjs — Criterio de cierre de M8.
 *
 * Lo más frágil de este milestone es la conversión de zona horaria: el equipo
 * captura "21 de septiembre a las 7 pm" pensando en CDMX, y eso tiene que
 * guardarse como el instante UTC correcto. Un error de una hora ahí no lo nota
 * nadie hasta que la cohorte llega tarde a su primera sesión.
 *
 * Por eso la prueba agenda una sesión reenviando el formulario real y después
 * comprueba el timestamp guardado en la base.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-cohortes.mjs
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

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
      // Next serializa la acción de dos formas según cómo se pasó:
      //   $ACTION_ID_<hash>                     -> <form action={accionServidor}>
      //   $ACTION_REF_n + $ACTION_n:0/:1 + KEY  -> useActionState
      // Ambas son la ruta de mejora progresiva y se reenvían igual: se copian
      // verbatim y el servidor las interpreta.
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
  console.log('  PRUEBA DE COHORTES — M8')
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
      ? `  M8 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
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
  const admin = await iniciarSesion(correo.admin)
  const vigente = await iniciarSesion(correo.alumnoVigente)
  const vencido = await iniciarSesion(correo.alumnoVencido)

  const rutaCohorte = `/admin/cohortes/${IDS.cohorte}`
  const rutaCursoAdmin = `/admin/cursos/${IDS.curso}`
  const rutaCursoAlumno = `/curso/${CURSO_QA.slug}`
  const rutaEnVivo = `${rutaCursoAlumno}/en-vivo`

  // El día CDMX en que cae la sesión futura del seed (dentro de una semana).
  // Se calcula igual que la página: con `en-CA` en la zona de México, no con
  // getDate(), que daría el día del servidor.
  const fechaFutura = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

  const bd = await conectarPostgres(vars)

  try {
    // ====================================================================
    const G1 = 'ADMIN'

    afirmar(G1, 'la cohorte abre', 200, (await pedir(rutaCohorte, admin)).status)

    const paginaCurso = await texto(rutaCursoAdmin, admin)
    afirmar(G1, 'el curso lista su cohorte', true, paginaCurso.includes('Cohorte de prueba'))

    const paginaCohorte = await texto(rutaCohorte, admin)
    afirmar(G1, 'muestra las dos sesiones', true,
      paginaCohorte.includes('Ya ocurri') && paginaCohorte.includes('xima'))
    afirmar(G1, 'muestra el link de Meet', true, paginaCohorte.includes('meet.google.com'))
    afirmar(G1, 'ofrece ligar grabación', true, paginaCohorte.includes('Sin grabación ligada'))

    // ====================================================================
    // Lo delicado: capturar en CDMX y guardar el UTC correcto.
    const G2 = 'ZONA HORARIA (server action real, sin JavaScript)'

    // El de NUEVA sesión: sin `id`. Desde el 20-sep cada sesión trae también
    // su formulario de edición, con los mismos campos más el `id`; el primero
    // que aparecía era el de la sesión pasada, y esta prueba la editaba y
    // luego la borraba por título creyendo que era la suya.
    const formularioSesion = leerFormularios(paginaCohorte).find(
      (f) =>
        'cohort_id' in f.campos &&
        'title' in f.campos &&
        'fecha' in f.campos &&
        'hora' in f.campos &&
        !('id' in f.campos) &&
        // "Agendar varias" también trae cohorte, fecha y hora, pero su título es
        // `titulo_base` y agenda ocho de golpe.
        !('titulo_base' in f.campos)
    )
    afirmar(G2, 'el formulario admite envío sin JS', true, Boolean(formularioSesion))

    if (formularioSesion) {
      const TITULO = 'QA · Sesión de zona horaria'
      await enviar(rutaCohorte, formularioSesion, admin, {
        title: TITULO,
        fecha: '2026-09-21',
        hora: '19:00',
        meet_url: 'https://meet.google.com/qa-zona',
        description: '',
      })

      const { rows } = await bd.query(
        `select scheduled_at from academia.cohort_sessions
          where cohort_id = $1 and title = $2`,
        [IDS.cohorte, TITULO]
      )

      afirmar(G2, 'la sesión se guardó', 1, rows.length)

      if (rows[0]) {
        // 19:00 en CDMX (UTC-6) es 01:00 UTC del día siguiente.
        const guardado = new Date(rows[0].scheduled_at).toISOString()
        afirmar(G2, '19:00 CDMX se guarda como UTC', '2026-09-22T01:00:00.000Z', guardado)

        const deVuelta = new Intl.DateTimeFormat('es-MX', {
          timeZone: 'America/Mexico_City',
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(rows[0].scheduled_at))
        afirmar(G2, 'y se muestra de vuelta como 19:00', '19:00', deVuelta)
      }

      await bd.query(`delete from academia.cohort_sessions where cohort_id = $1 and title = $2`, [
        IDS.cohorte,
        TITULO,
      ])
    }

    // ====================================================================
    const G3 = 'ALUMNO VIGENTE'

    // Las sesiones salieron de "Contenido" y viven en su pestaña (M14 · Fase 2):
    // ahí estorbaban para llegar al temario.
    const cursoAlumno = await texto(rutaCursoAlumno, vigente)
    afirmar(G3, 'Contenido lleva a la pestaña', true, cursoAlumno.includes(`${rutaCursoAlumno}/en-vivo`))
    afirmar(G3, 'Contenido anuncia la próxima', true, cursoAlumno.includes('Próxima sesión en vivo'))
    afirmar(G3, 'Contenido ya no trae ligas de Meet', false, cursoAlumno.includes('meet.google.com'))

    const enVivo = await texto(rutaEnVivo, vigente)
    afirmar(G3, 've sus dos sesiones', true,
      (enVivo.match(/data-sesion="/g) ?? []).length >= 2)
    afirmar(G3, 'la futura cae en su día de CDMX', true,
      enVivo.includes(`data-fecha="${fechaFutura}"`))
    afirmar(G3, 'recibe el link de Meet', true, enVivo.includes('meet.google.com/qa-futura'))
    afirmar(G3, 'cada sesión abre su detalle', true,
      enVivo.includes(`id="sesion-${IDS.sesionFutura}"`) && enVivo.includes('popover="auto"'))
    // Solo hora de CDMX (21-sep-2026): sin ella, servidor y navegador
    // pintaban distinto y React 418 tiraba la página del curso.
    afirmar(G3, 'la hora se dice en CDMX', true, enVivo.includes('hora de la Ciudad de México'))

    const enVivoLista = await texto(`${rutaEnVivo}?vista=lista`, vigente)
    afirmar(G3, 'la vista de lista guarda las pasadas', true,
      enVivoLista.includes('Sesiones anteriores'))
    afirmar(G3, 'el selector dice en cuál estás', true, enVivoLista.includes('aria-current="true"'))

    // La campana avisa de la sesión futura: el seed la sembró hace un momento,
    // que es después de "la última vez que abrió la campana" (hace 2 h).
    await bd.query(
      `update academia.profiles set notifications_seen_at = now() - interval '2 hours' where email = $1`,
      [correo.alumnoVigente]
    )
    const inicio = await texto('/mis-cursos', vigente)
    afirmar(G3, 'la campana cuenta la sesión agendada', true,
      Number(inicio.match(/data-nuevas="(\d+)"/)?.[1] ?? 0) >= 1 && inicio.includes('Sesión en vivo'))
    afirmar(G3, 'la campana lleva a la pestaña', true, inicio.includes(`${rutaCursoAlumno}/en-vivo`))

    // ====================================================================
    // La grabación ligada (§3.10).
    const G4 = 'GRABACIÓN LIGADA'

    const formularioGrabacion = leerFormularios(await texto(rutaCohorte, admin)).find(
      (f) => 'recording_lesson_id' in f.campos && f.campos.id === IDS.sesionPasada
    )
    afirmar(G4, 'existe el formulario de grabación', true, Boolean(formularioGrabacion))

    if (formularioGrabacion) {
      await enviar(rutaCohorte, formularioGrabacion, admin, {
        recording_lesson_id: IDS.leccionVideo,
      })

      const { rows } = await bd.query(
        `select recording_lesson_id from academia.cohort_sessions where id = $1`,
        [IDS.sesionPasada]
      )
      afirmar(G4, 'quedó ligada en la base', IDS.leccionVideo, rows[0]?.recording_lesson_id)

      // La grabación se ve en la lista, que es donde se guardan las pasadas.
      const conGrabacion = await texto(`${rutaEnVivo}?vista=lista`, vigente)
      afirmar(G4, 'el alumno ve "Ver grabación"', true, conGrabacion.includes('Ver grabaci'))

      // Se deja como estaba.
      await bd.query(
        `update academia.cohort_sessions set recording_lesson_id = null where id = $1`,
        [IDS.sesionPasada]
      )
    }

    // ====================================================================
    const G5 = 'ALUMNO VENCIDO'

    const cursoVencido = await texto(rutaCursoAlumno, vencido)
    afirmar(G5, 'no ve la próxima sesión', false, cursoVencido.includes('Próxima sesión en vivo'))
    afirmar(G5, 'no recibe links de Meet', false, cursoVencido.includes('meet.google.com'))
    // La pestaña se queda apagada CON su motivo: si desaparece, el alumno cree
    // que la plataforma perdió algo.
    afirmar(G5, 'la pestaña sale apagada con su motivo', true,
      cursoVencido.includes('Renuévalo para volver a las sesiones en vivo'))

    const vivoVencido = await pedir(rutaEnVivo, vencido)
    afirmar(G5, '/en-vivo lo devuelve al curso', true,
      [303, 307].includes(vivoVencido.status) &&
        (vivoVencido.headers.get('location') ?? '').endsWith(rutaCursoAlumno))
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
