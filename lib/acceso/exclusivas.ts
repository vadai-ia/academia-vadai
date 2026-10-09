/**
 * Las sesiones exclusivas en las cuentas de avance del panel (0038, 9-oct-2026).
 *
 * Una sesión exclusiva es un módulo que solo abre para una lista. A quien no
 * está en ella no le cuenta: su avance y su certificado se miden contra lo que
 * puede ver. En el lado del alumno eso ya lo resuelve `lesson_outline`
 * (`para_mi`); pero al equipo la vista le enseña todo, así que las pantallas
 * del panel que miden el avance de cada persona restan aquí lo que esa persona
 * no ve.
 *
 * Sin `server-only` a propósito: no consulta nada, solo cruza filas que ya
 * trajo quien lo llama.
 */

export type Exclusivas = {
  /** grupo → (módulo exclusivo → cuántas lecciones publicadas tiene). */
  porGrupo: Map<string, Map<string, number>>
  /** Lección → su módulo, solo de las lecciones de módulos exclusivos. */
  moduloDe: Map<string, string>
  /** `${moduloId}:${userId}` de quien está en la lista. */
  miembros: Set<string>
}

export const SIN_EXCLUSIVAS: Exclusivas = { porGrupo: new Map(), moduloDe: new Map(), miembros: new Set() }

/**
 * Arma el cruce a partir de las filas del outline (que traen `module_id` y
 * `exclusiva`) y de `module_members`. `grupoDe` es la misma llave con la que
 * cada pantalla agrupa sus lecciones (curso, generación o ambos).
 */
export function armarExclusivas<F extends { id?: string | null; module_id: string | null; exclusiva: boolean | null }>(
  filas: F[],
  grupoDe: (fila: F) => string,
  miembros: Array<{ module_id: string; user_id: string }>
): Exclusivas {
  const porGrupo = new Map<string, Map<string, number>>()
  const moduloDe = new Map<string, string>()
  for (const f of filas) {
    if (!f.exclusiva || !f.module_id) continue
    if (f.id) moduloDe.set(f.id, f.module_id)
    const g = grupoDe(f)
    const modulos = porGrupo.get(g) ?? new Map<string, number>()
    modulos.set(f.module_id, (modulos.get(f.module_id) ?? 0) + 1)
    porGrupo.set(g, modulos)
  }
  return { porGrupo, moduloDe, miembros: new Set(miembros.map((m) => `${m.module_id}:${m.user_id}`)) }
}

/**
 * ¿Esta lección le cuenta a esta persona? Sirve para no sumar lo que completó
 * en una sesión exclusiva de cuya lista la sacaron después: su avance pasaría
 * del 100 %.
 */
export function leCuenta(ex: Exclusivas, userId: string, leccionId: string): boolean {
  const modulo = ex.moduloDe.get(leccionId)
  return modulo === undefined || ex.miembros.has(`${modulo}:${userId}`)
}

/** Cuántas lecciones del grupo NO ve esta persona por no estar en la lista. */
export function leccionesQueNoVe(ex: Exclusivas, grupo: string, userId: string): number {
  const modulos = ex.porGrupo.get(grupo)
  if (!modulos) return 0
  let n = 0
  for (const [moduloId, lecciones] of modulos) {
    if (!ex.miembros.has(`${moduloId}:${userId}`)) n += lecciones
  }
  return n
}
