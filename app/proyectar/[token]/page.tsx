import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CodigoQr } from '@/components/encuestas/codigo-qr'
import { PantallaEnVivo } from '@/components/encuestas/pantalla-en-vivo'
import { CambiarTema } from '@/components/marca/cambiar-tema'
import { exigirAdmin } from '@/lib/auth/sesion'
import { urlDeEncuesta } from '@/lib/encuestas/comun'
import { encuestaPorToken, payloadDeProyeccion } from '@/lib/encuestas/publico'

export const dynamic = 'force-dynamic'

// Sin `loading.tsx` en esta ruta: el notFound() es control de acceso y un límite
// de Suspense lo convertiría en un 200 con esqueleto.

export const metadata: Metadata = {
  title: 'Proyección',
  robots: { index: false, follow: false },
}

/**
 * La pantalla que se proyecta, y desde la que se corre la dinámica.
 *
 * EXIGE SESIÓN DE ADMIN (decidido 3-sep-2026). Durante un tiempo bastó el token,
 * para poder mandar la pantalla a otra máquina sin iniciar sesión ahí. Se cambió
 * por dos razones que se refuerzan: quien proyecta suele hacerlo en una ventana
 * con la barra de direcciones a la vista, así que el token es fotografiable
 * desde la sala; y desde que la pantalla trae los controles, ese token dejaría
 * manejar la dinámica a quien lo copiara.
 *
 * `exigirAdmin()` redirige a quien no lo sea. La ruta salió de
 * `PREFIJOS_PUBLICOS`, así que el middleware ya manda al login antes de llegar
 * aquí; esta llamada es la segunda barrera, la que comprueba el rol.
 */
export default async function PaginaProyectar({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  await exigirAdmin()

  const { token } = await params
  const encuesta = await encuestaPorToken(token)

  if (!encuesta) notFound()

  const inicial = await payloadDeProyeccion(encuesta)
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const url = urlDeEncuesta(base, encuesta.joinCode)

  return (
    <div className="relative bg-background">
      {/*
        El tema NO se fuerza a oscuro. Da la tentación —"un proyector se ve mejor
        en oscuro"— pero depende del salón: con las luces prendidas y un cañón
        flojo, el claro se lee mejor. Quien presenta sabe cuál es su caso.
      */}
      <div className="absolute top-4 right-4 z-10 print:hidden">
        <CambiarTema />
      </div>

      <PantallaEnVivo
        token={token}
        encuestaId={encuesta.id}
        inicial={inicial}
        codigo={encuesta.joinCode}
        // La URL se muestra sin el esquema: en una pared, "https://" son ocho
        // caracteres que nadie teclea y que le roban tamaño a lo que sí importa.
        url={url.replace(/^https?:\/\//, '')}
        qr={<CodigoQr texto={url} tamano={200} />}
      />
    </div>
  )
}
