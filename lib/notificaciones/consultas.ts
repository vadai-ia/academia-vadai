import 'server-only'

import type { Perfil } from '@/lib/auth/sesion'
import { publicacionesParaAlumno } from '@/lib/comunidad/posts'

/**
 * Las novedades de la campana: anuncios y entradas de blog publicadas.
 *
 * "Nuevo" es todo lo publicado después de la última vez que la persona abrió
 * la campana (`profiles.notifications_seen_at`). Si nunca la ha abierto, cuenta
 * desde que se creó su cuenta: lo publicado antes de que existiera no es una
 * novedad para ella, y estrenar la campana con doce avisos viejos en rojo es
 * la forma más rápida de que deje de mirarla.
 *
 * No hay tabla de notificaciones: la policy de `posts` ya decide qué ve cada
 * quien (publicado, y de su curso o de todos), así que la lista es la misma
 * consulta del blog con una marca de tiempo encima.
 */

export type Notificacion = {
  id: string
  titulo: string
  tipo: 'announcement' | 'blog'
  publicadoEn: string
  href: string
  nueva: boolean
}

export type Novedades = { lista: Notificacion[]; nuevas: number }

const CUANTAS = 8

export async function notificacionesDelAlumno(perfil: Perfil): Promise<Novedades> {
  const publicaciones = await publicacionesParaAlumno()
  const desde = new Date(perfil.notifications_seen_at ?? perfil.created_at ?? 0).getTime()

  const lista = publicaciones.slice(0, CUANTAS).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    tipo: p.tipo,
    publicadoEn: p.publicadoEn,
    href: p.tipo === 'blog' ? '/blog' : '/mis-cursos',
    nueva: new Date(p.publicadoEn).getTime() > desde,
  }))

  // Se cuentan TODAS las nuevas, no solo las ocho de la lista.
  const nuevas = publicaciones.filter((p) => new Date(p.publicadoEn).getTime() > desde).length

  return { lista, nuevas }
}
