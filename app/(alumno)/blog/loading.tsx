import { Bloque, EsqueletoEncabezado, PantallaDeCarga } from '@/components/marca/esqueleto'

export default function Cargando() {
  return (
    <PantallaDeCarga>
      <EsqueletoEncabezado />
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Bloque className="h-6 w-2/3" />
          <Bloque className="h-3.5 w-32" />
          <Bloque className="h-3.5 w-full" />
          <Bloque className="h-3.5 w-5/6" />
        </div>
      ))}
    </PantallaDeCarga>
  )
}
