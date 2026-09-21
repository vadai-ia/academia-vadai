#!/usr/bin/env node
/**
 * test-comunidad.mjs — Criterio de cierre de M7.
 *
 * El criterio del master document es literal: "Post fijado visible, comentario
 * oculto por admin desaparece para alumno". Ambas mitades se ejercen aquí, y la
 * segunda es la importante: se comprueba que el comentario oculto no aparezca en
 * el HTML del alumno, no que la UI decida no pintarlo.
 *
 *   PORT=3117 pnpm start
 *   node scripts/test-comunidad.mjs
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const SUPABASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')
const APP = (process.env.APP_URL ?? 'http://localhost:3117').replace(/\/+$/, '')

const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))
const RUTA_LECCION = `/curso/${CURSO_QA.slug}/${IDS.leccionVideo}`
const RUTA_COMUNIDAD = `/curso/${CURSO_QA.slug}/comunidad`

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

function leerFormulario(html, contiene, indice = 0) {
  let vistos = 0
  for (const bloque of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (!bloque[1].includes(contiene)) continue
    if (vistos++ < indice) continue
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

async function enviar(ruta, formulario, frasco, extra = {}) {
  const cuerpo = new FormData()
  for (const [n, v] of Object.entries(formulario.campos)) cuerpo.append(n, v)
  for (const [n, v] of Object.entries(extra)) cuerpo.set(n, v)
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
  console.log('  PRUEBA DE COMUNIDAD Y BLOG — M7')
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
      ? `  M7 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`
      : `  ${fallidas.length} de ${resultados.length} aserciones FALLARON.`
  )
  for (const f of fallidas) {
    console.log(`    ${f.grupo} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
  }
  console.log('')
  return fallidas.length === 0
}

// --- main ------------------------------------------------------------------

const MARCA_COMENTARIO = 'QA comentario de prueba unico'
const MARCA_POST = 'QA publicacion de prueba'
const MARCA_ANUNCIO = 'QA anuncio de prueba'
const MARCA_BLOG = 'QA entrada de blog'

/**
 * Borra lo que ESTA suite crea, por título exacto.
 *
 * Antes borraba con `like 'QA %'`, y ese patrón también casaba el anuncio que
 * siembra `seed.mjs` ("QA · Anuncio del curso"). Resultado: correr esta suite
 * dejaba a test-rls sin el anuncio que afirma, y la falla aparecía en OTRA
 * suite — de las más difíciles de rastrear.
 *
 * Una prueba solo debe llevarse lo suyo.
 */
async function purgar(bd) {
  const titulos = [MARCA_POST, MARCA_ANUNCIO, MARCA_BLOG, 'QA borrador sin publicar',
    'QA anuncio de otro curso']

  await bd.query(`delete from academia.lesson_comments where content = $1`, [MARCA_COMENTARIO])
  await bd.query(`delete from academia.community_posts where title = any($1::text[])`, [titulos])
  await bd.query(`delete from academia.posts where title = any($1::text[])`, [titulos])
}

async function main() {
  const bd = await conectarPostgres(vars)

  try {
    await purgar(bd)

    const alumno = await iniciarSesion(correo.alumnoVigente)
    const admin = await iniciarSesion(correo.admin)

    // ================================================================
    const G1 = 'COMENTARIOS POR LECCIÓN'

    const pagina = await texto(RUTA_LECCION, alumno)
    afirmar(G1, 'la sección existe', true, pagina.includes('Comentarios'))

    const formulario = leerFormulario(pagina, 'name="contenido"')
    afirmar(G1, 'hay formulario de comentario', true, Boolean(formulario))

    if (formulario) {
      await enviar(RUTA_LECCION, formulario, alumno, { contenido: MARCA_COMENTARIO })

      const conComentario = await texto(RUTA_LECCION, alumno)
      afirmar(G1, 'el alumno ve su comentario', true, conComentario.includes(MARCA_COMENTARIO))
      afirmar(G1, 'con su nombre', true, conComentario.includes('QA Alumno Vigente'))

      const paraAdmin = await texto(RUTA_LECCION, admin)
      afirmar(G1, 'el admin también lo ve', true, paraAdmin.includes(MARCA_COMENTARIO))
      afirmar(G1, 'y tiene botón de ocultar', true, paraAdmin.includes('Ocultar'))

      // ============================================================
      // El criterio literal: ocultar hace que desaparezca para el alumno.
      const G2 = 'MODERACIÓN'

      const moderar = leerFormulario(paraAdmin, 'name="ocultar"')
      afirmar(G2, 'hay formulario de moderación', true, Boolean(moderar))

      if (moderar) {
        await enviar(RUTA_LECCION, moderar, admin)

        const { rows } = await bd.query(
          `select status from academia.lesson_comments where content = $1`,
          [MARCA_COMENTARIO]
        )
        afirmar(G2, 'queda oculto en la base', 'hidden', rows[0]?.status)

        const trasOcultar = await texto(RUTA_LECCION, alumno)
        afirmar(G2, 'DESAPARECE para el alumno', false, trasOcultar.includes(MARCA_COMENTARIO))

        // No se borró: la moderación es reversible.
        afirmar(G2, 'pero sigue existiendo', 1, rows.length)
      }
    }

    // ================================================================
    const G3 = 'COMUNIDAD'

    afirmar(G3, 'la comunidad abre', 200, (await pedir(RUTA_COMUNIDAD, alumno)).status)

    const feed = await texto(RUTA_COMUNIDAD, alumno)
    const formPost = leerFormulario(feed, 'name="titulo"')
    afirmar(G3, 'hay formulario de publicación', true, Boolean(formPost))

    if (formPost) {
      await enviar(RUTA_COMUNIDAD, formPost, alumno, {
        titulo: MARCA_POST,
        cuerpo: 'Primer párrafo.\n\nSegundo párrafo.',
      })

      const { rows } = await bd.query(
        `select id, pinned, content_rich from academia.community_posts where title = $1`,
        [MARCA_POST]
      )
      afirmar(G3, 'se creó la publicación', 1, rows.length)
      afirmar(G3, 'sin fijar (eso es del admin)', false, rows[0]?.pinned)
      afirmar(G3, 'el texto quedó como documento', 'doc', rows[0]?.content_rich?.type)
      afirmar(G3, 'con sus dos párrafos', 2, rows[0]?.content_rich?.content?.length)

      const conPost = await texto(RUTA_COMUNIDAD, alumno)
      afirmar(G3, 'aparece en el feed', true, conPost.includes(MARCA_POST))
      afirmar(G3, 'y su contenido renderizado', true, conPost.includes('Segundo párrafo'))

      // ============================================================
      const G4 = 'FIJAR (la otra mitad del criterio)'

      const feedAdmin = await texto(RUTA_COMUNIDAD, admin)
      const fijar = leerFormulario(feedAdmin, 'name="fijar"')
      afirmar(G4, 'el admin tiene botón de fijar', true, Boolean(fijar))

      if (fijar) {
        await enviar(RUTA_COMUNIDAD, fijar, admin)

        const { rows: fijado } = await bd.query(
          `select pinned from academia.community_posts where title = $1`,
          [MARCA_POST]
        )
        afirmar(G4, 'queda fijado en la base', true, fijado[0]?.pinned)

        const conFijado = await texto(RUTA_COMUNIDAD, alumno)
        afirmar(G4, 'el alumno lo ve marcado como Fijado', true, conFijado.includes('Fijado'))
      }
    }

    // ================================================================
    const G5 = 'BLOG Y ANUNCIOS'

    const { rows: perfilAdmin } = await bd.query(
      `select user_id from academia.profiles where email = $1`,
      [correo.admin]
    )

    // Un anuncio publicado, una entrada de blog publicada y un borrador.
    await bd.query(
      `insert into academia.posts (author_id, post_type, title, content_rich, published_at)
       values ($1, 'announcement', $2, '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Aviso importante."}]}]}'::jsonb, now() - interval '1 hour'),
              ($1, 'blog', $3, '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Contenido del blog."}]}]}'::jsonb, now() - interval '1 hour'),
              ($1, 'blog', 'QA borrador sin publicar', null, null)`,
      [perfilAdmin[0].user_id, MARCA_ANUNCIO, MARCA_BLOG]
    )

    const misCursos = await texto('/mis-cursos', alumno)
    afirmar(G5, 'el anuncio se destaca en mis-cursos', true, misCursos.includes(MARCA_ANUNCIO))
    afirmar(G5, 'con su contenido', true, misCursos.includes('Aviso importante'))

    const blog = await texto('/blog', alumno)
    // Se miran los TÍTULOS de las entradas (los <h2> de la lista), no la
    // página entera: desde el 20-sep la campana del encabezado lista también
    // los anuncios, y eso es correcto. Lo que no puede pasar es que el
    // anuncio salga ENTRE las entradas del blog.
    const titulosDelBlog = [...blog.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1])
    afirmar(G5, 'la entrada aparece en /blog', true,
      titulosDelBlog.some((t) => t.includes(MARCA_BLOG)))
    afirmar(G5, 'el borrador NO aparece', false, blog.includes('QA borrador sin publicar'))
    afirmar(G5, 'el anuncio no se cuela al blog', false,
      titulosDelBlog.some((t) => t.includes(MARCA_ANUNCIO)))

    // Notificaciones internas (20-sep-2026): lo publicado después de la última
    // vez que abrió la campana cuenta como nuevo, y la campana lo dice.
    await bd.query(
      `update academia.profiles set notifications_seen_at = now() - interval '2 hours' where email = $1`,
      [correo.alumnoVigente]
    )
    const conNuevas = await texto('/blog', alumno)
    const nuevas = Number(conNuevas.match(/data-nuevas="(\d+)"/)?.[1] ?? -1)
    afirmar(G5, 'la campana cuenta lo publicado desde la última vez', true, nuevas >= 2)
    afirmar(G5, 'y lista la entrada como nueva', true,
      conNuevas.includes(MARCA_BLOG) && conNuevas.includes('Nuevo'))

    const formVistas = leerFormulario(conNuevas, 'Marcar como vistas')
    afirmar(G5, 'hay botón para marcarlas vistas sin JS', true, Boolean(formVistas))
    if (formVistas) {
      await enviar('/blog', formVistas, alumno)
      const trasVer = await texto('/blog', alumno)
      afirmar(G5, 'tras verlas, la campana queda en cero', '0',
        trasVer.match(/data-nuevas="(\d+)"/)?.[1] ?? null)
    }

    // ================================================================
    const G6 = 'AUDIENCIA'

    // Un anuncio dirigido al curso ajeno no debe verlo quien no está inscrito.
    await bd.query(
      `insert into academia.posts (author_id, post_type, title, audience_course_id, published_at)
       values ($1, 'announcement', 'QA anuncio de otro curso', $2, now())`,
      [perfilAdmin[0].user_id, IDS.cursoAjeno]
    )

    const misCursos2 = await texto('/mis-cursos', alumno)
    afirmar(G6, 'no ve anuncios de cursos ajenos', false,
      misCursos2.includes('QA anuncio de otro curso'))

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
