import 'server-only'

import type { ClienteAgente } from '@/lib/agente/servidor'

/**
 * Lo que el agente sabe para contestar una pregunta (M21).
 *
 *   - El MAPA de la plataforma, generado de la base: las secciones del curso y
 *     sus lecciones publicadas, cada una con una clave («L3», «S:envivo»). El
 *     modelo devuelve claves y el código arma las ligas: el modelo nunca
 *     escribe una URL. Fuera del mapa: módulos exclusivos (0038), borradores,
 *     precios y fechas.
 *   - El CONOCIMIENTO (`agent_knowledge`): material del repo, transcripts de
 *     Fireflies y subtítulos de Bunny, cortados en trozos; se eligen los que
 *     más se parecen a la conversación, primero los del curso, hasta un tope
 *     que deja la petición muy por debajo de los 100 mil tokens.
 */

export type Enlace = { titulo: string; ruta: string }

export type Contexto = {
  mapa: string
  enlaces: Map<string, Enlace>
  conocimiento: string
  fuentes: string[]
}

/** Letras de conocimiento por petición (~25 mil tokens). */
const PRESUPUESTO = 62_000
const TROZO = 2_400

const VACIAS = new Set(
  'a al algo algun alguna como con cual cuando de del desde donde el ella ellos en entre era es esa ese eso esta este esto fue ha hay la las le les lo los mas me mi mis muy no nos o para pero por que se si sin sobre su sus te tengo tiene tu tus un una uno y ya yo hola gracias buenas buen dia tardes noches saludos alguien saben sabe puedo puede hacer quiero'
    .split(' ')
)

function sinAcentos(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function palabrasClave(texto: string): Set<string> {
  return new Set(
    sinAcentos(texto)
      .split(/[^a-z0-9ñ]+/)
      .filter((p) => p.length > 2 && !VACIAS.has(p))
  )
}

function trozos(texto: string): string[] {
  const parrafos = texto.split(/\n{2,}/)
  const salida: string[] = []
  let actual = ''
  for (const p of parrafos) {
    if (actual.length + p.length > TROZO && actual) {
      salida.push(actual)
      actual = ''
    }
    // Un párrafo enorme (un transcript sin saltos) se corta a lo bruto.
    if (p.length > TROZO) {
      for (let i = 0; i < p.length; i += TROZO) salida.push(p.slice(i, i + TROZO))
    } else {
      actual = actual ? `${actual}\n\n${p}` : p
    }
  }
  if (actual) salida.push(actual)
  return salida
}

function puntaje(palabras: string[], clave: Set<string>): number {
  if (clave.size === 0) return 0
  let n = 0
  for (const p of palabras) if (clave.has(p)) n++
  return n / Math.sqrt(palabras.length + 20)
}

type Trozo = { texto: string; titulo: string; delCurso: boolean; palabras: string[] }

/**
 * Los trozos de un curso, cortados y con sus palabras ya normalizadas. Se
 * guardan 5 minutos en la instancia: una corrida del cron contesta varias
 * preguntas del mismo curso y el material pesa más de un megabyte.
 */
const VIGENCIA = 5 * 60_000
const trozosEnMemoria = new Map<string, { en: number; trozos: Trozo[] }>()

async function trozosDelCurso(db: ClienteAgente, cursoId: string): Promise<Trozo[]> {
  const guardado = trozosEnMemoria.get(cursoId)
  if (guardado && Date.now() - guardado.en < VIGENCIA) return guardado.trozos
  const { data, error } = await db
    .from('agent_knowledge')
    .select('titulo, contenido, course_id')
    .eq('activo', true)
    .or(`course_id.is.null,course_id.eq.${cursoId}`)
  if (error) {
    console.error(JSON.stringify({ operacion: 'agente:conocimiento', cursoId, error: error.message }))
    return []
  }
  const lista: Trozo[] = []
  for (const doc of data ?? []) {
    for (const t of trozos(doc.contenido)) {
      lista.push({ texto: t, titulo: doc.titulo, delCurso: doc.course_id === cursoId, palabras: sinAcentos(t).split(/[^a-z0-9ñ]+/) })
    }
  }
  trozosEnMemoria.set(cursoId, { en: Date.now(), trozos: lista })
  return lista
}

/**
 * El mapa y el conocimiento para una conversación de `cursoId`.
 * `cohortId`: la generación del hilo (los cursos por generaciones tienen
 * módulos por generación); null = solo los módulos comunes.
 */
export async function contextoDelCurso(
  db: ClienteAgente,
  curso: { id: string; slug: string; titulo: string },
  cohortId: string | null,
  conversacion: string
): Promise<Contexto> {
  const [modulos, material] = await Promise.all([
    db.from('modules').select('id, title, position, cohort_id, is_restricted').eq('course_id', curso.id).order('position'),
    trozosDelCurso(db, curso.id),
  ])

  const visibles = (modulos.data ?? []).filter(
    (m) => !m.is_restricted && (m.cohort_id === null || m.cohort_id === cohortId)
  )
  const { data: lecciones } = visibles.length
    ? await db
        .from('lessons')
        .select('id, title, module_id, position, lesson_type')
        .in(
          'module_id',
          visibles.map((m) => m.id)
        )
        .eq('status', 'published')
        .order('position')
    : { data: [] }

  const enlaces = new Map<string, Enlace>()
  const base = `/curso/${curso.slug}`
  const secciones: Array<[string, string, string]> = [
    ['S:contenido', 'Contenido del curso (todas las lecciones)', base],
    ['S:envivo', 'En vivo (clases, horarios y grabaciones)', `${base}/en-vivo`],
    ['S:comunidad', 'Comunidad del curso', `${base}/comunidad`],
    ['S:miscursos', 'Mis cursos', '/mis-cursos'],
    ['S:perfil', 'Mi perfil (nombre, foto y membresía)', '/perfil'],
    ['S:certificaciones', 'Certificaciones', '/certificaciones'],
    ['S:puntos', 'Puntos y ranking', '/puntos'],
  ]
  const lineas: string[] = [`Curso: ${curso.titulo}`, '', 'Secciones:']
  for (const [clave, titulo, ruta] of secciones) {
    enlaces.set(clave, { titulo, ruta })
    lineas.push(`${clave} · ${titulo}`)
  }
  lineas.push('', 'Lecciones (por módulo):')
  let n = 0
  for (const m of visibles) {
    const propias = (lecciones ?? []).filter((l) => l.module_id === m.id)
    if (propias.length === 0) continue
    lineas.push(`Módulo: ${m.title}`)
    for (const l of propias) {
      n++
      const clave = `L${n}`
      enlaces.set(clave, { titulo: l.title, ruta: `${base}/${l.id}` })
      lineas.push(`  ${clave} · ${l.title}`)
    }
  }

  // El conocimiento: trozos con más palabras en común con la conversación,
  // primero los del curso.
  const clave = palabrasClave(conversacion)
  const candidatos = material.map((t) => ({ ...t, puntos: puntaje(t.palabras, clave) }))
  // Los del curso pesan más, pero solo si dicen algo de la conversación.
  candidatos.sort((a, b) => b.puntos * (a.delCurso ? 1.5 : 1) - a.puntos * (b.delCurso ? 1.5 : 1))

  let usadas = 0
  const elegidos: string[] = []
  const fuentes = new Set<string>()
  for (const c of candidatos) {
    // Sin nada en común con la conversación no se manda: sin conocimiento, el modelo deja borrador.
    if (c.puntos <= 0) break
    if (usadas + c.texto.length > PRESUPUESTO) continue
    elegidos.push(`<fuente titulo="${c.titulo.replace(/"/g, "'")}">\n${c.texto}\n</fuente>`)
    fuentes.add(c.titulo)
    usadas += c.texto.length
  }

  return { mapa: lineas.join('\n'), enlaces, conocimiento: elegidos.join('\n\n'), fuentes: [...fuentes] }
}

/** Cómo funciona la plataforma: va siempre, en el bloque que se guarda en caché. */
export const AYUDA_DE_LA_PLATAFORMA = `Cómo funciona la academia (academia.vadai.com.mx):
- Cada alumno entra con su correo. Si olvidó su contraseña, la recupera desde la pantalla de entrar, en "¿La olvidaste?" junto a Contraseña. Entrar con Google solo funciona si el correo ya tiene cuenta.
- En Mis cursos están los cursos a los que tiene acceso, con su avance.
- Dentro de un curso hay pestañas: Contenido (las lecciones por módulo), En vivo (las clases con su liga, el calendario y las grabaciones), Comunidad (el muro del curso) y, en algunos cursos, Dinámicas.
- Cada lección tiene su video, su material para descargar y al final el botón "Marcar como completada". Debajo hay comentarios para preguntar sobre esa lección.
- El certificado se libera cuando completas todas las lecciones obligatorias y apruebas sus quizzes y tareas. Se descarga desde Certificaciones.
- Los puntos salen de la actividad: lecciones completadas, comentarios, publicaciones y dinámicas. El ranking es por curso.
- Las sesiones exclusivas solo las ve la lista de personas invitadas; si alguien no la ve, no es un error.
- Si el acceso de alguien venció, sigue viendo sus cursos y su avance, pero no los videos ni el material: eso lo resuelve el equipo (borrador).
- Pagos, facturas, cambios de tarjeta, cancelaciones y reembolsos los atiende el equipo (borrador).`
