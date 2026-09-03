import type { Opcion } from '@/lib/quiz/comun'

import type { AjustesPregunta, TipoPregunta } from './comun'

/**
 * Cómo se convierten las respuestas crudas en lo que se proyecta.
 *
 * Este módulo es PURO a propósito: no importa `server-only`, no habla con
 * Supabase y no sabe qué es una petición. Lo usan la pantalla de proyección y
 * —en la etapa 3— el generador del PDF, que tiene que producir exactamente las
 * mismas cifras que la sala vio en la pared. Si el PDF recalculara por su
 * cuenta, tarde o temprano diría otra cosa.
 *
 * La agregación se hace en JavaScript y no en SQL. Con cientos de respuestas la
 * diferencia es de microsegundos, y a cambio esta lógica se puede probar sin
 * levantar una base ni sembrar nada.
 */

export type RespuestaCruda = {
  id: string
  textValue: string | null
  textNorm: string | null
  optionId: string | null
  numericValue: number | null
  hidden: boolean
  creadaEn: string
  autor: string | null
}

export type AgregadoNube = {
  tipo: 'nube'
  total: number
  palabras: Array<{ palabra: string; conteo: number }>
}

export type AgregadoOpcion = {
  tipo: 'opcion'
  total: number
  opciones: Array<{ id: string; texto: string; conteo: number; porcentaje: number }>
}

export type AgregadoEscala = {
  tipo: 'escala'
  total: number
  promedio: number | null
  min: number
  max: number
  etiquetaMin: string
  etiquetaMax: string
  histograma: Array<{ valor: number; conteo: number }>
}

export type AgregadoMuro = {
  tipo: 'muro'
  total: number
  tarjetas: Array<{ id: string; texto: string; autor: string | null }>
}

export type Agregado = AgregadoNube | AgregadoOpcion | AgregadoEscala | AgregadoMuro

/**
 * Lo que devuelve el endpoint de proyección.
 *
 * Vive aquí, junto a los agregados, y no dentro del route handler ni del
 * componente: es el contrato entre los dos, y si cada lado lo declarara por su
 * cuenta se desincronizarían sin que TypeScript dijera nada.
 */
export type PayloadProyeccion = {
  v: number
  estado: 'draft' | 'live' | 'closed'
  participantes: number
  pregunta: {
    id: string
    prompt: string
    tipo: TipoPregunta
    abierta: boolean
    posicion: number
  } | null
  total: number
  /** Cuántas quedan sin abrir. Decide si el botón dice "Siguiente" o "Terminar". */
  pendientes: number
  /**
   * Los últimos en entrar, más reciente primero. Es lo que la sala de espera va
   * pintando mientras el instructor presenta. Vacío si la encuesta no muestra
   * nombres.
   */
  recienLlegados: Array<{ id: string; nombre: string }>
  agregado: Agregado | null
}

/** Cuántas tarjetas caben en la pared antes de que dejen de leerse. */
export const TOPE_TARJETAS = 24

/**
 * Ordena por conteo y desempata alfabéticamente.
 *
 * El desempate no es cosmético: sin él, dos palabras con el mismo conteo pueden
 * intercambiarse entre un sondeo y el siguiente, y la nube salta sola en la
 * pantalla cada segundo sin que haya llegado ninguna respuesta nueva.
 */
function porConteoYNombre<T extends { conteo: number }>(
  a: T & { clave: string },
  b: T & { clave: string }
): number {
  if (b.conteo !== a.conteo) return b.conteo - a.conteo
  return a.clave.localeCompare(b.clave, 'es')
}

/** Las que se proyectan. Una respuesta oculta sigue existiendo, solo no se ve. */
function visibles(respuestas: RespuestaCruda[]): RespuestaCruda[] {
  return respuestas.filter((r) => !r.hidden)
}

export function agregar(
  tipo: TipoPregunta,
  respuestas: RespuestaCruda[],
  opciones: Opcion[],
  ajustes: AjustesPregunta
): Agregado {
  const vistas = visibles(respuestas)

  switch (tipo) {
    case 'nube': {
      const cuenta = new Map<string, { palabra: string; conteo: number }>()
      for (const r of vistas) {
        // `text_norm` lo calcula Postgres como columna generada: minúsculas y
        // sin acentos. Agrupar por ahí hace que "Automatización", "automatizacion"
        // y "AUTOMATIZACIÓN" sean una sola palabra en la nube.
        const clave = (r.textNorm ?? '').trim()
        if (!clave) continue
        const previo = cuenta.get(clave)
        if (previo) previo.conteo += 1
        // Se muestra la primera forma que llegó, no la normalizada: proyectar
        // "automatizacion" sin acento se ve como un error de dedo nuestro.
        else cuenta.set(clave, { palabra: (r.textValue ?? clave).trim(), conteo: 1 })
      }

      const palabras = [...cuenta.entries()]
        .map(([clave, v]) => ({ ...v, clave }))
        .sort(porConteoYNombre)
        .map(({ palabra, conteo }) => ({ palabra, conteo }))

      return { tipo: 'nube', total: vistas.length, palabras }
    }

    case 'opcion': {
      const total = vistas.length
      return {
        tipo: 'opcion',
        total,
        // Se recorren las OPCIONES, no las respuestas: una opción que nadie
        // eligió tiene que salir en cero. Si desapareciera, la sala leería mal
        // el resultado — "nadie dijo eso" y "eso no estaba" no son lo mismo.
        opciones: opciones.map((o) => {
          const conteo = vistas.filter((r) => r.optionId === o.id).length
          return {
            id: o.id,
            texto: o.text,
            conteo,
            porcentaje: total === 0 ? 0 : Math.round((conteo / total) * 1000) / 10,
          }
        }),
      }
    }

    case 'escala': {
      const min = ajustes.min ?? 1
      const max = ajustes.max ?? 10
      const numeros = vistas
        .map((r) => r.numericValue)
        .filter((n): n is number => typeof n === 'number')

      const histograma: Array<{ valor: number; conteo: number }> = []
      for (let valor = min; valor <= max; valor += 1) {
        histograma.push({ valor, conteo: numeros.filter((n) => n === valor).length })
      }

      return {
        tipo: 'escala',
        total: numeros.length,
        promedio:
          numeros.length === 0
            ? null
            : Math.round((numeros.reduce((a, b) => a + b, 0) / numeros.length) * 10) / 10,
        min,
        max,
        etiquetaMin: ajustes.etiquetaMin ?? '',
        etiquetaMax: ajustes.etiquetaMax ?? '',
        histograma,
      }
    }

    case 'muro': {
      const tarjetas = [...vistas]
        // Lo más nuevo arriba: en una dinámica en vivo, lo que acaba de llegar
        // es lo que la sala está esperando ver aparecer.
        .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn) || b.id.localeCompare(a.id))
        .filter((r) => (r.textValue ?? '').trim() !== '')
        .slice(0, TOPE_TARJETAS)
        .map((r) => ({ id: r.id, texto: (r.textValue ?? '').trim(), autor: r.autor }))

      return { tipo: 'muro', total: vistas.length, tarjetas }
    }
  }
}
