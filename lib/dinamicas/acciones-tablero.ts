'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import type { EstadoAccion } from '@/lib/admin/tipos'
import { exigirPerfil } from '@/lib/auth/sesion'
import { crearClienteServidor } from '@/lib/supabase/server'

import {
  claveCelda,
  TOPE_ETIQUETA_COLUMNA,
  validarValorDeCelda,
  type ResultadoCelda,
  type TipoFila,
} from './comun'

/**
 * Lo que hace el ALUMNO sobre su tablero: abrirlo, agregar y renombrar
 * proyectos, borrar los suyos y calificar celdas.
 *
 * Todo va con el cliente del usuario y RLS decide: `puede_editar_tablero()`
 * exige ser miembro, dinámica abierta y acceso vigente, y la columna solo la
 * borra quien la creó (o el equipo). Aquí no se repite esa lógica; se
 * traducen sus negativas a un mensaje que dice qué pasó.
 *
 * Dos formas de calificar, a propósito:
 *   - `guardarTablero` recibe el <form> completo (sin JavaScript) y aplica
 *     SOLO las celdas que difieren de lo que la pantalla traía (`orig:`), así
 *     que dos compañeros guardando a la vez no se pisan lo que no tocaron.
 *   - `puntuarCelda` guarda una sola celda al salir de ella (con JavaScript).
 *     No revalida: el sondeo del tablero trae el cambio a todos, incluido a
 *     quien lo hizo.
 */

const MENSAJE_SIN_PERMISO = 'La dinámica ya cerró o tu acceso venció. Recarga.'
const MENSAJE_SOLO_CREADOR = 'Solo quien creó el proyecto o el equipo puede borrarlo.'

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

function primerError(resultado: { error?: { issues: Array<{ message: string }> } }) {
  return resultado.error?.issues[0]?.message ?? 'Revisa los datos.'
}

/** El mapeo del plan: RLS, FK rota y los mensajes del trigger tal cual. */
function mensajeDeError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return MENSAJE_SIN_PERMISO
  if (error.code === '23503') return 'Ese proyecto ya no existe.'
  if (error.code === '22023') return error.message
  return 'No se pudo guardar. Vuelve a intentarlo.'
}

/** Las tres pantallas que pintan este tablero. */
function revalidarTablero(dynamicId: string, boardId: string) {
  revalidatePath(`/dinamicas/${dynamicId}`)
  revalidatePath(`/admin/dinamicas/${dynamicId}/tableros`)
  revalidatePath(`/admin/dinamicas/${dynamicId}/tableros/${boardId}`)
}

const esquemaIds = z.object({
  board_id: z.uuid('Falta el tablero.'),
  dynamic_id: z.uuid('Falta la dinámica.'),
})

const esquemaEtiqueta = z
  .string()
  .trim()
  .min(1, 'Escribe el nombre del proyecto.')
  .max(TOPE_ETIQUETA_COLUMNA, `El nombre no puede pasar de ${TOPE_ETIQUETA_COLUMNA} caracteres.`)

// --------------------------------------------------------------------------
// Abrir el tablero
// --------------------------------------------------------------------------

/**
 * Crea el tablero propio: el de mi empresa, o el mío si no tengo empresa.
 *
 * Si un compañero lo abrió un segundo antes, el índice único devuelve 23505 y
 * eso ES el éxito: ya hay tablero y es el mismo para los dos. Cualquier otra
 * negativa (cerrada, acceso vencido) la pinta la página al volver.
 */
export async function abrirTablero(datos: FormData): Promise<void> {
  const perfil = await exigirPerfil()

  const dynamicId = String(datos.get('dynamic_id') ?? '')
  if (!z.uuid().safeParse(dynamicId).success) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('dynamic_boards').insert({
    dynamic_id: dynamicId,
    company_id: perfil.company_id,
    owner_user_id: perfil.company_id ? null : perfil.user_id,
  })

  if (error && error.code !== '23505') {
    registrarFallo('abrirTablero', { dynamicId, userId: perfil.user_id }, error.message)
  }

  revalidatePath('/dinamicas')
  revalidatePath(`/dinamicas/${dynamicId}`)
  revalidatePath(`/admin/dinamicas/${dynamicId}/tableros`)
  redirect(`/dinamicas/${dynamicId}`)
}

// --------------------------------------------------------------------------
// Proyectos (columnas)
// --------------------------------------------------------------------------

export async function agregarColumna(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const perfil = await exigirPerfil()

  const ids = esquemaIds.safeParse({
    board_id: datos.get('board_id'),
    dynamic_id: datos.get('dynamic_id'),
  })
  if (!ids.success) return { error: primerError(ids) }

  const etiqueta = esquemaEtiqueta.safeParse(datos.get('label'))
  if (!etiqueta.success) return { error: primerError(etiqueta) }

  const supabase = await crearClienteServidor()

  // max + 1. Dos compañeros a la vez pueden empatar la posición; el orden
  // estable lo resuelve (position, created_at, id) al leer.
  const { data: ultima } = await supabase
    .from('dynamic_columns')
    .select('position')
    .eq('board_id', ids.data.board_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('dynamic_columns')
    .insert({
      board_id: ids.data.board_id,
      label: etiqueta.data,
      position: (ultima?.position ?? 0) + 1,
      created_by: perfil.user_id,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    registrarFallo('agregarColumna', { boardId: ids.data.board_id }, error.message)
    return { error: mensajeDeError(error) }
  }
  if (!data) return { error: MENSAJE_SIN_PERMISO }

  revalidarTablero(ids.data.dynamic_id, ids.data.board_id)
  return { aviso: `Proyecto «${etiqueta.data}» agregado.` }
}

export async function renombrarColumna(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirPerfil()

  const ids = esquemaIds.safeParse({
    board_id: datos.get('board_id'),
    dynamic_id: datos.get('dynamic_id'),
  })
  if (!ids.success) return { error: primerError(ids) }

  const columnaId = String(datos.get('column_id') ?? '')
  if (!z.uuid().safeParse(columnaId).success) return { error: 'Falta el proyecto.' }

  const etiqueta = esquemaEtiqueta.safeParse(datos.get('label'))
  if (!etiqueta.success) return { error: primerError(etiqueta) }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('dynamic_columns')
    .update({ label: etiqueta.data })
    .eq('id', columnaId)
    .eq('board_id', ids.data.board_id)
    .select('id')

  if (error) {
    registrarFallo('renombrarColumna', { columnaId }, error.message)
    return { error: mensajeDeError(error) }
  }
  // Cero filas: RLS lo filtró (cerrada, acceso vencido) o ya no existe.
  if (!data || data.length === 0) return { error: MENSAJE_SIN_PERMISO }

  revalidarTablero(ids.data.dynamic_id, ids.data.board_id)
  return { aviso: 'Nombre guardado.' }
}

export async function eliminarColumna(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirPerfil()

  const ids = esquemaIds.safeParse({
    board_id: datos.get('board_id'),
    dynamic_id: datos.get('dynamic_id'),
  })
  if (!ids.success) return { error: primerError(ids) }

  const columnaId = String(datos.get('column_id') ?? '')
  if (!z.uuid().safeParse(columnaId).success) return { error: 'Falta el proyecto.' }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('dynamic_columns')
    .delete()
    .eq('id', columnaId)
    .eq('board_id', ids.data.board_id)
    .select('id')

  if (error) {
    registrarFallo('eliminarColumna', { columnaId }, error.message)
    return { error: mensajeDeError(error) }
  }
  // RLS no avisa: simplemente no borra. Cero filas = no era suyo (o cerró).
  if (!data || data.length === 0) return { error: MENSAJE_SOLO_CREADOR }

  revalidarTablero(ids.data.dynamic_id, ids.data.board_id)
  return { aviso: 'Proyecto eliminado.' }
}

// --------------------------------------------------------------------------
// Celdas
// --------------------------------------------------------------------------

type Cambio = { filaId: string; columnaId: string; valor: string; orig: string }

/** Las entradas `celda:{fila}:{col}` que difieren de su `orig:{fila}:{col}`. */
function leerCambios(datos: FormData): Cambio[] {
  const cambios: Cambio[] = []
  for (const [nombre, valor] of datos.entries()) {
    if (!nombre.startsWith('celda:') || typeof valor !== 'string') continue
    const [, filaId, columnaId] = nombre.split(':')
    if (!filaId || !columnaId) continue
    const orig = datos.get(`orig:${filaId}:${columnaId}`)
    const origTexto = typeof orig === 'string' ? orig.trim() : ''
    if (valor.trim() === origTexto) continue
    cambios.push({ filaId, columnaId, valor, orig: origTexto })
  }
  return cambios
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/**
 * El <form> completo del tablero, sin JavaScript.
 *
 * Solo se tocan las celdas que la persona cambió respecto a lo que su pantalla
 * traía. Si mientras tanto un compañero cambió una de ESAS, gana quien guarda
 * ahora —es la regla de la dinámica— pero se le dice cuántas eran.
 */
export async function guardarTablero(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const perfil = await exigirPerfil()

  const ids = esquemaIds.safeParse({
    board_id: datos.get('board_id'),
    dynamic_id: datos.get('dynamic_id'),
  })
  if (!ids.success) return { error: primerError(ids) }
  const { board_id: boardId, dynamic_id: dynamicId } = ids.data

  const cambios = leerCambios(datos)
  if (cambios.length === 0) return { aviso: 'No cambiaste ninguna celda.' }

  const supabase = await crearClienteServidor()
  const [dinamica, filas, actuales] = await Promise.all([
    supabase.from('dynamics').select('scale_min, scale_max').eq('id', dynamicId).maybeSingle(),
    supabase.from('dynamic_rows').select('id, row_kind, label').eq('dynamic_id', dynamicId),
    supabase
      .from('dynamic_cells')
      .select('row_id, column_id, numeric_value, text_value')
      .eq('board_id', boardId),
  ])

  if (!dinamica.data) return { error: 'Esa dinámica ya no existe.' }
  const escala = { min: dinamica.data.scale_min, max: dinamica.data.scale_max }
  const filaPorId = new Map((filas.data ?? []).map((f) => [f.id, f]))
  const actualPorClave = new Map(
    (actuales.data ?? []).map((c) => [
      claveCelda(c.row_id, c.column_id),
      c.numeric_value !== null ? String(c.numeric_value) : (c.text_value ?? ''),
    ])
  )

  const altas: Array<{
    board_id: string
    column_id: string
    row_id: string
    numeric_value: number | null
    text_value: string | null
    updated_by: string
  }> = []
  const bajas: Cambio[] = []
  let pisadas = 0

  for (const cambio of cambios) {
    const fila = filaPorId.get(cambio.filaId)
    if (!fila) return { error: 'Una de las filas ya no existe. Recarga.' }

    const valor = validarValorDeCelda({ tipo: fila.row_kind }, escala, cambio.valor)
    if (!valor.ok) return { error: `${fila.label}: ${valor.error}` }

    const clave = claveCelda(cambio.filaId, cambio.columnaId)
    if ((actualPorClave.get(clave) ?? '') !== cambio.orig) pisadas += 1

    if (valor.numero === null && valor.texto === null) {
      // Vaciar = borrar. Solo si había algo que borrar.
      if (actualPorClave.has(clave)) bajas.push(cambio)
    } else {
      altas.push({
        board_id: boardId,
        column_id: cambio.columnaId,
        row_id: cambio.filaId,
        numeric_value: valor.numero,
        text_value: valor.texto,
        updated_by: perfil.user_id,
      })
    }
  }

  if (altas.length > 0) {
    const { data, error } = await supabase
      .from('dynamic_cells')
      .upsert(altas, { onConflict: 'column_id,row_id' })
      .select('id')

    if (error) {
      registrarFallo('guardarTablero', { boardId, altas: altas.length }, error.message)
      return { error: mensajeDeError(error) }
    }
    if ((data?.length ?? 0) < altas.length) return { error: MENSAJE_SIN_PERMISO }
  }

  if (bajas.length > 0) {
    const resultados = await Promise.all(
      bajas.map((b) =>
        supabase
          .from('dynamic_cells')
          .delete()
          .eq('board_id', boardId)
          .eq('column_id', b.columnaId)
          .eq('row_id', b.filaId)
          .select('id')
      )
    )
    for (const r of resultados) {
      if (r.error) {
        registrarFallo('guardarTablero', { boardId, bajas: bajas.length }, r.error.message)
        return { error: mensajeDeError(r.error) }
      }
      if (!r.data || r.data.length === 0) return { error: MENSAJE_SIN_PERMISO }
    }
  }

  revalidarTablero(dynamicId, boardId)

  const n = altas.length + bajas.length
  let aviso = `Guardado: ${plural(n, 'cambio', 'cambios')}.`
  if (pisadas > 0) {
    aviso +=
      pisadas === 1
        ? ' 1 celda la había cambiado alguien más; se aplicó tu valor.'
        : ` ${pisadas} celdas las había cambiado alguien más; se aplicó tu valor.`
  }
  return { aviso }
}

const esquemaCelda = z.object({
  boardId: z.uuid(),
  rowId: z.uuid(),
  columnId: z.uuid(),
  valor: z.string().max(200),
})

/**
 * Una celda, al salir de ella (con JavaScript, en `useTransition`).
 *
 * Argumentos planos y sin `revalidatePath` a propósito: el tablero ya sondea
 * la versión y se refresca solo cuando cambia; revalidar aquí dispararía un
 * repintado por cada celda que el compañero de al lado va llenando.
 */
export async function puntuarCelda(entrada: {
  boardId: string
  rowId: string
  columnId: string
  valor: string
}): Promise<ResultadoCelda> {
  const perfil = await exigirPerfil()

  const r = esquemaCelda.safeParse(entrada)
  if (!r.success) return { ok: false, error: 'Revisa la celda.' }
  const { boardId, rowId, columnId, valor } = r.data

  const supabase = await crearClienteServidor()

  // Un viaje: la fila con la escala de su dinámica.
  const { data: fila } = await supabase
    .from('dynamic_rows')
    .select('row_kind, dynamics(scale_min, scale_max)')
    .eq('id', rowId)
    .maybeSingle()

  type FilaConEscala = {
    row_kind: TipoFila
    dynamics: { scale_min: number; scale_max: number } | null
  }
  const f = fila as unknown as FilaConEscala | null
  if (!f || !f.dynamics) return { ok: false, error: 'Esa fila ya no existe. Recarga.' }

  const validado = validarValorDeCelda(
    { tipo: f.row_kind },
    { min: f.dynamics.scale_min, max: f.dynamics.scale_max },
    valor
  )
  if (!validado.ok) return validado

  if (validado.numero === null && validado.texto === null) {
    // Vaciar = borrar. Si no borró nada, o no había celda o RLS lo filtró.
    const { data, error } = await supabase
      .from('dynamic_cells')
      .delete()
      .eq('board_id', boardId)
      .eq('column_id', columnId)
      .eq('row_id', rowId)
      .select('id')

    if (error) {
      registrarFallo('puntuarCelda', { boardId, rowId, columnId }, error.message)
      return { ok: false, error: mensajeDeError(error) }
    }
    if (!data || data.length === 0) {
      const { data: sigue } = await supabase
        .from('dynamic_cells')
        .select('id')
        .eq('column_id', columnId)
        .eq('row_id', rowId)
        .maybeSingle()
      if (sigue) return { ok: false, error: MENSAJE_SIN_PERMISO }
    }
    return validado
  }

  const { data, error } = await supabase
    .from('dynamic_cells')
    .upsert(
      {
        board_id: boardId,
        column_id: columnId,
        row_id: rowId,
        numeric_value: validado.numero,
        text_value: validado.texto,
        updated_by: perfil.user_id,
      },
      { onConflict: 'column_id,row_id' }
    )
    .select('id')

  if (error) {
    registrarFallo('puntuarCelda', { boardId, rowId, columnId }, error.message)
    return { ok: false, error: mensajeDeError(error) }
  }
  if (!data || data.length === 0) return { ok: false, error: MENSAJE_SIN_PERMISO }

  return validado
}
