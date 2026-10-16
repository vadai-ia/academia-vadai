import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Avatar, Cifra, Seccion, Tarjeta } from '@/components/ui-vadai/superficie'
import { Logros } from '@/components/vaip/logros'
import { exigirPerfil } from '@/lib/auth/sesion'
import { planVaip } from '@/lib/membresia/consultas'
import { perfilDeMiembro } from '@/lib/membresia/espacio'

export const metadata: Metadata = { title: 'Perfil de miembro' }
export const dynamic = 'force-dynamic'

/**
 * El perfil que un miembro de V-AI-P ve de otro (M17, fase 2): foto, nombre,
 * empresa, bio, puntos, nivel y logros. Decidido por Alejandro con empresa
 * incluida. La regla de quién ve a quién vive en la base
 * (`academia_perfil_de_miembro`): fuera de eso, 404.
 */
export default async function PaginaMiembro({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const perfil = await exigirPerfil()
  const plan = await planVaip()
  if (!plan) notFound()
  const miembro = await perfilDeMiembro(plan.id, userId, perfil.user_id)
  if (!miembro) notFound()

  const esMio = miembro.userId === perfil.user_id
  const ganados = miembro.logros.filter((l) => l.ganado).length

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Link href="/vaip" className="text-sm text-muted-foreground hover:text-primary">
        ← V-AI-P
      </Link>

      <Tarjeta className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <Avatar nombre={miembro.nombre} foto={miembro.foto} tamano={96} className="text-3xl" />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{miembro.nombre}</h1>
            {miembro.esEquipo ? (
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                Equipo VADAI
              </span>
            ) : null}
          </div>
          {miembro.empresa ? <p className="text-sm text-muted-foreground">{miembro.empresa}</p> : null}
          {miembro.bio ? <p className="text-pretty">{miembro.bio}</p> : null}
          {esMio ? (
            <Link href="/perfil" className="text-sm font-medium text-primary hover:underline">
              {miembro.bio || miembro.foto ? 'Editar mi foto y mi bio' : 'Agrega tu foto y una línea sobre ti'}
            </Link>
          ) : null}
        </div>
      </Tarjeta>

      {miembro.puesto ? (
        <div className="grid grid-cols-3 gap-4">
          <Cifra valor={miembro.puesto.puntos} etiqueta="puntos en V-AI-P" destacada />
          <Cifra valor={miembro.puesto.nivel.nombre} etiqueta="nivel" />
          <Cifra valor={`#${miembro.puesto.lugar}`} etiqueta="en el ranking" />
        </div>
      ) : null}

      <Seccion titulo="Logros" apoyo={`${ganados} de ${miembro.logros.length}`}>
        <Logros logros={miembro.logros} />
      </Seccion>
    </div>
  )
}
