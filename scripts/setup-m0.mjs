#!/usr/bin/env node
/**
 * setup-m0.mjs — Crea los buckets de storage de la academia.
 *
 * Cero dependencias. Idempotente: si un bucket ya existe, verifica su configuración
 * y no lo toca. Nunca borra nada y nunca toca buckets que no empiecen con `academia-`.
 *
 * Los otros pasos de M0 (exponer el schema, Auth, SMTP) son de dashboard y no
 * tienen API pública sin un Personal Access Token. Ver docs/M0-SETUP.md.
 *
 *   node scripts/setup-m0.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const BUCKETS = [
  {
    id: 'academia-adjuntos',
    public: false,
    file_size_limit: 104_857_600, // 100 MB por archivo (§3.2 del master document)
    uso: 'adjuntos de lecciones y entregas de tareas',
  },
  {
    id: 'academia-media',
    public: true,
    file_size_limit: 10_485_760, // 10 MB: portadas, avatares, imágenes de blog
    allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'],
    uso: 'portadas, avatares, imágenes de blog',
  },
  {
    id: 'academia-certificados',
    public: false,
    file_size_limit: 10_485_760,
    allowed_mime_types: ['application/pdf'],
    uso: 'PDFs de certificados',
  },
]

function cargarEnv() {
  const ruta = resolve(ROOT, '.env.local')
  if (!existsSync(ruta)) {
    console.error('  No existe .env.local. Ver docs/M0-SETUP.md paso 6.')
    process.exit(1)
  }
  const vars = {}
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const l = linea.trim()
    if (!l || l.startsWith('#') || !l.includes('=')) continue
    const i = l.indexOf('=')
    let v = l.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    vars[l.slice(0, i).trim()] = v
  }
  return vars
}

const env = cargarEnv()
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_BASE || !SERVICE) {
  console.error('  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.')
  process.exit(1)
}

const cabeceras = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}

async function main() {
  console.log('\n  SETUP M0 — buckets de storage\n')

  const res = await fetch(`${URL_BASE}/storage/v1/bucket`, { headers: cabeceras })
  const existentes = await res.json()
  if (!Array.isArray(existentes)) {
    console.error('  No se pudo listar buckets:', JSON.stringify(existentes))
    process.exitCode = 1
    return
  }

  let fallas = 0
  let avisos = 0

  for (const b of BUCKETS) {
    const yaExiste = existentes.find((x) => x.name === b.id || x.id === b.id)

    if (yaExiste) {
      const coincide = Boolean(yaExiste.public) === b.public
      console.log(
        `  ${coincide ? '✓' : '✗'}  ${b.id.padEnd(24)} ya existía` +
          (coincide ? ` (${b.public ? 'público' : 'privado'})` : ` pero es ${yaExiste.public ? 'público' : 'privado'} y debe ser ${b.public ? 'público' : 'privado'}`)
      )
      if (!coincide) {
        console.log(`     ${' '.repeat(24)} → corrígelo en Storage → ${b.id} → Settings (no lo cambio yo)`)
        fallas++
      }
      continue
    }

    const { uso: _uso, ...config } = b

    const postear = (cuerpo) =>
      fetch(`${URL_BASE}/storage/v1/bucket`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify(cuerpo),
      })

    let crear = await postear({ name: b.id, ...config })
    let cuerpo = await crear.json().catch(() => ({}))
    let heredado = false

    // El file_size_limit del bucket no puede exceder el tope global del proyecto
    // (Settings → Storage → Upload file size limit). Si lo excede, creamos el bucket
    // heredando el tope global y avisamos, en vez de dejar el bucket sin crear.
    if (!crear.ok && /maximum allowed size/i.test(cuerpo.message ?? '')) {
      const { file_size_limit: _limite, ...sinLimite } = config
      crear = await postear({ name: b.id, ...sinLimite })
      cuerpo = await crear.json().catch(() => ({}))
      heredado = crear.ok
    }

    if (crear.ok) {
      console.log(`  ✓  ${b.id.padEnd(24)} creado (${b.public ? 'público' : 'privado'}) — ${b.uso}`)
      if (heredado) {
        const mb = Math.round(b.file_size_limit / 1_048_576)
        console.log(`     ${' '.repeat(24)} ! hereda el tope global del proyecto; §3.2 pide ${mb} MB`)
        console.log(`     ${' '.repeat(24)}   súbelo en Settings → Storage → Upload file size limit`)
        avisos++
      }
    } else {
      console.log(`  ✗  ${b.id.padEnd(24)} falló: ${cuerpo.message ?? crear.status}`)
      fallas++
    }
  }

  const ajenos = existentes.filter((b) => !String(b.name ?? b.id).startsWith('academia-'))
  if (ajenos.length) {
    console.log(`\n  ${ajenos.length} bucket(s) de otros sistemas: no se tocan (Regla Cero).`)
  }

  console.log(
    fallas === 0
      ? `\n  Buckets listos${avisos ? ` (${avisos} aviso)` : ''}.` +
          ' Las policies las crea la migración academia_0015_storage.sql en M1.\n'
      : `\n  ${fallas} bucket(s) con problemas. Ver docs/M0-SETUP.md paso 5.\n`
  )
  process.exitCode = fallas === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('\n  Error inesperado:', e.message)
  process.exitCode = 1
})
