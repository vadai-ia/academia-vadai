#!/usr/bin/env node
/**
 * seed.mjs — Datos de prueba de M1.
 *
 * Idempotente por diseño: se puede correr las veces que haga falta. Los usuarios
 * se resuelven POR CORREO (si ya existen se vinculan, si no se crean) y el resto
 * usa UUID fijos con `on conflict do update`.
 *
 * Los usuarios se crean con la Admin API de Auth, que es uso normal de la
 * plataforma: no altera objetos de `auth`, solo inserta filas. El resto va por
 * conexión directa a Postgres.
 *
 *   node scripts/seed.mjs
 */

import {
  cargarEnv,
  conectarPostgres,
  exigir,
  linea,
  titulo,
} from './lib/entorno.mjs'
import { CLAVE_QA, CURSO_AJENO_QA, CURSO_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const URL_BASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')

const cabeceras = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  'Content-Type': 'application/json',
}

// --- usuarios de auth ------------------------------------------------------

async function buscarPorCorreo(email) {
  const url = `${URL_BASE}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=200`
  const res = await fetch(url, { headers: cabeceras })
  if (!res.ok) return null
  const cuerpo = await res.json()
  const lista = Array.isArray(cuerpo?.users) ? cuerpo.users : []
  return lista.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function crearUsuario(usuario) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({
      email: usuario.email,
      password: CLAVE_QA,
      email_confirm: true,
      user_metadata: { full_name: usuario.nombre, qa: true },
    }),
  })
  const cuerpo = await res.json()
  if (!res.ok) {
    throw new Error(`No se pudo crear ${usuario.email}: ${cuerpo.msg ?? cuerpo.message ?? res.status}`)
  }
  return cuerpo
}

/** Deja la contraseña conocida aunque el usuario ya existiera. */
async function fijarClave(id) {
  await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: cabeceras,
    body: JSON.stringify({ password: CLAVE_QA, email_confirm: true }),
  })
}

async function asegurarUsuarios() {
  const resueltos = {}

  for (const usuario of USUARIOS_QA) {
    const existente = await buscarPorCorreo(usuario.email)

    if (existente) {
      await fijarClave(existente.id)
      resueltos[usuario.llave] = { ...usuario, id: existente.id }
      linea('ok', usuario.email.padEnd(42), 'ya existía, contraseña QA restablecida')
    } else {
      const creado = await crearUsuario(usuario)
      resueltos[usuario.llave] = { ...usuario, id: creado.id }
      linea('ok', usuario.email.padEnd(42), 'creado')
    }
  }

  return resueltos
}

// --- datos del schema academia ---------------------------------------------

async function sembrarDatos(cliente, usuarios) {
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const enUnaSemana = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  await cliente.query('begin')

  try {
    // Perfiles. `sinPerfil` se omite a propósito.
    for (const usuario of USUARIOS_QA.filter((u) => u.conPerfil)) {
      const resuelto = usuarios[usuario.llave]
      await cliente.query(
        `insert into academia.profiles (user_id, email, full_name, role)
         values ($1, $2, $3, $4)
         on conflict (user_id) do update
           set email = excluded.email,
               full_name = excluded.full_name,
               role = excluded.role`,
        [resuelto.id, usuario.email, usuario.nombre, usuario.role]
      )
    }

    // Cursos
    for (const curso of [CURSO_QA, CURSO_AJENO_QA]) {
      await cliente.query(
        `insert into academia.courses
           (id, slug, title, description, status, course_type, access_days, price_mxn, price_usd)
         values ($1, $2, $3, $4, 'published', 'cohort', null, 14999.00, 899.00)
         on conflict (id) do update
           set slug = excluded.slug, title = excluded.title, status = excluded.status`,
        [curso.id, curso.slug, curso.title, curso.description]
      )
    }

    // Módulos
    await cliente.query(
      `insert into academia.modules (id, course_id, title, position) values
         ($1, $2, 'Módulo 1 · Fundamentos', 1),
         ($3, $2, 'Módulo 2 · Implementación', 2),
         ($4, $5, 'Módulo ajeno', 1)
       on conflict (id) do update set title = excluded.title, position = excluded.position`,
      [IDS.modulo1, IDS.curso, IDS.modulo2, IDS.moduloAjeno, IDS.cursoAjeno]
    )

    // Lecciones: una de cada tipo, más una en borrador y una del curso ajeno.
    await cliente.query(
      `insert into academia.lessons
         (id, module_id, title, position, lesson_type, status, bunny_video_id, video_duration_sec, description_rich)
       values
         ($1, $2, 'Lección 1 · Video de bienvenida', 1, 'video',      'published', 'qa-bunny-guid-0001', 600,
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Contenido protegido."}]}]}'),
         ($3, $2, 'Lección 2 · Texto de apoyo',      2, 'text',       'published', null, null,
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Contenido protegido."}]}]}'),
         ($4, $5, 'Lección 3 · Quiz de repaso',      1, 'quiz',       'published', null, null, null),
         ($6, $5, 'Lección 4 · Tarea práctica',      2, 'assignment', 'published', null, null, null),
         ($7, $5, 'Lección 5 · Borrador',            3, 'text',       'draft',     null, null, null),
         ($8, $9, 'Lección del curso ajeno',         1, 'video',      'published', 'qa-bunny-guid-9999', 300, null)
       on conflict (id) do update
         set title = excluded.title, status = excluded.status, lesson_type = excluded.lesson_type`,
      [
        IDS.leccionVideo, IDS.modulo1,
        IDS.leccionTexto,
        IDS.leccionQuiz, IDS.modulo2,
        IDS.leccionTarea,
        IDS.leccionBorrador,
        IDS.leccionAjena, IDS.moduloAjeno,
      ]
    )

    // Adjunto de lección: el vigente lo ve, el vencido no.
    //
    // El archivo se sube de verdad, no solo la fila. Una fila que nombra un
    // archivo inexistente firma bien y falla al descargar: la prueba pasaría y
    // el alumno se llevaría un 404. `pnpm storage:huerfanos` lo cazaría, pero
    // más vale que el seed no lo siembre.
    await subirAdjuntoDePrueba(`lecciones/${IDS.leccionVideo}/guia-qa.pdf`)

    await cliente.query(
      `insert into academia.lesson_attachments
         (id, lesson_id, storage_path, file_name, mime_type, size_bytes)
       values ($1, $2::uuid, 'lecciones/' || $2::text || '/guia-qa.pdf',
               'guia-qa.pdf', 'application/pdf', 12345)
       on conflict (id) do update set file_name = excluded.file_name`,
      [IDS.adjunto, IDS.leccionVideo]
    )

    // Cohorte con una sesión futura y una pasada.
    await cliente.query(
      `insert into academia.cohorts (id, course_id, name, starts_on, ends_on)
       values ($1, $2, 'QA · Cohorte de prueba', current_date - 7, current_date + 30)
       on conflict (id) do update set name = excluded.name`,
      [IDS.cohorte, IDS.curso]
    )

    await cliente.query(
      `insert into academia.cohort_sessions (id, cohort_id, title, scheduled_at, meet_url)
       values
         ($1, $2, 'Sesión 1 · Ya ocurrió',  $3, 'https://meet.google.com/qa-pasada'),
         ($4, $2, 'Sesión 2 · Próxima',     $5, 'https://meet.google.com/qa-futura')
       on conflict (id) do update set title = excluded.title, scheduled_at = excluded.scheduled_at`,
      [IDS.sesionPasada, IDS.cohorte, haceUnaSemana, IDS.sesionFutura, enUnaSemana]
    )

    // Quiz con respuesta correcta: la prueba de fuga de correct_option_id.
    await cliente.query(
      `insert into academia.quizzes (id, lesson_id, passing_score, reveal_answers)
       values ($1, $2, 80, false)
       on conflict (id) do update set passing_score = excluded.passing_score`,
      [IDS.quiz, IDS.leccionQuiz]
    )

    await cliente.query(
      `insert into academia.quiz_questions (id, quiz_id, question, options, correct_option_id, position)
       values ($1, $2, '¿Cuál es la capital de México?',
               '[{"id":"a","text":"Guadalajara"},{"id":"b","text":"Ciudad de México"},{"id":"c","text":"Monterrey"}]'::jsonb,
               'b', 1)
       on conflict (id) do update set question = excluded.question`,
      [IDS.pregunta, IDS.quiz]
    )

    await cliente.query(
      `insert into academia.assignments (id, lesson_id, instructions_rich, allow_files, allow_text)
       values ($1, $2, '{"type":"doc","content":[]}'::jsonb, true, true)
       on conflict (id) do update set allow_files = excluded.allow_files`,
      [IDS.tarea, IDS.leccionTarea]
    )

    // Anuncio dirigido al curso: el vencido debe seguir viéndolo (CTA de recompra).
    await cliente.query(
      `insert into academia.posts
         (id, author_id, post_type, title, content_rich, audience_course_id, published_at)
       values ($1, $2, 'announcement', 'QA · Anuncio del curso',
               '{"type":"doc","content":[]}'::jsonb, $3, now() - interval '1 day')
       on conflict (id) do update set title = excluded.title`,
      [IDS.anuncio, usuarios.admin.id, IDS.curso]
    )

    // Pago del alumno vigente. Sirve para probar que borrar payments es
    // exclusivo de superadmin (§4).
    await cliente.query(
      `insert into academia.payments
         (id, user_id, email, course_id, stripe_session_id, amount, currency, status)
       values ($1, $2, $3, $4, 'cs_test_qa_0001', 14999.00, 'mxn', 'paid')
       on conflict (id) do update set status = 'paid'`,
      [IDS.pago, usuarios.alumnoVigente.id, usuarios.alumnoVigente.email, IDS.curso]
    )

    // Inscripciones: una vigente y una vencida, ambas en la misma cohorte.
    await cliente.query(
      `insert into academia.enrollments
         (user_id, course_id, cohort_id, source, expires_at, status)
       values ($1, $2, $3, 'manual', null, 'active')
       on conflict (user_id, course_id) do update
         set expires_at = null, status = 'active', cohort_id = excluded.cohort_id`,
      [usuarios.alumnoVigente.id, IDS.curso, IDS.cohorte]
    )

    await cliente.query(
      `insert into academia.enrollments
         (user_id, course_id, cohort_id, source, expires_at, status)
       values ($1, $2, $3, 'manual', $4, 'active')
       on conflict (user_id, course_id) do update
         set expires_at = excluded.expires_at, status = 'active', cohort_id = excluded.cohort_id`,
      [usuarios.alumnoVencido.id, IDS.curso, IDS.cohorte, ayer]
    )

    // Punto de partida LIMPIO para los alumnos QA. Sin esto, una suite que
    // abortó a medias deja progreso, intentos y entregas, y la siguiente
    // corrida arranca con "el alumno lleva 25%" sin haber hecho nada — que
    // fue exactamente lo que pasó la víspera del lanzamiento. El seed es el
    // único punto por el que pasan todas las corridas, así que el reset vive
    // aquí y no en cada suite. Los certificados no: esa suite borra también
    // el PDF de Storage y sabe hacerlo bien.
    await cliente.query(
      `delete from academia.assignment_submissions where user_id = any($1::uuid[])`,
      [[usuarios.alumnoVigente.id, usuarios.alumnoVencido.id]]
    )
    await cliente.query(
      `delete from academia.quiz_attempts where user_id = any($1::uuid[])`,
      [[usuarios.alumnoVigente.id, usuarios.alumnoVencido.id]]
    )
    await cliente.query(
      `delete from academia.lesson_progress where user_id = any($1::uuid[])`,
      [[usuarios.alumnoVigente.id, usuarios.alumnoVencido.id]]
    )

    // Progreso previo del alumno vencido: debe sobrevivir al vencimiento (§6.3).
    await cliente.query(
      `insert into academia.lesson_progress (user_id, lesson_id, completed, seconds_watched, completed_at)
       values ($1, $2, true, 600, now() - interval '10 days')
       on conflict (user_id, lesson_id) do update set completed = true`,
      [usuarios.alumnoVencido.id, IDS.leccionVideo]
    )

    await cliente.query('commit')
  } catch (error) {
    await cliente.query('rollback')
    throw error
  }
}

// --- main ------------------------------------------------------------------

async function main() {
  titulo('SEEDS DE M1 — datos de prueba')

  const usuarios = await asegurarUsuarios()
  const cliente = await conectarPostgres(vars)

  try {
    await sembrarDatos(cliente, usuarios)

    const { rows } = await cliente.query(`
      select
        (select count(*)::int from academia.profiles)        as perfiles,
        (select count(*)::int from academia.courses)         as cursos,
        (select count(*)::int from academia.modules)         as modulos,
        (select count(*)::int from academia.lessons)         as lecciones,
        (select count(*)::int from academia.cohort_sessions) as sesiones,
        (select count(*)::int from academia.enrollments)     as inscripciones
    `)
    const c = rows[0]

    console.log('')
    linea('ok', 'Datos sembrados')
    console.log(
      `      ${c.perfiles} perfiles · ${c.cursos} cursos · ${c.modulos} módulos · ` +
        `${c.lecciones} lecciones · ${c.sesiones} sesiones · ${c.inscripciones} inscripciones`
    )
    console.log('')
    console.log(`      alumno vigente : ${USUARIOS_QA[2].email}  (sin expiración)`)
    console.log(`      alumno vencido : ${USUARIOS_QA[3].email}  (expiró ayer)`)
    console.log(`      sin perfil     : ${USUARIOS_QA[4].email}  (autenticado, NO pertenece)`)
    console.log(`      contraseña QA  : ${CLAVE_QA}`)
    console.log('')
    console.log('      Siguiente: pnpm test:rls')
    console.log('')
  } finally {
    await cliente.end().catch(() => {})
  }
}

/**
 * Sube un PDF mínimo pero VÁLIDO al bucket de adjuntos.
 *
 * Se arma a mano en vez de leerlo de disco para no meter un binario al repo por
 * 300 bytes. Tiene cabecera, un catálogo, una página vacía y el trailer, que es
 * lo que cualquier visor necesita para abrirlo sin quejarse.
 */
async function subirAdjuntoDePrueba(ruta) {
  const pdf = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj',
    'trailer<</Root 1 0 R>>',
    '%%EOF',
  ].join('\n')

  const res = await fetch(
    `${URL_BASE}/storage/v1/object/academia-adjuntos/${ruta}`,
    {
      method: 'POST',
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: pdf,
    }
  )

  if (!res.ok && res.status !== 409) {
    linea('aviso', 'adjunto de prueba', `no se pudo subir (${res.status})`)
  }
}

main().catch((error) => {
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
