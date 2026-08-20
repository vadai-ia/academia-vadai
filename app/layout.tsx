import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
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
}

export const viewport: Viewport = {
  themeColor: '#0A1A2F',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" className={cn('font-sans', inter.variable)}>
      <body>{children}</body>
    </html>
  )
}
