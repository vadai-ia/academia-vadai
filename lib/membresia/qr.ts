import { matrizQr, rutaQr } from '@/lib/encuestas/qr'

/**
 * El QR de V-AI-P para imprimir (M17): el código, el nombre y la dirección
 * debajo, en un SVG que escala sin pixelarse.
 *
 * Colores horneados, como en `components/encuestas/codigo-qr.tsx`: un lector
 * busca módulos oscuros sobre fondo claro, en cualquier tema. Sin logo encima
 * del código: obligaría a subir la corrección a 'H' y a módulos más chicos.
 */

const escapar = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function svgDelQr(texto: string, leyenda: string, pie: string): string {
  const matriz = matrizQr(texto)
  const escala = 10
  const lado = matriz.ladoConMargen * escala
  const alto = lado + 110
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${alto}" width="${lado}" height="${alto}">
  <rect width="${lado}" height="${alto}" fill="#ffffff"/>
  <g transform="scale(${escala})" shape-rendering="crispEdges">
    <path d="${rutaQr(matriz)}" fill="#0a1a2f"/>
  </g>
  <text x="${lado / 2}" y="${lado + 42}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="#0a1a2f">${escapar(leyenda)}</text>
  <text x="${lado / 2}" y="${lado + 84}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="#4e6572">${escapar(pie)}</text>
</svg>
`
}
