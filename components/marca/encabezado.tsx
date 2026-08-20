import { BotonSalir } from '@/components/auth/boton-salir'
import { Wordmark } from '@/components/marca/wordmark'
import { nombreVisible, type Perfil } from '@/lib/auth/sesion'

export function Encabezado({ perfil }: { perfil: Perfil }) {
  const equipo = perfil.role === 'admin' || perfil.role === 'superadmin'

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Wordmark className="text-sm" />

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {nombreVisible(perfil)}
            {equipo ? (
              <span className="ml-2 rounded-full border border-vadai-lima/40 bg-vadai-lima/10 px-2 py-0.5 text-[11px] text-vadai-lima">
                Equipo VADAI
              </span>
            ) : null}
          </span>
          <BotonSalir />
        </div>
      </div>
    </header>
  )
}
