/**
 * Las reglas del juego: cuánto vale cada cosa y dónde empieza cada nivel.
 *
 * Es el ÚNICO lugar donde viven los pesos. La vista `actividad_por_curso`
 * (migración 0025) entrega conteos crudos por alumno y curso; los puntos se
 * calculan aquí, en el servidor, y se pintan tal cual. Guardar puntos en la
 * base sería una segunda verdad que se desincroniza en cuanto alguien borra
 * un comentario; calcularlos cuesta un select.
 *
 * Sin `server-only` a propósito: los componentes de cliente que animan el
 * número necesitan `nivelDe()` y la lista de "cómo ganar puntos".
 *
 * Los beneficios de los puntos (asesorías, implementaciones) no están
 * definidos todavía; por ahora el juego es subir de nivel y verse en el
 * ranking del grupo. Por eso el ranking es POR CURSO y no de toda la academia:
 * compites con tu grupo, que es a quien ves en la comunidad.
 */

export const PUNTOS = {
  leccion: 10,
  quiz: 25,
  tarea: 20,
  tareaAprobada: 30,
  publicacion: 15,
  comentario: 5,
  certificado: 100,
} as const

export type Actividad = {
  lecciones: number
  quizzes: number
  tareas: number
  tareasAprobadas: number
  publicaciones: number
  comentarios: number
  certificados: number
}

export const ACTIVIDAD_VACIA: Actividad = {
  lecciones: 0,
  quizzes: 0,
  tareas: 0,
  tareasAprobadas: 0,
  publicaciones: 0,
  comentarios: 0,
  certificados: 0,
}

export function sumarActividad(a: Actividad, b: Actividad): Actividad {
  return {
    lecciones: a.lecciones + b.lecciones,
    quizzes: a.quizzes + b.quizzes,
    tareas: a.tareas + b.tareas,
    tareasAprobadas: a.tareasAprobadas + b.tareasAprobadas,
    publicaciones: a.publicaciones + b.publicaciones,
    comentarios: a.comentarios + b.comentarios,
    certificados: a.certificados + b.certificados,
  }
}

export function puntosDe(a: Actividad): number {
  return (
    a.lecciones * PUNTOS.leccion +
    a.quizzes * PUNTOS.quiz +
    a.tareas * PUNTOS.tarea +
    a.tareasAprobadas * PUNTOS.tareaAprobada +
    a.publicaciones * PUNTOS.publicacion +
    a.comentarios * PUNTOS.comentario +
    a.certificados * PUNTOS.certificado
  )
}

/**
 * Los niveles, en la voz de VADAI: nombran algo que el dueño de una empresa
 * reconoce, no "bronce, plata, oro". Los umbrales están pensados para un
 * curso de 23 lecciones con quizzes y tareas: terminarlo con participación
 * llega a "Referente"; "Leyenda" pide un segundo curso o mucha comunidad.
 */
export const NIVELES = [
  { nombre: 'Recién llegado', minimo: 0 },
  { nombre: 'En marcha', minimo: 50 },
  { nombre: 'Con oficio', minimo: 150 },
  { nombre: 'Referente', minimo: 350 },
  { nombre: 'Leyenda VADAI', minimo: 700 },
] as const

export type Nivel = {
  /** 1 a NIVELES.length */
  numero: number
  nombre: string
  minimo: number
  siguiente: { nombre: string; minimo: number } | null
  /** 0 a 100: qué tanto del tramo hasta el siguiente nivel ya se recorrió. */
  progreso: number
  faltan: number
}

export function nivelDe(puntos: number): Nivel {
  let indice = 0
  for (let i = 0; i < NIVELES.length; i++) {
    if (puntos >= (NIVELES[i]?.minimo ?? 0)) indice = i
  }
  const actual = NIVELES[indice] ?? NIVELES[0]
  const siguiente = NIVELES[indice + 1] ?? null
  const tramo = siguiente ? siguiente.minimo - actual.minimo : 1
  const recorrido = siguiente ? puntos - actual.minimo : tramo
  return {
    numero: indice + 1,
    nombre: actual.nombre,
    minimo: actual.minimo,
    siguiente: siguiente ? { nombre: siguiente.nombre, minimo: siguiente.minimo } : null,
    progreso: siguiente ? Math.min(100, Math.round((recorrido / tramo) * 100)) : 100,
    faltan: siguiente ? Math.max(0, siguiente.minimo - puntos) : 0,
  }
}

/** Para la lista "¿Cómo gano puntos?". En orden de lo más frecuente. */
export const COMO_GANAR = [
  { que: 'Completar una lección', puntos: PUNTOS.leccion },
  { que: 'Comentar en una lección o en la comunidad', puntos: PUNTOS.comentario },
  { que: 'Publicar en la comunidad de tu curso', puntos: PUNTOS.publicacion },
  { que: 'Entregar una tarea', puntos: PUNTOS.tarea },
  { que: 'Aprobar un quiz', puntos: PUNTOS.quiz },
  { que: 'Que te aprueben una tarea', puntos: PUNTOS.tareaAprobada },
  { que: 'Terminar un curso y recibir tu certificado', puntos: PUNTOS.certificado },
] as const
