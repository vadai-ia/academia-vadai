import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { GUION_TEMA } from '@/lib/tema/guion'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: 'VADAI Academia',
    template: '%s · VADAI Academia',
  },
  description: 'Academia online de VADAI: IA aplicada para dueños de negocio.',
  // Plataforma privada: el acceso es un producto pagado, no hay nada que indexar.
  robots: { index: false, follow: false },
  // Cuatro tamaños porque el navegador elige, y a 16 px el sello completo —con
  // su anillo de texto— es puré gris. Los chicos llevan solo el monograma; los
  // grandes, el sello entero, donde el anillo sí se lee.
  //
  // El fondo blanco va HORNEADO en el PNG, no puesto con CSS: la pestaña la
  // pinta el navegador y ahí no llega ninguna hoja de estilos. El arte es negro
  // sobre transparente, así que sin disco desaparece.
  icons: {
    icon: [
      { url: '/vadai-sello-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/vadai-sello-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/vadai-sello-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/vadai-sello.png', sizes: '512x512', type: 'image/png' },
    ],
    // iOS compone el icono sobre NEGRO y le pone su propia máscara redondeada:
    // este va con el cuadrado entero blanco, no con disco, o saldría con las
    // esquinas negras.
    apple: '/vadai-apple.png',
  },
}

export const viewport: Viewport = {
  // Color de la barra del navegador en móvil. Uno solo y claro, porque el tema
  // por defecto de la plataforma es el claro y NO sigue al sistema: con la
  // variante por `prefers-color-scheme` puesta, quien tuviera el equipo en
  // oscuro vería una barra navy sobre una página blanca.
  themeColor: '#f5f8fb',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" className={cn('font-sans', inter.variable)} suppressHydrationWarning>
      <head>
        {/*
          Va aquí, inline y antes de cualquier pintado, y no en un componente.

          Si el tema se aplicara después de hidratar, quien tiene el sistema en
          claro vería primero la página en oscuro y luego el salto: el destello
          blanco/negro que delata a las apps mal hechas. Este script corre
          síncrono en el <head>, así que el navegador ya pinta el tema correcto
          la primera vez.

          `suppressHydrationWarning` en <html> es necesario porque este script
          modifica la clase del elemento antes de que React lo compare con lo
          que renderizó el servidor.
        */}
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
