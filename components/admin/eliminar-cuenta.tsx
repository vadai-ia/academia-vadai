import { ConfirmarConModal } from '@/components/admin/confirmar-con-modal'
import { eliminarCuenta } from '@/lib/admin/acciones-baja'

/**
 * Un `pattern` que acepta el correo sin distinguir mayúsculas: "ana@x.com" da
 * "[aA][nN][aA]@[xX]\.[cC][oO][mM]". Validación nativa, sin JavaScript. El
 * servidor compara en minúsculas de todas formas.
 */
function patronInsensible(correo: string): string {
  return [...correo]
    .map((c) => {
      if (/[a-z]/i.test(c)) return `[${c.toLowerCase()}${c.toUpperCase()}]`
      if (/[0-9@_-]/.test(c)) return c
      return `\\${c}`
    })
    .join('')
}

/**
 * "Eliminar cuenta": el botón rojo del final de la ficha y su modal.
 *
 * Solo vive en la ficha (M14): borrar merece haber visto todo lo de la persona
 * antes. Y se confirma escribiendo su correo, porque un clic de más no debería
 * bastar para algo que no se deshace. La página decide si se pinta (nadie se
 * borra a sí mismo; al equipo solo un superadmin) y la acción lo vuelve a
 * comprobar.
 */
export function EliminarCuenta({
  userId,
  email,
  nombre,
  esDelEquipo,
  publicacionesDelBlog,
}: {
  userId: string
  email: string
  nombre: string
  esDelEquipo: boolean
  publicacionesDelBlog: number
}) {
  const quien = nombre || email

  return (
    <ConfirmarConModal
      idModal={`eliminar-cuenta-${userId}`}
      accion={eliminarCuenta}
      campos={{ user_id: userId }}
      boton={{
        texto: 'Eliminar cuenta',
        etiquetaAccesible: `Eliminar la cuenta de ${quien}`,
        tono: 'destructivo',
        variante: 'destructive',
        tamano: 'default',
      }}
      titulo={`¿Eliminar la cuenta de ${quien}?`}
      confirmar={{ texto: 'Sí, eliminar para siempre', enCurso: 'Eliminando…', tono: 'destructivo' }}
    >
      <p>
        Esto no se puede deshacer. Se borra de la academia y de la autenticación: no vuelve a
        poder entrar ni aparece en ninguna lista.
      </p>
      <p>
        <span className="font-medium text-foreground">Se pierde</span>: sus inscripciones, su
        avance, sus intentos de quiz, sus entregas y archivos, sus comentarios y publicaciones (con
        las respuestas de otros a ellos) y sus certificados: los folios dejan de verificarse.
      </p>
      <p>
        <span className="font-medium text-foreground">Se queda</span>: sus pagos, sin cuenta
        ligada, para la contabilidad. Lo que contestó en encuestas se queda en el padrón, sin
        ligar a nadie.
      </p>
      {esDelEquipo && publicacionesDelBlog > 0 ? (
        <p>
          Sus {publicacionesDelBlog} publicaci{publicacionesDelBlog === 1 ? 'ón' : 'ones'} del blog
          pasan a tu nombre.
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5">
        <span>Para confirmar, escribe su correo:</span>
        <input
          type="email"
          name="confirmacion"
          required
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          pattern={patronInsensible(email)}
          title="Escribe el correo tal cual"
          placeholder={email}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground"
        />
      </label>
      <p>Si solo quieres cortarle el acceso, usa Suspender: se puede deshacer.</p>
    </ConfirmarConModal>
  )
}
