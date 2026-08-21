import 'server-only'

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

/**
 * Plantilla del certificado (§3.6).
 *
 * Horizontal, A4, con la paleta de §9. Sin imágenes: el wordmark va como texto.
 * Esto no es una limitación temporal por que falte el asset — un PDF que embebe
 * un PNG pesa varias veces más y se ve borroso al imprimirlo, mientras que el
 * texto es vectorial y sale nítido a cualquier tamaño. Cuando llegue el logo
 * definitivo, lo que conviene es un SVG, no un mapa de bits.
 *
 * Tipografía: las Helvetica que trae @react-pdf, sin registrar fuentes remotas.
 * Registrar una fuente hace que el render salga a la red en cada emisión, y un
 * timeout de Google Fonts no puede ser el motivo por el que un alumno no reciba
 * su certificado.
 */

const NAVY = '#0A1A2F'
const CYAN = '#00A0DB'
const LIMA = '#C6F24E'
const BLANCO = '#F5F8FB'
const GRIS = '#93A3B5'

const estilos = StyleSheet.create({
  pagina: {
    backgroundColor: NAVY,
    color: BLANCO,
    paddingVertical: 48,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
  },

  marco: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1C3A5E',
    borderRadius: 6,
    paddingVertical: 34,
    paddingHorizontal: 44,
    justifyContent: 'space-between',
  },

  encabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  wordmark: { fontFamily: 'Helvetica-Bold', fontSize: 20, letterSpacing: 3, color: BLANCO },
  academia: { fontSize: 8, letterSpacing: 2.5, color: CYAN, marginTop: 3 },

  folioCaja: { alignItems: 'flex-end' },
  folioEtiqueta: { fontSize: 7, letterSpacing: 1.5, color: GRIS },
  folioValor: { fontFamily: 'Courier-Bold', fontSize: 10, color: LIMA, marginTop: 3 },

  centro: { alignItems: 'center', marginVertical: 4 },
  antetitulo: { fontSize: 9, letterSpacing: 3, color: GRIS },

  nombre: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 32,
    color: BLANCO,
    marginTop: 14,
    textAlign: 'center',
  },

  regla: { width: 190, height: 2, backgroundColor: LIMA, marginTop: 14 },

  conector: { fontSize: 10, color: GRIS, marginTop: 16 },

  curso: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 19,
    color: CYAN,
    marginTop: 8,
    textAlign: 'center',
  },

  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bloquePie: { maxWidth: 250 },
  etiquetaPie: { fontSize: 7, letterSpacing: 1.5, color: GRIS },
  valorPie: { fontSize: 9, color: BLANCO, marginTop: 4 },
  urlPie: { fontSize: 8, color: CYAN, marginTop: 4 },

  firma: { alignItems: 'flex-end' },
  lineaFirma: { width: 150, height: 1, backgroundColor: '#1C3A5E', marginBottom: 5 },
  nombreFirma: { fontSize: 9, color: BLANCO },
  cargoFirma: { fontSize: 7, color: GRIS, marginTop: 2 },
})

export type DatosCertificado = {
  nombre: string
  curso: string
  folio: string
  emitidoEn: Date
  urlVerificacion: string
}

function fechaLarga(fecha: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(fecha)
}

export function Certificado({
  nombre,
  curso,
  folio,
  emitidoEn,
  urlVerificacion,
}: DatosCertificado) {
  return (
    <Document
      title={`Certificado ${folio}`}
      author="VADAI"
      subject={curso}
      creator="VADAI Academia"
    >
      <Page size="A4" orientation="landscape" style={estilos.pagina}>
        <View style={estilos.marco}>
          <View style={estilos.encabezado}>
            <View>
              <Text style={estilos.wordmark}>VADAI</Text>
              <Text style={estilos.academia}>ACADEMIA</Text>
            </View>
            <View style={estilos.folioCaja}>
              <Text style={estilos.folioEtiqueta}>FOLIO</Text>
              <Text style={estilos.folioValor}>{folio}</Text>
            </View>
          </View>

          <View style={estilos.centro}>
            <Text style={estilos.antetitulo}>CERTIFICADO DE FINALIZACIÓN</Text>
            <Text style={estilos.nombre}>{nombre}</Text>
            <View style={estilos.regla} />
            <Text style={estilos.conector}>ha completado satisfactoriamente el curso</Text>
            <Text style={estilos.curso}>{curso}</Text>
          </View>

          <View style={estilos.pie}>
            <View style={estilos.bloquePie}>
              <Text style={estilos.etiquetaPie}>EMITIDO EL</Text>
              <Text style={estilos.valorPie}>{fechaLarga(emitidoEn)}</Text>
              <Text style={estilos.etiquetaPie}>{'\n'}VERIFICA ESTE CERTIFICADO EN</Text>
              <Text style={estilos.urlPie}>{urlVerificacion}</Text>
            </View>

            <View style={estilos.firma}>
              <View style={estilos.lineaFirma} />
              <Text style={estilos.nombreFirma}>Alejandro Martínez</Text>
              <Text style={estilos.cargoFirma}>VADAI</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
