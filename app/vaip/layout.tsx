import type { ReactNode } from 'react'

import { MarcoPublico } from '@/components/membresias/marco-publico'

/** Marco de /vaip (M17): público, porque es el destino del QR impreso. */
export default function LayoutVaip({ children }: { children: ReactNode }) {
  return <MarcoPublico inicio="/vaip">{children}</MarcoPublico>
}
