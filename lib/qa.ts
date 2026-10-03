/**
 * Cómo se reconoce lo que es de las pruebas, en un solo lugar.
 *
 * Las suites corren contra la base de producción y necesitan los cursos QA
 * publicados mientras corren (`pnpm qa:mostrar`). En esa ventana —tres
 * corridas completas pueden ser casi una hora— un admin real los veía en su
 * «Vista de alumno» como si fueran cursos de la academia (3-oct-2026). Archivar
 * al terminar no basta: lo que no se debe ver no puede depender de cuándo
 * alguien abre la pantalla.
 *
 *   - Una cuenta QA vive en `qa-*@academia.vadai.com.mx` (ese dominio no tiene
 *     MX; ver lib/correo/resend.ts).
 *   - Un curso QA tiene slug `qa-…` (los siembra scripts/seed.mjs). Ningún
 *     curso real debe empezar así.
 */

const CUENTA_QA = /^qa-.*@academia\.vadai\.com\.mx$/i

export function esCuentaQa(email: string | null | undefined): boolean {
  return Boolean(email && CUENTA_QA.test(email.trim()))
}

export function esCursoQa(slug: string | null | undefined): boolean {
  return Boolean(slug && slug.startsWith('qa-'))
}
