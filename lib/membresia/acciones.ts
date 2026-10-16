'use server'

import { revalidatePath } from 'next/cache'

import type { EstadoAccion } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { planVaip } from '@/lib/membresia/consultas'
import { sincronizarPlan } from '@/lib/membresia/sincronizar'

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

/**
 * «Sincronizar accesos» (M17): pone a cada miembro al día con los cursos del
 * plan. Se corre después de agregar un curso a V-AI-P; a quien recibe un curso
 * nuevo le llega el aviso por correo (CLAUDE.md: agregar un curso a quien ya
 * tiene cuenta SIEMPRE avisa).
 *
 * Solo admin: toca accesos de todos los miembros.
 */
export async function sincronizarAccesos(_previo: EstadoAccion, _datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()
  const plan = await planVaip()
  if (!plan) return { error: 'No existe el plan V-AI-P.' }

  // Service role adentro: la acción ya está autorizada y escribe inscripciones de otros.
  const r = await sincronizarPlan(plan.id)
  if (r.error) {
    registrarFallo('sincronizarAccesos', { plan: plan.id }, r.error)
    return { error: 'No se pudieron leer las membresías.' }
  }
  const { personas, nuevos, fallas } = r

  revalidatePath('/admin/vaip')
  if (fallas > 0) {
    return { error: `${personas} miembros revisados; ${fallas} con errores. Revisa los registros.` }
  }
  return {
    aviso:
      nuevos > 0
        ? `${personas} miembros al día; ${nuevos} accesos nuevos, con su aviso por correo.`
        : `${personas} miembros al día. No había cursos nuevos que dar.`,
  }
}
