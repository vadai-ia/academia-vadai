#!/usr/bin/env node
/**
 * test-rls.mjs — Criterio de cierre de M1.
 *
 * Prueba las policies como las probaría un atacante: iniciando sesión de verdad
 * con cada usuario QA y consultando PostgREST con su JWT y la llave ANÓNIMA.
 * Nunca usa la service role para las aserciones — eso saltaría RLS y la prueba
 * no probaría nada.
 *
 * Lo único que hace con service role es reponer el pago de prueba al inicio,
 * para que el script sea re-corrible.
 *
 *   node scripts/test-rls.mjs
 *
 * Sale con código 1 si cualquier aserción falla.
 */

import { cargarEnv, conectarPostgres, exigir } from './lib/entorno.mjs'
import { CLAVE_QA, IDS, USUARIOS_QA } from './lib/qa.mjs'

const vars = cargarEnv()
const URL_BASE = exigir(vars, 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const ANON = exigir(vars, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SERVICE = exigir(vars, 'SUPABASE_SERVICE_ROLE_KEY')

// --- acceso a PostgREST ----------------------------------------------------

function cabeceras(token, extra = {}) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Accept-Profile': 'academia',
    'Content-Profile': 'academia',
    'Content-Type': 'application/json',
    ...extra,
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
    throw new Error(
      `No se pudo iniciar sesión como ${email}: ${cuerpo.error_description ?? cuerpo.msg ?? res.status}. ` +
        '¿Corriste `pnpm db:seed`?'
    )
  }
  return cuerpo.access_token
}

async function filas(token, consulta) {
  const res = await fetch(`${URL_BASE}/rest/v1/${consulta}`, { headers: cabeceras(token) })
  const cuerpo = await res.json().catch(() => null)
  return Array.isArray(cuerpo) ? cuerpo : []
}

const contar = async (token, consulta) => (await filas(token, consulta)).length

async function escribir(metodo, token, consulta, cuerpo, prefer = 'return=representation') {
  const res = await fetch(`${URL_BASE}/rest/v1/${consulta}`, {
    method: metodo,
    headers: cabeceras(token, { Prefer: prefer }),
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const datos = await res.json().catch(() => null)
  return {
    ok: res.ok,
    status: res.status,
    afectadas: Array.isArray(datos) ? datos.length : 0,
    mensaje: datos && !Array.isArray(datos) ? (datos.message ?? '') : '',
  }
}

// --- reporte ---------------------------------------------------------------

const resultados = []

function afirmar(actor, descripcion, esperado, real) {
  resultados.push({ actor, descripcion, esperado, real, ok: esperado === real })
}

function imprimir() {
  const porActor = new Map()
  for (const r of resultados) {
    if (!porActor.has(r.actor)) porActor.set(r.actor, [])
    porActor.get(r.actor).push(r)
  }

  const ancho = Math.max(...resultados.map((r) => r.descripcion.length))

  console.log('')
  console.log('  PRUEBA DE POLICIES — schema academia')
  console.log('  Cada actor consulta con su propio JWT y la llave anónima.')

  for (const [actor, casos] of porActor) {
    console.log('')
    console.log(`  ${actor}`)
    console.log('  ' + '─'.repeat(ancho + 34))
    for (const c of casos) {
      const icono = c.ok ? '✓' : '✗'
      const comparacion = c.ok
        ? `${String(c.real)}`
        : `esperado ${String(c.esperado)}, obtuvo ${String(c.real)}`
      console.log(`  ${icono}  ${c.descripcion.padEnd(ancho)}  ${comparacion}`)
    }
  }

  const fallidas = resultados.filter((r) => !r.ok)
  console.log('')
  console.log('  ' + '─'.repeat(ancho + 34))
  if (fallidas.length === 0) {
    console.log(`  M1 EN VERDE — ${resultados.length}/${resultados.length} aserciones pasaron.`)
  } else {
    console.log(`  ${fallidas.length} de ${resultados.length} aserciones FALLARON:`)
    for (const f of fallidas) {
      console.log(`    ${f.actor} · ${f.descripcion}: esperado ${f.esperado}, obtuvo ${f.real}`)
    }
  }
  console.log('')
  return fallidas.length === 0
}

// --- preparación -----------------------------------------------------------

/** Repone el pago de prueba (lo borra el caso del superadmin). */
async function reponerPago(idAlumno, correoAlumno) {
  await fetch(`${URL_BASE}/rest/v1/payments`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Profile': 'academia',
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: IDS.pago,
      user_id: idAlumno,
      email: correoAlumno,
      course_id: IDS.curso,
      stripe_session_id: 'cs_test_qa_0001',
      amount: 14999.0,
      currency: 'mxn',
      status: 'paid',
    }),
  })
}

// --- main ------------------------------------------------------------------

const bd = await conectarPostgres(vars)

async function main() {
  const correo = Object.fromEntries(USUARIOS_QA.map((u) => [u.llave, u.email]))

  const t = {}
  for (const u of USUARIOS_QA) t[u.llave] = await iniciarSesion(u.email)

  // El id del alumno vigente sale de su propio perfil.
  const perfilVigente = await filas(t.alumnoVigente, 'profiles?select=user_id')
  const idVigente = perfilVigente[0]?.user_id
  await reponerPago(idVigente, correo.alumnoVigente)

  // ======================================================================
  // ALUMNO CON ACCESO VIGENTE — ve todo lo suyo, nada ajeno
  // ======================================================================
  const A = 'ALUMNO VIGENTE  (qa-alumno1, sin expiración)'

  afirmar(A, 'cursos visibles (solo el suyo)', 1, await contar(t.alumnoVigente, 'courses?select=id'))
  afirmar(A, 'módulos', 2, await contar(t.alumnoVigente, 'modules?select=id'))
  afirmar(A, 'lecciones publicadas (sin borrador)', 4, await contar(t.alumnoVigente, 'lessons?select=id'))
  afirmar(A, 'estructura (lesson_outline)', 4, await contar(t.alumnoVigente, 'lesson_outline?select=id'))
  afirmar(A, 'adjuntos', 1, await contar(t.alumnoVigente, 'lesson_attachments?select=id'))
  afirmar(A, 'sesiones de su cohorte', 2, await contar(t.alumnoVigente, 'cohort_sessions?select=id'))
  afirmar(A, 'quizzes', 1, await contar(t.alumnoVigente, 'quizzes?select=id'))
  afirmar(A, 'tareas', 1, await contar(t.alumnoVigente, 'assignments?select=id'))
  afirmar(A, 'anuncios de su curso', 1, await contar(t.alumnoVigente, 'posts?select=id'))
  afirmar(A, 'inscripciones (solo la propia)', 1, await contar(t.alumnoVigente, 'enrollments?select=id'))
  afirmar(A, 'perfiles (solo el propio)', 1, await contar(t.alumnoVigente, 'profiles?select=user_id'))
  afirmar(A, 'sus pagos', 1, await contar(t.alumnoVigente, 'payments?select=id'))
  afirmar(A, 'lecciones desbloqueadas', true,
    (await filas(t.alumnoVigente, 'lesson_outline?select=desbloqueada&limit=1'))[0]?.desbloqueada)

  // La fuga que el spec no contemplaba.
  afirmar(A, 'tabla quiz_questions (admin-only)', 0, await contar(t.alumnoVigente, 'quiz_questions?select=id'))
  const preguntas = await filas(t.alumnoVigente, 'quiz_questions_public?select=*')
  afirmar(A, 'preguntas por la vista pública', 1, preguntas.length)
  afirmar(A, 'la vista NO trae correct_option_id', false,
    Object.keys(preguntas[0] ?? {}).includes('correct_option_id'))

  // Escrituras
  const creaCurso = await escribir('POST', t.alumnoVigente, 'courses', {
    slug: 'qa-hackeo', title: 'No debería existir',
  })
  afirmar(A, 'crear un curso queda bloqueado', false, creaCurso.ok)

  const subeRol = await escribir('PATCH', t.alumnoVigente, `profiles?user_id=eq.${idVigente}`, {
    role: 'superadmin',
  })
  afirmar(A, 'auto-ascenderse a superadmin bloqueado', false, subeRol.ok)

  // El player hace upsert de progreso, así que se prueba tal cual lo hará la app.
  const guardaProgreso = await escribir('POST', t.alumnoVigente,
    'lesson_progress?on_conflict=user_id,lesson_id',
    { user_id: idVigente, lesson_id: IDS.leccionVideo, completed: true, seconds_watched: 120 },
    'resolution=merge-duplicates,return=representation')
  afirmar(A, 'guardar progreso permitido', true, guardaProgreso.ok)

  // --- barrido adversarial: caminos de escalación hermanos del de 0016 ---

  const comentaAjeno = await escribir('POST', t.alumnoVigente, 'lesson_comments', {
    lesson_id: IDS.leccionAjena, user_id: idVigente, content: 'Intento en curso ajeno',
  })
  afirmar(A, 'comentar en un curso ajeno bloqueado', false, comentaAjeno.ok)

  const autoInscribirse = await escribir('POST', t.alumnoVigente, 'enrollments', {
    user_id: idVigente, course_id: IDS.cursoAjeno, source: 'manual', status: 'active',
  })
  afirmar(A, 'auto-inscribirse a otro curso bloqueado', false, autoInscribirse.ok)

  const extenderVigencia = await escribir('PATCH', t.alumnoVigente,
    `enrollments?course_id=eq.${IDS.curso}`,
    { expires_at: null, status: 'active' })
  afirmar(A, 'extender su propia vigencia bloqueado', 0, extenderVigencia.afectadas)

  const fijarPost = await escribir('POST', t.alumnoVigente, 'community_posts', {
    course_id: IDS.curso, user_id: idVigente, title: 'Post fijado por el alumno', pinned: true,
  })
  afirmar(A, 'fijar su propio post bloqueado', false, fijarPost.ok)

  const autoAprobarse = await escribir('POST', t.alumnoVigente, 'assignment_submissions', {
    assignment_id: IDS.tarea, user_id: idVigente, text_content: 'Entrega', status: 'approved',
  })
  afirmar(A, 'auto-aprobarse una tarea bloqueado', false, autoAprobarse.ok)

  // Se afirma la propiedad, no el conteo: cuántas filas de progreso tenga este
  // alumno depende de qué suites hayan corrido antes. Lo que nunca debe pasar es
  // que aparezca una fila ajena.
  const progresoVisible = await filas(t.alumnoVigente, 'lesson_progress?select=user_id')
  afirmar(A, 'progreso de otros alumnos invisible', true,
    progresoVisible.length > 0 && progresoVisible.every((p) => p.user_id === idVigente))

  const autoAprobarQuiz = await escribir('POST', t.alumnoVigente, 'quiz_attempts', {
    quiz_id: IDS.quiz, user_id: idVigente, answers: {}, score: 100, passed: true,
  })
  afirmar(A, 'auto-reportarse quiz aprobado bloqueado', false, autoAprobarQuiz.ok)

  afirmar(A, 'stripe_events inalcanzable', 0, await contar(t.alumnoVigente, 'stripe_events?select=event_id'))
  afirmar(A, 'certificados ajenos invisibles', 0, await contar(t.alumnoVigente, 'certificates?select=id'))

  // ======================================================================
  // ALUMNO CON ACCESO VENCIDO — estructura sí, contenido no
  // ======================================================================
  const V = 'ALUMNO VENCIDO  (qa-alumno2, expiró ayer)'

  afirmar(V, 'sigue viendo su curso', 1, await contar(t.alumnoVencido, 'courses?select=id'))
  afirmar(V, 'sigue viendo los módulos', 2, await contar(t.alumnoVencido, 'modules?select=id'))
  afirmar(V, 'sigue viendo los títulos (outline)', 4, await contar(t.alumnoVencido, 'lesson_outline?select=id'))
  afirmar(V, 'los títulos salen bloqueados', false,
    (await filas(t.alumnoVencido, 'lesson_outline?select=desbloqueada&limit=1'))[0]?.desbloqueada)
  afirmar(V, 'sigue viendo anuncios (CTA recompra)', 1, await contar(t.alumnoVencido, 'posts?select=id'))
  afirmar(V, 'conserva su progreso', 1, await contar(t.alumnoVencido, 'lesson_progress?select=lesson_id'))

  afirmar(V, 'CONTENIDO de lecciones bloqueado', 0, await contar(t.alumnoVencido, 'lessons?select=id'))
  afirmar(V, 'adjuntos bloqueados', 0, await contar(t.alumnoVencido, 'lesson_attachments?select=id'))
  afirmar(V, 'sesiones en vivo bloqueadas', 0, await contar(t.alumnoVencido, 'cohort_sessions?select=id'))
  afirmar(V, 'quizzes bloqueados', 0, await contar(t.alumnoVencido, 'quizzes?select=id'))
  afirmar(V, 'preguntas bloqueadas', 0, await contar(t.alumnoVencido, 'quiz_questions_public?select=id'))
  afirmar(V, 'tareas bloqueadas', 0, await contar(t.alumnoVencido, 'assignments?select=id'))
  afirmar(V, 'comunidad bloqueada', 0, await contar(t.alumnoVencido, 'community_posts?select=id'))

  const progresoVencido = await escribir('POST', t.alumnoVencido,
    'lesson_progress?on_conflict=user_id,lesson_id',
    { user_id: (await filas(t.alumnoVencido, 'profiles?select=user_id'))[0]?.user_id,
      lesson_id: IDS.leccionTexto, completed: true, seconds_watched: 5 },
    'resolution=merge-duplicates,return=representation')
  afirmar(V, 'ya no puede registrar progreso nuevo', false, progresoVencido.ok)

  // ======================================================================
  // AUTENTICADO SIN PERFIL — la Regla Cero en acción
  // ======================================================================
  const S = 'SIN PERFIL  (qa-sinperfil, autenticado pero no pertenece)'

  for (const [etiqueta, consulta] of [
    ['cursos', 'courses?select=id'],
    ['módulos', 'modules?select=id'],
    ['lecciones', 'lessons?select=id'],
    ['estructura (outline)', 'lesson_outline?select=id'],
    ['perfiles', 'profiles?select=user_id'],
    ['directorio de miembros', 'public_profiles?select=user_id'],
    ['inscripciones', 'enrollments?select=id'],
    ['anuncios', 'posts?select=id'],
    ['pagos', 'payments?select=id'],
    ['sesiones', 'cohort_sessions?select=id'],
  ]) {
    afirmar(S, `${etiqueta}: cero filas`, 0, await contar(t.sinPerfil, consulta))
  }

  /** Cuántas filas hay de verdad. Ver la nota del grupo ADMIN. */
  const cuantas = async (tabla) => {
    const { rows } = await bd.query(`select count(*)::int n from academia.${tabla}`)
    return rows[0].n
  }

  // ======================================================================
  // ADMIN
  // ======================================================================
  const AD = 'ADMIN  (qa-admin)'

  // El admin ve TODO. Se compara contra la base y no contra números fijos, y
  // la razón vale la pena escribirla: estas aserciones decían "ve 4 perfiles" y
  // "ve 2 inscripciones", y se rompieron dos veces — primero al crear la
  // primera cuenta real, después al dar de alta a alguien desde la interfaz.
  //
  // Ninguna de las dos veces había un bug: la plataforma se estaba USANDO. Una
  // aserción que se rompe porque el producto se usa no está probando nada, solo
  // pidiendo mantenimiento. Lo que importa es la PROPIEDAD: que el admin vea
  // todas las filas que existen. Así sigue cazando una policy que filtre de más
  // cuando haya 40 alumnos, y no molesta cuando entra el 41.
  afirmar(AD, 've todos los cursos', await cuantas('courses'), await contar(t.admin, 'courses?select=id'))
  afirmar(
    AD,
    've todas las lecciones, incluida la borrador',
    await cuantas('lessons'),
    await contar(t.admin, 'lessons?select=id')
  )
  afirmar(
    AD,
    've todos los perfiles',
    await cuantas('profiles'),
    await contar(t.admin, 'profiles?select=user_id')
  )
  afirmar(
    AD,
    've todas las inscripciones',
    await cuantas('enrollments'),
    await contar(t.admin, 'enrollments?select=id')
  )
  afirmar(
    AD,
    've la respuesta correcta del quiz',
    await cuantas('quiz_questions'),
    await contar(t.admin, 'quiz_questions?select=correct_option_id')
  )

  const borraAdmin = await escribir('DELETE', t.admin, `payments?id=eq.${IDS.pago}`)
  afirmar(AD, 'NO puede borrar pagos', 0, borraAdmin.afectadas)

  // ======================================================================
  // SUPERADMIN
  // ======================================================================
  const SA = 'SUPERADMIN  (qa-superadmin)'

  afirmar(
    SA,
    've todos los cursos',
    await cuantas('courses'),
    await contar(t.superadmin, 'courses?select=id')
  )
  const borraSuper = await escribir('DELETE', t.superadmin, `payments?id=eq.${IDS.pago}`)
  afirmar(SA, 'SÍ puede borrar pagos', 1, borraSuper.afectadas)

  // Se repone para que el script sea re-corrible.
  await reponerPago(idVigente, correo.alumnoVigente)

  await bd.end().catch(() => {})
  process.exitCode = imprimir() ? 0 : 1
}

main().catch(async (error) => {
  await bd.end().catch(() => {})
  console.error('')
  console.error(`  ${error.message}`)
  console.error('')
  process.exitCode = 1
})
