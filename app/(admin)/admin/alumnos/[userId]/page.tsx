import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CambiarEmpresa, DarAcceso, EnlaceDeAcceso } from '@/components/admin/acciones-de-alumno'
import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { EliminarCuenta } from '@/components/admin/eliminar-cuenta'
import { Avatar, Cifra, Progreso, Seccion, Tarjeta } from '@/components/ui-vadai/superficie'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  cambiarAcceso,
  cambiarCorreoDeAlumno,
  extenderAcceso,
  quitarDelCurso,
  reactivarCuenta,
  reenviarAcceso,
  suspenderCuenta,
} from '@/lib/admin/acciones-alumnos'
import { listarEmpresas } from '@/lib/admin/empresas'
import { fichaDeAlumno } from '@/lib/admin/ficha-alumno'
import { dinero, fechaConHora, fechaCorta } from '@/lib/admin/formato'
import { exigirAdmin } from '@/lib/auth/sesion'

export const dynamic = 'force-dynamic'
// Eliminar una cuenta llama a Auth y recorre Storage: cabe en segundos, pero
// el default de Vercel es corto.
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ETIQUETA_ACCESO = { vigente: 'Vigente', vencido: 'Vencido', revocado: 'Revocado' } as const

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params
  if (!UUID.test(userId)) return { title: 'Alumno' }
  const ficha = await fichaDeAlumno(userId)
  return { title: ficha?.nombre || ficha?.email || 'Alumno' }
}

/**
 * La ficha completa de una persona (M14): todo lo que se sabe de ella y todas
 * las acciones, en un solo lugar. La lista solo enseña lo que se escanea;
 * aquí está lo demás.
 *
 * NO lleva `loading.tsx`: el `notFound()` es control de acceso y un límite de
 * Suspense lo volvería un 200 (components/marca/esqueleto.tsx).
 */
export default async function PaginaFicha({ params }: { params: Promise<{ userId: string }> }) {
  const perfil = await exigirAdmin()
  const { userId } = await params
  if (!UUID.test(userId)) notFound()

  const [ficha, empresas] = await Promise.all([fichaDeAlumno(userId), listarEmpresas()])
  if (!ficha) notFound()

  const quien = ficha.nombre || ficha.email
  const esDelEquipo = ficha.rol === 'admin' || ficha.rol === 'superadmin'
  const suspendida = ficha.estado === 'suspended'
  const soySuperadmin = perfil.role === 'superadmin'
  // Nadie se toca a sí mismo; al equipo solo lo toca un superadmin. Cada
  // acción vuelve a comprobarlo en el servidor.
  const puedeTocarLaCuenta = ficha.userId !== perfil.user_id && (soySuperadmin || !esDelEquipo)

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link href="/admin/alumnos" className="w-fit text-sm text-primary underline-offset-4 hover:underline">
          ← Alumnos
        </Link>

        <div className="flex items-start gap-4">
          <Avatar nombre={quien} tamano={48} />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="flex flex-wrap items-center gap-2 text-[1.75rem] leading-tight font-medium tracking-tight text-balance">
              {ficha.nombre || '(sin nombre)'}
              {esDelEquipo ? <Badge className="bg-vadai-lima text-[11px] text-vadai-navy">{ficha.rol}</Badge> : null}
              {suspendida ? (
                <Badge variant="outline" className="text-[11px]">
                  Suspendida
                </Badge>
              ) : null}
              {!esDelEquipo && !ficha.ultimoAcceso ? (
                <Badge variant="outline" className="border-destructive/40 text-[11px] text-destructive">
                  Nunca ha entrado
                </Badge>
              ) : null}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ficha.email}
              {' · '}
              {ficha.empresa?.nombre ?? 'General'}
              {' · '}dado de alta el {fechaCorta(ficha.creadoEn)}
              {' · '}
              {ficha.ultimoAcceso ? `última vez que entró: ${fechaConHora(ficha.ultimoAcceso)}` : 'no ha entrado ni una vez'}
            </p>
          </div>
        </div>
      </header>

      {/* --- Cursos y avance ------------------------------------------------ */}
      <Seccion
        titulo="Cursos y avance"
        apoyo={ficha.inscripciones.length === 0 ? 'Sin inscripciones' : `${ficha.inscripciones.length} curso${ficha.inscripciones.length === 1 ? '' : 's'}`}
      >
        <div className="flex flex-col gap-3">
          {ficha.inscripciones.map((i) => (
            <Tarjeta key={i.cursoId} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/cursos/${i.cursoId}`} className="font-medium underline-offset-4 hover:underline">
                    {i.cursoTitulo}
                  </Link>
                  {i.cohorte ? (
                    <Badge variant="secondary" className="text-[11px]">
                      {i.cohorte}
                    </Badge>
                  ) : null}
                  {i.acceso !== 'vigente' ? (
                    <Badge variant="outline" className="text-[11px]">
                      {ETIQUETA_ACCESO[i.acceso]}
                    </Badge>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {i.expiraEn ? `Vence ${fechaCorta(i.expiraEn)}` : 'Sin vencimiento'} · inscrito el{' '}
                  {fechaCorta(i.inscritoEn)} ({i.origen === 'stripe' ? 'compra' : 'alta manual'})
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">Avance</span>
                    <span className="font-medium tabular-nums">
                      {i.total > 0 ? `${i.hechas} de ${i.total} lecciones · ${i.porcentaje}%` : 'sin lecciones todavía'}
                    </span>
                  </div>
                  <Progreso porcentaje={i.porcentaje} />
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm sm:min-w-52">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">Puntos</span>
                    <span className="font-medium text-primary tabular-nums">{i.puntos}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Nivel {i.nivel.numero} · {i.nivel.nombre}
                  </div>
                </div>
              </div>

              <ul className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums sm:grid-cols-6">
                <li>{i.actividad.lecciones} lecciones</li>
                <li>{i.actividad.quizzes} quizzes</li>
                <li>{i.actividad.tareas} tareas</li>
                <li>{i.actividad.publicaciones} publicaciones</li>
                <li>{i.actividad.comentarios} comentarios</li>
                <li>{i.actividad.certificados} certificados</li>
              </ul>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <form action={cambiarAcceso}>
                  <input type="hidden" name="user_id" value={ficha.userId} />
                  <input type="hidden" name="course_id" value={i.cursoId} />
                  <input type="hidden" name="revocar" value={i.acceso === 'revocado' ? 'no' : 'si'} />
                  <Button type="submit" variant="ghost" size="sm">
                    {i.acceso === 'revocado' ? 'Restaurar acceso' : 'Revocar acceso'}
                  </Button>
                </form>

                <form action={extenderAcceso} className="flex items-center gap-1.5">
                  <input type="hidden" name="user_id" value={ficha.userId} />
                  <input type="hidden" name="course_id" value={i.cursoId} />
                  <input
                    type="number"
                    name="dias"
                    min={1}
                    max={3650}
                    defaultValue={30}
                    aria-label="Días para extender"
                    className="h-8 w-20 rounded-lg border border-input bg-transparent px-2 text-sm"
                  />
                  <Button type="submit" variant="ghost" size="sm">
                    Extender días
                  </Button>
                </form>

                <ConfirmarConModal
                  idModal={`quitar-${i.cursoId}`}
                  accion={quitarDelCurso}
                  campos={{ user_id: ficha.userId, course_id: i.cursoId }}
                  boton={{ texto: 'Quitar del curso', etiquetaAccesible: `Quitar a ${quien} de ${i.cursoTitulo}`, tono: 'destructivo' }}
                  titulo={`¿Quitar a ${quien} de ${i.cursoTitulo}?`}
                  confirmar={{ texto: 'Sí, quitar', enCurso: 'Quitando…', tono: 'destructivo' }}
                >
                  <p>Deja de ver el curso. Su avance se conserva por si vuelve a inscribirse.</p>
                </ConfirmarConModal>
              </div>
            </Tarjeta>
          ))}

          <DarAcceso userId={ficha.userId} disponibles={ficha.cursosDisponibles} />
        </div>
      </Seccion>

      {/* --- Actividad -------------------------------------------------------- */}
      <Seccion titulo="Actividad">
        <Tarjeta className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
            <Cifra valor={ficha.conteos.comentarios} etiqueta="comentarios" />
            <Cifra valor={ficha.conteos.publicaciones} etiqueta="publicaciones" />
            <Cifra
              valor={ficha.conteos.entregas}
              etiqueta="entregas"
              detalle={ficha.conteos.entregas > 0 ? `${ficha.conteos.entregasAprobadas} aprobadas` : undefined}
            />
            <Cifra valor={ficha.conteos.intentosDeQuiz} etiqueta="intentos de quiz" />
            <Cifra valor={ficha.certificados.length} etiqueta="certificados" destacada={ficha.certificados.length > 0} />
          </div>
          {ficha.certificados.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {ficha.certificados.map((c) => (
                <li key={c.folio} className="flex flex-wrap items-baseline gap-x-3">
                  <a href={`/certificado/${c.folio}`} target="_blank" rel="noopener" className="font-mono text-xs text-primary underline-offset-4 hover:underline">
                    {c.folio}
                  </a>
                  <span>{c.cursoTitulo}</span>
                  <span className="text-xs text-muted-foreground">{fechaCorta(c.emitidoEn)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {esDelEquipo && ficha.conteos.publicacionesDelBlog > 0 ? (
            <p className="text-xs text-muted-foreground">
              Autor de {ficha.conteos.publicacionesDelBlog} publicaci{ficha.conteos.publicacionesDelBlog === 1 ? 'ón' : 'ones'} del blog.
            </p>
          ) : null}
        </Tarjeta>
      </Seccion>

      {/* --- Pagos ------------------------------------------------------------ */}
      <Seccion titulo="Pagos">
        {ficha.pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pagos: entró por alta manual.</p>
        ) : (
          <Tarjeta className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>Curso</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ficha.pagos.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5">{p.cursoTitulo}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{dinero(p.monto, p.moneda)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.estado}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground tabular-nums">{fechaCorta(p.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        )}
      </Seccion>

      {/* --- Acceso ----------------------------------------------------------- */}
      <Seccion titulo="Acceso" apoyo="Cómo entra y con qué correo">
        <Tarjeta className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start gap-3">
            <form action={reenviarAcceso}>
              <input type="hidden" name="email" value={ficha.email} />
              <Button type="submit" variant="outline" size="sm">
                Reenviar correo de acceso
              </Button>
            </form>

            <EnlaceDeAcceso email={ficha.email} />

            {/* Cambiar el correo: con confirmación, y al nuevo le llega el de
                crear contraseña. Es lo que prueba que el cambio fue para la
                persona correcta. */}
            <ConfirmarConModal
              idModal={`cambiar-correo-${ficha.userId}`}
              accion={cambiarCorreoDeAlumno}
              campos={{ user_id: ficha.userId }}
              boton={{ texto: 'Cambiar correo', etiquetaAccesible: `Cambiar el correo de ${quien}`, variante: 'outline' }}
              titulo={`Cambiar el correo de ${quien}`}
              confirmar={{ texto: 'Cambiar y avisarle', enCurso: 'Cambiando…' }}
            >
              <p>
                Ahora entra con <span className="font-medium text-foreground">{ficha.email}</span>. Escribe el
                correo nuevo:
              </p>
              <input
                type="email"
                name="nuevo_email"
                required
                autoComplete="off"
                placeholder="nuevo@correo.com"
                className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
              />
              <p>
                Al correo nuevo le llega el mensaje para crear su contraseña, con liga de 30 días.
                Sus cursos, avance y puntos siguen igual. El correo viejo deja de servir para entrar.
              </p>
            </ConfirmarConModal>
          </div>

          {!esDelEquipo ? (
            <CambiarEmpresa userId={ficha.userId} actual={ficha.empresa?.id ?? ''} empresas={empresas} />
          ) : null}

          <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
            <span className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Ligas de acceso enviadas
            </span>
            {ficha.enlaces.length === 0 ? (
              <p className="text-muted-foreground">
                Ninguna liga de 30 días todavía: los correos anteriores al 20-sep llevaban una liga de una hora.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5 text-muted-foreground tabular-nums">
                {ficha.enlaces.map((l) => (
                  <li key={l.enviadoEn}>
                    {fechaCorta(l.enviadoEn)} · {l.vigente ? `vale hasta el ${fechaCorta(l.venceEn)}` : 'ya vencida'} ·{' '}
                    {l.usos > 0 ? `abierta ${l.usos} ${l.usos === 1 ? 'vez' : 'veces'}, la última el ${fechaCorta(l.ultimoUso)}` : 'sin abrir'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Tarjeta>
      </Seccion>

      {/* --- Cuenta ----------------------------------------------------------- */}
      <Seccion titulo="Cuenta">
        <Tarjeta className="flex flex-col gap-4 p-5">
          {suspendida ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Suspendida: no puede entrar. Sus cursos, progreso y pagos siguen guardados.
              </p>
              {puedeTocarLaCuenta ? (
                <form action={reactivarCuenta}>
                  <input type="hidden" name="user_id" value={ficha.userId} />
                  <Button type="submit" variant="outline" size="sm">
                    Reactivar cuenta
                  </Button>
                </form>
              ) : null}
            </div>
          ) : puedeTocarLaCuenta ? (
            <div className="flex flex-wrap items-center gap-3">
              <ConfirmarConModal
                idModal={`suspender-cuenta-${ficha.userId}`}
                accion={suspenderCuenta}
                campos={{ user_id: ficha.userId }}
                boton={{ texto: 'Suspender cuenta', etiquetaAccesible: `Suspender la cuenta de ${quien}`, variante: 'outline' }}
                titulo={`¿Suspender a ${quien}?`}
                confirmar={{ texto: 'Sí, suspender', enCurso: 'Suspendiendo…', tono: 'destructivo' }}
              >
                <p>
                  Deja de poder entrar desde este momento, aunque tenga la sesión abierta. Al
                  intentarlo verá que su cuenta está suspendida.
                </p>
                <p>
                  <span className="font-medium text-foreground">No se borra nada</span>: sus
                  inscripciones, progreso, entregas, certificados y pagos se quedan como están.
                  La encuentras en Suspendidos y la reactivas cuando quieras.
                </p>
              </ConfirmarConModal>
              <span className="text-xs text-muted-foreground">Le corta la entrada sin borrar nada.</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {ficha.userId === perfil.user_id
                ? 'Es tu propia cuenta.'
                : 'Solo un superadmin puede suspender o eliminar a alguien del equipo.'}
            </p>
          )}

          {puedeTocarLaCuenta ? (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <EliminarCuenta
                userId={ficha.userId}
                email={ficha.email}
                nombre={ficha.nombre}
                esDelEquipo={esDelEquipo}
                publicacionesDelBlog={ficha.conteos.publicacionesDelBlog}
              />
              <span className="text-xs text-muted-foreground">Suspender se puede deshacer. Eliminar, no.</span>
            </div>
          ) : null}
        </Tarjeta>
      </Seccion>
    </div>
  )
}
