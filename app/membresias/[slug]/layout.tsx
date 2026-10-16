import type { ReactNode } from 'react'

import { MarcoPublico } from '@/components/membresias/marco-publico'

/** Marco de /membresias/<slug> (M18): público, como /vaip. */
export default async function LayoutMembresia({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <MarcoPublico inicio={`/membresias/${slug}`}>{children}</MarcoPublico>
}
