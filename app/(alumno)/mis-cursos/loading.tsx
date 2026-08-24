import {
  EsqueletoEncabezado,
  EsqueletoTarjetas,
  PantallaDeCarga,
} from '@/components/marca/esqueleto'

export default function Cargando() {
  return (
    <PantallaDeCarga>
      <EsqueletoEncabezado />
      <EsqueletoTarjetas cuantas={2} />
    </PantallaDeCarga>
  )
}
