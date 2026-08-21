'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'

import { plantillaRecuperacion } from '@/lib/correo/plantillas'
import { enviarCorreo } from '@/lib/correo/resend'
import { generarEnlaceDeAcceso } from '@/lib/stripe/provisioning'
import { crearClienteServidor } from '@/lib/supabase/server'

import { traducirError } from './mensajes'
import { RUTAS, rutaDeInicio } from './rutas'
import type { EstadoFormulario } from './tipos'

// --- validación ------------------------------------------------------------

const correo = z
  .string()
  .trim()
  .min(1, 'Escribe tu correo.')
  .email('Ese correo no parece válido.')
  .transform((v) => v.toLowerCase())

const contrasena = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')

const esquemaLogin = z.object({ correo, contrasena: z.string().min(1, 'Escribe tu contraseña.') })
const esquemaRecuperar = z.object({ correo })
const esquemaNuevaContrasena = z
  .object({ contrasena, confirmacion: z.string() })
  .refine((d) => d.contrasena === d.confirmacion, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmacion'],
  })

function primerError(resultado: z.ZodSafeParseResult<unknown>): string {
  return resultado.success ? '' : (resultado.error.issues[0]?.message ?? 'Revisa los datos.')
}

/** URL pública de la app, para armar los redirects de Supabase Auth. */
async function urlDeLaApp(): Promise<string> {
  const configurada = process.env.NEXT_PUBLIC_APP_URL
  if (configurada) return configurada.replace(/\/+$/, '')

  // Respaldo en preview deploys, donde el dominio cambia por rama.
  const cabeceras = await headers()
  const host = cabeceras.get('x-forwarded-host') ?? cabeceras.get('host') ?? 'localhost:3000'
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'
  return `${protocolo}://${host}`
}

// --- entrar con correo y contraseña ----------------------------------------

export async function entrarConContrasena(
  _previo: EstadoFormulario,
  datos: FormData
): Promise<EstadoFormulario> {
  const resultado = esquemaLogin.safeParse({
    correo: datos.get('correo'),
    contrasena: datos.get('contrasena'),
  })

  if (!resultado.success) return { error: primerError(resultado) }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({
    email: resultado.data.correo,
    password: resultado.data.contrasena,
  })

  if (error) {
    console.error(
      JSON.stringify({ operacion: 'entrarConContrasena', correo: resultado.data.correo, error: error.message })
    )
    return { error: traducirError(error.message) }
  }

  // Con la sesión ya escrita, se decide a dónde mandarlo según su rol.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let destino: string = RUTAS.sinAcceso
  if (user) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (perfil && perfil.status === 'active') destino = rutaDeInicio(perfil.role)
  }

  const solicitado = datos.get('destino')
  if (typeof solicitado === 'string' && solicitado.startsWith('/') && destino !== RUTAS.sinAcceso) {
    // Solo rutas internas: un `destino` externo sería un open redirect.
    destino = solicitado
  }

  revalidatePath('/', 'layout')
  redirect(destino)
}

// --- entrar con Google ------------------------------------------------------

/**
 * Devuelve void, no un estado: se usa directo en `<form action>`, que exige una
 * acción sin valor de retorno. Si falla, el error viaja por query string y la
 * página de login lo traduce.
 */
export async function entrarConGoogle(): Promise<void> {
  const supabase = await crearClienteServidor()
  const base = await urlDeLaApp()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${base}/auth/callback` },
  })

  if (error || !data.url) {
    console.error(JSON.stringify({ operacion: 'entrarConGoogle', error: error?.message }))
    redirect(`${RUTAS.login}?error=google`)
  }

  redirect(data.url)
}

// --- recuperar contraseña ---------------------------------------------------

export async function enviarRecuperacion(
  _previo: EstadoFormulario,
  datos: FormData
): Promise<EstadoFormulario> {
  const resultado = esquemaRecuperar.safeParse({ correo: datos.get('correo') })
  if (!resultado.success) return { error: primerError(resultado) }

  // El enlace se genera con service role y el correo lo manda Resend desde
  // nuestro código, no el SMTP de Supabase. Ver lib/correo/resend.ts.
  const enlace = await generarEnlaceDeAcceso(resultado.data.correo, RUTAS.nuevaContrasena)

  if (enlace) {
    const plantilla = plantillaRecuperacion(enlace)
    const envio = await enviarCorreo({
      para: resultado.data.correo,
      asunto: plantilla.asunto,
      html: plantilla.html,
      texto: plantilla.texto,
    })

    if (!envio.ok) {
      console.error(
        JSON.stringify({
          operacion: 'enviarRecuperacion',
          correo: resultado.data.correo,
          error: envio.motivo,
        })
      )
    }
  }

  // Respuesta idéntica exista o no la cuenta: si dijéramos "ese correo no está
  // registrado", cualquiera podría averiguar quién compró el curso. Por eso
  // tampoco se refleja el resultado del envío.
  return {
    aviso:
      'Si ese correo tiene una cuenta, te llegará un enlace para crear una contraseña nueva. Revisa también tu carpeta de spam.',
  }
}

export async function fijarNuevaContrasena(
  _previo: EstadoFormulario,
  datos: FormData
): Promise<EstadoFormulario> {
  const resultado = esquemaNuevaContrasena.safeParse({
    contrasena: datos.get('contrasena'),
    confirmacion: datos.get('confirmacion'),
  })

  if (!resultado.success) return { error: primerError(resultado) }

  const supabase = await crearClienteServidor()

  // El enlace del correo ya dejó una sesión activa; sin ella no hay a quién
  // cambiarle la contraseña.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Ese enlace ya venció. Pide uno nuevo desde "Olvidé mi contraseña".' }
  }

  const { error } = await supabase.auth.updateUser({ password: resultado.data.contrasena })

  if (error) {
    console.error(JSON.stringify({ operacion: 'fijarNuevaContrasena', usuario: user.id, error: error.message }))
    return { error: traducirError(error.message) }
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('user_id', user.id)
    .maybeSingle()

  revalidatePath('/', 'layout')
  redirect(perfil && perfil.status === 'active' ? rutaDeInicio(perfil.role) : RUTAS.sinAcceso)
}

// --- salir ------------------------------------------------------------------

export async function salir(): Promise<void> {
  const supabase = await crearClienteServidor()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect(RUTAS.login)
}
