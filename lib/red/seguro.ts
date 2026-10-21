import 'server-only'

import { lookup } from 'node:dns'
import { lookup as lookupPromesa } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import zlib from 'node:zlib'

/**
 * Pedir una URL de internet desde el servidor, sin que nos usen para entrar a
 * nuestra propia red (SSRF). M20 lo hacía para los webhooks; M24 lo extiende
 * para leer noticias y bajar imágenes a partir de una liga que pega alguien.
 *
 *   - Solo https al puerto 443, sin usuario ni contraseña, sin IPs escritas.
 *   - El nombre se resuelve UNA vez y la conexión va a esa IP ya revisada (un
 *     `lookup` propio): un DNS que contesta una IP pública al revisar y una
 *     privada al conectar (rebinding) no pasa.
 *   - Se rechaza toda IP privada, de loopback, link-local, CGNAT, reservada,
 *     multicast, ULA y las que traen una IPv4 adentro (mapeadas, NAT64, 6to4).
 *   - A lo más 3 redirecciones, cada una revisada igual; tiempo y bytes topados.
 *
 * Para la suite (`NOTICIAS_SITIO_DE_PRUEBA=http://127.0.0.1:…`, fuera de
 * Vercel y solo localhost): los hosts `*.qa-noticias.invalid` van a ese sitio
 * falso. `.invalid` nunca resuelve, así que en producción esas ligas fallan
 * solas, igual que `qa-webhooks.invalid` en M20.
 */

const DOMINIO_DE_PRUEBA = '.qa-noticias.invalid'

/** ¿Es una IP a la que nunca debemos conectarnos? */
export function ipPrivada(ip: string): boolean {
  if (isIP(ip) === 6) {
    const x = ip.toLowerCase()
    if (x === '::1' || x === '::') return true
    if (x.startsWith('fc') || x.startsWith('fd')) return true // ULA
    if (x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb')) return true // link-local
    if (x.startsWith('ff')) return true // multicast
    const conV4 = x.match(/(?:::ffff:|^64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/) // mapeada o NAT64
    if (conV4) return ipPrivada(conV4[1]!)
    if (x.startsWith('64:ff9b:') || x.startsWith('2002:') || x.startsWith('2001:0:') || x.startsWith('2001::')) return true // NAT64, 6to4, Teredo
    return false
  }
  if (isIP(ip) !== 4) return true
  const [a = 0, b = 0, c = 0] = ip.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

/** El sitio falso de la suite, si este servidor lo tiene puesto. */
function sitioDePrueba(): URL | null {
  const crudo = process.env.NOTICIAS_SITIO_DE_PRUEBA
  if (!crudo || process.env.VERCEL) return null
  try {
    const u = new URL(crudo)
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost' ? u : null
  } catch {
    return null
  }
}

export function esUrlDePrueba(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(DOMINIO_DE_PRUEBA)
  } catch {
    return false
  }
}

/** Revisa la forma de la URL. null si se puede pedir; si no, el motivo en español. */
export function formaSegura(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return 'La URL no es válida.'
  }
  if (u.hostname.endsWith(DOMINIO_DE_PRUEBA) && sitioDePrueba()) return null
  if (u.protocol !== 'https:') return 'Solo se aceptan URLs https.'
  if (u.username || u.password) return 'La URL no puede llevar usuario ni contraseña.'
  if (u.port && u.port !== '443') return 'Solo se aceptan URLs del puerto normal (443).'
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) return 'Escribe la dirección con su nombre, no con una IP.'
  if (!host.includes('.') || host === 'localhost' || /\.(local|internal|localhost|invalid|test|example)$/.test(host)) {
    return 'Ese destino no es público.'
  }
  return null
}

/** ¿Se puede mandar a esta URL? https y un host que resuelve solo a IPs públicas. */
export async function destinoSeguro(url: string): Promise<string | null> {
  const forma = formaSegura(url)
  if (forma) return forma
  const host = new URL(url).hostname
  if (host.endsWith(DOMINIO_DE_PRUEBA)) return null
  try {
    const direcciones = await lookupPromesa(host, { all: true })
    if (direcciones.length === 0 || direcciones.some((d) => ipPrivada(d.address))) return 'Ese destino no es público.'
  } catch {
    return 'No se pudo resolver el destino.'
  }
  return null
}

/**
 * Resuelve el nombre y solo deja pasar IPs públicas. Lo usa el socket mismo,
 * así que la IP revisada es la IP a la que se conecta.
 */
const lookupPublico: LookupFunction = (hostname, opciones, callback) => {
  lookup(hostname, { all: true, family: opciones.family ?? 0 }, (error, direcciones) => {
    if (error) return callback(error, '', 4)
    const publicas = direcciones.filter((d) => !ipPrivada(d.address))
    if (publicas.length === 0 || publicas.length !== direcciones.length) {
      const e = Object.assign(new Error('Ese destino no es público.'), { code: 'EDESTINO' })
      return callback(e, '', 4)
    }
    if (opciones.all) {
      return (callback as unknown as (e: null, d: { address: string; family: number }[]) => void)(null, publicas)
    }
    const primera = publicas[0]!
    callback(null, primera.address, primera.family)
  })
}

export type Respuesta = {
  status: number
  url: string
  tipo: string
  cuerpo: Buffer
  /** Se dejó de leer por el tope de bytes o por `cortarEn`. */
  cortado: boolean
}

export type Opciones = {
  /** Tope de bytes a leer (ya descomprimidos). */
  maxBytes: number
  /** Tiempo total, en ms. */
  tiempo?: number
  /** `Accept` de la petición. */
  acepta?: string
  /** Deja de leer cuando aparece este texto (p. ej. `</head>`). */
  cortarEn?: string
}

const AGENTE = 'VADAI-Academia/1.0 (+https://academia.vadai.com.mx)'

/**
 * Pide una URL con todas las reglas de arriba. Nunca lanza: si algo sale mal
 * regresa `{ error }` con el motivo en español.
 */
export async function pedirSeguro(url: string, o: Opciones): Promise<Respuesta | { error: string }> {
  const fin = Date.now() + (o.tiempo ?? 5000)
  let actual = url
  for (let salto = 0; salto <= 3; salto += 1) {
    const forma = formaSegura(actual)
    if (forma) return { error: forma }
    const r = await unaPeticion(actual, o, fin)
    if ('error' in r) return r
    if (r.status >= 300 && r.status < 400 && r.ubicacion) {
      try {
        actual = new URL(r.ubicacion, actual).toString()
      } catch {
        return { error: 'La página redirige a una dirección inválida.' }
      }
      continue
    }
    return { status: r.status, url: actual, tipo: r.tipo, cuerpo: r.cuerpo, cortado: r.cortado }
  }
  return { error: 'Demasiadas redirecciones.' }
}

function unaPeticion(
  url: string,
  o: Opciones,
  fin: number
): Promise<{ status: number; ubicacion: string | null; tipo: string; cuerpo: Buffer; cortado: boolean } | { error: string }> {
  return new Promise((resolver) => {
    const u = new URL(url)
    const prueba = u.hostname.endsWith(DOMINIO_DE_PRUEBA) ? sitioDePrueba() : null
    const restante = fin - Date.now()
    if (restante <= 0) return resolver({ error: 'Se agotó el tiempo.' })

    const encabezados = {
      'user-agent': AGENTE,
      accept: o.acepta ?? '*/*',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'es-MX,es;q=0.9,en;q=0.8',
      ...(prueba ? { 'x-host-de-prueba': u.hostname } : {}),
    }
    const pedir = prueba
      ? http.request({
          host: prueba.hostname,
          port: prueba.port,
          path: `/${u.hostname.replace(DOMINIO_DE_PRUEBA, '')}${u.pathname}${u.search}`,
          method: 'GET',
          headers: encabezados,
        })
      : https.request({
          host: u.hostname,
          servername: u.hostname,
          port: 443,
          path: `${u.pathname}${u.search}`,
          method: 'GET',
          headers: encabezados,
          lookup: lookupPublico,
        })

    let terminado = false
    const acabar = (valor: Parameters<typeof resolver>[0]) => {
      if (terminado) return
      terminado = true
      clearTimeout(reloj)
      resolver(valor)
    }
    const reloj = setTimeout(() => {
      pedir.destroy()
      acabar({ error: 'Se agotó el tiempo.' })
    }, restante)

    pedir.on('error', (e: NodeJS.ErrnoException) =>
      acabar({ error: e.code === 'EDESTINO' ? 'Ese destino no es público.' : 'No se pudo abrir la página.' })
    )
    pedir.on('response', (res) => {
      const status = res.statusCode ?? 0
      const ubicacion = typeof res.headers.location === 'string' ? res.headers.location : null
      const tipo = String(res.headers['content-type'] ?? '').toLowerCase()
      if (status >= 300 && status < 400) {
        res.resume()
        return acabar({ status, ubicacion, tipo, cuerpo: Buffer.alloc(0), cortado: false })
      }
      const codificacion = String(res.headers['content-encoding'] ?? '').toLowerCase()
      const flujo =
        codificacion === 'gzip'
          ? res.pipe(zlib.createGunzip())
          : codificacion === 'deflate'
            ? res.pipe(zlib.createInflate())
            : codificacion === 'br'
              ? res.pipe(zlib.createBrotliDecompress())
              : res
      const partes: Buffer[] = []
      let bytes = 0
      const cerrar = (cortado: boolean) => {
        res.destroy()
        acabar({ status, ubicacion, tipo, cuerpo: Buffer.concat(partes), cortado })
      }
      flujo.on('data', (pedazo: Buffer) => {
        partes.push(pedazo)
        bytes += pedazo.length
        if (bytes >= o.maxBytes) return cerrar(true)
        if (o.cortarEn && pedazo.toString('latin1').toLowerCase().includes(o.cortarEn)) return cerrar(true)
      })
      flujo.on('end', () => acabar({ status, ubicacion, tipo, cuerpo: Buffer.concat(partes), cortado: false }))
      flujo.on('error', () => acabar({ error: 'La página llegó dañada.' }))
    })
    pedir.end()
  })
}
