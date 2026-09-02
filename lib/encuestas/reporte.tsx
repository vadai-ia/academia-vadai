import 'server-only'

import { Document, Page, Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'

import type { Agregado } from './agregados'
import { acomodarNube } from './layout-nube'
import { matrizQr, rutaQr } from './qr'
import type { DatosExportacion, PreguntaExportada } from './exportacion'

/**
 * El reporte en PDF de una encuesta, con sus gráficas.
 *
 * LAS GRÁFICAS SE REDIBUJAN EN VECTOR, no se capturan. No hay navegador sin
 * cabeza en este stack ni se va a instalar uno: `@react-pdf/renderer` trae
 * primitivas SVG —`Svg`, `Rect`, `Path`, `Text`— y con eso se pinta lo mismo que
 * la pantalla, pero en un PDF que se imprime nítido a cualquier tamaño.
 *
 * LO QUE HACE QUE COINCIDAN es que el layout no vive aquí: la nube la acomoda
 * `acomodarNube()` y el QR lo arma `matrizQr()`, los mismos módulos puros que usa
 * la proyección. Si este archivo calculara posiciones por su cuenta, el reporte
 * mostraría un dibujo distinto del que la sala vio en la pared, y nadie sabría
 * cuál es el bueno.
 *
 * Mismo criterio que `lib/certificados/plantilla.tsx`: sin imágenes y sin
 * registrar fuentes remotas. Un timeout de Google Fonts no puede ser el motivo
 * por el que no salga un reporte.
 */

const NAVY = '#0A1A2F'
const CYAN = '#00A0DB'
const AZUL = '#006E96'
const GRIS = '#93A3B5'
const TINTA = '#0A1A2F'
const BORDE = '#D3DFEA'
const PAPEL = '#FFFFFF'

/** Los cinco tonos de las gráficas, en el orden de `--chart-1..5` del tema claro. */
const TONOS = [AZUL, '#7BA428', CYAN, '#4A6580', NAVY]
const tono = (n: number) => TONOS[(n - 1) % TONOS.length] ?? AZUL

/**
 * Deja solo lo que las Helvetica internas saben dibujar.
 *
 * Las fuentes estándar del PDF cubren WinAnsi; un emoji fuera de ese rango sale
 * como un cuadro vacío o rompe el render. Se sustituye por un punto medio.
 *
 * Es una pérdida real y consciente: en un muro de respuestas escritas desde
 * celulares va a haber emojis. La alternativa sería empaquetar una fuente de
 * color de varios megabytes en el repo, y no vale ese precio para un reporte que
 * se lee por su texto.
 */
function limpiar(texto: string): string {
  return texto.replace(/[^\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, '·')
}

const estilos = StyleSheet.create({
  pagina: {
    backgroundColor: PAPEL,
    color: TINTA,
    paddingVertical: 40,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },

  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: BORDE,
    paddingBottom: 14,
    marginBottom: 18,
  },
  wordmark: { fontFamily: 'Helvetica-Bold', fontSize: 14, letterSpacing: 2.5, color: NAVY },
  academia: { fontSize: 6.5, letterSpacing: 2, color: AZUL, marginTop: 2 },

  titulo: { fontFamily: 'Helvetica-Bold', fontSize: 19, marginBottom: 4 },
  apoyo: { fontSize: 10, color: GRIS },

  cifras: { flexDirection: 'row', gap: 26, marginTop: 14, marginBottom: 6 },
  cifraValor: { fontFamily: 'Helvetica-Bold', fontSize: 17, color: AZUL },
  cifraEtiqueta: { fontSize: 8, color: GRIS, marginTop: 1 },

  seccion: { marginTop: 20 },
  preguntaNum: { fontSize: 8, letterSpacing: 1.5, color: GRIS, marginBottom: 3 },
  preguntaTexto: { fontFamily: 'Helvetica-Bold', fontSize: 13, marginBottom: 10 },

  fila: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  etiqueta: { fontSize: 10, flex: 1 },
  conteo: { fontSize: 10, color: GRIS, width: 74, textAlign: 'right' },

  tarjeta: {
    borderWidth: 1,
    borderColor: BORDE,
    borderLeftWidth: 3,
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
  },
  tarjetaTexto: { fontSize: 10, lineHeight: 1.35 },
  tarjetaAutor: { fontSize: 8, color: GRIS, marginTop: 3 },

  vacio: {
    borderWidth: 1,
    borderColor: BORDE,
    borderStyle: 'dashed',
    borderRadius: 3,
    padding: 14,
    textAlign: 'center',
    color: GRIS,
    fontSize: 9,
  },

  pie: {
    position: 'absolute',
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: GRIS,
  },
})

// --------------------------------------------------------------------------
// Las cuatro gráficas, en vector
// --------------------------------------------------------------------------

function NubePdf({ datos }: { datos: Extract<Agregado, { tipo: 'nube' }> }) {
  if (datos.palabras.length === 0) return <Text style={estilos.vacio}>Nadie contestó.</Text>

  // El MISMO acomodo que se proyectó. Ver el encabezado de este archivo.
  const layout = acomodarNube(datos)

  // El ancho útil de la página (A4 menos los márgenes) y el alto que le toca
  // por proporción: así la nube conserva la forma con la que se acomodó.
  const ancho = 507
  const alto = Math.round(ancho * (layout.alto / layout.ancho))

  return (
    <Svg viewBox={`0 0 ${layout.ancho} ${layout.alto}`} width={ancho} height={alto}>
      {layout.palabras.map((p) => (
        <Text
          key={p.palabra}
          x={p.x}
          y={p.y + p.tamano * 0.34}
          fill={tono(p.tono)}
          textAnchor="middle"
          // El tamaño va por `style` y no como prop: el <Text> de SVG en
          // react-pdf no acepta `fontSize` suelto.
          style={{ fontSize: p.tamano }}
        >
          {limpiar(p.palabra)}
        </Text>
      ))}
    </Svg>
  )
}

function BarrasPdf({ datos }: { datos: Extract<Agregado, { tipo: 'opcion' }> }) {
  if (datos.opciones.length === 0) return <Text style={estilos.vacio}>Sin opciones.</Text>

  const tope = Math.max(1, ...datos.opciones.map((o) => o.conteo))

  return (
    <View>
      {datos.opciones.map((opcion, i) => (
        <View key={opcion.id} style={{ marginBottom: 9 }}>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>{limpiar(opcion.texto)}</Text>
            <Text style={estilos.conteo}>
              {opcion.porcentaje}% ({opcion.conteo})
            </Text>
          </View>
          <Svg viewBox="0 0 100 4" width={507} height={11}>
            <Rect x={0} y={0} width={100} height={4} rx={1.4} fill="#E8EEF5" />
            <Rect
              x={0}
              y={0}
              width={Math.max(0.6, (opcion.conteo / tope) * 100)}
              height={4}
              rx={1.4}
              fill={tono(i + 1)}
            />
          </Svg>
        </View>
      ))}
    </View>
  )
}

function TermometroPdf({ datos }: { datos: Extract<Agregado, { tipo: 'escala' }> }) {
  if (datos.total === 0) return <Text style={estilos.vacio}>Nadie contestó.</Text>

  const tope = Math.max(1, ...datos.histograma.map((h) => h.conteo))
  const ancho = 100 / Math.max(1, datos.histograma.length)

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 30, color: AZUL }}>
          {datos.promedio}
        </Text>
        <Text style={{ fontSize: 10, color: GRIS }}>
          promedio de {datos.total} respuesta(s), del {datos.min} al {datos.max}
        </Text>
      </View>

      {/* El histograma: el promedio solo no distingue una sala de acuerdo de una
          sala partida en dos, y esa diferencia es justo la que se comenta. */}
      <Svg viewBox="0 0 100 30" width={507} height={90}>
        {datos.histograma.map((casilla, i) => {
          const altura = Math.max(0.7, (casilla.conteo / tope) * 28)
          return (
            <Rect
              key={casilla.valor}
              x={i * ancho + ancho * 0.12}
              y={30 - altura}
              width={ancho * 0.76}
              height={altura}
              rx={0.6}
              fill={casilla.conteo > 0 ? tono(2) : '#E8EEF5'}
            />
          )
        })}
      </Svg>

      <View style={{ flexDirection: 'row', marginTop: 3 }}>
        {datos.histograma.map((casilla) => (
          <Text
            key={casilla.valor}
            style={{ width: 507 / datos.histograma.length, fontSize: 7.5, textAlign: 'center', color: GRIS }}
          >
            {casilla.valor}
          </Text>
        ))}
      </View>

      {datos.etiquetaMin || datos.etiquetaMax ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ fontSize: 8, color: GRIS }}>{limpiar(datos.etiquetaMin)}</Text>
          <Text style={{ fontSize: 8, color: GRIS }}>{limpiar(datos.etiquetaMax)}</Text>
        </View>
      ) : null}
    </View>
  )
}

function MuroPdf({ datos }: { datos: Extract<Agregado, { tipo: 'muro' }> }) {
  if (datos.tarjetas.length === 0) return <Text style={estilos.vacio}>Nadie contestó.</Text>

  return (
    <View>
      {datos.tarjetas.map((tarjeta, i) => (
        <View key={tarjeta.id} style={[estilos.tarjeta, { borderLeftColor: tono(i + 1) }]} wrap={false}>
          <Text style={estilos.tarjetaTexto}>{limpiar(tarjeta.texto)}</Text>
          {tarjeta.autor ? (
            <Text style={estilos.tarjetaAutor}>{limpiar(tarjeta.autor)}</Text>
          ) : null}
        </View>
      ))}
      {datos.total > datos.tarjetas.length ? (
        <Text style={{ fontSize: 8, color: GRIS, marginTop: 2 }}>
          Se muestran las {datos.tarjetas.length} más recientes de {datos.total}. El Excel las trae
          todas.
        </Text>
      ) : null}
    </View>
  )
}

function Grafica({ agregado }: { agregado: Agregado }) {
  switch (agregado.tipo) {
    case 'nube':
      return <NubePdf datos={agregado} />
    case 'opcion':
      return <BarrasPdf datos={agregado} />
    case 'escala':
      return <TermometroPdf datos={agregado} />
    case 'muro':
      return <MuroPdf datos={agregado} />
  }
}

// --------------------------------------------------------------------------

function QrPdf({ texto, tamano = 86 }: { texto: string; tamano?: number }) {
  const matriz = matrizQr(texto)
  return (
    <Svg
      viewBox={`0 0 ${matriz.ladoConMargen} ${matriz.ladoConMargen}`}
      width={tamano}
      height={tamano}
    >
      <Rect x={0} y={0} width={matriz.ladoConMargen} height={matriz.ladoConMargen} fill="#FFFFFF" />
      <Path d={rutaQr(matriz)} fill={NAVY} />
    </Svg>
  )
}

function Seccion({ pregunta, indice }: { pregunta: PreguntaExportada; indice: number }) {
  return (
    <View style={estilos.seccion} wrap={false}>
      <Text style={estilos.preguntaNum}>PREGUNTA {indice + 1}</Text>
      <Text style={estilos.preguntaTexto}>{limpiar(pregunta.prompt)}</Text>
      <Grafica agregado={pregunta.agregado} />
    </View>
  )
}

export type DatosReporte = {
  datos: DatosExportacion
  url: string
  emitidoEn: Date
}

export function Reporte({ datos, url, emitidoEn }: DatosReporte) {
  const respondieron = datos.preguntas.reduce((n, p) => n + p.respuestas.length, 0)
  const fecha = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'long',
    timeZone: 'America/Mexico_City',
  }).format(emitidoEn)

  return (
    <Document
      title={`Encuesta ${datos.codigo}`}
      author="VADAI"
      subject={datos.titulo}
      creator="VADAI Academia"
    >
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.encabezado} fixed>
          <View>
            <Text style={estilos.wordmark}>VADAI</Text>
            <Text style={estilos.academia}>ACADEMIA</Text>
          </View>
          <QrPdf texto={url} />
        </View>

        <Text style={estilos.titulo}>{limpiar(datos.titulo)}</Text>
        <Text style={estilos.apoyo}>
          {limpiar(datos.curso)}
          {datos.cohorte ? ` · ${limpiar(datos.cohorte)}` : ''} · código {datos.codigo}
        </Text>

        <View style={estilos.cifras}>
          <View>
            <Text style={estilos.cifraValor}>{datos.participantes.length}</Text>
            <Text style={estilos.cifraEtiqueta}>participantes</Text>
          </View>
          <View>
            <Text style={estilos.cifraValor}>{respondieron}</Text>
            <Text style={estilos.cifraEtiqueta}>respuestas</Text>
          </View>
          <View>
            <Text style={estilos.cifraValor}>{datos.preguntas.length}</Text>
            <Text style={estilos.cifraEtiqueta}>preguntas</Text>
          </View>
        </View>

        {datos.preguntas.length === 0 ? (
          <Text style={estilos.vacio}>Esta encuesta no tiene preguntas.</Text>
        ) : (
          datos.preguntas.map((pregunta, i) => (
            <Seccion key={pregunta.id} pregunta={pregunta} indice={i} />
          ))
        )}

        <View style={estilos.pie} fixed>
          <Text>
            {limpiar(datos.titulo)} · {fecha}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
