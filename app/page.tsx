import { redirect } from 'next/navigation'

import { obtenerSesion } from '@/lib/auth/sesion'
import { RUTAS, rutaDeInicio } from '@/lib/auth/rutas'

export const dynamic = 'force-dynamic'

/**
 * La raíz no dibuja nada: manda a donde corresponde.
 *
 * Antes había aquí una portada con una sonda de conexión a Supabase y una lista
 * del avance por milestone. Servía como smoke test durante el scaffold, pero
 * como página pública era un error: le contaba a cualquier visitante qué base
 * de datos usamos, cómo se llama el schema y qué partes del producto estaban a
 * medias — y encima esa lista se quedó desactualizada, que es lo que le pasa
 * siempre a un tablero de progreso puesto en una portada.
 *
 * Esto es una plataforma privada: la puerta es el login, y para quien ya entró
 * la puerta debe abrirse sola hacia su lugar. Un alumno cae en /mis-cursos y un
 * admin en /admin, sin pasar por una pantalla intermedia que no le dice nada.
 */
export default async function Raiz() {
  const sesion = await obtenerSesion()

  if (sesion.tipo === 'activo') redirect(rutaDeInicio(sesion.perfil.role))
  if (sesion.tipo === 'sinPerfil' || sesion.tipo === 'suspendido') redirect(RUTAS.sinAcceso)

  redirect(RUTAS.login)
}
