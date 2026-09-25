import type { ReactNode } from 'react'

/**
 * Iconos de la navegación principal. De línea, mismo grosor y mismo tamaño.
 *
 * Este archivo NO lleva 'use client', y no es un descuido. Estos iconos son
 * elementos ya construidos (`<svg>`), no componentes. Cuando vivían en
 * `navegacion.tsx` —que sí es de cliente— el layout del servidor no recibía un
 * `<svg>` sino una referencia al módulo de cliente, y el navegador la resolvía
 * al elemento que creó ese módulo: uno que React ya congeló. En desarrollo el
 * lector de RSC intenta anotarle `_debugInfo` y revienta con
 *
 *   TypeError: Cannot redefine property: _debugInfo
 *
 * en TODAS las páginas que llevan encabezado. Producción no lo ve porque esa
 * anotación solo existe en desarrollo, y por eso pasó las suites, que corren
 * contra `pnpm start`.
 *
 * Aquí el servidor los serializa como SVG normal y de paso no pesan en el bundle.
 * La regla general: de un archivo 'use client' se exportan componentes, nunca
 * elementos.
 */

function marco(hijos: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      {hijos}
    </svg>
  )
}

export const IconoInicio = marco(
  <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </>
)

export const IconoCursos = marco(
  <>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </>
)

export const IconoBlog = marco(
  <>
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h4" />
    <path d="M10 6h8M10 10h8M10 14h4" />
  </>
)

/** Dos siluetas: es la comunidad, no una sola persona (que es Mi perfil). */
export const IconoComunidad = marco(
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
)

/** Un trofeo: es el marcador, no una estadística cualquiera. */
export const IconoPuntos = marco(
  <>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </>
)

export const IconoPerfil = marco(
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>
)

export const IconoPanel = marco(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </>
)

/** Un edificio: las empresas de las que vienen los alumnos. */
export const IconoEmpresas = marco(
  <>
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1" />
  </>
)

/** Barras de una gráfica en vivo: es lo que la sala ve crecer en la proyección. */
export const IconoEncuestas = marco(
  <>
    <path d="M3 3v18h18" />
    <rect x="7" y="12" width="3" height="6" rx="0.5" />
    <rect x="12" y="8" width="3" height="10" rx="0.5" />
    <rect x="17" y="5" width="3" height="13" rx="0.5" />
  </>
)

/** Una rejilla: la matriz de decisión que cada empresa llena en las dinámicas. */
export const IconoDinamicas = marco(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </>
)
