import { Badge } from '@/components/ui/badge'
import { Seccion } from '@/components/ui-vadai/superficie'
import type { Agregado } from '@/lib/encuestas/agregados'
import { ETIQUETA_TIPO_PREGUNTA } from '@/lib/encuestas/comun'
import type { DatosExportacion, PreguntaExportada } from '@/lib/encuestas/exportacion'

/**
 * Los resultados, para LEERSE en el panel.
 *
 * No reusa los componentes de la proyección a propósito: aquellos están hechos
 * para verse a diez metros —un promedio en 96 píxeles, barras de dos centímetros—
 * y aquí el admin quiere repasar cifras en una pantalla a medio metro. Es la
 * misma información con otra densidad, que es una decisión de diseño, no una
 * duplicación por descuido.
 *
 * Los números salen de `agregar()`, el mismo módulo puro que alimenta la pared y
 * el PDF, así que las tres superficies no pueden discrepar.
 */

const TONOS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const

const tono = (n: number) => TONOS[(n - 1) % TONOS.length]

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

function Vacio({ children }: { children: string }) {
  return (
    <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

function Cuerpo({ agregado }: { agregado: Agregado }) {
  if (agregado.total === 0) return <Vacio>Nadie contestó esta pregunta.</Vacio>

  switch (agregado.tipo) {
    case 'nube': {
      const tope = agregado.palabras[0]?.conteo ?? 1
      return (
        <ul className="flex flex-wrap gap-2">
          {agregado.palabras.map((p, i) => (
            <li
              key={p.palabra}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm"
              // La palabra más repetida se marca con el color; el resto se
              // distingue por el conteo, que es el dato que se consulta.
              style={p.conteo === tope ? { borderColor: tono(i + 1) } : undefined}
            >
              <span>{p.palabra}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{p.conteo}</span>
            </li>
          ))}
        </ul>
      )
    }

    case 'opcion': {
      const tope = Math.max(1, ...agregado.opciones.map((o) => o.conteo))
      return (
        <ul className="flex flex-col gap-3">
          {agregado.opciones.map((opcion, i) => (
            <li key={opcion.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm">{opcion.texto}</span>
                <span className="shrink-0 text-sm tabular-nums">
                  {opcion.porcentaje}%
                  <span className="ml-2 text-muted-foreground">({opcion.conteo})</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(opcion.conteo / tope) * 100}%`,
                    backgroundColor: tono(i + 1),
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )
    }

    case 'escala': {
      const tope = Math.max(1, ...agregado.histograma.map((h) => h.conteo))
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span
              className="text-[1.75rem] leading-none font-medium tabular-nums"
              style={{ color: tono(1) }}
            >
              {agregado.promedio}
            </span>
            <span className="text-sm text-muted-foreground">
              de promedio · {agregado.total} respuesta(s) · del {agregado.min} al {agregado.max}
            </span>
          </div>

          {/* La distribución, porque el promedio solo no distingue una sala de
              acuerdo de una partida en dos. */}
          <div className="flex h-16 items-end gap-1">
            {agregado.histograma.map((casilla) => (
              <div key={casilla.valor} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${Math.max(3, (casilla.conteo / tope) * 100)}%`,
                    backgroundColor: casilla.conteo > 0 ? tono(2) : 'var(--color-muted)',
                  }}
                />
                <span className="text-xs text-muted-foreground tabular-nums">{casilla.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    case 'muro':
      return (
        <ul className="flex flex-col gap-2">
          {agregado.tarjetas.map((tarjeta, i) => (
            <li
              key={tarjeta.id}
              className="rounded-[10px] border border-border p-3"
              style={{ borderLeftWidth: 3, borderLeftColor: tono(i + 1) }}
            >
              <p className="text-sm">{tarjeta.texto}</p>
              {tarjeta.autor ? (
                <p className="mt-1 text-xs text-muted-foreground">{tarjeta.autor}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )
  }
}

function Pregunta({ pregunta, indice }: { pregunta: PreguntaExportada; indice: number }) {
  const ocultas = pregunta.respuestas.filter((r) => r.oculta).length

  return (
    <li className="flex flex-col gap-3 rounded-[10px] border border-border p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">{indice + 1}.</span>
          <span className="font-medium">{pregunta.prompt}</span>
        </span>
        <Badge variant="outline" className="shrink-0">
          {ETIQUETA_TIPO_PREGUNTA[pregunta.tipo]}
        </Badge>
      </div>

      <Cuerpo agregado={pregunta.agregado} />

      {ocultas > 0 ? (
        <p className="text-xs text-muted-foreground">
          {ocultas} respuesta(s) ocultada(s) en vivo. No se cuentan arriba, pero sí salen en la
          exportación, marcadas.
        </p>
      ) : null}
    </li>
  )
}

export function ResultadosEncuesta({ datos }: { datos: DatosExportacion }) {
  return (
    <div className="flex flex-col gap-8">
      <Seccion
        titulo="Respuestas"
        apoyo={
          datos.preguntas.length === 0
            ? 'Esta encuesta todavía no tiene preguntas.'
            : 'Lo mismo que vio la sala, en tamaño de lectura.'
        }
      >
        {datos.preguntas.length === 0 ? (
          <Vacio>Agrega preguntas en la pestaña anterior.</Vacio>
        ) : (
          <ul className="flex flex-col gap-4">
            {datos.preguntas.map((pregunta, i) => (
              <Pregunta key={pregunta.id} pregunta={pregunta} indice={i} />
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion
        titulo="Quién participó"
        apoyo="Cada persona que entró por el QR, con lo que dejó. Es el padrón que te llevas del evento."
      >
        {datos.participantes.length === 0 ? (
          <Vacio>Todavía no ha entrado nadie.</Vacio>
        ) : (
          <ul className="flex flex-col gap-2">
            {datos.participantes.map((persona) => (
              <li
                key={persona.email}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[10px] border border-border px-4 py-2.5"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {`${persona.nombre} ${persona.apellido}`.trim() || 'Sin nombre'}
                    </span>
                    {persona.tieneCuenta ? (
                      <Badge variant="secondary" className="shrink-0">
                        Con cuenta
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {persona.email}
                    {persona.telefono ? ` · ${persona.telefono}` : ''}
                  </span>
                </div>

                <div className="flex shrink-0 gap-4 text-xs text-muted-foreground tabular-nums">
                  <span>{persona.respondio} respuesta(s)</span>
                  <span>{fechaCorta(persona.entroEn)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  )
}
