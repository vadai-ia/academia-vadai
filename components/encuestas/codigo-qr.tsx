import { matrizQr, rutaQr } from '@/lib/encuestas/qr'
import { cn } from '@/lib/utils'

/**
 * El QR que se proyecta.
 *
 * LOS COLORES VAN A MANO, y es la única parte de la interfaz donde eso es
 * correcto. El contraste de un QR es funcional, no decorativo: un lector busca
 * módulos oscuros sobre fondo claro. Si esto usara tokens semánticos, en tema
 * oscuro saldría claro-sobre-oscuro y dejaría de escanearse — igual que el
 * wordmark, que va siempre sobre placa blanca porque es arte negro.
 *
 * Por eso tampoco se invierte con el tema: el blanco está horneado.
 */
export function CodigoQr({
  texto,
  tamano = 240,
  className,
}: {
  texto: string
  tamano?: number
  className?: string
}) {
  const matriz = matrizQr(texto)

  return (
    <svg
      viewBox={`0 0 ${matriz.ladoConMargen} ${matriz.ladoConMargen}`}
      width={tamano}
      height={tamano}
      className={cn('rounded-xl', className)}
      role="img"
      aria-label={`Código QR para entrar a ${texto}`}
      // `crispEdges` evita que el antialiasing difumine los bordes de los
      // módulos al escalar. Un QR borroso en un proyector es un QR que no lee.
      shapeRendering="crispEdges"
    >
      <rect width={matriz.ladoConMargen} height={matriz.ladoConMargen} fill="#ffffff" />
      <path d={rutaQr(matriz)} fill="#0a1a2f" />
    </svg>
  )
}
