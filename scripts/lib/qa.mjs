/**
 * Datos de prueba de M1.
 *
 * Todo lo QA lleva prefijo `qa-` para poder purgarlo sin ambigüedad al cerrar
 * M11 ("datos de prueba purgados"). Los UUID son fijos a propósito: hacen el
 * seed idempotente y permiten que test-rls.mjs afirme sobre ids concretos.
 */

/** Contraseña de los usuarios QA. Solo existe en ambientes de prueba. */
export const CLAVE_QA = 'VadaiQA-2026!seed'

export const DOMINIO_QA = 'academia.vadai.com.mx'

/**
 * Los cinco actores del criterio de cierre de M1.
 *
 * `sin-perfil` es el más importante y el más fácil de olvidar: un usuario
 * autenticado de verdad, con JWT válido, que NO tiene fila en academia.profiles.
 * Es la prueba de que estar autenticado no significa pertenecer a la academia.
 */
export const USUARIOS_QA = [
  {
    llave: 'superadmin',
    email: `qa-superadmin@${DOMINIO_QA}`,
    nombre: 'QA Superadmin',
    role: 'superadmin',
    conPerfil: true,
  },
  {
    llave: 'admin',
    email: `qa-admin@${DOMINIO_QA}`,
    nombre: 'QA Admin',
    role: 'admin',
    conPerfil: true,
  },
  {
    llave: 'alumnoVigente',
    email: `qa-alumno1@${DOMINIO_QA}`,
    nombre: 'QA Alumno Vigente',
    role: 'alumno',
    conPerfil: true,
  },
  {
    llave: 'alumnoVencido',
    email: `qa-alumno2@${DOMINIO_QA}`,
    nombre: 'QA Alumno Vencido',
    role: 'alumno',
    conPerfil: true,
  },
  {
    llave: 'sinPerfil',
    email: `qa-sinperfil@${DOMINIO_QA}`,
    nombre: 'QA Sin Perfil',
    role: null,
    conPerfil: false,
  },
]

const U = (n) => `0a0a0000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`

export const IDS = {
  // Curso al que SÍ están inscritos los alumnos QA.
  curso: U(1),
  modulo1: U(2),
  modulo2: U(3),
  leccionVideo: U(4),
  leccionTexto: U(5),
  leccionQuiz: U(6),
  leccionTarea: U(7),
  // Lección en borrador: ni el alumno vigente debe verla.
  leccionBorrador: U(8),
  adjunto: U(9),
  cohorte: U(10),
  sesionFutura: U(11),
  sesionPasada: U(12),
  quiz: U(13),
  pregunta: U(14),
  tarea: U(15),
  anuncio: U(16),
  pago: U(17),

  // Curso AJENO: nadie está inscrito. Prueba el aislamiento entre cursos.
  cursoAjeno: U(20),
  moduloAjeno: U(21),
  leccionAjena: U(22),

  // Dinámicas empresariales (M13, test-dinamicas.mjs): la empresa QA de las
  // cuentas qa-din-* y el id fijo con el que se prueba el check de escala.
  empresaDinamicas: U(23),
  dinamica: U(24),
}

export const CURSO_QA = {
  id: IDS.curso,
  slug: 'qa-curso-prueba',
  title: 'QA · Curso de prueba',
  description: 'Curso sembrado por scripts/seed.mjs para validar las policies de M1.',
}

export const CURSO_AJENO_QA = {
  id: IDS.cursoAjeno,
  slug: 'qa-curso-ajeno',
  title: 'QA · Curso ajeno',
  description: 'Ningún usuario QA está inscrito aquí. Sirve para probar aislamiento entre cursos.',
}

/** Marca común para poder purgar sin tocar datos reales. */
export const PREFIJO_QA = 'qa-'
