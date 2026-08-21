#!/usr/bin/env node
/**
 * storage-huerfanos.mjs — Encuentra archivos que ya no referencia nadie.
 *
 * Postgres borra filas en cascada; los archivos de Storage no. Borrar una
 * lección se lleva sus `lesson_attachments`, pero los PDFs siguen ahí. Borrar
 * un curso se lleva las publicaciones de su comunidad, pero no las imágenes.
 * Y un certificado reemitido deja el PDF viejo sin nadie que lo nombre.
 *
 * Nada de eso se ve: no rompe la app, no aparece en ninguna pantalla, y la
 * cuenta de Storage crece sola. Por eso hay que ir a buscarlo a propósito.
 *
 * Este script reconcilia en vez de intentar enganchar cada borrado. Enganchar
 * cada camino sería frágil —basta olvidar uno— y además no arregla lo que ya
 * quedó huérfano. Reconciliar arregla las dos cosas y se puede correr siempre.
 *
 * Y reconciliar mira los dos lados. El reverso del huérfano es la referencia
 * colgante: una fila que nombra un archivo que no existe. Eso sí se ve, y se ve
 * mal — es un adjunto que le da al alumno una descarga rota. No se borra solo:
 * se reporta, porque quitar la fila puede ser lo correcto o puede ser que falte
 * volver a subir el archivo, y eso no lo decide un script.
 *
 *   pnpm storage:huerfanos             # solo reporta
 *   pnpm storage:huerfanos --borrar    # borra lo que reporta
 *
 * REGLA CERO: solo mira y solo borra dentro de los buckets `academia-*`.
 * Los objetos de cualquier otro bucket ni se leen.
 */

import { createClient } from '@supabase/supabase-js'

import { cargarEnv, conectarPostgres, exigir, linea, titulo } from './lib/entorno.mjs'

const BORRAR = process.argv.includes('--borrar')
const GRACIA_ARG = process.argv.find((a) => a.startsWith('--gracia='))

/**
 * Margen de gracia. Un archivo recién subido puede no tener todavía su fila:
 * `publicarEnComunidad` sube primero y hace el insert después, así que hay una
 * ventana de milisegundos en la que el archivo es legítimo y parece huérfano.
 * Una hora es de sobra y no cambia nada del propósito del script.
 */
const GRACIA_MINUTOS = GRACIA_ARG ? Number(GRACIA_ARG.split('=')[1]) : 60

const BUCKETS = ['academia-adjuntos', 'academia-media', 'academia-certificados']

const vars = cargarEnv()
const URL_BASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')

/** Saca la ruta dentro del bucket de una URL pública de Storage. */
function rutaDeUrl(url, bucket) {
  if (typeof url !== 'string') return null
  const marca = `/storage/v1/object/public/${bucket}/`
  const i = url.indexOf(marca)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marca.length).split('?')[0])
}

/** Todas las rutas que alguna fila de `academia` dice estar usando. */
async function rutasReferenciadas(bd) {
  const referencias = {
    'academia-adjuntos': new Set(),
    'academia-media': new Set(),
    'academia-certificados': new Set(),
  }

  const origen = new Map()

  const agregar = (bucket, ruta, desde) => {
    if (typeof ruta === 'string' && ruta.trim() !== '') {
      const limpia = ruta.replace(/^\/+/, '')
      referencias[bucket].add(limpia)
      if (desde && !origen.has(`${bucket}/${limpia}`)) origen.set(`${bucket}/${limpia}`, desde)
    }
  }

  // --- academia-adjuntos ---------------------------------------------------
  const adjuntos = await bd.query(`select storage_path from academia.lesson_attachments`)
  for (const fila of adjuntos.rows) agregar('academia-adjuntos', fila.storage_path, 'lesson_attachments')

  const entregas = await bd.query(`select files from academia.assignment_submissions`)
  for (const fila of entregas.rows) {
    for (const archivo of Array.isArray(fila.files) ? fila.files : []) {
      agregar('academia-adjuntos', archivo?.storage_path, 'assignment_submissions')
    }
  }

  // --- academia-media ------------------------------------------------------
  const publicaciones = await bd.query(`select images from academia.community_posts`)
  for (const fila of publicaciones.rows) {
    for (const imagen of Array.isArray(fila.images) ? fila.images : []) {
      agregar('academia-media', imagen?.storage_path, 'community_posts')
      agregar('academia-media', rutaDeUrl(imagen?.url, 'academia-media'), 'community_posts')
    }
  }

  // Portadas y avatares se guardan como URL pública, no como ruta.
  for (const [tabla, columna] of [
    ['courses', 'cover_url'],
    ['posts', 'cover_url'],
    ['profiles', 'avatar_url'],
  ]) {
    const filas = await bd.query(
      `select ${columna} as valor from academia.${tabla} where ${columna} is not null`
    )
    for (const fila of filas.rows) {
      agregar('academia-media', rutaDeUrl(fila.valor, 'academia-media'), `${tabla}.${columna}`)
    }
  }

  // --- academia-certificados -----------------------------------------------
  const certificados = await bd.query(
    `select pdf_path from academia.certificates where pdf_path is not null`
  )
  for (const fila of certificados.rows) agregar('academia-certificados', fila.pdf_path, 'certificates')

  return { referencias, origen }
}

/** Lo que hay realmente en cada bucket, con su antigüedad. */
async function objetosReales(bd) {
  const { rows } = await bd.query(
    `select bucket_id, name, coalesce(updated_at, created_at) as fecha,
            coalesce((metadata->>'size')::bigint, 0) as bytes
     from storage.objects
     where bucket_id = any($1::text[])
     order by bucket_id, name`,
    [BUCKETS]
  )
  return rows
}

function humano(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function main() {
  titulo(BORRAR ? 'HUÉRFANOS DE STORAGE — BORRANDO' : 'HUÉRFANOS DE STORAGE')

  const bd = await conectarPostgres(vars)

  let huerfanos = []
  let enGracia = []
  let colgantes = []
  let totalObjetos = 0

  try {
    const { referencias, origen } = await rutasReferenciadas(bd)
    const objetos = await objetosReales(bd)
    totalObjetos = objetos.length

    const corte = Date.now() - GRACIA_MINUTOS * 60 * 1000

    for (const objeto of objetos) {
      if (referencias[objeto.bucket_id]?.has(objeto.name)) continue
      // Sin referencia. Si es reciente puede ser una subida en curso, así que
      // se aparta en vez de esconderse: decir "no hay huérfanos" cuando los hay
      // pero son nuevos es la clase de reporte que hace perder una tarde.
      if (new Date(objeto.fecha).getTime() > corte) enGracia.push(objeto)
      else huerfanos.push(objeto)
    }

    // El reverso: referencias que nombran un archivo que no está.
    const existentes = new Set(objetos.map((o) => `${o.bucket_id}/${o.name}`))
    for (const [bucket, rutas] of Object.entries(referencias)) {
      for (const ruta of rutas) {
        const llave = `${bucket}/${ruta}`
        if (!existentes.has(llave)) colgantes.push({ llave, desde: origen.get(llave) ?? '?' })
      }
    }

    console.log(`  Buckets:     ${BUCKETS.join(', ')}`)
    console.log(`  Objetos:     ${totalObjetos}`)
    console.log(`  Referencias: ${Object.values(referencias).reduce((n, s) => n + s.size, 0)}`)
    console.log(`  Gracia:      ${GRACIA_MINUTOS} min (lo subido hace poco no se toca)`)
  } finally {
    await bd.end().catch(() => {})
  }

  if (colgantes.length > 0) {
    console.log('')
    console.log(`  Referencias colgantes (${colgantes.length}) — la fila existe, el archivo no:`)
    for (const c of colgantes) console.log(`    ${c.desde.padEnd(24)} ${c.llave}`)
    console.log('')
    console.log('  Estas NO se borran solas: puede que falte volver a subir el')
    console.log('  archivo, o puede que sobre la fila. Eso no lo decide un script.')
  }

  if (enGracia.length > 0) {
    console.log('')
    console.log(`  Sin referencia pero dentro de la gracia (${enGracia.length}):`)
    for (const g of enGracia) {
      const edad = Math.round((Date.now() - new Date(g.fecha).getTime()) / 60000)
      console.log(`    ${String(edad).padStart(3)} min  ${g.bucket_id}/${g.name}`)
    }
    console.log('')
    console.log(`  Vuelve a correrlo más tarde, o baja el margen:`)
    console.log(`    pnpm storage:huerfanos --gracia=0`)
  }

  if (huerfanos.length === 0) {
    console.log('')
    linea(
      enGracia.length > 0 ? 'aviso' : 'ok',
      'Sin huérfanos que borrar',
      `${totalObjetos} objeto(s) en total`
    )
    console.log('')
    return
  }

  const porBucket = new Map()
  for (const h of huerfanos) {
    if (!porBucket.has(h.bucket_id)) porBucket.set(h.bucket_id, [])
    porBucket.get(h.bucket_id).push(h)
  }

  const bytes = huerfanos.reduce((n, h) => n + Number(h.bytes), 0)

  for (const [bucket, lista] of porBucket) {
    console.log('')
    console.log(`  ${bucket}  (${lista.length})`)
    for (const h of lista) {
      console.log(`    ${humano(Number(h.bytes)).padStart(8)}  ${h.name}`)
    }
  }

  console.log('')

  if (!BORRAR) {
    linea('aviso', `${huerfanos.length} huérfano(s)`, `${humano(bytes)} sin nadie que los use`)
    console.log('')
    console.log('  Para borrarlos:  pnpm storage:huerfanos --borrar')
    console.log('')
    // No es un fallo: informar es el modo normal.
    return
  }

  // El borrado va por la API de Storage, no por SQL. Borrar la fila de
  // `storage.objects` a mano dejaría el archivo en el bucket y la base
  // diciendo que no existe: lo peor de los dos mundos.
  const supabase = createClient(URL_BASE, SERVICE, { auth: { persistSession: false } })

  let borrados = 0
  for (const [bucket, lista] of porBucket) {
    // En tandas: `remove` acepta varias rutas pero no conviene mandarle miles.
    for (let i = 0; i < lista.length; i += 100) {
      const tanda = lista.slice(i, i + 100).map((h) => h.name)
      const { error } = await supabase.storage.from(bucket).remove(tanda)
      if (error) {
        linea('falla', bucket, error.message)
        process.exitCode = 1
        continue
      }
      borrados += tanda.length
    }
    linea('ok', bucket, `${lista.length} borrado(s)`)
  }

  console.log('')
  console.log(`  ${borrados} archivo(s) borrados, ${humano(bytes)} liberados.`)
  console.log('')
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
