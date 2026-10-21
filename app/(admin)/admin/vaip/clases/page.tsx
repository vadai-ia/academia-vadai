import type { Metadata } from 'next'

import { ArbolCurso } from '@/components/admin/arbol-curso'
import { CalendarioDeGeneracion } from '@/components/admin/calendario-de-generacion'
import { FormularioCurso } from '@/components/admin/formulario-curso'
import { Seccion, Titulo } from '@/components/ui-vadai/superficie'
import { obtenerCurso } from '@/lib/admin/consultas'
import { generacionesDelCurso, leccionesLigables } from '@/lib/admin/generaciones'
import { esAdmin, exigirEquipo } from '@/lib/auth/sesion'
import { generacionPorOmision } from '@/lib/generaciones'
import { planVaip } from '@/lib/membresia/consultas'

export const metadata: Metadata = { title: 'Clases · V-AI-P' }
export const dynamic = 'force-dynamic'

/**
 * Las clases de V-AI-P (M19; todo en un lugar desde M25): el calendario de la
 * generación «Miembros», las grabaciones —que son las lecciones de la casa— y,
 * para admin, los datos de la casa. La casa ya no sale en Cursos: los dos
 * mundos no se mezclan, y aquí está todo lo suyo.
 *
 * Agendar una clase manda las fechas por correo y la pone en la campana de los
 * miembros. NO publica un anuncio (decisión de Alejandro, 20-oct-2026): los
 * avisos de V-AI-P que no son clase van fijados en el Muro.
 */
export default async function PaginaClases({
  searchParams,
}: {
  searchParams: Promise<{ sesion?: string; modulo?: string }>
}) {
  const perfil = await exigirEquipo()
  const soyAdmin = esAdmin(perfil)
  const { sesion, modulo } = await searchParams
  const plan = await planVaip()

  if (!plan?.casa) {
    return (
      <div className="flex flex-col gap-6">
        <Titulo ceja="V-AI-P">Clases</Titulo>
        <p className="text-sm text-muted-foreground">V-AI-P todavía no tiene curso casa.</p>
      </div>
    )
  }

  const [generaciones, curso] = await Promise.all([generacionesDelCurso(plan.casa.id), obtenerCurso(plan.casa.id)])
  const generacion = generacionPorOmision(generaciones)
  const ligables = generacion ? await leccionesLigables(plan.casa.id, generacion.id) : []
  const arbol = curso
    ? { ...curso, modulos: curso.modulos.filter((m) => m.cohort_id === (generacion?.id ?? null)) }
    : null
  const datosDeLaCasa = curso ? (({ modulos: _modulos, ...resto }) => resto)(curso) : null

  return (
    <div className="flex flex-col gap-10">
      <Titulo
        ceja="V-AI-P"
        apoyo="El calendario de las clases y sus grabaciones. Agendar una clase manda las fechas por correo a los miembros y la pone en su campana."
      >
        Clases
      </Titulo>

      {generacion ? (
        <Seccion titulo="Calendario" apoyo="Los avisos que no son una clase van fijados en el Muro.">
          <CalendarioDeGeneracion
            generacion={generacion}
            ligables={ligables}
            correoAdmin={perfil.email}
            compacto
            sesionAbierta={sesion ?? null}
            prefijo="?"
            deVaip
            esCasa
          />
        </Seccion>
      ) : (
        <p className="text-sm text-muted-foreground">La casa de V-AI-P no tiene generación.</p>
      )}

      {arbol ? (
        <section id="grabaciones" className="flex flex-col gap-3 border-t border-border pt-8">
          <p className="text-sm text-pretty text-muted-foreground">
            Cada grabación es una lección: súbele el video y lígala a su clase en el calendario.
          </p>
          <ArbolCurso
            curso={arbol}
            moduloAbierto={modulo ?? null}
            cohortId={generacion?.id ?? null}
            soloLectura={!soyAdmin}
            raiz="/admin/vaip/clases"
          />
        </section>
      ) : null}

      {soyAdmin && datosDeLaCasa ? (
        <details id="datos-de-la-casa" className="group rounded-[10px] border border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-medium [&::-webkit-details-marker]:hidden">
            Datos de la casa
            <span className="text-sm font-normal text-muted-foreground">
              {plan.casa.publicada ? 'Publicada' : 'En borrador'}
            </span>
          </summary>
          <div className="flex max-w-2xl flex-col gap-4 border-t border-border px-5 py-5">
            <p className="text-sm text-pretty text-muted-foreground">
              La casa es el curso donde viven el muro, las clases y las grabaciones de V-AI-P. Mientras esté en
              borrador, la página de venta dice que abre pronto.
            </p>
            <FormularioCurso curso={datosDeLaCasa} enVaip />
          </div>
        </details>
      ) : null}
    </div>
  )
}
