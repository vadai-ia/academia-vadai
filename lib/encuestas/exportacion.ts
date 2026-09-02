import 'server-only'

import { crearClienteServidor } from '@/lib/supabase/server'

import { agregar, type Agregado, type RespuestaCruda } from './agregados'
import { leerAjustes, type AjustesPregunta, type TipoPregunta } from './comun'
import { leerOpciones, type Opcion } from '@/lib/quiz/comun'
import { libroXlsx, nombreDeHoja, type Celda, type Hoja } from './xlsx'

/**
 * Todo lo que hace falta para exportar una encuesta, en un solo lugar.
 *
 * El Excel y el PDF salen de ESTE mismo objeto. Si cada uno consultara por su
 * cuenta, tarde o temprano dirían cifras distintas del mismo evento, y no habría
 * forma de saber cuál creer.
 *
 * Pasa por RLS con el cliente del usuario: las tres tablas que toca
 * —`poll_answers`, `poll_participants`, `participants`— son admin-only, así que
 * un alumno que llegara aquí se llevaría listas vacías en vez de los nombres,
 * correos y teléfonos de toda la sala.
 */

const ZONA = 'America/Mexico_City'

export type RespuestaExportada = {
  autor: string
  email: string
  valor: string
  oculta: boolean
  creadaEn: string
}

export type PreguntaExportada = {
  id: string
  prompt: string
  tipo: TipoPregunta
  posicion: number
  opciones: Opcion[]
  ajustes: AjustesPregunta
  agregado: Agregado
  respuestas: RespuestaExportada[]
}

export type ParticipanteExportado = {
  nombre: string
  apellido: string
  email: string
  telefono: string
  tieneCuenta: boolean
  entroEn: string
  respondio: number
}

export type DatosExportacion = {
  id: string
  titulo: string
  codigo: string
  curso: string
  cohorte: string | null
  estado: string
  preguntas: PreguntaExportada[]
  participantes: ParticipanteExportado[]
}

/**
 * Fecha y hora legibles, en CDMX.
 *
 * Va como TEXTO y no como número de serie de Excel a propósito: este escritor no
 * emite `styles.xml`, así que un serial se vería como `45903.52` en la celda.
 * Un texto con la fecha completa se lee siempre, aunque no se pueda ordenar
 * como fecha — y para un reporte de evento eso es el trato correcto.
 */
function fechaLegible(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: ZONA,
  }).format(new Date(iso))
}

/** Cómo se lee una respuesta en una celda, según el tipo de su pregunta. */
function valorLegible(
  tipo: TipoPregunta,
  opciones: Opcion[],
  fila: { text_value: string | null; option_id: string | null; numeric_value: number | null }
): string {
  if (tipo === 'opcion') {
    // Se exporta el TEXTO de la opción, no su id. Una columna llena de "a" y "c"
    // no le sirve a nadie que abra el archivo tres semanas después.
    return opciones.find((o) => o.id === fila.option_id)?.text ?? (fila.option_id ?? '')
  }
  if (tipo === 'escala') return String(fila.numeric_value ?? '')
  return fila.text_value ?? ''
}

export async function datosParaExportar(encuestaId: string): Promise<DatosExportacion | null> {
  const supabase = await crearClienteServidor()

  const { data: encuesta } = await supabase
    .from('polls')
    .select(
      'id, title, join_code, status, courses(title), cohorts(name), poll_questions(id, prompt, question_type, options, settings, position)'
    )
    .eq('id', encuestaId)
    .maybeSingle()

  if (!encuesta) return null

  type FilaEncuesta = {
    id: string
    title: string
    join_code: string
    status: string
    courses: { title: string } | null
    cohorts: { name: string } | null
    poll_questions: Array<{
      id: string
      prompt: string
      question_type: string
      options: unknown
      settings: unknown
      position: number
    }>
  }

  const fila = encuesta as unknown as FilaEncuesta
  const preguntasOrdenadas = [...(fila.poll_questions ?? [])].sort((a, b) => a.position - b.position)
  const ids = preguntasOrdenadas.map((p) => p.id)

  // Dos viajes, no uno por pregunta: con cinco preguntas serían cinco idas y
  // vueltas a Supabase para armar un archivo que se descarga de una sola vez.
  const [respuestas, asistencias] = await Promise.all([
    ids.length > 0
      ? supabase
          .from('poll_answers')
          .select(
            'id, question_id, text_value, text_norm, option_id, numeric_value, hidden, created_at, poll_participants(display_name, participants(email))'
          )
          .in('question_id', ids)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from('poll_participants')
      .select('id, display_name, joined_at, participants(email, first_name, last_name, phone, user_id)')
      .eq('poll_id', encuestaId)
      .order('joined_at', { ascending: true }),
  ])

  type FilaRespuesta = {
    id: string
    question_id: string
    text_value: string | null
    text_norm: string | null
    option_id: string | null
    numeric_value: number | null
    hidden: boolean
    created_at: string
    poll_participants: { display_name: string; participants: { email: string } | null } | null
  }

  type FilaAsistencia = {
    id: string
    display_name: string
    joined_at: string
    participants: {
      email: string
      first_name: string
      last_name: string
      phone: string | null
      user_id: string | null
    } | null
  }

  const todas = (respuestas.data ?? []) as unknown as FilaRespuesta[]
  const asistentes = (asistencias.data ?? []) as unknown as FilaAsistencia[]

  const preguntas: PreguntaExportada[] = preguntasOrdenadas.map((p) => {
    const tipo = p.question_type as TipoPregunta
    const opciones = leerOpciones(p.options)
    const ajustes = leerAjustes(p.settings, tipo)
    const suyas = todas.filter((r) => r.question_id === p.id)

    const crudas: RespuestaCruda[] = suyas.map((r) => ({
      id: r.id,
      textValue: r.text_value,
      textNorm: r.text_norm,
      optionId: r.option_id,
      numericValue: r.numeric_value,
      hidden: r.hidden,
      creadaEn: r.created_at,
      autor: r.poll_participants?.display_name ?? null,
    }))

    return {
      id: p.id,
      prompt: p.prompt,
      tipo,
      posicion: p.position,
      opciones,
      ajustes,
      agregado: agregar(tipo, crudas, opciones, ajustes),
      respuestas: suyas.map((r) => ({
        autor: r.poll_participants?.display_name ?? 'Sin nombre',
        email: r.poll_participants?.participants?.email ?? '',
        valor: valorLegible(tipo, opciones, r),
        // Una respuesta oculta SÍ se exporta, marcada. Si alguien escribió algo
        // impresentable en una capacitación de empresa, el cliente va a querer
        // saber que ocurrió, no que desapareciera sin rastro.
        oculta: r.hidden,
        creadaEn: r.created_at,
      })),
    }
  })

  const respuestasPorAsistente = new Map<string, number>()
  for (const r of todas) {
    const clave = r.poll_participants?.display_name ?? ''
    respuestasPorAsistente.set(clave, (respuestasPorAsistente.get(clave) ?? 0) + 1)
  }

  return {
    id: fila.id,
    titulo: fila.title,
    codigo: fila.join_code,
    curso: fila.courses?.title ?? 'Curso eliminado',
    cohorte: fila.cohorts?.name ?? null,
    estado: fila.status,
    preguntas,
    participantes: asistentes.map((a) => ({
      nombre: a.participants?.first_name ?? '',
      apellido: a.participants?.last_name ?? '',
      email: a.participants?.email ?? '',
      telefono: a.participants?.phone ?? '',
      tieneCuenta: Boolean(a.participants?.user_id),
      entroEn: a.joined_at,
      respondio: respuestasPorAsistente.get(a.display_name) ?? 0,
    })),
  }
}

// --------------------------------------------------------------------------
// El libro de Excel
// --------------------------------------------------------------------------

/** Una línea que resume el agregado de una pregunta, para la hoja de resumen. */
function resumenDe(pregunta: PreguntaExportada): string {
  const a = pregunta.agregado
  switch (a.tipo) {
    case 'nube':
      return a.palabras
        .slice(0, 5)
        .map((p) => `${p.palabra} (${p.conteo})`)
        .join(', ')
    case 'opcion':
      return a.opciones.map((o) => `${o.texto}: ${o.conteo} (${o.porcentaje}%)`).join(' · ')
    case 'escala':
      return a.promedio === null ? 'sin respuestas' : `promedio ${a.promedio} de ${a.max}`
    case 'muro':
      return `${a.total} respuesta(s)`
  }
}

export function libroDeEncuesta(datos: DatosExportacion, fecha = new Date()): Buffer {
  const resumen: Celda[][] = [
    ['Encuesta', datos.titulo],
    ['Código', datos.codigo],
    ['Curso', datos.curso],
    ['Cohorte', datos.cohorte ?? 'Todo el curso'],
    ['Participantes', datos.participantes.length],
    ['Exportado', fechaLegible(fecha.toISOString())],
    [],
    ['#', 'Pregunta', 'Tipo', 'Respuestas', 'Resultado'],
    ...datos.preguntas.map((p, i): Celda[] => [
      i + 1,
      p.prompt,
      p.tipo,
      p.respuestas.length,
      resumenDe(p),
    ]),
  ]

  const participantes: Celda[][] = [
    ['Nombre', 'Apellido', 'Correo', 'Teléfono', 'Tiene cuenta', 'Entró', 'Respondió'],
    ...datos.participantes.map((p): Celda[] => [
      p.nombre,
      p.apellido,
      p.email,
      p.telefono,
      p.tieneCuenta ? 'Sí' : 'No',
      fechaLegible(p.entroEn),
      p.respondio,
    ]),
  ]

  const hojas: Hoja[] = [
    { nombre: 'Resumen', filas: resumen },
    { nombre: 'Participantes', filas: participantes },
    ...datos.preguntas.map((pregunta, i): Hoja => ({
      // El número va al frente para que las hojas se lean en el orden en que se
      // proyectaron, aunque el título se recorte a 31 caracteres.
      nombre: nombreDeHoja(`${i + 1}. ${pregunta.prompt}`, `Pregunta ${i + 1}`),
      filas: [
        [pregunta.prompt],
        [],
        ['Autor', 'Correo', 'Respuesta', 'Oculta', 'Cuándo'],
        ...pregunta.respuestas.map((r): Celda[] => [
          r.autor,
          r.email,
          r.valor,
          r.oculta ? 'Sí' : '',
          fechaLegible(r.creadaEn),
        ]),
      ],
    })),
  ]

  return libroXlsx(hojas, fecha)
}

/** Nombre del archivo que ve quien descarga. */
export function nombreDeArchivo(datos: DatosExportacion, extension: string, fecha = new Date()): string {
  const dia = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: ZONA }).format(fecha)
  return `encuesta-${datos.codigo}-${dia}.${extension}`
}
