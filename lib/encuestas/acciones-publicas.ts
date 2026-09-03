'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { darDeAlta } from '@/lib/stripe/provisioning'

import type { EstadoPublico } from './tipos-publicos'

import {
  encuestaPorCodigo,
  entrar,
  participanteActual,
  responder,
  tieneCuenta,
  type DatosDeEntrada,
} from './publico'

/**
 * Lo que puede hacer alguien que llegó por el QR.
 *
 * Son las dos únicas escrituras abiertas a internet de toda la plataforma, así
 * que cada una valida tres cosas antes de tocar la base: que el código exista y
 * la encuesta esté en vivo, que la cookie corresponda a un participante de ESA
 * encuesta, y la cuota por IP. El detalle vive en `publico.ts`.
 */

const esquemaEntrada = z.object({
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(60),
  apellido: z.string().trim().min(2, 'Escribe tu apellido.').max(60),
  email: z.email('Ese correo no se ve bien.').max(160),
  telefono: z
    .string()
    .trim()
    .max(30)
    // Se pide, pero no se exige un formato: en una sala hay quien escribe con
    // lada, quien pone espacios y quien pone guiones, y rechazarle el teléfono
    // a alguien que está intentando participar en vivo es perder el dato y la
    // participación de una vez.
    .default(''),
})

/**
 * Entrar a la encuesta por cualquiera de los tres caminos.
 *
 * El camino "crear cuenta" delega en `darDeAlta()` SIN curso: la persona
 * obtiene cuenta para volver a la siguiente encuesta, no acceso a un curso que
 * no compró. El rol `invitado` es lo que la mantiene fuera de /mis-cursos.
 *
 * Un fallo de correo NUNCA aborta la entrada: la regla de CLAUDE.md es que la
 * cuenta se crea primero y el correo se intenta después. Aquí importa el doble,
 * porque la persona está de pie en un salón esperando contestar.
 */
export async function entrarAEncuesta(
  _previo: EstadoPublico,
  datos: FormData
): Promise<EstadoPublico> {
  const codigo = String(datos.get('codigo') ?? '')
  const encuesta = await encuestaPorCodigo(codigo)
  if (!encuesta) return { error: 'Ese código no existe.' }

  const resultado = esquemaEntrada.safeParse({
    nombre: datos.get('nombre'),
    apellido: datos.get('apellido'),
    email: datos.get('email'),
    telefono: datos.get('telefono') ?? '',
  })
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? 'Revisa tus datos.' }
  }

  // UN SOLO CAMINO (decidido 3-sep-2026). Antes había dos botones —"crear mi
  // cuenta" y "continuar como invitado"— y los dos pedían exactamente los mismos
  // datos, así que la elección no cambiaba nada para quien la hacía: solo lo
  // detenía a decidir, de pie, con el celular en la mano y la pared esperándolo.
  //
  // Ahora se entra y punto, y la cuenta se crea sola. Es lo que pedía el
  // encargo original: "eso les crea una cuenta para siguientes encuestas".
  //
  // `allow_guests` sigue significando algo: apagado, solo entra quien YA tiene
  // cuenta en la academia, que es el caso de una sesión interna.
  if (!encuesta.allowGuests) {
    const yaEsDeLaCasa = await tieneCuenta(resultado.data.email)
    if (!yaEsDeLaCasa) {
      return { error: 'Esta encuesta es solo para quien ya tiene cuenta en la academia.' }
    }
  }

  const entrada = await entrar(encuesta, resultado.data as DatosDeEntrada, {
    crearCuenta: true,
    darDeAlta: async (email, nombre) => {
      const alta = await darDeAlta({
        email,
        nombre,
        rol: 'invitado',
        origen: 'manual',
        urlRedireccion: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/nueva-contrasena`,
      })
      return alta.ok ? (alta.userId ?? null) : null
    },
  })

  if (!entrada.ok) return { error: entrada.motivo }

  revalidatePath(`/e/${encuesta.joinCode}`)
  return { aviso: 'Listo, ya estás dentro.' }
}

const esquemaRespuesta = z.object({
  pregunta_id: z.uuid(),
})

export async function responderEncuesta(
  _previo: EstadoPublico,
  datos: FormData
): Promise<EstadoPublico> {
  const codigo = String(datos.get('codigo') ?? '')
  const encuesta = await encuestaPorCodigo(codigo)
  if (!encuesta) return { error: 'Ese código no existe.' }

  const participante = await participanteActual(encuesta)
  if (!participante) return { error: 'Vuelve a escanear el código para identificarte.' }

  const validado = esquemaRespuesta.safeParse({ pregunta_id: datos.get('pregunta_id') })
  if (!validado.success) return { error: 'Falta la pregunta.' }

  const pregunta = encuesta.preguntas.find((p) => p.id === validado.data.pregunta_id)
  if (!pregunta) return { error: 'Esa pregunta no existe.' }

  const crudo = String(datos.get('valor') ?? '').trim()
  if (crudo === '') return { error: 'Escribe algo antes de enviar.' }

  let valor: { texto?: string; opcion?: string; numero?: number }

  switch (pregunta.tipo) {
    case 'opcion': {
      if (!pregunta.opciones.some((o) => o.id === crudo)) {
        return { error: 'Elige una de las opciones.' }
      }
      valor = { opcion: crudo }
      break
    }
    case 'escala': {
      const numero = Number(crudo)
      const min = pregunta.ajustes.min ?? 1
      const max = pregunta.ajustes.max ?? 10
      if (!Number.isInteger(numero) || numero < min || numero > max) {
        return { error: `Elige un número del ${min} al ${max}.` }
      }
      valor = { numero }
      break
    }
    default: {
      // El tope se recorta en vez de rechazarse: quien acaba de escribir tres
      // renglones en un celular no merece perderlos por un contador.
      const tope = pregunta.ajustes.maxCaracteres ?? 280
      valor = { texto: crudo.slice(0, tope) }
    }
  }

  const guardado = await responder(encuesta, participante, pregunta.id, valor)
  if (!guardado.ok) return { error: guardado.motivo }

  revalidatePath(`/e/${encuesta.joinCode}`)
  return { aviso: '¡Va! Mira la pantalla.' }
}
