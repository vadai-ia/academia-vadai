import { NextResponse, type NextRequest } from 'next/server'

import { esEquipo, obtenerSesion } from '@/lib/auth/sesion'
import { respuestaDeImagen } from '@/lib/noticias/imagen'

/**
 * La imagen de una noticia o un aviso antes de publicarla (M24): el panel la
 * enseña junto a cada propuesta y en el compositor. Solo para el equipo; la
 * imagen definitiva se dibuja al publicar y se guarda en `academia-media`.
 *
 *   /api/noticias/vista-previa?tipo=noticia&titulo=…&medio=…
 */
export async function GET(req: NextRequest) {
  const sesion = await obtenerSesion()
  if (sesion.tipo !== 'activo') return NextResponse.json({ error: 'Necesitas iniciar sesión.' }, { status: 401 })
  if (!esEquipo(sesion.perfil)) return NextResponse.json({ error: 'Solo el equipo.' }, { status: 403 })

  const q = req.nextUrl.searchParams
  const titulo = (q.get('titulo') ?? '').trim().slice(0, 160)
  if (titulo.length < 3) return NextResponse.json({ error: 'Falta el título.' }, { status: 400 })
  return respuestaDeImagen({
    tipo: q.get('tipo') === 'aviso' ? 'aviso' : 'noticia',
    titulo,
    medio: q.get('medio')?.trim().slice(0, 60) || null,
    fecha: new Date(),
  })
}
