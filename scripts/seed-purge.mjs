#!/usr/bin/env node
/**
 * seed-purge.mjs — Borra los datos de prueba de M1.
 *
 * Es lo que cierra el criterio de M11: "datos de prueba purgados".
 *
 * Solo toca lo que lleva la marca QA: usuarios cuyo correo empieza con `qa-` y
 * las filas de academia.* con los UUID fijos de scripts/lib/qa.mjs. Nunca borra
 * por rango ni por fecha, para que no pueda llevarse por delante datos reales.
 *
 * También borra los ARCHIVOS, no solo las filas. Postgres cascadea; Storage no.
 * Sin esto, cada corrida de la suite dejaba certificados y entregas en los
 * buckets para siempre, sin ninguna fila que los nombrara — y "datos de prueba
 * purgados" quedaba a medias. Se borra por PREFIJO de los ids QA, no buscando
 * huérfanos: así no puede llevarse por delante un archivo real en vuelo.
 * (Para lo ya huérfano de antes: `pnpm storage:huerfanos`.)
 *
 *   node scripts/seed-purge.mjs --confirmar
 */

import {
  cargarEnv,
  conectarPostgres,
  exigir,
  linea,
  titulo,
} from './lib/entorno.mjs'
import { IDS, PREFIJO_QA, USUARIOS_QA } from './lib/qa.mjs'

const CONFIRMADO = process.argv.includes('--confirmar')

const vars = cargarEnv()
const URL_BASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')

const cabeceras = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}

/** Todos los usuarios de auth con el prefijo QA, sembrados o no. */
async function usuariosQA() {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=1000`, { headers: cabeceras })
  if (!res.ok) return []
  const cuerpo = await res.json()
  const lista = Array.isArray(cuerpo?.users) ? cuerpo.users : []
  return lista.filter((u) => (u.email ?? '').toLowerCase().startsWith(PREFIJO_QA))
}

/**
 * Los archivos QA, buscados por PREFIJO de ruta y no por "sin referencia".
 *
 * La diferencia importa: buscar huérfanos borraría también un archivo real que
 * alguien esté subiendo en ese instante, porque su fila todavía no existe. Por
 * prefijo solo cae lo que vive en la carpeta de un usuario QA o de una lección
 * de un curso QA, que es exactamente lo que sembramos.
 */
async function archivosQA(cliente, usuarios) {
  if (usuarios.length === 0) return []

  const lecciones = await cliente.query(
    `select l.id
       from academia.lessons l
       join academia.modules m on m.id = l.module_id
      where m.course_id = any($1::uuid[])`,
    [[IDS.curso, IDS.cursoAjeno]]
  )

  const patrones = [
    ...usuarios.flatMap((id) => [`${id}/%`, `entregas/${id}/%`, `comunidad/${id}/%`, `avatares/${id}/%`]),
    ...lecciones.rows.map((l) => `lecciones/${l.id}/%`),
  ]

  const { rows } = await cliente.query(
    `select bucket_id, name
       from storage.objects
      where bucket_id like 'academia-%'
        and name like any($1::text[])`,
    [patrones]
  )

  return rows
}

/** Borra por la API de Storage: quitar la fila dejaría el archivo en el bucket. */
async function borrarArchivos(archivos) {
  if (archivos.length === 0) return

  const porBucket = new Map()
  for (const a of archivos) {
    if (!porBucket.has(a.bucket_id)) porBucket.set(a.bucket_id, [])
    porBucket.get(a.bucket_id).push(a.name)
  }

  for (const [bucket, rutas] of porBucket) {
    const res = await fetch(`${URL_BASE}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: cabeceras,
      body: JSON.stringify({ prefixes: rutas }),
    })
    linea(res.ok ? 'ok' : 'falla', bucket, res.ok ? `${rutas.length} archivo(s)` : `error ${res.status}`)
    if (!res.ok) process.exitCode = 1
  }
}

async function main() {
  titulo('PURGA DE DATOS QA')

  if (!CONFIRMADO) {
    console.log('  Esto borra:')
    for (const u of USUARIOS_QA) console.log(`    - usuario ${u.email}`)
    console.log(`    - los 2 cursos QA y todo lo que cuelga de ellos (cascada)`)
    console.log(`    - sus archivos en los buckets academia-*`)
    console.log(`    - los stripe_events sintéticos (evt_qa_*)`)
    console.log('')
    console.log('  Nada más. No toca usuarios ni cursos reales.')
    console.log('')
    console.log('  Para ejecutarlo:  node scripts/seed-purge.mjs --confirmar')
    console.log('')
    return
  }

  const cliente = await conectarPostgres(vars)

  try {
    // Los ids de los usuarios QA se leen ANTES de borrar los perfiles: son el
    // prefijo de sus carpetas en Storage y después ya no habría de dónde
    // sacarlos.
    const dueños = await cliente.query(
      `select user_id from academia.profiles where email like $1`,
      [`${PREFIJO_QA}%`]
    )
    const prefijos = dueños.rows.map((f) => f.user_id)

    const archivos = await archivosQA(cliente, prefijos)

    // Los cursos en cascada se llevan módulos, lecciones, inscripciones,
    // cohortes, quizzes, tareas, comunidad y anuncios asociados.
    const cursos = await cliente.query(
      'delete from academia.courses where id = any($1::uuid[]) returning slug',
      [[IDS.curso, IDS.cursoAjeno]]
    )
    for (const c of cursos.rows) linea('ok', `curso ${c.slug}`, 'borrado en cascada')

    // Por si quedó algo sembrado con el prefijo fuera de esos dos cursos.
    const perfiles = await cliente.query(
      `delete from academia.profiles where email like $1 returning email`,
      [`${PREFIJO_QA}%`]
    )
    for (const p of perfiles.rows) linea('ok', `perfil ${p.email}`, 'borrado')

    // Eventos sintéticos de la suite de Stripe: no cuelgan de ningún curso.
    const eventos = await cliente.query(
      `delete from academia.stripe_events where event_id like 'evt_qa_%' returning event_id`
    )
    if (eventos.rowCount > 0) {
      linea('ok', 'stripe_events sintéticos', `${eventos.rowCount} borrado(s)`)
    }

    // Publicaciones que las suites dejan marcadas y no cuelgan de un curso.
    const publicaciones = await cliente.query(
      `delete from academia.posts where title like 'QA %' returning id`
    )
    if (publicaciones.rowCount > 0) {
      linea('ok', 'publicaciones QA', `${publicaciones.rowCount} borrada(s)`)
    }

    await borrarArchivos(archivos)

    const restantes = await cliente.query(
      `select count(*)::int n from academia.profiles where email like $1`,
      [`${PREFIJO_QA}%`]
    )
    if (restantes.rows[0].n > 0) {
      linea('falla', 'quedaron perfiles QA', String(restantes.rows[0].n))
      process.exitCode = 1
    }
  } finally {
    await cliente.end().catch(() => {})
  }

  // Los usuarios de auth se borran con la Admin API, no con SQL.
  //
  // Se listan TODOS los `qa-`, no solo los cinco sembrados: las suites crean
  // otros por su cuenta —`qa-stripe@` sale del webhook— y si una suite muere a
  // medias, el suyo se queda. Buscarlos por prefijo los alcanza a todos.
  for (const usuario of await usuariosQA()) {
    const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${usuario.id}`, {
      method: 'DELETE',
      headers: cabeceras,
    })
    linea(
      res.ok ? 'ok' : 'falla',
      usuario.email.padEnd(42),
      res.ok ? 'borrado' : `error ${res.status}`
    )
    if (!res.ok) process.exitCode = 1
  }

  console.log('')
  console.log('  Purga terminada. Para volver a sembrar: pnpm db:seed')
  console.log('')
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
