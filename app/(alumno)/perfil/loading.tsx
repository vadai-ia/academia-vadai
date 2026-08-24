import {
  Bloque,
  EsqueletoEncabezado,
  EsqueletoLineas,
  PantallaDeCarga,
} from '@/components/marca/esqueleto'

export default function Cargando() {
  return (
    <PantallaDeCarga>
      <EsqueletoEncabezado />
      <div className="flex max-w-2xl flex-col gap-4">
        <Bloque className="h-11 w-full" />
        <Bloque className="h-11 w-full" />
      </div>
      <EsqueletoLineas cuantas={2} />
    </PantallaDeCarga>
  )
}
