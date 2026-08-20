#!/usr/bin/env node
/**
 * check-m0.mjs — Verificación de M0 (Fase A).
 *
 * Cero dependencias: corre con `node scripts/check-m0.mjs` antes de instalar nada.
 * Solo hace lecturas. No crea usuarios, no escribe en la base, no toca otros schemas.
 *
 * Ver docs/M0-SETUP.md. Sale con código 1 si algo falla.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import dns from 'node:dns/promises'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TIMEOUT_MS = 15_000

// --- .env.local ------------------------------------------------------------

function cargarEnv() {
  const ruta = resolve(ROOT, '.env.local')
  if (!existsSync(ruta)) return { ruta, vars: null }

  const vars = {}
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith('#')) continue
    const i = limpia.indexOf('=')
    if (i === -1) continue
    const clave = limpia.slice(0, i).trim()
    let valor = limpia.slice(i + 1).trim()
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1)
    }
    vars[clave] = valor
  }
  return { ruta, vars }
}

// --- reporte ---------------------------------------------------------------

const resultados = []
const OK = 'ok'
const FALLA = 'falla'
const AVISO = 'aviso'

function registrar(estado, titulo, detalle, arreglo) {
  resultados.push({ estado, titulo, detalle, arreglo })
}
const ok = (t, d) => registrar(OK, t, d)
const falla = (t, d, a) => registrar(FALLA, t, d, a)
const aviso = (t, d, a) => registrar(AVISO, t, d, a)

function imprimirReporte() {
  const icono = { [OK]: '\u2713', [FALLA]: '\u2717', [AVISO]: '!' }
  const ancho = Math.max(...resultados.map((r) => r.titulo.length))

  console.log('')
  console.log('  VERIFICACIÓN M0 — VADAI ACADEMIA')
  console.log('  ' + '─'.repeat(ancho + 40))

  for (const r of resultados) {
    console.log(`  ${icono[r.estado]}  ${r.titulo.padEnd(ancho)}  ${r.detalle}`)
    if (r.arreglo) console.log(`     ${' '.repeat(ancho)}  → ${r.arreglo}`)
  }

  const fallas = resultados.filter((r) => r.estado === FALLA)
  const avisos = resultados.filter((r) => r.estado === AVISO)

  console.log('  ' + '─'.repeat(ancho + 40))
  if (fallas.length === 0) {
    console.log(`  M0 LISTO — ${resultados.length - avisos.length} verificaciones en verde` +
      (avisos.length ? `, ${avisos.length} aviso(s)` : ''))
    console.log('  Siguiente: avísame y arranco Fase B (scaffold).')
  } else {
    console.log(`  M0 INCOMPLETO — ${fallas.length} verificación(es) fallaron.`)
    console.log('  Revisa docs/M0-SETUP.md. No se escribe código de app hasta que esto salga en verde.')
  }
  console.log('')
  return fallas.length === 0
}

// --- helpers ---------------------------------------------------------------

async function pedir(url, opciones = {}) {
  try {
    const res = await fetch(url, { ...opciones, signal: AbortSignal.timeout(TIMEOUT_MS) })
    const texto = await res.text()
    let json = null
    try {
      json = JSON.parse(texto)
    } catch {
      /* respuesta no-JSON, se queda el texto */
    }
    return { res, json, texto, error: null }
  } catch (e) {
    return { res: null, json: null, texto: '', error: e }
  }
}

/** Decodifica el payload de un JWT sin verificar firma. Devuelve null si no es JWT. */
function payloadJwt(token) {
  const partes = token?.split('.')
  if (partes?.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

const REQUERIDAS_M0 = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'SUPABASE_DB_URL',
]

const DIFERIDAS = {
  'M9 (Stripe)': ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'],
  'M3/M4 (Bunny)': [
    'BUNNY_STREAM_LIBRARY_ID',
    'BUNNY_STREAM_API_KEY',
    'BUNNY_STREAM_TOKEN_KEY',
    'BUNNY_STREAM_CDN_HOSTNAME',
  ],
}

const BUCKETS = [
  { nombre: 'academia-adjuntos', publico: false },
  { nombre: 'academia-media', publico: true },
  { nombre: 'academia-certificados', publico: false },
]

// --- verificaciones --------------------------------------------------------

async function main() {
  const { ruta, vars } = cargarEnv()

  if (!vars) {
    falla('.env.local', 'no existe', `copia .env.local.example a ${ruta} y llénalo (docs/M0-SETUP.md paso 6)`)
    imprimirReporte()
    process.exitCode = 1
    return
  }
  ok('.env.local', `encontrado (${Object.keys(vars).length} variables)`)

  // 1. Variables requeridas
  const faltantes = REQUERIDAS_M0.filter((k) => !vars[k])
  if (faltantes.length) {
    falla('Variables de M0', `faltan o están vacías: ${faltantes.join(', ')}`, 'docs/M0-SETUP.md paso 6')
  } else {
    ok('Variables de M0', `las ${REQUERIDAS_M0.length} presentes`)
  }

  for (const [milestone, claves] of Object.entries(DIFERIDAS)) {
    const pendientes = claves.filter((k) => !vars[k])
    if (pendientes.length) {
      aviso(`Variables ${milestone}`, `${pendientes.length}/${claves.length} pendientes`, 'no bloquea M1')
    } else {
      ok(`Variables ${milestone}`, 'completas')
    }
  }

  if (faltantes.length) {
    imprimirReporte()
    process.exitCode = 1
    return
  }

  const URL_BASE = vars.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')
  const ANON = vars.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const SERVICE = vars.SUPABASE_SERVICE_ROLE_KEY

  // 2. Las llaves son distintas
  if (ANON === SERVICE) {
    falla('Llaves anon vs service', 'son idénticas', 'copiaste la misma dos veces; revisa Settings → API')
  } else {
    const pAnon = payloadJwt(ANON)
    const pSvc = payloadJwt(SERVICE)
    if (pAnon && pSvc) {
      const bien = pAnon.role === 'anon' && pSvc.role === 'service_role'
      bien
        ? ok('Llaves anon vs service', `roles correctos (anon / service_role)`)
        : falla('Llaves anon vs service', `roles: ${pAnon.role} / ${pSvc.role}`, 'están invertidas o son de otro proyecto')
      if (pAnon.ref && pSvc.ref && pAnon.ref !== pSvc.ref) {
        falla('Consistencia de proyecto', `anon=${pAnon.ref} service=${pSvc.ref}`, 'las llaves son de proyectos distintos')
      }
    } else {
      ok('Llaves anon vs service', 'distintas (formato sb_* nuevo)')
    }
  }

  // 3. La URL responde
  const salud = await pedir(`${URL_BASE}/auth/v1/health`, { headers: { apikey: ANON } })
  if (salud.error) {
    falla('Conexión a Supabase', `no responde: ${salud.error.message}`, `verifica NEXT_PUBLIC_SUPABASE_URL (${URL_BASE})`)
    imprimirReporte()
    process.exitCode = 1
    return
  }
  ok('Conexión a Supabase', `${URL_BASE} responde (${salud.res.status})`)

  // 4. Schema `academia` expuesto en la API  ← el paso que más se olvida
  const sonda = await pedir(`${URL_BASE}/rest/v1/__sonda_academia__?select=*&limit=1`, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Accept-Profile': 'academia',
    },
  })

  const codigo = sonda.json?.code
  if (codigo === 'PGRST106') {
    falla(
      'Schema academia expuesto',
      'PostgREST lo rechaza (PGRST106)',
      'Dashboard → Settings → API → Exposed schemas: agrega "academia" SIN quitar los existentes (M0-SETUP paso 2)'
    )
  } else if (codigo === 'PGRST205' || sonda.res?.status === 404) {
    // Schema visible; la tabla sonda no existe, que es justo lo esperado antes de migrar.
    ok('Schema academia expuesto', 'PostgREST lo resuelve (tabla sonda inexistente, correcto)')
  } else if (sonda.res?.status === 200) {
    aviso('Schema academia expuesto', 'existe una tabla __sonda_academia__ real', 'inesperado pero no bloquea')
  } else {
    falla(
      'Schema academia expuesto',
      `respuesta inesperada ${sonda.res?.status} ${codigo ?? ''} ${sonda.json?.message ?? sonda.texto.slice(0, 120)}`,
      'revisa M0-SETUP pasos 1 y 2'
    )
  }

  // 5. Configuración de Auth (lectura pura, no crea usuarios)
  const conf = await pedir(`${URL_BASE}/auth/v1/settings`, { headers: { apikey: ANON } })
  if (conf.json) {
    const s = conf.json
    s.disable_signup === true
      ? ok('Sign-up público OFF', 'disable_signup = true')
      : falla(
          'Sign-up público OFF',
          'el registro público está ABIERTO',
          'Authentication → Sign In/Providers → "Allow new users to sign up" = OFF (M0-SETUP paso 3)'
        )

    s.external?.email
      ? ok('Provider email/password', 'habilitado')
      : falla('Provider email/password', 'deshabilitado', 'Authentication → Providers → Email')

    s.external?.google
      ? ok('Provider Google', 'habilitado')
      : falla('Provider Google', 'deshabilitado', 'Authentication → Providers → Google (M0-SETUP paso 3)')
  } else {
    aviso('Configuración de Auth', `no se pudo leer (${conf.res?.status})`, 'verifica a mano el paso 3')
  }

  aviso(
    'Account linking',
    'no es consultable por API',
    'confirma a mano: "Link accounts with the same email" = ON'
  )

  // 6. Service role funciona
  const admin = await pedir(`${URL_BASE}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  })
  admin.res?.status === 200
    ? ok('Service role key', 'autoriza el endpoint admin')
    : falla('Service role key', `no autoriza (${admin.res?.status})`, 'copia de nuevo la service_role de Settings → API')

  // 7. Buckets
  const lista = await pedir(`${URL_BASE}/storage/v1/bucket`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  })
  if (Array.isArray(lista.json)) {
    for (const esperado of BUCKETS) {
      const encontrado = lista.json.find((b) => b.name === esperado.nombre || b.id === esperado.nombre)
      if (!encontrado) {
        falla(
          `Bucket ${esperado.nombre}`,
          'no existe',
          `créalo ${esperado.publico ? 'PÚBLICO' : 'PRIVADO'} (M0-SETUP paso 5)`
        )
      } else if (Boolean(encontrado.public) !== esperado.publico) {
        falla(
          `Bucket ${esperado.nombre}`,
          `es ${encontrado.public ? 'público' : 'privado'} y debe ser ${esperado.publico ? 'público' : 'privado'}`,
          'Storage → bucket → Settings'
        )
      } else {
        ok(`Bucket ${esperado.nombre}`, esperado.publico ? 'existe, público' : 'existe, privado')
      }
    }
    const ajenos = lista.json.filter((b) => !b.name?.startsWith('academia-')).length
    if (ajenos) aviso('Buckets ajenos', `${ajenos} de otros sistemas VADAI`, 'no se tocan (Regla Cero)')
  } else {
    falla('Buckets de storage', `no se pudo listar (${lista.res?.status})`, 'revisa la service role key y el paso 5')
  }

  // 8. SUPABASE_DB_URL
  try {
    const db = new URL(vars.SUPABASE_DB_URL)
    if (!/^postgres(ql)?:$/.test(db.protocol)) throw new Error(`protocolo ${db.protocol}`)
    if (/YOUR-PASSWORD|\[.*\]/.test(db.password || '')) {
      throw new Error('la password sigue siendo el placeholder')
    }
    await dns.lookup(db.hostname)
    if (db.port === '6543') {
      falla(
        'SUPABASE_DB_URL',
        'apunta al transaction pooler (6543)',
        'usa el Session pooler (5432): el transaction pooler no soporta el DDL de las migraciones'
      )
    } else {
      ok('SUPABASE_DB_URL', `${db.hostname}:${db.port || 5432} resuelve por DNS`)
    }
  } catch (e) {
    falla('SUPABASE_DB_URL', e.message, 'Settings → Database → Connection string → Session pooler (M0-SETUP paso 6)')
  }

  // 9. Conexión real a Postgres — solo si `pg` ya está instalado (post-scaffold)
  try {
    const { Client } = await import('pg')
    const c = new Client({ connectionString: vars.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
    try {
      await c.connect()
      const r = await c.query(
        `select current_database() db,
                (select count(*)::int from information_schema.tables where table_schema = 'academia') tablas,
                (select count(*)::int from pg_namespace where nspname = 'academia') existe`
      )
      const { db, tablas, existe } = r.rows[0]
      existe
        ? ok('Conexión real a Postgres', `${db}, schema academia con ${tablas} tabla(s)`)
        : falla('Conexión real a Postgres', `conecta a ${db} pero el schema academia no existe`, 'M0-SETUP paso 1')
    } finally {
      await c.end().catch(() => {})
    }
  } catch (e) {
    e.code === 'ERR_MODULE_NOT_FOUND'
      ? aviso('Conexión real a Postgres', 'pg aún no instalado', 'se verifica al correr pnpm db:migrate')
      : falla('Conexión real a Postgres', e.message, 'revisa SUPABASE_DB_URL (usuario, password, host)')
  }

  process.exitCode = imprimirReporte() ? 0 : 1
}

main().catch((e) => {
  console.error('\n  Error inesperado en la verificación:\n ', e)
  process.exitCode = 1
})
