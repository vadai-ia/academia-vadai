import { redirect } from 'next/navigation'

import { casaDeVaip } from '@/lib/membresia/consultas'

export const dynamic = 'force-dynamic'

/**
 * /comunidad ya no es una página (M22, 20-oct-2026). Era el mismo muro de cada
 * curso en otra envoltura —sin temas ni ranking— y una de seis formas de
 * llegar al muro de V-AI-P. Cada muro vive ahora en su espacio: el de V-AI-P
 * en /vaip y el de cada curso en su pestaña Comunidad; Inicio muestra lo
 * último de todos.
 *
 * Se queda como redirección para que ninguna liga vieja muera:
 *   ?curso=<casa de V-AI-P> → /vaip
 *   ?curso=<slug>           → /curso/<slug>/comunidad
 *   sin curso               → Inicio
 *
 * Sin `loading.tsx` en esta carpeta, a propósito: con uno, el redirect saldría
 * como un 200 con esqueleto (CLAUDE.md, anti-patterns).
 */
export default async function Comunidad({ searchParams }: { searchParams: Promise<{ curso?: string }> }) {
  const { curso } = await searchParams
  if (!curso || !/^[a-z0-9-]+$/.test(curso)) redirect('/mis-cursos')
  const casa = await casaDeVaip()
  redirect(casa?.slug === curso ? '/vaip' : `/curso/${curso}/comunidad`)
}
