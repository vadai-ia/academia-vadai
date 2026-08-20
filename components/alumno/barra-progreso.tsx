export function BarraProgreso({
  porcentaje,
  etiqueta,
}: {
  porcentaje: number
  etiqueta?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiqueta ?? 'Progreso del curso'}
      >
        <div
          className="h-full rounded-full bg-vadai-lima transition-[width] duration-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      {etiqueta ? <p className="text-xs text-muted-foreground">{etiqueta}</p> : null}
    </div>
  )
}
