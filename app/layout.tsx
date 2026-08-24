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
  icons: {
    icon: [
      { url: '/vadai-sello-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/vadai-sello.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/vadai-sello.png',
  },
}

export const viewport: Viewport = {
  // Uno por tema: es el color de la barra del navegador en móvil, y con un solo
  // valor el tema claro quedaría con una barra navy que no le corresponde.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f8fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1a2f' },
  ],
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
