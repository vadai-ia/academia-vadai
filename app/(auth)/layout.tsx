import type { ReactNode } from 'react'

import { Wordmark } from '@/components/marca/wordmark'

/**
 * Marco de las pantallas de acceso. Mobile-first: el alumno típico entra desde
 * el celular (§0).
 */
export default function LayoutAuth({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12">
      <Wordmark />
      <main className="w-full max-w-sm">{children}</main>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Plataforma privada de VADAI. El acceso se obtiene comprando un curso o por
        invitación.
      </p>
    </div>
  )
}
