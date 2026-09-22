import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { EmpezarTablero } from '@/components/dinamicas/empezar-tablero'
import { Tablero } from '@/components/dinamicas/tablero'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, Tarjeta, Titulo } from '@/components/ui-vadai/superficie'
import { esEquipo, exigirPerfil } from '@/lib/auth/sesion'
import { ETIQUETA_ESTADO_DINAMICA } from '@/lib/dinamicas/comun'
import {
  obtenerDinamicaParaAlumno,
  type DinamicaParaAlumno,
} from '@/lib/dinamicas/consultas-alumno'
import { PUNTOS } from '@/lib/gamificacion/reglas'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx`: el notFound() y el redirect() de abajo son control de
// acceso, y un límite de Suspense los convertiría en un 200 con esqueleto.

function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const resultado = await obtenerDinamicaParaAlumno(id)
  return { title: resultado ? resultado.dinamica.titulo : 'Dinámica' }
}

/**
 * Una dinámica y MI tablero: el de mi empresa, o el mío si no tengo empresa.
 *
 * Cuatro situaciones, en este orden de decisión: el acceso venció (se ve, no
 * se puntúa), la dinámica cerró (se consulta), no hay tablero todavía (un solo
 * botón grande lo abre para toda la empresa) y, si no, la matriz.
 */
export default async function PaginaDinamica({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await exigirPerfil()
  const { id } = await params

  // El equipo monitorea desde el admin: ahí están TODOS los tableros.
  if (esEquipo(perfil)) redirect(`/admin/dinamicas/${id}/tableros`)

  const resultado = await obtenerDinamicaParaAlumno(id)
  if (!resultado) notFound()

  const { dinamica: d, tablero } = resultado
  const abierta = d.estado === 'open'
  const cerrada = d.estado === 'closed'
  const puedeEscribir = abierta && d.vigente
  const completas = d.avance?.completas ?? 0
  const empresa = d.tablero.tipo === 'empresa' ? d.tablero.empresa : null
  const deQuien = empresa ? `Tablero de ${empresa}` : 'Tu tablero'

  return (
    <div className="flex flex-col gap-8">
      <Link href="/dinamicas" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Dinámicas
      </Link>

      <Titulo
        apoyo={`${d.cursoTitulo} · ${deQuien}`}
        acciones={
          <>
            <Badge variant={abierta && d.vigente ? 'default' : 'outline'}>
              {abierta && !d.vigente ? 'Solo lectura' : ETIQUETA_ESTADO_DINAMICA[d.estado]}
            </Badge>
            {cerrada && completas > 0 ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-vadai-lima px-3.5 py-1.5 text-sm font-semibold text-vadai-navy">
                +{PUNTOS.dinamica} puntos
              </span>
            ) : null}
          </>
        }
      >
        {d.titulo}
      </Titulo>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {abierta && d.cierraEn ? (
          <span>
            Cierra el {fechaLarga(d.cierraEn)} <span className="text-xs">(CDMX)</span>
          </span>
        ) : null}
        {cerrada && d.cerroEn ? (
          <span>
            Cerró el {fechaLarga(d.cerroEn)} <span className="text-xs">(CDMX)</span>
          </span>
        ) : null}
        <span>
          {puedeEscribir ? 'Calificas' : 'Se califica'} del {d.escala.min} al {d.escala.max}
        </span>
        {tablero && tablero.editores.length > 0 ? <Editores editores={tablero.editores} /> : null}
      </div>

      {d.descripcion ? (
        <p className="max-w-2xl text-sm break-words whitespace-pre-wrap text-muted-foreground">
          {d.descripcion}
        </p>
      ) : null}

      {d.tablero.tipo === 'individual' ? (
        <p className="text-sm text-muted-foreground">
          No tienes empresa registrada, así que este tablero es solo tuyo. Si deberías estar con
          tu equipo,{' '}
          <a
            href="mailto:hola@vadai.com.mx?subject=Mi%20empresa%20en%20la%20academia"
            className="text-primary underline-offset-4 hover:underline"
          >
            escríbenos
          </a>
          .
        </p>
      ) : null}

      {/* Excluyentes: con la dinámica cerrada, renovar no devuelve nada que
          calificar, así que el banner de vencido sobra y se dice en una línea. */}
      {!d.vigente && !cerrada ? <AccesoVencidoEnDinamica dinamica={d} empresa={empresa} /> : null}

      {cerrada ? (
        <Tarjeta className="flex flex-col gap-1.5 p-5">
          <h2 className="font-medium">Esta dinámica cerró</h2>
          <p className="text-sm text-muted-foreground">
            {d.cerroEn ? (
              <>
                Cerró el {fechaLarga(d.cerroEn)} <span className="text-xs">(CDMX)</span>.{' '}
              </>
            ) : null}
            El tablero se queda tal cual para consultarlo.
          </p>
          {!d.vigente ? (
            <p className="text-sm text-muted-foreground">
              Tu acceso al curso también venció; el tablero se queda para consultarlo.
            </p>
          ) : null}
          {tablero && completas === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún proyecto quedó calificado completo, así que esta dinámica no sumó puntos.
            </p>
          ) : null}
        </Tarjeta>
      ) : null}

      {tablero ? (
        <Tablero
          tablero={tablero}
          puedeEscribir={puedeEscribir}
          soyAdmin={false}
          miUserId={perfil.user_id}
        />
      ) : cerrada ? (
        <Tarjeta className="border-dashed px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {empresa
              ? `Esta dinámica cerró antes de que ${empresa} empezara su tablero.`
              : 'Esta dinámica cerró antes de que empezaras tu tablero.'}
          </p>
        </Tarjeta>
      ) : d.vigente ? (
        <Tarjeta className="flex flex-col items-center gap-4 border-dashed px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {empresa
              ? 'Tu empresa todavía no empieza este tablero. Quien lo abra lo abre para todos.'
              : 'Todavía no empiezas tu tablero.'}
          </p>
          <EmpezarTablero
            dynamicId={d.id}
            etiqueta={empresa ? `Empezar el tablero de ${empresa}` : 'Empezar mi tablero'}
          />
        </Tarjeta>
      ) : (
        <Tarjeta className="border-dashed px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {empresa
              ? 'Tu empresa todavía no empieza este tablero. Al renovar tu acceso podrás abrirlo.'
              : 'Todavía no empiezas tu tablero. Al renovar tu acceso podrás abrirlo.'}
          </p>
        </Tarjeta>
      )}
    </div>
  )
}

/** Hasta tres avatares encimados y "Ana, Luis y 2 más han editado". */
function Editores({ editores }: { editores: Array<{ userId: string; nombre: string }> }) {
  const pila = editores.map((e) => e.nombre.trim().split(/\s+/)[0] ?? e.nombre)
  let texto: string
  if (pila.length === 1) texto = `${pila[0]} ha editado`
  else if (pila.length === 2) texto = `${pila[0]} y ${pila[1]} han editado`
  else if (pila.length === 3) texto = `${pila[0]}, ${pila[1]} y ${pila[2]} han editado`
  else texto = `${pila[0]}, ${pila[1]} y ${pila.length - 2} más han editado`

  return (
    <span className="flex items-center gap-2">
      <span className="flex -space-x-2">
        {editores.slice(0, 3).map((e) => (
          <Avatar key={e.userId} nombre={e.nombre} tamano={28} className="ring-2 ring-card" />
        ))}
      </span>
      <span aria-hidden>{texto}</span>
      <span className="sr-only">Han editado: {editores.map((e) => e.nombre).join(', ')}.</span>
    </span>
  )
}

/**
 * Bloqueo por vencimiento, en la voz de components/alumno/acceso-vencido.tsx:
 * qué sigue viendo, qué ya no puede hacer y cómo volver.
 */
function AccesoVencidoEnDinamica({
  dinamica,
  empresa,
}: {
  dinamica: DinamicaParaAlumno
  empresa: string | null
}) {
  const hayLinks = Boolean(dinamica.linkRecompraMxn ?? dinamica.linkRecompraUsd)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-medium">Tu acceso a este curso venció</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          Puedes ver {empresa ? `el tablero de ${empresa}` : 'tu tablero'} tal como va, pero ya no
          puedes puntuar. Al renovar vuelves a participar.
        </p>
      </div>

      {hayLinks ? (
        <div className="flex flex-wrap gap-3">
          {dinamica.linkRecompraMxn ? (
            <Button asChild>
              <a href={dinamica.linkRecompraMxn} target="_blank" rel="noopener noreferrer">
                Renovar acceso
              </a>
            </Button>
          ) : null}
          {dinamica.linkRecompraUsd ? (
            <Button asChild variant="outline">
              <a href={dinamica.linkRecompraUsd} target="_blank" rel="noopener noreferrer">
                Pagar en USD
              </a>
            </Button>
          ) : null}
        </div>
      ) : (
        <a
          href="mailto:hola@vadai.com.mx?subject=Quiero%20renovar%20mi%20acceso"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Escríbenos para renovar
        </a>
      )}
    </section>
  )
}
