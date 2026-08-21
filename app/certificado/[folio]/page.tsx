import type { Metadata } from 'next'
import Link from 'next/link'

import { verificarFolio } from '@/lib/certificados/verificacion'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ folio: string }>
}): Promise<Metadata> {
  const { folio } = await params
  return {
    title: `Certificado ${folio}`,
    // Un folio no debe acabar en un índice de búsqueda: es la credencial que
    // abre esta página.
    robots: { index: false, follow: false },
  }
}

function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

/**
 * Verificación pública de un certificado (§3.6).
 *
 * Sin login, a propósito: quien verifica un certificado es un reclutador o un
 * cliente, no un alumno, y pedirle una cuenta haría que nadie lo verificara.
 *
 * No es un 404 cuando el folio no existe. Un 404 deja a quien verifica sin
 * saber si se equivocó al teclear o si el certificado es falso, y esa distinción
 * es justo para lo que vino.
 */
export default async function PaginaCertificado({
  params,
}: {
  params: Promise<{ folio: string }>
}) {
  const { folio } = await params
  const certificado = await verificarFolio(folio)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-8 px-5 py-16">
      <header className="flex flex-col gap-1">
        <span className="text-lg font-semibold tracking-[0.2em]">VADAI</span>
        <span className="text-[0.7rem] tracking-[0.2em] text-vadai-cyan">ACADEMIA</span>
      </header>

      {certificado ? (
        <section className="flex flex-col gap-6 rounded-xl border border-border p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-vadai-lima px-3 py-1 text-xs font-semibold text-vadai-navy">
              Certificado válido
            </span>
            <p className="text-sm text-muted-foreground">
              Este certificado fue emitido por VADAI Academia y es auténtico.
            </p>
          </div>

          <dl className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs tracking-wider text-muted-foreground">OTORGADO A</dt>
              <dd className="text-xl font-semibold text-balance">{certificado.nombre}</dd>
            </div>

            <div className="flex flex-col gap-0.5">
              <dt className="text-xs tracking-wider text-muted-foreground">POR COMPLETAR</dt>
              <dd className="text-base font-medium text-vadai-cyan text-balance">
                {certificado.curso}
              </dd>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs tracking-wider text-muted-foreground">EMITIDO EL</dt>
                <dd className="text-sm">{fechaLarga(certificado.emitidoEn)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs tracking-wider text-muted-foreground">FOLIO</dt>
                <dd className="font-mono text-sm">{certificado.folio}</dd>
              </div>
            </div>
          </dl>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-6 sm:p-8">
          <span className="inline-flex w-fit items-center rounded-full border border-destructive px-3 py-1 text-xs font-semibold text-destructive">
            Sin resultados
          </span>
          <p className="text-sm text-muted-foreground">
            No encontramos ningún certificado con el folio{' '}
            <span className="font-mono text-foreground">{folio}</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Revisa que esté completo y bien tecleado. Tiene la forma{' '}
            <span className="font-mono text-foreground">VADAI-2026-XXXXXXXXXX</span> y no lleva
            las letras I, L, O ni U.
          </p>
        </section>
      )}

      <footer className="text-sm">
        <Link href="/" className="text-vadai-cyan underline-offset-4 hover:underline">
          Ir a VADAI Academia →
        </Link>
      </footer>
    </main>
  )
}
