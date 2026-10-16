import type { Metadata } from 'next'
import Link from 'next/link'

import { Diploma } from '@/components/diplomas/diploma'
import { RevelarDiploma } from '@/components/diplomas/revelar'
import { Tarjeta } from '@/components/ui-vadai/superficie'
import { Button } from '@/components/ui/button'
import { exigirPerfil } from '@/lib/auth/sesion'
import { misCertificados } from '@/lib/certificados/consultas'
import { diplomasPorAbrir, misDiplomas } from '@/lib/diplomas/consultas'

export const metadata: Metadata = { title: 'Mis certificaciones' }
export const dynamic = 'force-dynamic'

const hora = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))

/**
 * Mis certificaciones (15-oct-2026): los diplomas de generación de VADAI y
 * Total Coach, con su apertura sorpresa, y los certificados por curso.
 */
export default async function PaginaCertificaciones() {
  const perfil = await exigirPerfil()
  const [diplomas, porAbrir, certificados] = await Promise.all([
    misDiplomas(perfil),
    diplomasPorAbrir(perfil),
    misCertificados(),
  ])
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://academia.vadai.com.mx').replace(/\/+$/, '')
  const vacio = diplomas.length === 0 && porAbrir.length === 0 && certificados.length === 0

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1.5 print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Mis certificaciones</h1>
        <p className="text-sm text-muted-foreground">Tus diplomas y certificados de la academia.</p>
      </header>

      {porAbrir.map((p) => (
        <Tarjeta key={p.clave} className="flex flex-col items-center gap-2 p-8 text-center print:hidden">
          <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">Algo viene en camino</p>
          <p className="text-xl font-semibold text-balance">Tu diploma de {p.curso} se abre el {hora(p.visibleDesde)}.</p>
          <p className="text-sm text-muted-foreground">Vuelve a esta página a esa hora.</p>
        </Tarjeta>
      ))}

      {diplomas.map((d) => (
        <section key={d.programa.clave} className="flex flex-col gap-3">
          {d.vistaPrevia ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-2 text-center text-sm text-muted-foreground print:hidden">
              Vista del equipo: los alumnos lo ven a partir del {hora(d.programa.visibleDesde)}.
            </p>
          ) : null}
          <RevelarDiploma clave={d.programa.clave} nombre={d.nombre} programa={d.programa.curso}>
            <Diploma
              programa={d.programa}
              nombre={d.nombre}
              folio={d.folio}
              urlDeVerificacion={`${base}/diploma/${d.folio}`}
            />
          </RevelarDiploma>
        </section>
      ))}

      {certificados.length > 0 ? (
        <section className="flex flex-col gap-4 print:hidden">
          <h2 className="text-lg font-semibold">Certificados de cursos</h2>
          <ul className="flex flex-col gap-3">
            {certificados.map((c) => (
              <li
                key={c.folio}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium text-balance">{c.curso}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.folio}</span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button asChild size="sm">
                    <a href={`/api/certificados/${c.folio}`}>Descargar PDF</a>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/certificado/${c.folio}`}>Ver verificación</Link>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {vacio ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          Todavía no tienes certificaciones. Aquí aparecerán tus diplomas y certificados.
        </p>
      ) : null}
    </div>
  )
}
