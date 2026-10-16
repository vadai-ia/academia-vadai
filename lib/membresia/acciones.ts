'use server'

import { revalidatePath } from 'next/cache'

import type { EstadoAccion } from '@/lib/admin/tipos'
import { exigirAdmin } from '@/lib/auth/sesion'
import { planVaip } from '@/lib/membresia/consultas'
import { sincronizarMembresia } from '@/lib/membresia/sincronizar'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

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

  // Service role: la acción ya está autorizada y escribe inscripciones de otros.
  const supabase = crearClienteServiceRole()
  const { data, error } = await supabase.from('memberships').select('user_id').eq('plan_id', plan.id)
  if (error) {
    registrarFallo('sincronizarAccesos', { plan: plan.id }, error.message)
    return { error: 'No se pudieron leer las membresías.' }
  }

  const personas = [...new Set((data ?? []).map((m) => m.user_id).filter((v): v is string => v !== null))]
  let nuevos = 0
  let fallas = 0
  for (const userId of personas) {
    const r = await sincronizarMembresia(userId, plan.id)
    nuevos += r.nuevos.length
    if (!r.ok) fallas += 1
  }

  revalidatePath('/admin/vaip')
  if (fallas > 0) {
    return { error: `${personas.length} miembros revisados; ${fallas} con errores. Revisa los registros.` }
  }
  return {
    aviso:
      nuevos > 0
        ? `${personas.length} miembros al día; ${nuevos} accesos nuevos, con su aviso por correo.`
        : `${personas.length} miembros al día. No había cursos nuevos que dar.`,
  }
}
