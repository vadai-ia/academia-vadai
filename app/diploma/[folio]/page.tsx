import type { Metadata } from 'next'
import Link from 'next/link'

import { Diploma } from '@/components/diplomas/diploma'
import { verificarDiploma } from '@/lib/diplomas/consultas'

export const metadata: Metadata = { title: 'Verificación de diploma', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * Verificación pública de un diploma VADAI · Total Coach por su folio. Sin
 * sesión, como /certificado/[folio].
 */
export default async function PaginaVerificarDiploma({ params }: { params: Promise<{ folio: string }> }) {
  const { folio } = await params
  const diploma = await verificarDiploma(decodeURIComponent(folio))
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://academia.vadai.com.mx').replace(/\/+$/, '')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-5 py-10">
      {diploma ? (
        <>
          <div className="flex flex-col gap-1.5 text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">Diploma verificado</p>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {diploma.nombre} · {diploma.programa.curso}, {diploma.programa.generacion}
            </h1>
            <p className="text-sm text-muted-foreground">
              Emitido por VADAI y Total Coach el {diploma.programa.emitido}.
            </p>
          </div>
          <Diploma
            programa={diploma.programa}
            nombre={diploma.nombre}
            folio={diploma.folio}
            urlDeVerificacion={`${base}/diploma/${diploma.folio}`}
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">No encontramos ese folio</h1>
          <p className="text-sm text-muted-foreground">Revisa que esté escrito tal cual aparece en el diploma.</p>
        </div>
      )}
      <p className="text-center text-sm">
        <Link href="/" className="text-primary hover:underline">
          Academia VADAI
        </Link>
      </p>
    </main>
  )
}
