'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { faltaFuncion, type LlamadaRpc } from '@/lib/alumno/catalogo'
import { exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Empezar un curso gratis del catálogo (M15). La regla vive en la base
 * (`academia_inscribirme_gratis`, academia_0033): solo un curso publicado,
 * marcado en el catálogo y marcado como gratis, y solo para quien llama.
 *
 * Funciona sin JavaScript: el formulario manda el curso y la acción redirige al
 * curso si salió bien, o de vuelta a /cursos con el motivo si no.
 */
const esquema = z.object({ curso: z.uuid('Curso inválido.') })

export async function empezarCursoGratis(datos: FormData): Promise<void> {
  await exigirPerfil()

  const lectura = esquema.safeParse({ curso: datos.get('curso') })
  if (!lectura.success) redirect(`/cursos?error=${encodeURIComponent('No encontramos ese curso.')}`)

  const supabase = await crearClienteServidor()
  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const { data, error } = await rpc('academia_inscribirme_gratis', { curso: lectura.data.curso })

  if (error || typeof data !== 'string') {
    const motivo = faltaFuncion(error)
      ? 'Los cursos gratis llegan en unos minutos. Intenta más tarde.'
      : /generación abierta/i.test(error?.message ?? '')
        ? 'Este curso abre inscripciones en su próxima generación. Vuelve pronto.'
        : 'No pudimos inscribirte en ese curso. Escríbenos si sigue pasando.'
    console.error(JSON.stringify({ operacion: 'empezarCursoGratis', curso: lectura.data.curso, error: error?.message ?? 'sin slug' }))
    redirect(`/cursos?error=${encodeURIComponent(motivo)}`)
  }

  revalidatePath('/cursos')
  revalidatePath('/mis-cursos')
  redirect(`/curso/${data}`)
}
