import type { Metadata } from 'next'

import { FormularioLogin } from '@/components/auth/formulario-login'

export const metadata: Metadata = { title: 'Entrar' }

/**
 * Un mensaje de error tiene que decir la causa Y la salida. "Intenta de nuevo"
 * cuando reintentar no puede funcionar es peor que no decir nada: manda a la
 * persona a repetir el mismo callejón.
 */
const ERRORES: Record<string, string> = {
  sinCuenta:
    'Ese correo de Google no tiene cuenta en la academia. El acceso se obtiene comprando ' +
    'un curso o por invitación — si ya compraste, entra con el correo que usaste al pagar.',
  cancelado: 'Cancelaste el acceso con Google. Puedes intentarlo otra vez o entrar con tu correo.',
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
