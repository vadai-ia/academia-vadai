#!/usr/bin/env node
/**
 * agente-conocimiento.mjs — Carga lo que sabe el agente de la comunidad (M21)
 * en `academia.agent_knowledge`.
 *
 *   node scripts/agente-conocimiento.mjs --seco      # qué cargaría, sin escribir
 *   node scripts/agente-conocimiento.mjs             # carga (o actualiza) todo
 *   node scripts/agente-conocimiento.mjs --solo=repo,plataforma
 *   node scripts/agente-conocimiento.mjs --podar     # además borra lo que ya no existe
 *
 * Cuatro fuentes:
 *
 *   repo        Material del curso en `contenido/`, SOLO lo de la lista REPO:
 *               manual de Claude, glosario, guiones y láminas, prompts,
 *               plantillas, onboarding. Nunca evaluaciones ni quizzes (serían las
 *               respuestas), correos comerciales, encuestas, investigación,
 *               bitácoras ni READMEs (notas internas que nombran empresas).
 *   plataforma  La descripción de cada lección publicada, de módulos que no son
 *               exclusivos (0038), de cursos que no son QA.
 *   fireflies   Las clases grabadas de la lista FIREFLIES, por su API
 *               (`FIREFLIES_API_KEY` en .env.local). Del transcript solo entra lo
 *               que dicen los ponentes (el equipo): lo que dijo un participante de
 *               su empresa no se le enseña a otro. Más el resumen de la clase.
 *   bunny       Subtítulos de los videos de las lecciones, si la biblioteca los
 *               tiene (al 19-oct-2026 ninguno: generarlos en Bunny tiene costo).
 *
 * Idempotente: cada documento tiene su clave (la ruta, el id de la lección, de
 * la reunión o del video) y se actualiza en su lugar. Lo que un admin apagó en
 * Ajustes → Agente se queda apagado. Las notas del equipo nunca se tocan.
 *
 * Correos y teléfonos se quitan de todo antes de guardarlo.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { cargarEnv, conectarPostgres, exigir, linea, RAIZ, titulo } from './lib/entorno.mjs'

const CURSO = 'claude-en-tu-empresa'
const CONTENIDO = join(RAIZ, 'contenido', 'claude-en-tu-empresa')

/** [patrón sobre la ruta relativa a CONTENIDO, curso (slug) o null = todos los cursos] */
const REPO = [
  [/^sesiones\/00-antes-del-curso\/onboarding\/[^/]+\.md$/, null],
  [/^glosario\/terminos\/[^/]+\.md$/, null],
  [/^glosario\/capitulos\/00-como-se-usa\.md$/, null],
  [/^sesiones\/02-plataforma\/manual\/capitulos\/[^/]+\.md$/, null],
  [/^mapa-curso\.md$/, CURSO],
  [/^referencia\/planes-claude\.md$/, CURSO],
  [/^plataforma\/empresa-demo\.md$/, CURSO],
  [/^plataforma\/plantillas\/[^/]+\.md$/, CURSO],
  [/^plataforma\/modulo-\d+\/(guion|workbook|laminas)\.md$/, CURSO],
  [/^sesiones\/0[1-7]-[^/]+\/laminas\.md$/, CURSO],
  [/^sesiones\/02-plataforma\/prompts\/[^/]+\.md$/, CURSO],
  [/^sesiones\/03-conectar-y-crear\/(habilidades-por-area\.md|prompts-por-area\/.+\.md)$/, CURSO],
  [/^sesiones\/04-crear-y-decidir\/(prompts-en-vivo|hoja-de-equipo|dinamica-matriz)\.md$/, CURSO],
  [/^sesiones\/05-pacto-y-skills\/(manual-de-skills\/manual|hoja-de-taller|tarjeta-pacto)\.md$/, CURSO],
  [/^sesiones\/05-pacto-y-skills\/prompts\/.+\.md$/, CURSO],
  [/^sesiones\/06-seguridad-para-directivos\/(manual-de-seguridad\/capitulos\/[^/]+|prompt-del-manual)\.md$/, CURSO],
  [/^sesiones\/07-del-plan-al-proceso\/(manual-del-proceso\/capitulos\/[^/]+|hoja-del-proyecto|diagnostico)\.md$/, CURSO],
]
/** Aunque caiga en un patrón de arriba, esto nunca entra. */
const NUNCA = /(evaluacion|quiz|correo|encuesta|investigacion|bitacora|readme|entregables|fuentes|construir)/i

/**
 * Las clases de Fireflies que el agente puede leer. Solo clases del curso (la
 * sala de Zoom del curso), nunca juntas internas: la reunión «Aranza - CLAUDE
 * EN TU EMPRESA» del 24-sep, por ejemplo, NO está, aunque su título se parezca.
 * Al 19-oct Fireflies solo tiene las sesiones 1 a 3.
 */
const FIREFLIES = {
  curso: CURSO,
  /**
   * Solo las frases de estos ponentes, por su nombre EXACTO en el transcript
   * (sin acentos ni mayúsculas). Exacto a propósito: «Roberto Jiménez» es un
   * participante, no Roberto Martínez de Total Coach.
   */
  ponentes: ['alejandro', 'alejandro martinez', 'alejandro martinez licon', 'roberto martinez'],
  reuniones: [
    { id: '01M32HE9FHR2YKKBRG1TZHK061', titulo: 'Clase en vivo · Sesión 1, alineación' },
    { id: '01M32HEZRJ4RTJXJC1P1MR5AHS', titulo: 'Clase en vivo · Sesión 2, la plataforma de Claude' },
    { id: '01M336K4WGMSVWSW6AS82SVFEG', titulo: 'Clase en vivo · Sesión 3, conectar y crear' },
  ],
}

const LIMITE = 400_000

// --------------------------------------------------------------------------

const args = process.argv.slice(2)
const SECO = args.includes('--seco')
const PODAR = args.includes('--podar')
const solo = (args.find((a) => a.startsWith('--solo=')) ?? '').slice(7).split(',').filter(Boolean)
const toca = (f) => solo.length === 0 || solo.includes(f)

function anonimizar(t) {
  return t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]').replace(/(\+?\d[\d\s().-]{8,}\d)/g, '[teléfono]')
}

function limpiar(t) {
  return anonimizar(t.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')).trim()
}

function caminar(dir) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...caminar(ruta))
    else salida.push(ruta)
  }
  return salida
}

const TIPO_DE_ARCHIVO = { guion: 'guion', laminas: 'láminas', workbook: 'workbook' }

function tituloDe(rel, texto) {
  const frente = texto.startsWith('---') ? texto.slice(0, texto.indexOf('\n---', 3) + 1) : ''
  const deFrente = frente.match(/^titulo:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, '').trim()
  const h1 = texto.match(/^#\s+(.+)$/m)?.[1]?.replace(/[*_`]/g, '').trim()
  const archivo = rel.split('/').pop().replace(/\.md$/, '')
  const tipo = rel.startsWith('plataforma/modulo-') || /^sesiones\/0\d-[^/]+\/laminas\.md$/.test(rel) ? TIPO_DE_ARCHIVO[archivo] : null
  const nombre = deFrente || h1 || archivo.replace(/[-_]/g, ' ')
  const base = tipo && !nombre.toLowerCase().includes(archivo) ? `${nombre} (${tipo})` : nombre
  const grupo = rel.startsWith('glosario/')
    ? 'Glosario'
    : rel.includes('/manual/capitulos/')
      ? 'Manual de Claude'
      : rel.includes('manual-de-seguridad')
        ? 'Manual de seguridad'
        : rel.includes('manual-del-proceso')
          ? 'Manual del proceso'
          : rel.match(/^sesiones\/0(\d)-/)
            ? `Sesión ${rel.match(/^sesiones\/0(\d)-/)[1]}`
            : rel.match(/^plataforma\/modulo-(\d+)/)
              ? `Módulo ${rel.match(/^plataforma\/modulo-(\d+)/)[1]}`
              : 'Curso'
  return (base.toLowerCase().startsWith(grupo.toLowerCase()) ? base : `${grupo} · ${base}`).slice(0, 200)
}

/** Texto plano de un documento de Tiptap (como lib/comunidad/documento.ts). */
function textoDeTiptap(doc) {
  const partes = []
  const recorrer = (n) => {
    if (!n || typeof n !== 'object') return
    if (n.type === 'text' && typeof n.text === 'string') partes.push(n.text)
    if (Array.isArray(n.content)) n.content.forEach(recorrer)
    if (['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(n.type)) partes.push('\n')
  }
  recorrer(doc)
  return partes.join('').replace(/\n{3,}/g, '\n\n').trim()
}

const normal = (t) =>
  (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

function esPonente(nombre) {
  return FIREFLIES.ponentes.includes(normal(nombre))
}

/** Palabras que salen en nombres o razones sociales pero no identifican a nadie. */
const NO_SON_NOMBRES = new Set(
  ('alejandro roberto martinez licon dir ing rrhh speaker galaxy ultra ceo lic del las los grupo servicios comercial ' +
    'comercializadora industrial industrias mexico mexicana constructora construcciones sistemas soluciones corporativo ' +
    'internacional empresa empresas general direccion ventas finanzas operaciones claude vadai total coach academia')
    .split(' ')
)

function palabrasDeNombres(nombres) {
  const palabras = new Set()
  for (const n of nombres) {
    for (const w of normal(n).split(/[^a-z0-9ñ]+/)) if (w.length >= 3 && !/\d/.test(w) && !NO_SON_NOMBRES.has(w)) palabras.add(w)
  }
  return palabras
}

/** Cambia por [participante] cada palabra de un nombre, solo si va con mayúscula (es un nombre, no una palabra común). */
function sinNombres(texto, palabras) {
  if (palabras.size === 0) return texto
  return texto
    .replace(/[\p{L}\p{N}]+/gu, (w) => (/^\p{Lu}/u.test(w) && palabras.has(normal(w)) ? '[participante]' : w))
    .replace(/(\[participante\]\s*){2,}/g, '[participante] ')
}

function deVtt(vtt) {
  return vtt
    .split(/\r?\n/)
    .filter((l) => l && !/^WEBVTT/.test(l) && !/-->/.test(l) && !/^\d+$/.test(l.trim()) && !/^NOTE/.test(l))
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// --------------------------------------------------------------------------

titulo(`CONOCIMIENTO DEL AGENTE${SECO ? ' — en seco, no escribe' : ''}`)
const vars = cargarEnv()
const bd = await conectarPostgres(vars)
const docs = [] // { fuente, clave, titulo, course_id, contenido }

try {
  const { rows: cursos } = await bd.query(`select id, slug from academia.courses`)
  const idDe = new Map(cursos.map((c) => [c.slug, c.id]))
  const cursoId = (slug) => (slug === null ? null : (idDe.get(slug) ?? undefined))

  // --- repo -----------------------------------------------------------------
  if (toca('repo')) {
    let n = 0
    for (const ruta of caminar(CONTENIDO)) {
      const rel = relative(CONTENIDO, ruta).split('\\').join('/')
      const regla = REPO.find(([p]) => p.test(rel))
      if (!regla || NUNCA.test(rel)) continue
      const id = cursoId(regla[1])
      if (id === undefined) {
        linea('aviso', `no existe el curso ${regla[1]}`, rel)
        continue
      }
      const texto = limpiar(readFileSync(ruta, 'utf8'))
      if (texto.length < 80) continue
      docs.push({ fuente: 'repo', clave: rel, titulo: tituloDe(rel, texto), course_id: id, contenido: texto.slice(0, LIMITE) })
      n++
    }
    linea('ok', `repo: ${n} documentos`)
  }

  // --- plataforma: la descripción de las lecciones publicadas ---------------
  if (toca('plataforma')) {
    const { rows } = await bd.query(`
      select l.id, l.title, l.description_rich, m.course_id
        from academia.lessons l
        join academia.modules m on m.id = l.module_id
        join academia.courses c on c.id = m.course_id
       where l.status = 'published' and not m.is_restricted
         and c.status <> 'archived' and c.slug not like 'qa-%'
         and l.description_rich is not null`)
    let n = 0
    for (const l of rows) {
      const texto = limpiar(textoDeTiptap(l.description_rich))
      if (texto.length < 120) continue
      docs.push({ fuente: 'plataforma', clave: l.id, titulo: `Lección «${l.title}»`.slice(0, 200), course_id: l.course_id, contenido: texto.slice(0, LIMITE) })
      n++
    }
    linea('ok', `plataforma: ${n} lecciones con descripción`)
  }

  // --- fireflies --------------------------------------------------------------
  if (toca('fireflies')) {
    const llave = vars.FIREFLIES_API_KEY
    const id = cursoId(FIREFLIES.curso)
    if (!llave) linea('aviso', 'fireflies: falta FIREFLIES_API_KEY en .env.local, se salta')
    else if (id === undefined) linea('aviso', `fireflies: no existe el curso ${FIREFLIES.curso}`)
    else {
      // Los nombres a quitar: quien habló en CUALQUIER clase (alguien que solo
      // habló en la sesión 1 aparece nombrado en la 3) y los alumnos del curso
      // con sus empresas, de la base.
      const { rows: inscritos } = await bd.query(
        `select p.full_name, co.name as empresa
           from academia.enrollments e
           join academia.profiles p on p.user_id = e.user_id
           left join academia.companies co on co.id = p.company_id
          where e.course_id = $1 and p.role = 'alumno'`,
        [id]
      )
      const nombres = new Set(inscritos.flatMap((i) => [i.full_name, i.empresa]).filter(Boolean))
      const clases = []
      for (const r of FIREFLIES.reuniones) {
        const res = await fetch('https://api.fireflies.ai/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${llave}` },
          body: JSON.stringify({
            query: 'query T($id: String!) { transcript(id: $id) { id title sentences { speaker_name text } summary { overview keywords } } }',
            variables: { id: r.id },
          }),
        })
        const cuerpo = await res.json().catch(() => null)
        const t = cuerpo?.data?.transcript
        if (!res.ok || !t) {
          linea('falla', `fireflies: ${r.titulo}`, cuerpo?.errors?.[0]?.message ?? `HTTP ${res.status}`)
          continue
        }
        const porPonente = new Map()
        const frases = []
        for (const s of t.sentences ?? []) {
          porPonente.set(s.speaker_name ?? '¿?', (porPonente.get(s.speaker_name ?? '¿?') ?? 0) + 1)
          if (esPonente(s.speaker_name)) frases.push(s.text)
        }
        const resumen = t.summary?.overview ? `Resumen de la clase:\n${t.summary.overview}\n\n` : ''
        // El equipo nombra a los participantes («gracias, Blanca») y a sus empresas:
        // esos nombres, sacados de la lista de quién habló, se cambian por [participante].
        for (const n of porPonente.keys()) if (!esPonente(n)) nombres.add(n)
        clases.push({ r, texto: limpiar(`${resumen}Lo que explicó el equipo en la clase:\n${frases.join(' ')}`) })
        const ponentes = [...porPonente.entries()].map(([p, k]) => `${p} ${k}`).join(', ')
        linea(frases.length ? 'ok' : 'aviso', `fireflies: ${r.titulo}`, `${frases.length} frases del equipo · ${ponentes}`)
      }
      const quitar = palabrasDeNombres([...nombres])
      for (const { r, texto } of clases) {
        docs.push({ fuente: 'fireflies', clave: r.id, titulo: r.titulo, course_id: id, contenido: sinNombres(texto, quitar).slice(0, LIMITE) })
      }
      linea('ok', `fireflies: se quitan ${quitar.size} palabras de nombres de participantes y empresas`)
    }
  }

  // --- bunny: subtítulos ------------------------------------------------------
  if (toca('bunny')) {
    const lib = vars.BUNNY_STREAM_LIBRARY_ID
    const llave = vars.BUNNY_STREAM_API_KEY
    const cdn = vars.BUNNY_STREAM_CDN_HOSTNAME
    if (!lib || !llave || !cdn) linea('aviso', 'bunny: faltan las variables de Bunny, se salta')
    else {
      const { rows } = await bd.query(`
        select l.id, l.title, l.bunny_video_id, m.course_id
          from academia.lessons l
          join academia.modules m on m.id = l.module_id
          join academia.courses c on c.id = m.course_id
         where l.status = 'published' and not m.is_restricted and l.bunny_video_id is not null
           and c.status <> 'archived' and c.slug not like 'qa-%'`)
      let con = 0
      for (const l of rows) {
        const res = await fetch(`https://video.bunnycdn.com/library/${lib}/videos/${l.bunny_video_id}`, { headers: { AccessKey: llave, accept: 'application/json' } })
        if (!res.ok) continue
        const video = await res.json()
        const subtitulo = (video.captions ?? []).find((c) => /^es/i.test(c.srclang)) ?? (video.captions ?? [])[0]
        if (!subtitulo) continue
        const vtt = await fetch(`https://${cdn}/${l.bunny_video_id}/captions/${subtitulo.srclang}.vtt`)
        if (!vtt.ok) {
          linea('aviso', `bunny: ${l.title}`, `tiene subtítulos pero el CDN respondió ${vtt.status}`)
          continue
        }
        const texto = limpiar(deVtt(await vtt.text()))
        if (texto.length < 200) continue
        docs.push({ fuente: 'bunny', clave: l.bunny_video_id, titulo: `Video · ${l.title}`.slice(0, 200), course_id: l.course_id, contenido: texto.slice(0, LIMITE) })
        con++
      }
      linea(con ? 'ok' : 'aviso', `bunny: ${con} de ${rows.length} videos con subtítulos`)
    }
  }

  const total = docs.reduce((s, d) => s + d.contenido.length, 0)
  linea('ok', `${docs.length} documentos, ${total.toLocaleString('es-MX')} letras (~${Math.round(total / 2.5 / 1000)} mil tokens en total; el agente usa ~25 mil por pregunta)`)

  if (SECO) {
    for (const d of docs) console.log(`    ${d.fuente.padEnd(10)} ${String(d.contenido.length).padStart(7)}  ${d.titulo}`)
    process.exit(0)
  }

  // --- escribir ---------------------------------------------------------------
  await bd.query('begin')
  for (const d of docs) {
    await bd.query(
      `insert into academia.agent_knowledge (fuente, clave, titulo, course_id, contenido)
       values ($1, $2, $3, $4, $5)
       on conflict (fuente, clave) do update
         set titulo = excluded.titulo, course_id = excluded.course_id, contenido = excluded.contenido, updated_at = now()
       where academia.agent_knowledge.contenido is distinct from excluded.contenido
          or academia.agent_knowledge.titulo is distinct from excluded.titulo
          or academia.agent_knowledge.course_id is distinct from excluded.course_id`,
      [d.fuente, d.clave, d.titulo, d.course_id, d.contenido]
    )
  }
  const fuentes = [...new Set(docs.map((d) => d.fuente))]
  for (const f of fuentes) {
    const vistas = docs.filter((d) => d.fuente === f).map((d) => d.clave)
    const { rows: viejas } = await bd.query(`select id, titulo from academia.agent_knowledge where fuente = $1 and not (clave = any($2))`, [f, vistas])
    if (viejas.length === 0) continue
    if (PODAR) {
      await bd.query(`delete from academia.agent_knowledge where id = any($1)`, [viejas.map((v) => v.id)])
      linea('ok', `${f}: se borraron ${viejas.length} que ya no existen`)
    } else {
      linea('aviso', `${f}: ${viejas.length} ya no existen en la fuente (--podar para borrarlos)`, viejas.slice(0, 3).map((v) => v.titulo).join(' · '))
    }
  }
  await bd.query('commit')
  linea('ok', 'guardado en academia.agent_knowledge')
} catch (e) {
  await bd.query('rollback').catch(() => {})
  linea('falla', 'no se guardó nada', e.message)
  process.exitCode = 1
} finally {
  await bd.end()
}
