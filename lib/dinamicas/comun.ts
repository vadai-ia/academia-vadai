/**
 * Piezas de las dinámicas empresariales que necesitan tanto el servidor como
 * el navegador: tipos, etiquetas, topes, el cálculo del ponderado y la
 * validación de una celda.
 *
 * Sin `server-only` a propósito (mismo criterio que lib/encuestas/comun.ts y
 * lib/gamificacion/reglas.ts): el tablero es un client component que
 * recalcula el ponderado al teclear, la exportación lo usa en el servidor y
 * la suite lo puede importar sin levantar nada. Una sola implementación del
 * SUMPRODUCT del Excel original (contenido/claude-en-tu-empresa/sesion-1/
 * hoja-de-decision.py) para que la pantalla, el Excel y la prueba digan lo
 * mismo.
 */

export const ESTADOS_DINAMICA = ['draft', 'open', 'closed'] as const
export type EstadoDinamica = (typeof ESTADOS_DINAMICA)[number]

export const ETIQUETA_ESTADO_DINAMICA: Record<EstadoDinamica, string> = {
  draft: 'Borrador',
  open: 'Abierta',
  closed: 'Cerrada',
}

export const TIPOS_FILA = ['criterio', 'informativa'] as const
export type TipoFila = (typeof TIPOS_FILA)[number]

export const ETIQUETA_TIPO_FILA: Record<TipoFila, string> = {
  criterio: 'Criterio con peso',
  informativa: 'Fila informativa',
}

/** Del 1 al 10, como califica la gente en español y como venía el Excel. */
export const ESCALA_POR_DEFECTO = { min: 1, max: 10 } as const

/** numeric(5,2) en la base: dos decimales. Tres tercios dan 99.99, no 100. */
export const TOLERANCIA_PESOS = 0.001

export const TOPE_TITULO = 160
export const TOPE_DESCRIPCION = 1000
export const TOPE_ETIQUETA_FILA = 120
export const TOPE_ETIQUETA_COLUMNA = 80
export const TOPE_TEXTO_INFORMATIVO = 80

export type Escala = { min: number; max: number }

export type FilaDinamica = {
  id: string
  tipo: TipoFila
  etiqueta: string
  /** En %. Null en las informativas. */
  peso: number | null
  posicion: number
}

export type ColumnaTablero = {
  id: string
  etiqueta: string
  posicion: number
  /** Null si la cuenta que la creó ya no existe. */
  creadaPor: string | null
  creadaPorNombre: string | null
  creadaEn: string
}

export type CeldaTablero = {
  filaId: string
  columnaId: string
  numero: number | null
  texto: string | null
  editadaPor: string | null
  editadaPorNombre: string | null
  editadaEn: string | null
}

/** Todo lo que el componente del tablero necesita para pintarse. */
export type TableroParaPintar = {
  id: string
  dinamicaId: string
  version: number
  titulo: string
  descripcion: string | null
  cursoId: string
  cursoTitulo: string
  cursoSlug: string
  /** Null = tablero individual (General). */
  empresa: string | null
  /** EFECTIVO: una abierta con fecha límite vencida llega como 'closed'. */
  estado: EstadoDinamica
  cierraEn: string | null
  cerroEn: string | null
  escala: Escala
  filas: FilaDinamica[]
  columnas: ColumnaTablero[]
  celdas: CeldaTablero[]
  /** Quienes han creado un proyecto o puesto una calificación, sin repetir. */
  editores: Array<{ userId: string; nombre: string }>
}

export type Ponderado = {
  /** Null mientras falte algún criterio por calificar. Un decimal. */
  valor: number | null
  puntuados: number
  deCriterios: number
  completa: boolean
}

export type ResultadoCelda =
  | { ok: true; numero: number | null; texto: string | null }
  | { ok: false; error: string }

/**
 * "Abierta de verdad": abierta y sin fecha límite vencida. Es la misma regla
 * que academia.dinamica_abierta() en la base; aquí se repite para poder pintar
 * "Cerrada" sin un viaje extra.
 */
export function estaAbierta(
  d: { status: string; closes_at: string | null },
  ahora: number = Date.now()
): boolean {
  if (d.status !== 'open') return false
  if (!d.closes_at) return true
  return new Date(d.closes_at).getTime() > ahora
}

/** El estado que se muestra: una abierta con la fecha vencida ya es cerrada. */
export function estadoEfectivo(
  d: { status: string; closes_at: string | null },
  ahora: number = Date.now()
): EstadoDinamica {
  if (d.status === 'draft') return 'draft'
  return estaAbierta(d, ahora) ? 'open' : 'closed'
}

export function sumaPesos(filas: ReadonlyArray<Pick<FilaDinamica, 'tipo' | 'peso'>>): number {
  let suma = 0
  for (const f of filas) if (f.tipo === 'criterio' && f.peso !== null) suma += f.peso
  return Math.round(suma * 100) / 100
}

export function pesosSuman100(filas: ReadonlyArray<Pick<FilaDinamica, 'tipo' | 'peso'>>): boolean {
  return Math.abs(sumaPesos(filas) - 100) <= TOLERANCIA_PESOS
}

/** La llave con la que el tablero indexa sus celdas. */
export function claveCelda(filaId: string, columnaId: string): string {
  return `${filaId}:${columnaId}`
}

/**
 * La media ponderada de un proyecto, a un decimal.
 *
 * Solo hay valor cuando TODOS los criterios están calificados: un proyecto
 * con tres de cinco criterios no es "un 7.2", es un proyecto a medias. La
 * aritmética va en centésimas de peso (enteros) para que el redondeo no
 * dependa de flotantes: 20/15/10/30/25 con [10,4,7,8,9] da 7.95 y se pinta
 * "8.0", igual que el Excel.
 */
export function ponderado(
  criterios: ReadonlyArray<{ id: string; peso: number }>,
  valores: ReadonlyMap<string, number>
): Ponderado {
  let numerador = 0
  let denominador = 0
  let puntuados = 0
  for (const c of criterios) {
    const centesimas = Math.round(c.peso * 100)
    denominador += centesimas
    const v = valores.get(c.id)
    if (v === undefined) continue
    puntuados += 1
    numerador += centesimas * v
  }
  const completa = criterios.length > 0 && puntuados === criterios.length
  const valor = completa && denominador > 0 ? Math.round((numerador * 10) / denominador) / 10 : null
  return { valor, puntuados, deCriterios: criterios.length, completa }
}

function criteriosDe(filas: ReadonlyArray<FilaDinamica>): Array<{ id: string; peso: number }> {
  return filas
    .filter((f) => f.tipo === 'criterio' && f.peso !== null)
    .map((f) => ({ id: f.id, peso: f.peso as number }))
}

/** El ponderado de una columna, leyendo las celdas por su clave. */
export function ponderadoDeColumna(
  filas: ReadonlyArray<FilaDinamica>,
  celdas: ReadonlyMap<string, Pick<CeldaTablero, 'numero'>>,
  columnaId: string
): Ponderado {
  const valores = new Map<string, number>()
  for (const f of filas) {
    if (f.tipo !== 'criterio') continue
    const celda = celdas.get(claveCelda(f.id, columnaId))
    if (celda && celda.numero !== null) valores.set(f.id, celda.numero)
  }
  return ponderado(criteriosDe(filas), valores)
}

/** Las columnas con el mejor ponderado completo. Empate: todas. */
export function ganadoras(
  filas: ReadonlyArray<FilaDinamica>,
  celdas: ReadonlyMap<string, Pick<CeldaTablero, 'numero'>>,
  columnas: ReadonlyArray<Pick<ColumnaTablero, 'id'>>
): Set<string> {
  let mejor: number | null = null
  const porColumna = new Map<string, number>()
  for (const c of columnas) {
    const p = ponderadoDeColumna(filas, celdas, c.id)
    if (p.valor === null) continue
    porColumna.set(c.id, p.valor)
    if (mejor === null || p.valor > mejor) mejor = p.valor
  }
  const resultado = new Set<string>()
  if (mejor === null) return resultado
  for (const [id, v] of porColumna) if (v === mejor) resultado.add(id)
  return resultado
}

export function formatearPonderado(valor: number | null): string {
  return valor === null ? '—' : valor.toFixed(1)
}

/**
 * Lo que tecleó la persona, validado según la fila. Vacío = borrar la celda.
 * El trigger de la base repite la regla; esto es para el mensaje amable.
 */
export function validarValorDeCelda(
  fila: Pick<FilaDinamica, 'tipo'>,
  escala: Escala,
  crudo: string
): ResultadoCelda {
  const texto = crudo.trim()
  if (texto === '') return { ok: true, numero: null, texto: null }

  if (fila.tipo === 'criterio') {
    const numero = Number(texto)
    if (!Number.isInteger(numero) || numero < escala.min || numero > escala.max) {
      return {
        ok: false,
        error: `Escribe un número entero entre ${escala.min} y ${escala.max}.`,
      }
    }
    return { ok: true, numero, texto: null }
  }

  if (texto.length > TOPE_TEXTO_INFORMATIVO) {
    return { ok: false, error: `Máximo ${TOPE_TEXTO_INFORMATIVO} caracteres.` }
  }
  return { ok: true, numero: null, texto }
}

/** 'Alejandro Martínez' → 'AM'. Mismo criterio que el Avatar de superficie.tsx. */
export function iniciales(nombre: string): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase() || '·'
  )
}
