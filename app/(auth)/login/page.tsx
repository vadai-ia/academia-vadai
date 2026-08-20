import type { Metadata } from 'next'

import { FormularioLogin } from '@/components/auth/formulario-login'

export const metadata: Metadata = { title: 'Entrar' }

const ERRORES: Record<string, string> = {
  google: 'No se pudo completar el acceso con Google. Intenta de nuevo o entra con tu correo.',
  enlace: 'Ese enlace ya venció o se usó. Pide uno nuevo desde "¿La olvidaste?".',
}

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; error?: string }>
}) {
  const { destino, error } = await searchParams

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Entra a tu academia</h1>
        <p className="text-sm text-muted-foreground">
          Usa el correo con el que compraste tu curso.
        </p>
      </header>

      <FormularioLogin
        destino={destino?.startsWith('/') ? destino : undefined}
        errorInicial={error ? ERRORES[error] : undefined}
      />
    </div>
  )
}
