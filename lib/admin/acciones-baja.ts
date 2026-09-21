'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { borrarArchivosDeUsuario } from '@/lib/admin/almacenamiento'
import { exigirAdmin } from '@/lib/auth/sesion'
import { crearClienteServiceRole } from '@/lib/supabase/service-role'

import type { EstadoAccion } from './tipos'

const esquema = z.object({
  user_id: z.uuid('Cuenta inválida.'),
  confirmacion: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase()),
})

/**
 * Borra la cuenta de verdad (decidido 21-sep-2026, M14): Auth y academia, en
 * cascada. Suspender sigue siendo el camino reversible.
 *
 * El orden importa, porque la cascada y los `set null` destruyen información:
 *   1. Las publicaciones del blog pasan a quien borra: `posts.author_id` es
 *      CASCADE y el blog no se pierde por dar de baja a su autor.
 *   2. Los pagos se marcan: la FK los dejará sin cuenta (`set null`) y la marca
 *      evita que aparezcan como "pago sin cuenta", que es otro problema.
 *   3. `auth.admin.deleteUser`: punto sin retorno. Se lleva el perfil y todo lo
 *      que cuelga: inscripciones, avance, intentos, entregas, comentarios y
 *      publicaciones (con las respuestas de otros), certificados, ligas.
 *   4. Storage, después: si Auth fallara, nadie se queda con cuenta y sin sus
 *      archivos; si Storage falla, `pnpm storage:huerfanos` lo recoge.
 *
 * Termina en `redirect` a la lista: la ficha ya no existe. Siempre a una
 * PÁGINA, nunca a un route handler (lib/auth/acciones-acceso.ts explica por qué).
 */
export async function eliminarCuenta(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const admin = await exigirAdmin()

  const resultado = esquema.safeParse({
    user_id: datos.get('user_id'),
    confirmacion: datos.get('confirmacion') ?? '',
  })
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  const { user_id: userId, confirmacion } = resultado.data

  if (userId === admin.user_id) return { error: 'No puedes eliminar tu propia cuenta.' }

  const servicio = crearClienteServiceRole()
  const { data: objetivo } = await servicio
    .from('profiles')
    .select('email, full_name, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (!objetivo) return { error: 'Esa cuenta ya no existe.' }

  const esDelEquipo = objetivo.role === 'admin' || objetivo.role === 'superadmin'
  if (esDelEquipo && admin.role !== 'superadmin') {
    return { error: 'Solo un superadmin puede eliminar a alguien del equipo.' }
  }
  if (confirmacion !== objetivo.email.toLowerCase()) {
    return { error: 'El correo no coincide. Escríbelo tal cual para confirmar.' }
  }

  // Lo que se va, para el registro.
  const [inscripciones, progreso, comentarios, entregas, certificados] = await Promise.all([
    servicio.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    servicio.from('lesson_progress').select('lesson_id', { count: 'exact', head: true }).eq('user_id', userId),
    servicio.from('lesson_comments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    servicio.from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    servicio.from('certificates').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  // 1. El blog se queda, a nombre de quien borra.
  const { data: publicaciones, error: errorPosts } = await servicio
    .from('posts')
    .update({ author_id: admin.user_id })
    .eq('author_id', userId)
    .select('id')
  if (errorPosts) {
    console.error(JSON.stringify({ operacion: 'eliminarCuenta:posts', userId, error: errorPosts.message }))
    return { error: 'No se pudieron reasignar sus publicaciones del blog. No se borró nada.' }
  }

  // 2. Los pagos se quedan, marcados.
  const { error: errorPagos } = await servicio
    .from('payments')
    .update({ account_deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (errorPagos) {
    console.error(JSON.stringify({ operacion: 'eliminarCuenta:pagos', userId, error: errorPagos.message }))
    return { error: 'No se pudieron marcar sus pagos. No se borró nada.' }
  }

  // 3. Punto sin retorno.
  const { error: errorAuth } = await servicio.auth.admin.deleteUser(userId)
  if (errorAuth) {
    console.error(JSON.stringify({ operacion: 'eliminarCuenta:auth', userId, error: errorAuth.message }))
    return { error: `No se pudo eliminar la cuenta: ${errorAuth.message}` }
  }

  // 4. Archivos, tolerante.
  const archivos = await borrarArchivosDeUsuario(servicio, userId)

  // Verificación: la cascada tuvo que llevarse el perfil.
  const { data: sigue } = await servicio.from('profiles').select('user_id').eq('user_id', userId).maybeSingle()
  if (sigue) {
    console.error(JSON.stringify({ operacion: 'eliminarCuenta:perfilSigue', userId }))
    return { error: 'Auth borró la cuenta pero el perfil sigue en la academia. Avisa a Alejandro.' }
  }

  console.log(
    JSON.stringify({
      operacion: 'eliminarCuenta',
      porQuien: admin.email,
      userId,
      email: objetivo.email,
      rol: objetivo.role,
      inscripciones: inscripciones.count ?? 0,
      progreso: progreso.count ?? 0,
      comentarios: comentarios.count ?? 0,
      entregas: entregas.count ?? 0,
      certificados: certificados.count ?? 0,
      publicacionesReasignadas: publicaciones?.length ?? 0,
      archivosBorrados: archivos.borrados,
      advertencias: archivos.advertencias,
    })
  )

  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')
  revalidatePath('/admin')
  redirect(`/admin/alumnos?aviso=eliminado&correo=${encodeURIComponent(objetivo.email)}`)
}
