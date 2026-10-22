import type { MetadataRoute } from 'next'

/**
 * La academia como app en la pantalla de inicio (22-oct-2026).
 *
 * Alejandro: «que puedan instalar la app web en su inicio como en iPhone para
 * poder verla desde su teléfono fácilmente sin ingresar a la web». Con esto,
 * Android ofrece «Instalar app» y abre la academia sin barra del navegador; el
 * iPhone toma el nombre y el icono de `appleWebApp` en app/layout.tsx. Cómo se
 * instala en cada teléfono lo explica /instalar.
 *
 * Abre en /mis-cursos y no en /: la raíz solo redirige, y quien la instaló ya
 * tiene cuenta. Si su sesión expiró, el middleware lo manda a entrar y de
 * regreso. El manifiesto es público (lib/auth/rutas.ts): el navegador lo pide
 * sin cookies.
 *
 * Los iconos salen de `pnpm iconos` (scripts/generar-iconos.py).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/mis-cursos',
    name: 'VADAI Academia',
    short_name: 'VADAI',
    description: 'Tus cursos, las clases de V-AI-P y la comunidad de VADAI.',
    lang: 'es-MX',
    start_url: '/mis-cursos',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // El mismo claro del `themeColor` del layout: la barra de estado y la
    // pantalla de arranque no cambian de color al abrir.
    background_color: '#f5f8fb',
    theme_color: '#f5f8fb',
    icons: [
      { src: '/vadai-app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/vadai-app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/vadai-app-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
