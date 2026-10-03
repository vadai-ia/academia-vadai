'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { cdmxAUtc, diaDeLaSemana, sumarDias } from '@/lib/admin/fechas'
import type { LlamadaRpc } from '@/lib/alumno/catalogo'
import { crearEnlacesDurables } from '@/lib/auth/enlace-durable'
import { RUTAS } from '@/lib/auth/rutas'
import { exigirAdmin } from '@/lib/auth/sesion'
import { describirHorario, enlaceGoogle, enlaceOutlook } from '@/lib/calendario/enlaces'
import { urlIcsDeCohorte } from '@/lib/calendario/firma'
import { hoyCdmx } from '@/lib/calendario/mes'
import { plantillaCalendario } from '@/lib/correo/plantillas'
import { enviarCorreosEnLote } from '@/lib/correo/resend'
import { crearClienteServidor } from '@/lib/supabase/server'

import type { EstadoAccion } from './tipos'

/**
 * Generaciones y sesiones en vivo (§3.10, M16).
 *
 * Sobre la hora: el formulario captura en horario de CDMX, porque es como piensa
 * el equipo ("la sesión es a las 7 de la noche"). Se convierte a UTC aquí y se
 * guarda en `timestamptz`. La UI del alumno la vuelve a convertir a SU hora
 * local, mostrando CDMX como referencia. Nunca se guarda texto de hora local:
 * eso se rompe solo en el cambio de horario.
 */

const esquemaGeneracion = z.object({
  course_id: z.uuid('Curso inválido.'),
  name: z.string().trim().min(2, 'La generación necesita un nombre.').max(120),
  starts_on: z.string().trim().nullable(),
  ends_on: z.string().trim().nullable(),
})

const esquemaSesion = z.object({
  title: z.string().trim().min(2, 'La sesión necesita un título.').max(200),
  fecha: z.string().trim().min(10, 'Falta la fecha.'),
  hora: z.string().trim().min(4, 'Falta la hora.'),
  meet_url: z.string().trim(),
  description: z.string().trim(),
})

function primerError(resultado: { error?: { issues: Array<{ message: string }> } }) {
  return resultado.error?.issues[0]?.message ?? 'Revisa los datos.'
}

function registrarFallo(operacion: string, detalle: Record<string, unknown>, error: string) {
  console.error(JSON.stringify({ operacion, ...detalle, error }))
}

const vacioANull = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

/** El error de la base, traducido: lo que un trigger dice ya viene en español. */
function mensajeDeBase(error: { message: string; code?: string }, porOmision: string): string {
  if (/cohorts_fechas_coherentes/.test(error.message)) {
    return 'La fecha de fin no puede ser anterior a la de inicio.'
  }
  if (/cohorts_una_abierta_por_curso/.test(error.message)) {
    return 'Este curso ya tiene una generación abierta a inscripciones. Ciérrala primero.'
  }
  if (error.code === '23514' || error.code === '22023') return error.message
  return porOmision
}

/** Las páginas que pintan generaciones: el curso y el panel principal. */
function revalidarCurso(cursoId: string) {
  revalidatePath(`/admin/cursos/${cursoId}`)
  revalidatePath('/admin')
}

// `cdmxAUtc` (CDMX -> UTC) vive en lib/admin/fechas.ts desde M13: la fecha
// límite de una dinámica se captura igual que la hora de una sesión.

// ==========================================================================
// Generaciones
// ==========================================================================

/**
 * Crea una generación (M16). Tres puntos de partida, según el curso:
 *
 *   - Curso sin generaciones: el contenido que ya tiene PASA a esta primera
 *     generación (`academia_activar_generaciones`), y el curso queda «por
 *     generaciones». No se copia: el progreso de los alumnos sigue valiendo.
 *   - Curso con generaciones y `copiar_de`: copia la estructura de esa
 *     generación —módulos, lecciones, adjuntos, quizzes, tareas— sin videos ni
 *     grabaciones, con las lecciones en borrador (`academia_copiar_generacion`).
 *   - Curso con generaciones sin `copiar_de`: nace vacía.
 *
 * Con «Abrir a inscripciones» marcada, pasa a ser la generación donde caen las
 * compras y las altas sin elección; la que estuviera abierta se cierra.
 *
 * Al terminar va a la pestaña de la generación nueva, con el aviso en la URL.
 */
export async function crearGeneracion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquemaGeneracion.safeParse({
    course_id: datos.get('course_id'),
    name: datos.get('name'),
    starts_on: vacioANull(datos.get('starts_on')),
    ends_on: vacioANull(datos.get('ends_on')),
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const copiarDe = String(datos.get('copiar_de') ?? '').trim()
  if (copiarDe && !z.uuid().safeParse(copiarDe).success) return { error: 'Generación de origen inválida.' }
  const abrir = datos.get('abrir_inscripciones') !== null
  const cursoId = resultado.data.course_id

  const supabase = await crearClienteServidor()
  const { data: curso } = await supabase
    .from('courses')
    .select('course_type')
    .eq('id', cursoId)
    .maybeSingle()
  if (!curso) return { error: 'El curso no existe.' }

  const { data: creada, error } = await supabase
    .from('cohorts')
    .insert(resultado.data)
    .select('id')
    .maybeSingle()

  if (error || !creada) {
    registrarFallo('crearGeneracion', { curso: cursoId }, error?.message ?? 'sin id')
    return {
      error: error ? mensajeDeBase(error, 'No se pudo crear la generación.') : 'No se pudo crear la generación.',
    }
  }

  const rpc = (supabase.rpc as unknown as LlamadaRpc).bind(supabase)
  const partes: string[] = []

  if (curso.course_type !== 'cohort') {
    // La primera generación de un curso: se lleva lo que ya había.
    const { data, error: errorActivar } = await rpc('academia_activar_generaciones', {
      curso: cursoId,
      generacion: creada.id,
    })
    if (errorActivar) {
      registrarFallo('crearGeneracion:activar', { curso: cursoId, generacion: creada.id }, errorActivar.message)
      await supabase.from('cohorts').delete().eq('id', creada.id)
      return { error: mensajeDeBase(errorActivar, 'No se pudo convertir el curso a generaciones.') }
    }
    const movidos = typeof data === 'number' ? data : 0
    partes.push(
      movidos > 0
        ? `El curso ya es por generaciones: sus ${movidos} módulo${movidos === 1 ? '' : 's'} pasaron a esta generación.`
        : 'El curso ya es por generaciones.'
    )
  } else if (copiarDe) {
    const { data, error: errorCopia } = await rpc('academia_copiar_generacion', {
      origen: copiarDe,
      destino: creada.id,
    })
    if (errorCopia) {
      registrarFallo('crearGeneracion:copiar', { origen: copiarDe, destino: creada.id }, errorCopia.message)
      await supabase.from('cohorts').delete().eq('id', creada.id)
      return { error: mensajeDeBase(errorCopia, 'No se pudo copiar la estructura.') }
    }
    const n = (data ?? {}) as Partial<Record<'modulos' | 'lecciones' | 'adjuntos' | 'quizzes' | 'tareas', number>>
    partes.push(
      `Se copiaron ${n.modulos ?? 0} módulos y ${n.lecciones ?? 0} lecciones` +
        (n.adjuntos ? `, ${n.adjuntos} adjuntos` : '') +
        (n.quizzes ? `, ${n.quizzes} quizzes` : '') +
        (n.tareas ? `, ${n.tareas} tareas` : '') +
        '. Las lecciones quedaron en borrador y sin video: súbelos y publícalas cuando toque.'
    )
  }

  if (abrir) {
    const abierta = await abrirSoloEsta(cursoId, creada.id)
    partes.push(abierta.ok ? 'Abierta a inscripciones.' : abierta.error)
  }

  revalidarCurso(cursoId)
  const aviso = ['Generación creada.', ...partes].join(' ')
  redirect(`/admin/cursos/${cursoId}?gen=${creada.id}&aviso=${encodeURIComponent(aviso)}`)
}

/** Cierra la que estuviera abierta y abre esta. Dos pasos: el índice único manda. */
async function abrirSoloEsta(cursoId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await crearClienteServidor()
  const cierre = await supabase
    .from('cohorts')
    .update({ open_for_enrollment: false })
    .eq('course_id', cursoId)
    .neq('id', id)
    .eq('open_for_enrollment', true)
  if (cierre.error) {
    registrarFallo('abrirInscripciones:cerrarOtras', { cursoId, id }, cierre.error.message)
    return { ok: false, error: 'No se pudo cerrar la generación que estaba abierta.' }
  }
  const { error } = await supabase.from('cohorts').update({ open_for_enrollment: true }).eq('id', id)
  if (error) {
    registrarFallo('abrirInscripciones', { id }, error.message)
    return { ok: false, error: mensajeDeBase(error, 'No se pudo abrir a inscripciones.') }
  }
  return { ok: true }
}

const esquemaEdicion = esquemaGeneracion.extend({ id: z.uuid('Generación inválida.') })

/** Nombre y fechas. El resto —abrir, terminar— tiene su propio botón. */
export async function actualizarGeneracion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquemaEdicion.safeParse({
    id: datos.get('id'),
    course_id: datos.get('course_id'),
    name: datos.get('name'),
    starts_on: vacioANull(datos.get('starts_on')),
    ends_on: vacioANull(datos.get('ends_on')),
  })
  if (!resultado.success) return { error: primerError(resultado) }
  const { id, course_id: cursoId, ...cambios } = resultado.data

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohorts').update(cambios).eq('id', id)
  if (error) {
    registrarFallo('actualizarGeneracion', { id }, error.message)
    return { error: mensajeDeBase(error, 'No se pudo guardar la generación.') }
  }

  revalidarCurso(cursoId)
  return { aviso: 'Generación guardada.' }
}

function leerIds(datos: FormData): { id: string; cursoId: string } | null {
  const id = String(datos.get('id') ?? '')
  const cursoId = String(datos.get('course_id') ?? '')
  return id && cursoId ? { id, cursoId } : null
}

/** La generación donde caen compras, catálogo y altas sin elección. Solo una por curso. */
export async function abrirInscripciones(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()
  const ids = leerIds(datos)
  if (!ids) return { error: 'Falta la generación.' }

  const hecho = await abrirSoloEsta(ids.cursoId, ids.id)
  if (!hecho.ok) return { error: hecho.error }

  revalidarCurso(ids.cursoId)
  revalidatePath('/cursos')
  return { aviso: 'Abierta a inscripciones. Las compras y las altas nuevas caen aquí.' }
}

export async function cerrarInscripciones(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()
  const ids = leerIds(datos)
  if (!ids) return { error: 'Falta la generación.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohorts').update({ open_for_enrollment: false }).eq('id', ids.id)
  if (error) {
    registrarFallo('cerrarInscripciones', { id: ids.id }, error.message)
    return { error: 'No se pudo cerrar.' }
  }

  revalidarCurso(ids.cursoId)
  revalidatePath('/cursos')
  return { aviso: 'Cerrada a inscripciones. El curso deja de ofrecerse hasta que abras otra generación.' }
}

/**
 * «Terminada» no es una columna: es que ya pasó `ends_on`. Marcarla pone la
 * fecha de fin en ayer (si no la tenía o estaba en el futuro) y cierra las
 * inscripciones. Los alumnos siguen viendo todo mientras su acceso al curso
 * esté vigente (decisión 6, 3-oct-2026).
 */
export async function marcarTerminada(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()
  const ids = leerIds(datos)
  if (!ids) return { error: 'Falta la generación.' }

  const supabase = await crearClienteServidor()
  const { data: actual } = await supabase.from('cohorts').select('ends_on').eq('id', ids.id).maybeSingle()
  const hoy = hoyCdmx()
  const ayer = sumarDias(hoy, -1)
  const ends_on = actual?.ends_on && actual.ends_on < hoy ? actual.ends_on : ayer

  const { error } = await supabase
    .from('cohorts')
    .update({ ends_on, open_for_enrollment: false })
    .eq('id', ids.id)
  if (error) {
    registrarFallo('marcarTerminada', { id: ids.id }, error.message)
    return { error: mensajeDeBase(error, 'No se pudo marcar como terminada.') }
  }

  revalidarCurso(ids.cursoId)
  return { aviso: 'Generación terminada. Sus alumnos conservan el acceso mientras les dure.' }
}

/** Quita la fecha de fin: vuelve a estar en curso. La fecha se corrige en «Editar». */
export async function reabrirGeneracion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()
  const ids = leerIds(datos)
  if (!ids) return { error: 'Falta la generación.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohorts').update({ ends_on: null }).eq('id', ids.id)
  if (error) {
    registrarFallo('reabrirGeneracion', { id: ids.id }, error.message)
    return { error: 'No se pudo reabrir.' }
  }

  revalidarCurso(ids.cursoId)
  return { aviso: 'Generación en curso otra vez. Ponle su fecha de fin en «Editar».' }
}

/**
 * Con confirmación en modal (M14): devuelve el error si lo hay; si no, va al
 * curso. Una generación con módulos no se borra (FK `restrict`): primero se
 * borran o se mueven, para que no desaparezca contenido con progreso detrás.
 */
export async function eliminarGeneracion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const ids = leerIds(datos)
  if (!ids) return { error: 'Falta la generación.' }

  // Las inscripciones NO se borran: cohort_id es `on delete set null`, así que
  // el alumno conserva su acceso y queda «sin generación» hasta que se le
  // asigne otra.
  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohorts').delete().eq('id', ids.id)

  if (error) {
    registrarFallo('eliminarGeneracion', { id: ids.id }, error.message)
    return {
      error:
        error.code === '23503'
          ? 'Esta generación tiene módulos. Bórralos primero (o muévelos) y vuelve a intentarlo.'
          : 'No se pudo eliminar la generación. Inténtalo otra vez.',
    }
  }

  revalidarCurso(ids.cursoId)
  redirect(`/admin/cursos/${ids.cursoId}`)
}

// ==========================================================================
// Sesiones
// ==========================================================================

export async function crearSesion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const cohorteId = String(datos.get('cohort_id') ?? '')
  if (!cohorteId) return { error: 'Falta la generación.' }

  const resultado = esquemaSesion.safeParse({
    title: datos.get('title'),
    fecha: datos.get('fecha'),
    hora: datos.get('hora'),
    meet_url: datos.get('meet_url') ?? '',
    description: datos.get('description') ?? '',
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const enUtc = cdmxAUtc(resultado.data.fecha, resultado.data.hora)
  if (!enUtc) return { error: 'La fecha o la hora no son válidas.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohort_sessions').insert({
    cohort_id: cohorteId,
    title: resultado.data.title,
    scheduled_at: enUtc,
    meet_url: resultado.data.meet_url || null,
    description: resultado.data.description || null,
  })

  if (error) {
    registrarFallo('crearSesion', { cohorteId }, error.message)
    return { error: 'No se pudo crear la sesión.' }
  }

  revalidatePath('/admin/cursos/[id]', 'page')
  // También se agenda desde el panel principal, que lista las próximas.
  revalidatePath('/admin')
  return { aviso: 'Sesión agendada.' }
}

/**
 * Edita una sesión ya agendada: título, fecha, hora, liga y descripción.
 *
 * No existía (20-sep-2026): para cambiar una hora había que borrar la sesión
 * y volverla a crear, y el formulario nuevo salía vacío. Ahora cada sesión
 * trae su formulario con lo que ya tiene, en hora CDMX (`utcACdmx`).
 */
export async function actualizarSesion(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return

  const resultado = esquemaSesion.safeParse({
    title: datos.get('title'),
    fecha: datos.get('fecha'),
    hora: datos.get('hora'),
    meet_url: datos.get('meet_url') ?? '',
    description: datos.get('description') ?? '',
  })
  if (!resultado.success) {
    registrarFallo('actualizarSesion', { id }, primerError(resultado))
    return
  }

  const enUtc = cdmxAUtc(resultado.data.fecha, resultado.data.hora)
  if (!enUtc) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('cohort_sessions')
    .update({
      title: resultado.data.title,
      scheduled_at: enUtc,
      meet_url: resultado.data.meet_url || null,
      description: resultado.data.description || null,
    })
    .eq('id', id)

  if (error) registrarFallo('actualizarSesion', { id }, error.message)

  revalidatePath('/admin/cursos/[id]', 'page')
  revalidatePath('/admin')
}

/**
 * Manda por correo las fechas de las sesiones en vivo de la generación, con
 * botones de calendario (pedido 21-sep-2026). Con `para` manda una PRUEBA
 * solo a esa dirección; sin `para`, a todos los inscritos activos de la
 * generación, en lote. Solo las sesiones futuras (o de hoy).
 */
export async function enviarCalendarioPorCorreo(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  const admin = await exigirAdmin()

  const cohorteId = String(datos.get('cohort_id') ?? '')
  const para = String(datos.get('para') ?? '').trim().toLowerCase()
  if (!cohorteId) return { error: 'Falta la generación.' }
  if (para && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(para)) return { error: 'Ese correo no parece válido.' }

  const supabase = await crearClienteServidor()
  const [{ data: cohorte }, { data: sesiones }] = await Promise.all([
    supabase.from('cohorts').select('id, name, course_id').eq('id', cohorteId).maybeSingle(),
    supabase
      .from('cohort_sessions')
      .select('id, title, description, scheduled_at, meet_url')
      .eq('cohort_id', cohorteId)
      .gte('scheduled_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .order('scheduled_at'),
  ])
  if (!cohorte) return { error: 'La generación no existe.' }
  if (!sesiones || sesiones.length === 0) return { error: 'No hay sesiones futuras que mandar.' }

  const { data: curso } = await supabase.from('courses').select('title').eq('id', cohorte.course_id).maybeSingle()
  const tituloCurso = curso?.title ?? 'tu curso'
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')

  const paraCorreo = sesiones.map((s) => {
    const datosSesion = {
      id: s.id,
      titulo: s.title,
      descripcion: s.description,
      inicio: s.scheduled_at,
      ligaUrl: s.meet_url,
      curso: tituloCurso,
    }
    return {
      id: s.id,
      titulo: s.title,
      inicio: s.scheduled_at,
      ligaUrl: s.meet_url,
      horario: describirHorario(s.scheduled_at),
      google: enlaceGoogle(datosSesion),
      outlook: enlaceOutlook(datosSesion),
    }
  })
  const urlTodas = urlIcsDeCohorte(base, cohorteId)

  // A quién: la prueba, o todos los inscritos activos de la generación. Quien
  // NUNCA ha entrado recibe además su liga de acceso (30 días): el correo de
  // fechas es el que abren el día de la sesión, y desde ahí mismo entran.
  let destinatarios: Array<{ email: string; nombre: string | null; urlAcceso: string | null }>
  if (para) {
    // En la prueba el botón de acceso lleva al login: no se acuña una liga
    // real para una dirección que no es la de un alumno.
    destinatarios = [{ email: para, nombre: admin.full_name, urlAcceso: `${base}${RUTAS.login}` }]
  } else {
    const { data: inscripciones } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('cohort_id', cohorteId)
      .eq('status', 'active')
    const ids = (inscripciones ?? []).map((e) => e.user_id)
    const { data: perfiles } = ids.length
      ? await supabase
          .from('profiles')
          .select('user_id, email, full_name, role, status, last_sign_in_at')
          .in('user_id', ids)
      : { data: [] }
    const alumnos = (perfiles ?? []).filter((p) => p.role === 'alumno' && p.status === 'active')

    const sinEntrar = alumnos.filter((p) => p.last_sign_in_at == null).map((p) => p.email)
    const ligas = await crearEnlacesDurables({ emails: sinEntrar, creadoPor: admin.user_id })

    destinatarios = alumnos.map((p) => ({
      email: p.email,
      nombre: p.full_name,
      urlAcceso: ligas.get(p.email) ?? null,
    }))
  }
  const conAcceso = para ? 0 : destinatarios.filter((d) => d.urlAcceso).length

  const correos = destinatarios.map((d) => {
    const plantilla = plantillaCalendario({
      nombre: d.nombre,
      curso: tituloCurso,
      sesiones: paraCorreo,
      urlTodas,
      urlAcceso: d.urlAcceso,
      base,
    })
    return {
      para: d.email,
      asunto: para ? `[PRUEBA] ${plantilla.asunto}` : plantilla.asunto,
      html: plantilla.html,
      texto: plantilla.texto,
    }
  })

  const resultado = await enviarCorreosEnLote(correos)
  console.log(
    JSON.stringify({
      operacion: 'enviarCalendarioPorCorreo',
      porQuien: admin.email,
      cohorteId,
      prueba: para || null,
      sesiones: sesiones.length,
      destinatarios: correos.length,
      conLigaDeAcceso: conAcceso,
      enviados: resultado.enviados,
      fallidos: resultado.fallidos.length,
      motivo: resultado.motivo ?? null,
    })
  )

  if (resultado.fallidos.length > 0) {
    return {
      error: `Salieron ${resultado.enviados} y fallaron ${resultado.fallidos.length}. Motivo: ${resultado.motivo ?? 'sin detalle'}.`,
    }
  }
  return {
    aviso: para
      ? `Prueba enviada a ${para} con las ${sesiones.length} sesiones (en la prueba, el botón de acceso lleva al login).`
      : `Las fechas salieron a ${resultado.enviados} alumno${resultado.enviados === 1 ? '' : 's'} de la generación` +
        (conAcceso > 0 ? `; ${conAcceso} con su liga de acceso, porque no han entrado.` : '.'),
  }
}

const esquemaSerie = z.object({
  cohort_id: z.uuid('Generación inválida.'),
  titulo_base: z.string().trim().min(2, 'Falta el título base.').max(120),
  fecha: z.string().trim().min(10, 'Falta la primera fecha.'),
  hora: z.string().trim().min(4, 'Falta la hora.'),
  cantidad: z.coerce.number().int().min(1, 'Al menos una.').max(40, 'Hasta 40 por serie.'),
  dias: z.array(z.coerce.number().int().min(0).max(6)),
  meet_url: z.string().trim(),
  description: z.string().trim(),
})

/**
 * Agenda varias sesiones de una vez: "8 sesiones, lunes y jueves, a las 7,
 * desde el 21 de septiembre, con esta liga de Zoom".
 *
 * Es lo que pidió Alejandro para planear el curso completo con anticipación
 * y que los alumnos vean desde el primer día qué fechas hay. Los títulos
 * salen numerados del título base ("Sesión 1", "Sesión 2"…); después cada
 * una se edita con su tema. Si no se marca ningún día, se repite el día de
 * la semana de la primera fecha.
 */
export async function crearSesionesEnSerie(
  _previo: EstadoAccion,
  datos: FormData
): Promise<EstadoAccion> {
  await exigirAdmin()

  const resultado = esquemaSerie.safeParse({
    cohort_id: datos.get('cohort_id'),
    titulo_base: datos.get('titulo_base'),
    fecha: datos.get('fecha'),
    hora: datos.get('hora'),
    cantidad: datos.get('cantidad'),
    dias: datos.getAll('dias').filter((v): v is string => typeof v === 'string'),
    meet_url: datos.get('meet_url') ?? '',
    description: datos.get('description') ?? '',
  })
  if (!resultado.success) return { error: primerError(resultado) }

  const { cohort_id, titulo_base, fecha, hora, cantidad, meet_url, description } = resultado.data
  const dias = resultado.data.dias.length > 0 ? new Set(resultado.data.dias) : new Set([diaDeLaSemana(fecha)])

  const fechas: string[] = []
  for (let n = 0; n < 400 && fechas.length < cantidad; n += 1) {
    const dia = sumarDias(fecha, n)
    if (dias.has(diaDeLaSemana(dia))) fechas.push(dia)
  }

  const filas = fechas.flatMap((dia, i) => {
    const enUtc = cdmxAUtc(dia, hora)
    return enUtc
      ? [
          {
            cohort_id,
            title: `${titulo_base} ${i + 1}`,
            scheduled_at: enUtc,
            meet_url: meet_url || null,
            description: description || null,
          },
        ]
      : []
  })
  if (filas.length === 0) return { error: 'La fecha o la hora no son válidas.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohort_sessions').insert(filas)
  if (error) {
    registrarFallo('crearSesionesEnSerie', { cohort_id, cuantas: filas.length }, error.message)
    return { error: 'No se pudieron agendar las sesiones.' }
  }

  revalidatePath('/admin/cursos/[id]', 'page')
  revalidatePath('/admin')
  const primera = fechas[0]
  const ultima = fechas[fechas.length - 1]
  return {
    aviso: `${filas.length} sesiones agendadas, del ${primera} al ${ultima}. Ahora ponle a cada una su tema.`,
  }
}

/** Con confirmación en modal (M14). La sesión se ve en el curso y en el panel. */
export async function eliminarSesion(_previo: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  if (!id) return { error: 'Falta la sesión.' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('cohort_sessions').delete().eq('id', id)

  if (error) {
    registrarFallo('eliminarSesion', { id }, error.message)
    return { error: 'No se pudo eliminar la sesión. Inténtalo otra vez.' }
  }

  revalidatePath('/admin/cursos/[id]', 'page')
  revalidatePath('/admin', 'layout')
  return { aviso: 'Sesión eliminada.' }
}

/**
 * Liga (o desliga) la grabación de una sesión ya ocurrida (§3.10).
 * La grabación es una lección de tipo video del mismo curso.
 */
export async function ligarGrabacion(datos: FormData): Promise<void> {
  await exigirAdmin()

  const id = String(datos.get('id') ?? '')
  const leccionId = String(datos.get('recording_lesson_id') ?? '')
  if (!id) return

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('cohort_sessions')
    .update({ recording_lesson_id: leccionId || null })
    .eq('id', id)

  if (error) registrarFallo('ligarGrabacion', { id, leccionId }, error.message)

  revalidatePath('/admin/cursos/[id]', 'page')
}
