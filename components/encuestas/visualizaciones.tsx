import type {
  Agregado,
  AgregadoEscala,
  AgregadoMuro,
  AgregadoNube,
  AgregadoOpcion,
} from '@/lib/encuestas/agregados'
import { acomodarNube } from '@/lib/encuestas/layout-nube'

/**
 * Las cuatro maneras de proyectar una respuesta.
 *
 * Todo es SVG y CSS: no se instaló ninguna librería de gráficas. Para cuatro
 * formas conocidas, Recharts sería medio megabyte para dibujar rectángulos, y
 * además impondría su propio sistema de color justo donde la marca importa más
 * —una pared de tres metros—.
 *
 * Los colores salen de `--color-chart-1..5`, que ya estaban definidos en
 * `globals.css` con `light-dark()` y verificados en los dos temas, y que hasta
 * hoy no usaba nadie.
 *
 * Estos componentes son PRESENTACIONALES PUROS: no tienen estado ni efectos, así
 * que sirven igual en un server component y dentro de la pantalla de proyección,
 * que se repinta sola cada segundo.
 */

/**
 * Se escriben como cadenas literales y no como clases de Tailwind armadas al
 * vuelo (`fill-chart-${n}`): Tailwind no puede ver una clase que se construye en
 * tiempo de ejecución y no la generaría.
 */
const TONOS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const

const tono = (n: number) => TONOS[(n - 1) % TONOS.length]

/** Lo que se ve mientras nadie ha contestado. Nunca una pantalla en blanco. */
function Esperando({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex min-h-64 flex-1 items-center justify-center rounded-xl border border-dashed border-border">
      <p className="text-center text-xl text-muted-foreground">{mensaje}</p>
    </div>
  )
}

// --------------------------------------------------------------------------
// Nube de palabras
// --------------------------------------------------------------------------

export function Nube({ datos }: { datos: AgregadoNube }) {
  if (datos.palabras.length === 0) {
    return <Esperando mensaje="Escribe tu palabra en el celular y aparecerá aquí." />
  }

  const layout = acomodarNube(datos)

  return (
    <figure className="flex flex-1 flex-col gap-2">
      <svg
        viewBox={`0 0 ${layout.ancho} ${layout.alto}`}
        className="h-full w-full"
        role="img"
        aria-label={`Nube con ${datos.palabras.length} palabras distintas`}
      >
        {layout.palabras.map((p) => (
          <text
            key={p.palabra}
            x={p.x}
            y={p.y}
            fontSize={p.tamano}
            fill={tono(p.tono)}
            textAnchor="middle"
            dominantBaseline="central"
            // Peso 500 en todo, como el resto de la plataforma: la jerarquía la
            // carga el tamaño, no la negrita.
            fontWeight={500}
            // La transición hace que una palabra que crece al repetirse lo haga
            // suavemente en vez de saltar. Es la parte que se siente "en vivo".
            style={{ transition: 'font-size 400ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {p.palabra}
          </text>
        ))}
      </svg>

      {layout.omitidas > 0 ? (
        <figcaption className="text-center text-sm text-muted-foreground">
          {layout.omitidas} palabra(s) más no cupieron en la pantalla.
        </figcaption>
      ) : null}
    </figure>
  )
}

// --------------------------------------------------------------------------
// Opción múltiple
// --------------------------------------------------------------------------

export function Barras({ datos }: { datos: AgregadoOpcion }) {
  if (datos.opciones.length === 0) return <Esperando mensaje="Esta pregunta no tiene opciones." />

  // El ancho se calcula contra la opción más votada y no contra el total: con
  // cinco opciones repartidas, todas las barras se verían diminutas y la
  // comparación —que es lo único que la sala quiere hacer— se perdería.
  const tope = Math.max(1, ...datos.opciones.map((o) => o.conteo))

  return (
    <ul className="flex flex-1 flex-col justify-center gap-5">
      {datos.opciones.map((opcion, indice) => (
        <li key={opcion.id} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-2xl font-medium">{opcion.texto}</span>
            <span className="shrink-0 text-2xl font-medium tabular-nums">
              {opcion.porcentaje}%
              <span className="ml-2 text-lg text-muted-foreground">({opcion.conteo})</span>
            </span>
          </div>
          <div className="h-8 w-full overflow-hidden rounded-lg bg-muted">
            <div
              className="h-full rounded-lg transition-[width] duration-700 ease-out"
              style={{
                width: `${(opcion.conteo / tope) * 100}%`,
                backgroundColor: tono(indice + 1),
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// --------------------------------------------------------------------------
// Escala
// --------------------------------------------------------------------------

export function Termometro({ datos }: { datos: AgregadoEscala }) {
  if (datos.total === 0) {
    return <Esperando mensaje="Elige tu número en el celular y el promedio aparecerá aquí." />
  }

  const recorrido = datos.max - datos.min || 1
  const posicion = (((datos.promedio ?? datos.min) - datos.min) / recorrido) * 100
  const tope = Math.max(1, ...datos.histograma.map((h) => h.conteo))

  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-[6rem] leading-none font-medium tabular-nums"
          style={{ color: tono(1) }}
        >
          {datos.promedio}
        </span>
        <span className="text-lg text-muted-foreground">
          promedio de {datos.total} respuesta(s)
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* La barra con el promedio marcado. */}
        <div className="relative h-6 w-full rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${posicion}%`, backgroundColor: tono(1) }}
          />
        </div>

        {/* Y debajo, cómo se repartieron: el promedio solo no distingue una sala
            de acuerdo de una sala partida en dos. */}
        <div className="flex h-28 items-end gap-1.5">
          {datos.histograma.map((casilla) => (
            <div key={casilla.valor} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-sm text-muted-foreground tabular-nums">
                {casilla.conteo > 0 ? casilla.conteo : ''}
              </span>
              <div
                className="w-full rounded-t-md transition-[height] duration-700 ease-out"
                style={{
                  height: `${Math.max(2, (casilla.conteo / tope) * 100)}%`,
                  backgroundColor: casilla.conteo > 0 ? tono(2) : 'var(--color-muted)',
                }}
              />
              <span className="text-base tabular-nums">{casilla.valor}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between text-base text-muted-foreground">
          <span>{datos.etiquetaMin || datos.min}</span>
          <span>{datos.etiquetaMax || datos.max}</span>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Muro
// --------------------------------------------------------------------------

export function Muro({ datos }: { datos: AgregadoMuro }) {
  if (datos.tarjetas.length === 0) {
    return <Esperando mensaje="Escribe tu respuesta en el celular y caerá aquí." />
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {datos.tarjetas.map((tarjeta, indice) => (
          <figure
            key={tarjeta.id}
            className="mb-4 flex break-inside-avoid flex-col gap-2 rounded-[10px] border border-border bg-card p-4"
            style={{ borderLeftWidth: 4, borderLeftColor: tono(indice + 1) }}
          >
            <blockquote className="text-lg leading-snug text-balance">{tarjeta.texto}</blockquote>
            {tarjeta.autor ? (
              <figcaption className="text-sm text-muted-foreground">{tarjeta.autor}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>

      {datos.total > datos.tarjetas.length ? (
        <p className="text-center text-sm text-muted-foreground">
          Se muestran las {datos.tarjetas.length} más recientes de {datos.total}.
        </p>
      ) : null}
    </div>
  )
}

// --------------------------------------------------------------------------

export function Visualizacion({ datos }: { datos: Agregado }) {
  switch (datos.tipo) {
    case 'nube':
      return <Nube datos={datos} />
    case 'opcion':
      return <Barras datos={datos} />
    case 'escala':
      return <Termometro datos={datos} />
    case 'muro':
      return <Muro datos={datos} />
  }
}
