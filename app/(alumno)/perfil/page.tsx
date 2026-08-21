import type { Metadata } from 'next'
import Link from 'next/link'

import { DatosDePerfil } from '@/components/alumno/datos-de-perfil'
import { Button } from '@/components/ui/button'
import { exigirPerfil } from '@/lib/auth/sesion'
import { misCertificados } from '@/lib/certificados/consultas'

export const metadata: Metadata = { title: 'Mi perfil' }
export const dynamic = 'force-dynamic'

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

/**
 * Perfil del alumno.
 *
 * §3.6 lo pide de pasada —"re-descargable desde el perfil"— pero es también
 * donde el alumno corrige su nombre, que es el que se imprime en el
 * certificado y el que ve quien lo verifica.
 */
export default async function PaginaPerfil() {
  const perfil = await exigirPerfil()
  const certificados = await misCertificados()

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">Tus datos y tus certificados.</p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Datos</h2>
        <DatosDePerfil nombre={perfil.full_name} correo={perfil.email} />
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">
          Certificados
          {certificados.length > 0 ? (
            <span className="text-muted-foreground"> · {certificados.length}</span>
          ) : null}
        </h2>

        {certificados.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            Todavía no tienes certificados. Completa un curso y aparecerá aquí.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {certificados.map((certificado) => (
              <li
                key={certificado.folio}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium text-balance">{certificado.curso}</span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono">{certificado.folio}</span> · emitido el{' '}
                    {fecha(certificado.emitidoEn)}
                  </span>
                </span>

                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button asChild size="sm">
                    <a href={`/api/certificados/${certificado.folio}`}>Descargar PDF</a>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/certificado/${certificado.folio}`}>Ver verificación</Link>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
