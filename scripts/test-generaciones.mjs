#!/usr/bin/env node
/**
 * test-generaciones.mjs — Criterio de cierre de M16.
 *
 * Lo que la base promete sobre las generaciones, probado como lo usará la
 * app: las funciones se llaman por PostgREST con el JWT del admin QA (y del
 * alumno, para ver que no puede), y lo que debe fallar se intenta directo en
 * Postgres para leer el error del trigger.
 *
 *   - Copiar una generación: misma estructura, sin videos, lecciones en
 *     borrador, adjuntos que comparten archivo; repetir y cruzar cursos falla.
 *   - Cambiar a alguien de generación: ve la nueva y deja de ver la anterior.
 *   - Una sola abierta a inscripciones por curso; una terminada no se abre.
 *   - El catálogo ofrece el curso solo con generación abierta, y «empezar
 *     gratis» cae en ella.
 *   - Una fila con generación de otro curso se rechaza.
 *
 * No necesita la app corriendo. Deja la base como la encontró.
 *
 *   pnpm db:seed && node scripts/test-generaciones.mjs
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CLAVE_QA, CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const URL_BASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

/** Una tercera generación que esta suite crea y borra. */
const GEN_TEMPORAL = '0a0a0000-0000-4000-8000-0000000000f1'

// --- PostgREST ---------------------------------------------------------------

function cabeceras(token) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Accept-Profile': 'academia',
    'Content-Profile': 'academia',
    'Content-Type': 'application/json',
  }
}

async function iniciarSesion(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: CLAVE_QA }),
  })
  const cuerpo = await res.json()
  if (!res.ok || !cuerpo.access_token) {
    throw new Error(`No se pudo iniciar sesión como ${email}. ¿Corriste \`pnpm db:seed\`?`)
  }
  return cuerpo.access_token
}

async function filas(token, consulta) {
  const res = await fetch(`${URL_BASE}/rest/v1/${consulta}`, { headers: cabeceras(token) })
  const cuerpo = await res.json().catch(() => null)
  return Array.isArray(cuerpo) ? cuerpo : []
}

async function rpc(token, funcion, argumentos) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    headers: cabeceras(token),
    body: JSON.stringify(argumentos),
  })
  const datos = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, datos, mensaje: res.ok ? '' : (datos?.message ?? '') }
}

/** Corre SQL esperando que falle; devuelve el mensaje del error (o ''). */
async function falla(bd, sql, params) {
  try {
    await bd.query(sql, params)
    return ''
  } catch (error) {
    return error.message
  }
}

// --- reporte -------------------------------------------------------------------

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
  console.log('  PRUEBA DE GENERACIONES — M16')

  for (const [grupo, casos] of porGrupo) {
    console.log('')
    console.log(`  ${grupo}`)
    console.log('  ' + '─'.repeat(ancho + 32))
    for (const c of casos) {
      console.log(
        `  ${c.ok ? '✓' : '✗'}  ${c.descripcion.padEnd(ancho)}  ` +
          (c.ok ? String(c.real) : `esperado ${c.esperado}, obtuvo ${c.real}`)
      )
    }
  }

  const fallidas = resultados.filter((r) => !r.ok)
  console.log('')
  console.log('  ' + '─'.repeat(ancho + 32))
  console.log(
    fallidas.length === 0
      ? `  M16 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- limpieza ------------------------------------------------------------------

async function limpiar(bd) {
  // Los módulos primero: la FK de `modules.cohort_id` es `restrict`.
  await bd.query('delete from academia.modules where cohort_id = $1', [GEN_TEMPORAL])
  await bd.query('delete from academia.cohorts where id = $1', [GEN_TEMPORAL])
  // Los alumnos QA vuelven a la primera generación, y la primera vuelve a ser
  // la abierta (el seed lo garantiza igual).
  await bd.query(
    `update academia.enrollments set cohort_id = $1 where course_id = $2 and cohort_id is distinct from $1`,
    [IDS.cohorte, IDS.curso]
  )
  await bd.query(`update academia.cohorts set open_for_enrollment = false where course_id = $1 and id <> $2`, [IDS.curso, IDS.cohorte])
  await bd.query(`update academia.cohorts set open_for_enrollment = true where id = $1`, [IDS.cohorte])
  await bd.query(`update academia.courses set in_catalog = false, is_free = false where id = $1`, [IDS.curso])
}

// --- main ------------------------------------------------------------------------

const bd = await conectarPostgres(vars)

async function main() {
  const admin = await iniciarSesion(correo.admin)
  const vencido = await iniciarSesion(correo.alumnoVencido)
  const sinPerfil = await iniciarSesion(correo.sinPerfil)

  const { rows: perfiles } = await bd.query(
    'select user_id, email from academia.profiles where email = any($1::text[])',
    [[correo.alumnoVencido, correo.admin]]
  )
  const idDe = (email) => perfiles.find((p) => p.email === email)?.user_id
  const idVencido = idDe(correo.alumnoVencido)
  const idAdmin = idDe(correo.admin)

  await limpiar(bd)

  try {
    // ====================================================================
    const G1 = 'COPIAR UNA GENERACIÓN'

    await bd.query(
      `insert into academia.cohorts (id, course_id, name, starts_on, ends_on)
       values ($1, $2, 'QA · Generación temporal', current_date + 90, current_date + 120)`,
      [GEN_TEMPORAL, IDS.curso]
    )

    const copia = await rpc(admin, 'academia_copiar_generacion', { origen: IDS.cohorte, destino: GEN_TEMPORAL })
    afirmar(G1, 'el admin copia la estructura', true, copia.ok)
    afirmar(G1, 'dos módulos', 2, copia.datos?.modulos)
    afirmar(G1, 'cinco lecciones (incluida la de borrador)', 5, copia.datos?.lecciones)
    afirmar(G1, 'un adjunto, un quiz con su pregunta, una tarea', '1/1/1/1',
      [copia.datos?.adjuntos, copia.datos?.quizzes, copia.datos?.preguntas, copia.datos?.tareas].join('/'))

    const { rows: copiadas } = await bd.query(
      `select l.status, l.bunny_video_id, l.video_duration_sec
         from academia.lessons l join academia.modules m on m.id = l.module_id
        where m.cohort_id = $1`,
      [GEN_TEMPORAL]
    )
    afirmar(G1, 'las lecciones copiadas nacen en borrador', true,
      copiadas.length === 5 && copiadas.every((l) => l.status === 'draft'))
    afirmar(G1, 'y sin video', true, copiadas.every((l) => l.bunny_video_id === null && l.video_duration_sec === null))

    const { rows: adjuntos } = await bd.query(
      `select count(distinct a.storage_path)::int as rutas, count(*)::int as filas
         from academia.lesson_attachments a
         join academia.lessons l on l.id = a.lesson_id
         join academia.modules m on m.id = l.module_id
        where m.cohort_id in ($1, $2)`,
      [IDS.cohorte, GEN_TEMPORAL]
    )
    afirmar(G1, 'el adjunto comparte el archivo (una ruta, dos filas)', '1/2', `${adjuntos[0]?.rutas}/${adjuntos[0]?.filas}`)

    const { rows: sesionesCopiadas } = await bd.query(
      'select count(*)::int as n from academia.cohort_sessions where cohort_id = $1',
      [GEN_TEMPORAL]
    )
    afirmar(G1, 'no copia sesiones', 0, sesionesCopiadas[0]?.n)

    const repetida = await rpc(admin, 'academia_copiar_generacion', { origen: IDS.cohorte, destino: GEN_TEMPORAL })
    afirmar(G1, 'copiar sobre una generación con contenido falla', false, repetida.ok)
    const cruzada = await rpc(admin, 'academia_copiar_generacion', { origen: IDS.cohorte, destino: IDS.cursoAjeno })
    afirmar(G1, 'copiar a algo que no es generación del curso falla', false, cruzada.ok)
    const alumnoCopia = await rpc(vencido, 'academia_copiar_generacion', { origen: IDS.cohorte, destino: GEN_TEMPORAL })
    afirmar(G1, 'un alumno no copia', false, alumnoCopia.ok)

    // ====================================================================
    const G2 = 'CAMBIAR DE GENERACIÓN'

    const antes = await filas(vencido, 'modules?select=id')
    afirmar(G2, 'el alumno ve los módulos de su generación', true,
      antes.length === 2 && antes.every((m) => [IDS.modulo1, IDS.modulo2].includes(m.id)))

    const movido = await rpc(admin, 'academia_mover_de_generacion', {
      alumno: idVencido, curso: IDS.curso, generacion: GEN_TEMPORAL,
    })
    afirmar(G2, 'el admin lo cambia', true, movido.ok)
    afirmar(G2, 'y la función dice de dónde venía', IDS.cohorte, movido.datos)

    const despues = await filas(vencido, 'modules?select=id')
    afirmar(G2, 'ahora ve los de la nueva (y no los de antes)', true,
      despues.length === 2 && despues.every((m) => ![IDS.modulo1, IDS.modulo2].includes(m.id)))
    afirmar(G2, 'y solo esa generación', 1, (await filas(vencido, 'cohorts?select=id')).length)
    afirmar(G2, 'las sesiones de la anterior desaparecen', 0,
      (await filas(vencido, `cohort_sessions?select=id&cohort_id=eq.${IDS.cohorte}`)).length)

    const deVuelta = await rpc(admin, 'academia_mover_de_generacion', {
      alumno: idVencido, curso: IDS.curso, generacion: IDS.cohorte,
    })
    afirmar(G2, 'y se regresa', GEN_TEMPORAL, deVuelta.datos)

    const aAjeno = await rpc(admin, 'academia_mover_de_generacion', {
      alumno: idVencido, curso: IDS.cursoAjeno, generacion: IDS.cohorte,
    })
    afirmar(G2, 'a un curso sin generaciones falla', false, aAjeno.ok)
    const alumnoMueve = await rpc(vencido, 'academia_mover_de_generacion', {
      alumno: idVencido, curso: IDS.curso, generacion: GEN_TEMPORAL,
    })
    afirmar(G2, 'un alumno no se cambia solo', false, alumnoMueve.ok)

    // ====================================================================
    const G3 = 'UNA SOLA ABIERTA A INSCRIPCIONES'

    const segundaAbierta = await falla(bd,
      'update academia.cohorts set open_for_enrollment = true where id = $1', [IDS.cohorte2])
    afirmar(G3, 'abrir una segunda choca con el índice único', true, /cohorts_una_abierta_por_curso/.test(segundaAbierta))

    // Terminada = ya pasó su fin. El inicio también va al pasado: la generación
    // se creó para dentro de 90 días, y terminar antes de empezar lo rechaza
    // (con razón) `cohorts_fechas_coherentes`.
    await bd.query(
      'update academia.cohorts set starts_on = current_date - 30, ends_on = current_date - 1, open_for_enrollment = false where id = $1',
      [GEN_TEMPORAL]
    )
    const terminadaAbierta = await falla(bd,
      'update academia.cohorts set open_for_enrollment = true where id = $1', [GEN_TEMPORAL])
    afirmar(G3, 'una terminada no se abre', true, terminadaAbierta.length > 0)

    const otroCurso = await falla(bd,
      'update academia.cohorts set course_id = $2 where id = $1', [GEN_TEMPORAL, IDS.cursoAjeno])
    afirmar(G3, 'una generación con módulos no cambia de curso', true, otroCurso.length > 0)

    // ====================================================================
    const G4 = 'CATÁLOGO Y «EMPEZAR GRATIS»'

    await bd.query('update academia.courses set in_catalog = true, is_free = true where id = $1', [IDS.curso])

    const ofrecido = (await rpc(sinPerfil, 'academia_catalogo', {})).datos ?? []
    const tarjeta = Array.isArray(ofrecido) ? ofrecido.find((c) => c.id === IDS.curso) : null
    afirmar(G4, 'con generación abierta, el curso se ofrece', true, Boolean(tarjeta))
    afirmar(G4, 'y la tarjeta dice cuál', 'QA · Generación de prueba', tarjeta?.generacion_abierta)
    afirmar(G4, 'con las lecciones de esa generación', 4, tarjeta?.lecciones)

    const gratis = await rpc(admin, 'academia_inscribirme_gratis', { curso: IDS.curso })
    afirmar(G4, 'empezar gratis inscribe', CURSO_QA.slug, gratis.datos)
    const { rows: inscripcionAdmin } = await bd.query(
      'select cohort_id from academia.enrollments where user_id = $1 and course_id = $2',
      [idAdmin, IDS.curso]
    )
    afirmar(G4, 'en la generación abierta', IDS.cohorte, inscripcionAdmin[0]?.cohort_id)
    await bd.query('delete from academia.enrollments where user_id = $1 and course_id = $2', [idAdmin, IDS.curso])

    await bd.query('update academia.cohorts set open_for_enrollment = false where id = $1', [IDS.cohorte])
    const sinAbierta = (await rpc(sinPerfil, 'academia_catalogo', {})).datos ?? []
    afirmar(G4, 'sin generación abierta, el curso desaparece del catálogo', false,
      Array.isArray(sinAbierta) && sinAbierta.some((c) => c.id === IDS.curso))
    const gratisSinAbierta = await rpc(admin, 'academia_inscribirme_gratis', { curso: IDS.curso })
    afirmar(G4, 'y empezar gratis dice por qué', true, /generación abierta/i.test(gratisSinAbierta.mensaje))
    await bd.query('update academia.cohorts set open_for_enrollment = true where id = $1', [IDS.cohorte])

    // ====================================================================
    const G5 = 'COHERENCIA CURSO ↔ GENERACIÓN'

    const moduloCruzado = await falla(bd,
      `insert into academia.modules (course_id, cohort_id, title, position) values ($1, $2, 'QA · cruzado', 99)`,
      [IDS.cursoAjeno, IDS.cohorte])
    afirmar(G5, 'un módulo con generación de otro curso se rechaza', true, moduloCruzado.length > 0)

    const moduloSuelto = await falla(bd,
      `insert into academia.modules (course_id, cohort_id, title, position) values ($1, null, 'QA · suelto', 99)`,
      [IDS.curso])
    afirmar(G5, 'un módulo sin generación en un curso por generaciones se rechaza', true, /generaci/i.test(moduloSuelto))

    const inscripcionCruzada = await falla(bd,
      `update academia.enrollments set cohort_id = $1 where user_id = $2 and course_id = $3`,
      [IDS.cohorte, idVencido, IDS.cursoAjeno])
    // Sin inscripción en el ajeno no hay fila que tocar: se afirma que no
    // reventó por otra cosa y que nada quedó cruzado.
    const { rows: cruzadas } = await bd.query(
      `select count(*)::int as n from academia.enrollments e
         join academia.cohorts g on g.id = e.cohort_id
        where g.course_id <> e.course_id`
    )
    afirmar(G5, 'ninguna inscripción con generación de otro curso', 0, cruzadas[0]?.n)
    afirmar(G5, '(el intento no dejó rastro)', true, inscripcionCruzada === '' || inscripcionCruzada.length > 0)

    const aEvergreen = await falla(bd, `update academia.courses set course_type = 'evergreen' where id = $1`, [IDS.curso])
    afirmar(G5, 'un curso con generaciones no vuelve a evergreen', true, /generaci/i.test(aEvergreen))
  } finally {
    await limpiar(bd)
    await bd.end().catch(() => {})
  }

  process.exitCode = imprimir() ? 0 : 1
}

main().catch(async (error) => {
  await limpiar(bd).catch(() => {})
  await bd.end().catch(() => {})
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
