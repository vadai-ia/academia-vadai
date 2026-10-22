import 'server-only'

import { ligaEnVaip } from '@/lib/comunidad/ligas'
import { misCursos, type CursoDelAlumno, type LeccionEnIndice } from '@/lib/alumno/consultas'
import { cursoDelAlumno } from '@/lib/alumno/consultas'
import { sesionesDelAlumno, sesionesDelCurso, type SesionDelAlumno } from '@/lib/alumno/sesiones'
import { obtenerSesion } from '@/lib/auth/sesion'
import { proximaOActual } from '@/lib/calendario/estado'
import { feedDelCurso, publicacionesParaAlumno, type AnuncioParaAlumno, type PostDeComunidad } from '@/lib/comunidad/posts'
import { dinamicasAbiertasParaCampana, type DinamicaParaCampana } from '@/lib/dinamicas/consultas-alumno'
import { planVaip } from '@/lib/membresia/consultas'
import { contextoVaip, cursosFueraDeVaip } from '@/lib/membresia/espacio'
import { noticiasDeVaip } from '@/lib/membresia/noticias'

export type Retomar = {
  curso: CursoDelAlumno
  leccion: LeccionEnIndice
  /** true si todavía no ha empezado ninguna lección. */
  empezando: boolean
}

/** Una publicación de un muro, en una línea: para Inicio. */
export type PublicacionBreve = {
  id: string
  titulo: string
  autor: string
  avatar: string | null
  creadoEn: string
  respuestas: number
  href: string
}

/** Lo último del muro de un curso. */
export type MuroBreve = {
  curso: { id: string; slug: string; titulo: string }
  publicaciones: PublicacionBreve[]
  href: string
}

/** Para el miembro: su comunidad, arriba de todo. */
export type BloqueVaip = {
  clase: SesionDelAlumno | null
  muro: PublicacionBreve[]
  noticia: PublicacionBreve | null
}

export type ResumenAlumno = {
  /** Los cursos de la persona, sin la casa de V-AI-P ni (si es miembro) sus herramientas: esas viven en V-AI-P. */
  cursos: CursoDelAlumno[]
  retomar: Retomar | null
  anuncio: AnuncioParaAlumno | null
  entradas: AnuncioParaAlumno[]
  /** La próxima sesión (o la que está pasando) de sus cursos; la de V-AI-P va en su bloque. */
  proximaSesion: SesionDelAlumno | null
  leccionesHechas: number
  leccionesTotales: number
  /** null si no es miembro de V-AI-P. */
  vaip: BloqueVaip | null
  /** No es miembro y la suscripción está abierta: una sola invitación. */
  invitarAVaip: boolean
  /** Los muros de sus cursos que tienen conversación, con lo último. */
  muros: MuroBreve[]
  /** Una dinámica abierta, si hay. */
  dinamica: DinamicaParaCampana | null
}

const breve = (p: PostDeComunidad, href: string): PublicacionBreve => ({
  id: p.id,
  titulo: p.titulo,
  autor: p.autor.nombre,
  avatar: p.autor.avatar,
  creadoEn: p.creadoEn,
  respuestas: p.comentarios.length,
  // 22-oct-2026: cada publicación tiene su página (lib/comunidad/ligas.ts).
  href: href === '/vaip' ? ligaEnVaip(p.id, Boolean(p.noticia)) : `${href}/${p.id}`,
})

/**
 * Todo lo que necesita Inicio, en un solo lugar.
 *
 * M22 (20-oct-2026): Inicio es «lo que está pasando». Para el miembro, V-AI-P
 * va primero (lo último del muro, la clase, la noticia); después retomar el
 * curso, la sesión y el anuncio, lo último de los muros de sus cursos y sus
 * cursos. Salieron la tarjeta de nivel (el puntaje por generación ya se
 * premió), «Tus certificados» (vive en Mi perfil) y el blog vacío.
 *
 * Se consulta en paralelo lo que no depende de nada; los muros de los cursos
 * después, porque necesitan la lista de cursos.
 */
export async function resumenDelAlumno(): Promise<ResumenAlumno> {
  const sesion = await obtenerSesion()
  const userId = sesion.tipo === 'activo' ? sesion.perfil.user_id : ''

  const [todos, anuncios, entradas, sesiones, ctx, plan, dinamicas] = await Promise.all([
    misCursos(),
    publicacionesParaAlumno('announcement'),
    publicacionesParaAlumno('blog'),
    sesionesDelAlumno(),
    contextoVaip(),
    planVaip(),
    dinamicasAbiertasParaCampana(),
  ])

  const esMiembro = ctx !== null
  const cursos = await cursosFueraDeVaip(todos)

  const leccionesHechas = cursos.reduce((n, c) => n + c.completadas, 0)
  const leccionesTotales = cursos.reduce((n, c) => n + c.totalLecciones, 0)
  const ahora = Date.now()
  // Lo de V-AI-P (su casa y sus herramientas) va en su bloque, no aquí: la
  // sesión y el anuncio son de los cursos que se ven en «Tus cursos».
  const slugsVisibles = new Set(cursos.map((c) => c.slug))
  const idsVisibles = new Set(cursos.map((c) => c.id))
  const proximaSesion = proximaOActual(
    sesiones.filter((s) => slugsVisibles.has(s.cursoSlug)),
    ahora
  )

  const [retomar, vaip, muros] = await Promise.all([
    siguientePaso(cursos),
    ctx?.casa ? bloqueVaip(ctx.casa, userId) : Promise.resolve(ctx ? { clase: null, muro: [], noticia: null } : null),
    murosDeLosCursos(cursos, userId),
  ])

  return {
    cursos,
    retomar,
    anuncio: anuncios.find((a) => a.cursoId === null || idsVisibles.has(a.cursoId)) ?? null,
    entradas: entradas.slice(0, 3),
    proximaSesion,
    leccionesHechas,
    leccionesTotales,
    vaip,
    invitarAVaip: !esMiembro && Boolean(plan?.abierto),
    muros,
    dinamica: dinamicas[0] ?? null,
  }
}

async function bloqueVaip(casa: CursoDelAlumno, userId: string): Promise<BloqueVaip> {
  const cohortId = casa.generacion?.id ?? null
  const [feed, sesiones, { noticias }] = await Promise.all([
    feedDelCurso(casa.id, cohortId, userId, { pagina: 1, porPagina: 3 }),
    sesionesDelCurso(casa.slug),
    noticiasDeVaip(casa.id, userId, { generacionId: cohortId, cuantas: 1 }),
  ])
  const noticia = noticias[0] ?? null
  return {
    clase: proximaOActual(sesiones, Date.now()),
    muro: feed.posts.map((p) => breve(p, '/vaip')),
    noticia: noticia ? breve(noticia, '/vaip') : null,
  }
}

/** Lo último de cada muro vigente que tenga conversación (dos publicaciones por curso). */
async function murosDeLosCursos(cursos: CursoDelAlumno[], userId: string): Promise<MuroBreve[]> {
  const vigentes = cursos.filter((c) => c.vigente && !c.sinGeneracion)
  const feeds = await Promise.all(
    vigentes.map((c) => feedDelCurso(c.id, c.generacion?.id ?? null, userId, { pagina: 1, porPagina: 2 }))
  )
  return vigentes
    .map((c, i) => {
      const href = `/curso/${c.slug}/comunidad`
      return {
        curso: { id: c.id, slug: c.slug, titulo: c.titulo },
        publicaciones: (feeds[i]?.posts ?? []).map((p) => breve(p, href)),
        href,
      }
    })
    .filter((m) => m.publicaciones.length > 0)
    .sort((a, b) => (b.publicaciones[0]?.creadoEn ?? '').localeCompare(a.publicaciones[0]?.creadoEn ?? ''))
}

/**
 * La lección con la que conviene seguir.
 *
 * Se elige el curso vigente con más avance pero sin terminar: es el que la
 * persona tiene fresco. Empezar por el que lleva 0% cuando hay otro al 80%
 * obliga a cambiar de contexto sin motivo.
 *
 * `misCursos()` no trae el índice —serían todas las lecciones de todos los
 * cursos para pintar una tarjeta—, así que el detalle se pide solo del curso
 * elegido. Es un viaje más, y solo uno.
 */
async function siguientePaso(cursos: CursoDelAlumno[]): Promise<Retomar | null> {
  const candidatos = cursos
    .filter((c) => c.vigente && c.totalLecciones > 0 && c.porcentaje < 100)
    .sort((a, b) => b.porcentaje - a.porcentaje)

  const elegido = candidatos[0]
  if (!elegido) return null

  const completo = await cursoDelAlumno(elegido.slug)
  if (!completo) return null

  const planas = completo.modulos.flatMap((m) => m.lecciones)
  const leccion =
    planas.find((l) => l.desbloqueada && !l.completada) ?? planas.find((l) => l.desbloqueada)

  if (!leccion) return null

  return { curso: completo, leccion, empezando: completo.completadas === 0 }
}
