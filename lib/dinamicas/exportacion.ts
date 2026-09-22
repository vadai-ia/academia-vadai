import 'server-only'

import { libroXlsx, nombreDeHoja, type Celda, type Hoja } from '@/lib/encuestas/xlsx'
import { crearClienteServidor } from '@/lib/supabase/server'

import {
  ETIQUETA_ESTADO_DINAMICA,
  claveCelda,
  contarCeldasDeCriterio,
  estadoEfectivo,
  ganadoras,
  ponderadoDeColumna,
  type CeldaTablero,
  type ColumnaTablero,
  type Escala,
  type EstadoDinamica,
  type FilaDinamica,
} from './comun'
import { nombresDe } from './tablero'

/**
 * Todo lo que hace falta para exportar una dinámica, en un solo lugar.
 *
 * Mismo criterio que `lib/encuestas/exportacion.ts`: un objeto con los datos y
 * un libro que sale de ESE objeto. La hoja "Resumen" y la hoja de cada tablero
 * leen la misma lista de celdas, así que no pueden contradecirse.
 *
 * El ponderado va PRECALCULADO como número, con `ponderadoDeColumna` de
 * comun.ts —la misma función que pinta la pantalla— y nunca como fórmula. El
 * escritor de xlsx.ts no emite fórmulas a propósito: los nombres de proyecto
 * y los textos informativos los escribe cualquier alumno, y un texto que
 * empieza con `=` viaja como texto literal. La suite lo afirma.
 *
 * Pasa por RLS con el cliente del admin. Un alumno no llega aquí (la ruta
 * devuelve 404 antes), y si llegara se llevaría solo lo que su policy le deja
 * ver: su propio tablero.
 */

const ZONA = 'America/Mexico_City'

export type TableroExportado = {
  id: string
  /** Null = tablero individual de alguien sin empresa (General). */
  empresa: string | null
  /** Quien es dueño del tablero individual; null en los de empresa. */
  dueno: string | null
  columnas: ColumnaTablero[]
  celdas: CeldaTablero[]
  /** Nombres de quienes crearon un proyecto o pusieron una calificación. */
  editores: string[]
  ultimaEdicion: string | null
}

export type DatosDinamica = {
  id: string
  titulo: string
  descripcion: string | null
  curso: string
  cohorte: string | null
  /** EFECTIVO: una abierta con la fecha límite vencida sale como cerrada. */
  estado: EstadoDinamica
  escala: Escala
  cierraEn: string | null
  cerroEn: string | null
  filas: FilaDinamica[]
  tableros: TableroExportado[]
}

/**
 * Fecha y hora legibles, en CDMX y diciéndolo.
 *
 * Va como TEXTO y no como número de serie de Excel: xlsx.ts no emite
 * `styles.xml`, así que un serial se vería como `45903.52`. El "(CDMX)" va
 * pegado porque el archivo se abre en cualquier parte y sin él la hora no
 * dice de dónde es.
 */
function fechaLegible(iso: string): string {
  const texto = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: ZONA,
  }).format(new Date(iso))
  return `${texto} (CDMX)`
}

/** "Farma Pronto" o "General · Roberto Martínez". Es el nombre de la hoja. */
function nombreDeTablero(t: Pick<TableroExportado, 'empresa' | 'dueno'>): string {
  return t.empresa ?? `General · ${t.dueno ?? 'Sin nombre'}`
}

function mapaDeCeldas(celdas: ReadonlyArray<CeldaTablero>): Map<string, CeldaTablero> {
  const mapa = new Map<string, CeldaTablero>()
  for (const c of celdas) mapa.set(claveCelda(c.filaId, c.columnaId), c)
  return mapa
}

/** El instante más reciente de una lista de ISO, o null si está vacía. */
function masReciente(fechas: ReadonlyArray<string | null>): string | null {
  let mejor: string | null = null
  for (const f of fechas) {
    if (!f) continue
    if (mejor === null || new Date(f).getTime() > new Date(mejor).getTime()) mejor = f
  }
  return mejor
}

function reportar(
  id: string,
  consultas: Record<string, { data: unknown; error?: { message: string } | null }>
): void {
  for (const [consulta, r] of Object.entries(consultas)) {
    if (r.error) {
      console.error(
        JSON.stringify({ operacion: 'datosDeDinamica', dynamicId: id, consulta, error: r.error.message })
      )
    }
  }
}

export async function datosDeDinamica(id: string): Promise<DatosDinamica | null> {
  const supabase = await crearClienteServidor()

  // Primera ronda: lo que cuelga directo de la dinámica. Selects planos y en
  // paralelo, como lib/admin/alumnos.ts; PostgREST anidado se tipa a mano y
  // aquí no hace falta.
  const [dinamica, filas, tableros] = await Promise.all([
    supabase.from('dynamics').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('dynamic_rows')
      .select('*')
      .eq('dynamic_id', id)
      .order('position')
      .order('created_at'),
    supabase.from('dynamic_boards').select('*').eq('dynamic_id', id).order('created_at'),
  ])
  reportar(id, { dinamica, filas, tableros })

  const d = dinamica.data
  if (!d) return null

  const listaTableros = tableros.data ?? []
  const boardIds = listaTableros.map((t) => t.id)
  const companyIds = [...new Set(listaTableros.flatMap((t) => (t.company_id ? [t.company_id] : [])))]
  const ownerIds = [...new Set(listaTableros.flatMap((t) => (t.owner_user_id ? [t.owner_user_id] : [])))]

  // Segunda ronda: curso, cohorte, dueños de tablero, proyectos y celdas.
  const [curso, cohorte, empresas, duenos, columnas, celdas] = await Promise.all([
    supabase.from('courses').select('title').eq('id', d.course_id).maybeSingle(),
    d.cohort_id
      ? supabase.from('cohorts').select('name').eq('id', d.cohort_id).maybeSingle()
      : Promise.resolve({ data: null }),
    companyIds.length > 0
      ? supabase.from('companies').select('id, name').in('id', companyIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length > 0
      ? supabase.from('profiles').select('user_id, full_name').in('user_id', ownerIds)
      : Promise.resolve({ data: [] }),
    boardIds.length > 0
      ? supabase
          .from('dynamic_columns')
          .select('*')
          .in('board_id', boardIds)
          .order('position')
          .order('created_at')
          .order('id')
      : Promise.resolve({ data: [] }),
    boardIds.length > 0
      ? supabase.from('dynamic_cells').select('*').in('board_id', boardIds)
      : Promise.resolve({ data: [] }),
  ])
  reportar(id, { curso, cohorte, empresas, duenos, columnas, celdas })

  const listaColumnas = columnas.data ?? []
  const listaCeldas = celdas.data ?? []

  // Tercera ronda: los nombres de quien creó cada proyecto y de quien puso
  // cada calificación, vía public_profiles (sin correo ni rol).
  const autorIds = new Set<string>()
  for (const c of listaColumnas) if (c.created_by) autorIds.add(c.created_by)
  for (const c of listaCeldas) if (c.updated_by) autorIds.add(c.updated_by)
  const nombres = await nombresDe([...autorIds])

  const nombreEmpresa = new Map((empresas.data ?? []).map((e) => [e.id, e.name]))
  const nombreDueno = new Map(
    (duenos.data ?? []).map((p) => [p.user_id, p.full_name.trim() || 'Sin nombre'])
  )

  const columnasPorTablero = new Map<string, ColumnaTablero[]>()
  for (const c of listaColumnas) {
    const lista = columnasPorTablero.get(c.board_id) ?? []
    lista.push({
      id: c.id,
      etiqueta: c.label,
      posicion: c.position,
      creadaPor: c.created_by,
      creadaPorNombre: c.created_by ? (nombres.get(c.created_by) ?? null) : null,
      creadaEn: c.created_at,
    })
    columnasPorTablero.set(c.board_id, lista)
  }

  const celdasPorTablero = new Map<string, CeldaTablero[]>()
  for (const c of listaCeldas) {
    const lista = celdasPorTablero.get(c.board_id) ?? []
    lista.push({
      filaId: c.row_id,
      columnaId: c.column_id,
      numero: c.numeric_value,
      texto: c.text_value,
      editadaPor: c.updated_by,
      editadaPorNombre: c.updated_by ? (nombres.get(c.updated_by) ?? null) : null,
      editadaEn: c.updated_at,
    })
    celdasPorTablero.set(c.board_id, lista)
  }

  const armados: TableroExportado[] = listaTableros.map((t) => {
    const cols = columnasPorTablero.get(t.id) ?? []
    const cels = celdasPorTablero.get(t.id) ?? []

    // Editores sin repetir, por id y no por nombre: dos "Ana" son dos personas.
    const editoresIds = new Set<string>()
    for (const c of cols) if (c.creadaPor) editoresIds.add(c.creadaPor)
    for (const c of cels) if (c.editadaPor) editoresIds.add(c.editadaPor)

    return {
      id: t.id,
      empresa: t.company_id ? (nombreEmpresa.get(t.company_id) ?? 'Empresa eliminada') : null,
      dueno: t.owner_user_id ? (nombreDueno.get(t.owner_user_id) ?? 'Sin nombre') : null,
      columnas: cols,
      celdas: cels,
      editores: [...editoresIds].map((uid) => nombres.get(uid) ?? 'Alumno'),
      ultimaEdicion: masReciente([
        ...listaColumnas.filter((c) => c.board_id === t.id).map((c) => c.updated_at),
        ...cels.map((c) => c.editadaEn),
      ]),
    }
  })

  // Empresas primero, por nombre; luego los individuales, por persona. Es el
  // orden de la pantalla de tableros y el de las hojas del libro.
  armados.sort((a, b) => {
    if ((a.empresa === null) !== (b.empresa === null)) return a.empresa === null ? 1 : -1
    return nombreDeTablero(a).localeCompare(nombreDeTablero(b), 'es')
  })

  return {
    id: d.id,
    titulo: d.title,
    descripcion: d.description,
    curso: curso.data?.title ?? 'Curso eliminado',
    cohorte: cohorte.data?.name ?? null,
    estado: estadoEfectivo(d),
    escala: { min: d.scale_min, max: d.scale_max },
    cierraEn: d.closes_at,
    cerroEn: d.closed_at,
    filas: (filas.data ?? []).map((f) => ({
      id: f.id,
      tipo: f.row_kind,
      etiqueta: f.label,
      peso: f.weight,
      posicion: f.position,
    })),
    tableros: armados,
  }
}

// --------------------------------------------------------------------------
// El libro de Excel
// --------------------------------------------------------------------------

/** La celda con la edición más reciente de un proyecto, si tiene alguna. */
function ultimaCeldaDe(celdas: ReadonlyArray<CeldaTablero>, columnaId: string): CeldaTablero | null {
  let mejor: CeldaTablero | null = null
  for (const c of celdas) {
    if (c.columnaId !== columnaId || !c.editadaEn) continue
    if (mejor === null || new Date(c.editadaEn).getTime() > new Date(mejor.editadaEn ?? 0).getTime()) {
      mejor = c
    }
  }
  return mejor
}

function hojaDeTablero(datos: DatosDinamica, t: TableroExportado): Hoja {
  const mapa = mapaDeCeldas(t.celdas)
  const nombre = nombreDeTablero(t)

  const filas: Celda[][] = [
    [`${datos.titulo} · ${nombre}`],
    ['Peso', 'Fila', ...t.columnas.map((c) => c.etiqueta)],
    // Las filas van en el orden del tablero, criterios e informativas
    // intercalados como los fijó el admin. El criterio lleva su peso como
    // número y sus calificaciones como número; la informativa, su texto.
    ...datos.filas.map((f): Celda[] =>
      f.tipo === 'criterio'
        ? [
            f.peso ?? '',
            f.etiqueta,
            ...t.columnas.map((c) => mapa.get(claveCelda(f.id, c.id))?.numero ?? ''),
          ]
        : ['', f.etiqueta, ...t.columnas.map((c) => mapa.get(claveCelda(f.id, c.id))?.texto ?? '')]
    ),
    [],
    [
      '',
      'Calificación ponderada',
      ...t.columnas.map((c) => ponderadoDeColumna(datos.filas, mapa, c.id).valor ?? '—'),
    ],
    [],
    ['Proyecto', 'Creado por', 'Última edición por', 'Cuándo'],
    ...t.columnas.map((c): Celda[] => {
      const ultima = ultimaCeldaDe(t.celdas, c.id)
      return [
        c.etiqueta,
        c.creadaPorNombre ?? '',
        ultima?.editadaPorNombre ?? '',
        fechaLegible(ultima?.editadaEn ?? c.creadaEn),
      ]
    }),
  ]

  return { nombre: nombreDeHoja(nombre), filas }
}

export function libroDeDinamica(datos: DatosDinamica, fecha = new Date()): Buffer {
  const criterios = datos.filas.filter((f) => f.tipo === 'criterio')
  const informativas = datos.filas.filter((f) => f.tipo === 'informativa')

  const resumen: Celda[][] = [
    ['Dinámica', datos.titulo],
    ['Curso', datos.curso],
    ['Cohorte', datos.cohorte ?? 'Todo el curso'],
    ['Estado', ETIQUETA_ESTADO_DINAMICA[datos.estado]],
    ['Escala', `Del ${datos.escala.min} al ${datos.escala.max}`],
    ['Fecha límite', datos.cierraEn ? fechaLegible(datos.cierraEn) : 'Sin fecha límite'],
    ['Exportado', fechaLegible(fecha.toISOString())],
    ['Criterios', criterios.map((c) => `${c.etiqueta} (${c.peso ?? 0} %)`).join(' · ')],
    ...(informativas.length > 0
      ? [['Filas informativas', informativas.map((f) => f.etiqueta).join(' · ')] as Celda[]]
      : []),
    [],
    [
      'Tablero',
      'Integrantes que editaron',
      'Proyectos',
      'Celdas llenas',
      'Celdas totales',
      'Mejor proyecto',
      'Ponderado',
      'Última edición',
    ],
    ...datos.tableros.map((t): Celda[] => {
      const mapa = mapaDeCeldas(t.celdas)
      const ganan = ganadoras(datos.filas, mapa, t.columnas)
      // El mismo conteo que la pantalla de tableros: celdas de criterio con
      // número sobre criterios × proyectos. Las informativas no se califican.
      const { llenas, total } = contarCeldasDeCriterio(datos.filas, t.columnas, t.celdas)
      let mejor: number | null = null
      for (const c of t.columnas) {
        const p = ponderadoDeColumna(datos.filas, mapa, c.id)
        if (p.valor !== null && (mejor === null || p.valor > mejor)) mejor = p.valor
      }
      return [
        nombreDeTablero(t),
        t.editores.join(', '),
        t.columnas.length,
        llenas,
        total,
        // Empate: todas, separadas por " / ". El número ordena, no decide solo.
        t.columnas
          .filter((c) => ganan.has(c.id))
          .map((c) => c.etiqueta)
          .join(' / '),
        mejor ?? '—',
        t.ultimaEdicion ? fechaLegible(t.ultimaEdicion) : '',
      ]
    }),
  ]

  const hojas: Hoja[] = [
    { nombre: 'Resumen', filas: resumen },
    ...datos.tableros.map((t) => hojaDeTablero(datos, t)),
  ]

  return libroXlsx(hojas, fecha)
}

/**
 * "hoja-de-decision": el título sin acentos ni signos, para el nombre del
 * archivo. Si no queda nada legible, los primeros ocho del id.
 */
function identificador(datos: Pick<DatosDinamica, 'id' | 'titulo'>): string {
  const limpio = datos.titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return limpio || datos.id.slice(0, 8)
}

/** Nombre del archivo que ve quien descarga. */
export function nombreDeArchivoDinamica(
  datos: Pick<DatosDinamica, 'id' | 'titulo'>,
  extension: string,
  fecha = new Date()
): string {
  const dia = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: ZONA }).format(fecha)
  return `dinamica-${identificador(datos)}-${dia}.${extension}`
}
