import { resumenDeAvisos, type ConteoDeAvisos } from '@/lib/correo/decision'

import type { EstadoAccion } from './tipos'

/**
 * Lo que el panel le dice al equipo después de dar de alta (M25).
 *
 * La regla: decir QUÉ correo le llegó a cada quien y, sobre todo, a quién NO.
 * Antes el Excel decía «3 sin correo enviado» sin decir quiénes, y el equipo
 * tenía que adivinar a quién reenviarle.
 */

const enLista = (valores: string[]) =>
  new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(valores)

/** El alta de UNA persona (formulario de Alumnos o «Todavía no tiene cuenta» del curso). */
export function mensajeDeAltaIndividual(o: {
  email: string
  cursos: string[]
  creado: boolean
  yaEntro: boolean
  conteo: ConteoDeAvisos
}): EstadoAccion {
  const { email, conteo } = o
  const donde = o.cursos.length > 0 ? enLista(o.cursos) : 'la academia'

  const [fallo] = conteo.fallidos
  if (fallo) {
    return {
      error:
        `${email} quedó dado de alta en ${donde}, pero el correo de acceso no salió (${fallo.motivo}). ` +
        'Sin ese correo no puede entrar: usa «Reenviar correo de acceso» en su ficha, o «Reenviar» arriba de Alumnos.',
    }
  }

  if (conteo.omitidos > 0) {
    return { aviso: `${email} quedó en ${donde}. Es una cuenta de prueba: no se le manda correo.` }
  }

  if (conteo.porTipo.nueva_generacion > 0) {
    const generacion = conteo.generaciones[0] ?? 'su nueva generación'
    return {
      aviso:
        `${email} pasó a la ${generacion} y se le avisó por correo con las fechas` +
        (o.yaEntro ? '. Su avance se conserva.' : ', con su liga para crear su contraseña.'),
    }
  }

  if (conteo.porTipo.bienvenida > 0) {
    return {
      aviso: o.creado
        ? `${email} dado de alta en ${donde}. Le llegó la bienvenida con su liga para crear su contraseña.`
        : `${email} ya tenía cuenta pero nunca había entrado: se le agregó ${donde} y le llegó la bienvenida con su liga.`,
    }
  }

  if (conteo.porTipo.nuevo_curso > 0) {
    return { aviso: `${email} ya tenía cuenta; se le agregó ${donde} y se le avisó por correo.` }
  }

  return {
    aviso:
      `${email} ya tenía ${donde} tal cual: no cambió nada y no se mandó correo.` +
      (o.yaEntro ? '' : ' Nunca ha entrado: si lo necesita, usa «Reenviar correo de acceso» en su ficha.'),
  }
}

/** Muchas personas a la vez: el Excel, o varias desde un curso o una ficha. */
export function mensajeDeAltaEnLote(o: {
  /** Lo que pasó con las cuentas, ya redactado: «12 cuentas nuevas», etc. */
  partes: string[]
  conteo: ConteoDeAvisos
  /** Lo que falló antes del correo: altas que no se pudieron hacer. */
  errores: string[]
}): EstadoAccion {
  const { resumen, lista } = resumenDeAvisos(o.conteo)
  const cuerpo = [...o.partes, `Correos: ${resumen}`].filter(Boolean).join('. ') + '.'

  if (o.errores.length > 0 || o.conteo.fallidos.length > 0) {
    const fallidos = o.conteo.fallidos.length
    return {
      error:
        [
          cuerpo,
          ...o.errores,
          fallidos > 0
            ? `A ${fallidos === 1 ? 'esta persona no le salió' : `estas ${fallidos} personas no les salió`} su correo de acceso; reenvíaselo desde «Correos que no salieron», arriba de Alumnos:`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      lista,
    }
  }
  return { aviso: cuerpo }
}
