'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { filasDeArchivo, interpretar } from '@/lib/admin/importar'
import { crearEnlaceDurable } from '@/lib/auth/enlace-durable'
import { exigirAdmin } from '@/lib/auth/sesion'
import { darDeAlta, type RolDeAlta } from '@/lib/stripe/provisioning'

import type { EstadoAccion } from './tipos'

/**
 * Altas que no son de un alumno suelto: gente del equipo y cargas masivas.
 *
 * Viven aparte de `acciones-alumnos.ts` porque tienen reglas distintas — una
 * exige superadmin, la otra procesa archivos — y mezclarlas haría más difícil
 * ver la guarda de escalación, que es la parte delicada.
 */

const urlNuevaContrasena = () =>
  `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nueva-contrasena`

// ---------------------------------------------------------------------------
// Alta de gente del equipo
// ---------------------------------------------------------------------------

const esquemaEquipo = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe el correo.')
    .email('Ese correo no parece válido.')
    .transform((v) => v.toLowerCase()),
  nombre: z.string().trim().max(160),
  rol: z.enum(['admin', 'superadmin']),
})

/**
 * Da de alta a un admin o superadmin.
 *
 * SOLO UN SUPERADMIN PUEDE HACERLO, y no es una formalidad: si un admin pudiera
 * crear admins, cualquiera con ese rol podría darse a sí mismo un segundo correo
 * con más permisos. Es escalación de privilegios por la puerta de enfrente.
 *
 * El trigger `proteger_campos_de_perfil` de la migración `academia_0016` no
 * cubre este camino: el alta va por service role, que salta el trigger a
 * propósito porque es quien provisiona. La única guarda posible está aquí, y por
 * eso queda registrada en el log con quién la ejecutó.
 */
export async function altaDeEquipo(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const perfil = await exigirAdmin()

  if (perfil.role !== 'superadmin') {
    return { error: 'Solo un superadmin puede dar de alta a alguien del equipo.' }
  }

  const resultado = esquemaEquipo.safeParse({
    email: datos.get('email'),
    nombre: datos.get('nombre') ?? '',
    rol: datos.get('rol'),
  })

  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  // Sin curso: alguien del equipo entra por su rol, no por estar inscrito.
  const alta = await darDeAlta({
    email: resultado.data.email,
    nombre: resultado.data.nombre || null,
    rol: resultado.data.rol as RolDeAlta,
    origen: 'manual',
    urlRedireccion: urlNuevaContrasena(),
  })

  if (!alta.ok) return { error: alta.motivo ?? 'No se pudo dar de alta.' }

  console.log(
    JSON.stringify({
      operacion: 'altaDeEquipo',
      porQuien: perfil.email,
      email: resultado.data.email,
      rol: resultado.data.rol,
    })
  )

  revalidatePath('/admin/alumnos')

  const extra = alta.creado ? ' Le llegó el correo para definir su contraseña.' : ''
  return { aviso: `${resultado.data.email} ahora es ${resultado.data.rol}.${extra}` }
}

// ---------------------------------------------------------------------------
// Alta masiva
// ---------------------------------------------------------------------------

/** Tope por carga. Cada fila crea un usuario de auth y manda un correo. */
const LIMITE_FILAS = 300

function plural(n: number, singular: string, plural_: string) {
  return `${n} ${n === 1 ? singular : plural_}`
}

/**
 * Da de alta a mucha gente desde un CSV o un Excel.
 *
 * Se procesa EN SERIE, no en paralelo. Con 40 filas la tentación es lanzar 40
 * altas a la vez, pero cada una crea un usuario de auth y manda un correo: en
 * paralelo se golpean los límites de la Admin API de Supabase y de Resend, y lo
 * que se gana en segundos se pierde en altas a medias.
 *
 * Una fila que falla NO detiene a las demás. Un padrón de 40 con un correo mal
 * escrito tiene que dar de alta a los 39 buenos y reportar el malo, no abortar
 * y dejar el trabajo a medias sin decir por dónde iba.
 */
export async function altaMasiva(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const archivo = datos.get('archivo')
  const cursoId = String(datos.get('course_id') ?? '')
  const cohorteId = String(datos.get('cohort_id') ?? '')

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: 'Elige un archivo CSV o Excel.' }
  }
  if (!cursoId) return { error: 'Elige el curso al que se van a inscribir.' }

  const lectura = await filasDeArchivo(archivo)
  if (!lectura.ok) return { error: lectura.motivo }

  const { personas, descartadas } = interpretar(lectura.filas)

  if (personas.length === 0) {
    const detalle = descartadas[0]
    return {
      error: detalle
        ? `No se encontró ningún correo válido. Fila ${detalle.linea}: ${detalle.motivo}`
        : 'No se encontró ninguna columna de correo en el archivo.',
    }
  }

  if (personas.length > LIMITE_FILAS) {
    return {
      error: `El archivo trae ${personas.length} personas y el tope por carga es ${LIMITE_FILAS}. Divídelo en varios.`,
    }
  }

  let nuevas = 0
  let existentes = 0
  let sinCorreo = 0
  const fallidas: string[] = []

  for (const persona of personas) {
    const alta = await darDeAlta({
      email: persona.email,
      nombre: persona.nombre || null,
      courseId: cursoId,
      cohortId: cohorteId || null,
      origen: 'manual',
      urlRedireccion: urlNuevaContrasena(),
    })

    if (!alta.ok) {
      fallidas.push(persona.email)
      continue
    }

    if (alta.creado) {
      nuevas += 1
      if (!alta.invitado) sinCorreo += 1
    } else {
      existentes += 1
    }
  }

  revalidatePath('/admin/alumnos')

  const partes = [
    plural(nuevas, 'cuenta nueva', 'cuentas nuevas'),
    existentes > 0 ? `${plural(existentes, 'ya existía', 'ya existían')} y se les agregó la inscripción` : null,
    descartadas.length > 0 ? `${plural(descartadas.length, 'fila descartada', 'filas descartadas')}` : null,
    sinCorreo > 0 ? `${sinCorreo} sin correo enviado` : null,
  ].filter(Boolean)

  // Una fila DESCARTADA nunca llegó a intentarse —no traía correo válido—; una
  // FALLIDA sí se intentó y algo salió mal. Son cosas distintas y se reportan
  // por separado, porque piden acciones distintas.
  if (fallidas.length > 0) {
    const muestra = fallidas.slice(0, 5).join(', ')
    const resto = fallidas.length > 5 ? ` y ${fallidas.length - 5} más` : ''
    return { error: `${partes.join(', ')}. No se pudo dar de alta a: ${muestra}${resto}.` }
  }

  return { aviso: `Listo: ${partes.join(', ')}.` }
}

// ---------------------------------------------------------------------------
// Enlace de acceso puntual
// ---------------------------------------------------------------------------

/**
 * Genera un enlace de un solo uso para que alguien entre.
 *
 * Es el respaldo de §11 cuando el correo no llega: en vez de decirle al alumno
 * "revisa tu spam", se le pasa el enlace por WhatsApp y entra. Se devuelve en el
 * aviso y no se guarda en ningún lado — es de un solo uso y caduca solo.
 */
export async function enlaceDeAcceso(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const perfil = await exigirAdmin()

  const email = String(datos.get('email') ?? '').trim().toLowerCase()
  if (!email) return { error: 'Falta el correo.' }

  // Vale 30 días y sobrevive a que se abra dos veces: es lo que se necesita
  // cuando la liga viaja por WhatsApp y la persona la abre cuando puede.
  const enlace = await crearEnlaceDurable({ email, creadoPor: perfil.user_id })
  if (!enlace) return { error: 'No se pudo generar el enlace. ¿Existe esa cuenta?' }

  console.log(JSON.stringify({ operacion: 'enlaceDeAcceso', porQuien: perfil.email, email }))

  return { aviso: enlace }
}
