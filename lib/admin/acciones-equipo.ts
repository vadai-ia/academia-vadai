'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { filasDeArchivo, interpretar } from '@/lib/admin/importar'
import { exigirAdmin } from '@/lib/auth/sesion'
import {
  darDeAlta,
  generarEnlaceDeAcceso,
  type RolDeAlta,
} from '@/lib/stripe/provisioning'

import { enLista, revisarSeleccion } from './seleccion-de-cursos'
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
 *
 * Todo el archivo entra a los MISMOS cursos, uno o varios. Por persona se llama
 * a `darDeAlta` una vez por curso: la primera crea la cuenta y manda el único
 * correo —que nombra todos los cursos—, las demás solo agregan su inscripción.
 */
export async function altaMasiva(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const archivo = datos.get('archivo')

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: 'Elige un archivo CSV o Excel.' }
  }

  // Los cursos se revisan ANTES de leer el archivo y de crear a nadie: un grupo
  // que no existe se descubre aquí, no en la persona veintitrés.
  const seleccion = await revisarSeleccion(
    datos.getAll('accesos').filter((v): v is string => typeof v === 'string')
  )
  if (!seleccion.ok) return { error: seleccion.error }
  const titulos = seleccion.cursos.map((c) => c.titulo)

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
  /** Entraron a la academia, pero no a todos los cursos marcados. */
  const aMedias: string[] = []

  for (const persona of personas) {
    let completa = true

    for (const [i, curso] of seleccion.cursos.entries()) {
      const alta = await darDeAlta({
        email: persona.email,
        nombre: persona.nombre || null,
        courseId: curso.id,
        cohortId: curso.cohorteId,
        origen: 'manual',
        urlRedireccion: urlNuevaContrasena(),
        titulosParaCorreo: titulos,
      })

      if (!alta.ok) {
        completa = false
        // Si falló el primero no hay cuenta: es una fallida. Si falló uno
        // posterior, la persona ya existe y le falta un curso.
        if (i === 0) fallidas.push(persona.email)
        else aMedias.push(persona.email)
        break
      }

      // Solo la primera llamada dice si la cuenta es nueva y si salió su correo.
      if (i === 0) {
        if (alta.creado) {
          nuevas += 1
          if (!alta.invitado) sinCorreo += 1
        } else {
          existentes += 1
        }
      }
    }

    if (!completa) continue
  }

  revalidatePath('/admin/alumnos')
  revalidatePath('/admin/cursos')
  for (const curso of seleccion.cursos) revalidatePath(`/admin/cursos/${curso.id}`)

  const partes = [
    plural(nuevas, 'cuenta nueva', 'cuentas nuevas'),
    existentes > 0 ? `${plural(existentes, 'ya existía', 'ya existían')} y se les agregó la inscripción` : null,
    aMedias.length > 0 ? `${aMedias.length} sin todos los cursos` : null,
    descartadas.length > 0 ? `${plural(descartadas.length, 'fila descartada', 'filas descartadas')}` : null,
    sinCorreo > 0 ? `${sinCorreo} sin correo enviado` : null,
  ].filter(Boolean)

  // Una fila DESCARTADA nunca llegó a intentarse —no traía correo válido—; una
  // FALLIDA sí se intentó y algo salió mal. Son cosas distintas y se reportan
  // por separado, porque piden acciones distintas.
  const muestra = (lista: string[]) =>
    lista.slice(0, 5).join(', ') + (lista.length > 5 ? ` y ${lista.length - 5} más` : '')

  if (fallidas.length > 0 || aMedias.length > 0) {
    return {
      error:
        `${partes.join(', ')}.` +
        (fallidas.length > 0 ? ` No se pudo dar de alta a: ${muestra(fallidas)}.` : '') +
        (aMedias.length > 0
          ? ` Les faltó algún curso a: ${muestra(aMedias)}. Vuelve a subir el archivo: no duplica nada.`
          : ''),
    }
  }

  return { aviso: `Listo, en ${enLista(titulos)}: ${partes.join(', ')}.` }
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

  const enlace = await generarEnlaceDeAcceso(email)
  if (!enlace) return { error: 'No se pudo generar el enlace. ¿Existe esa cuenta?' }

  console.log(JSON.stringify({ operacion: 'enlaceDeAcceso', porQuien: perfil.email, email }))

  return { aviso: enlace }
}
