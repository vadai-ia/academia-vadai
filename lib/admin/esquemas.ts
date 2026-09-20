import { z } from 'zod'

import type { Json } from '@/lib/supabase/types'

/**
 * Validación de todo lo que el admin puede escribir.
 * Vive aparte de las acciones para poder reutilizarse en los formularios.
 */

export const ESTADOS_CURSO = ['draft', 'published', 'archived'] as const
export const TIPOS_CURSO = ['cohort', 'evergreen'] as const
export const TIPOS_LECCION = ['video', 'text', 'quiz', 'assignment'] as const
export const ESTADOS_LECCION = ['draft', 'published'] as const

/** Convierte un título en slug: minúsculas, sin acentos, con guiones. */
export function generarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Un campo de texto vacío llega como '' desde FormData; se guarda como null. */
const opcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()

const numeroOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), 'Debe ser un número positivo.')
  .nullable()

const enteroOpcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'Debe ser un número entero mayor a cero.')
  .nullable()

/** Tiptap persiste JSON (§5). Llega como cadena desde el formulario. */
const richText = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null
    try {
      return JSON.parse(v) as Json
    } catch {
      ctx.addIssue({ code: 'custom', message: 'El contenido enriquecido no es válido.' })
      return null
    }
  })
  .nullable()

export const esquemaCurso = z.object({
  title: z.string().trim().min(3, 'El título necesita al menos 3 caracteres.').max(160),
  slug: z
    .string()
    .trim()
    .min(3, 'El slug necesita al menos 3 caracteres.')
    .regex(/^[a-z0-9-]+$/, 'El slug solo admite minúsculas, números y guiones.'),
  description: opcional,
  cover_url: opcional,
  price_mxn: numeroOpcional,
  price_usd: numeroOpcional,
  stripe_payment_link_mxn: opcional,
  stripe_payment_link_usd: opcional,
  access_days: enteroOpcional,
  course_type: z.enum(TIPOS_CURSO),
  status: z.enum(ESTADOS_CURSO),
  certificate_enabled: z.coerce.boolean(),
})

export const esquemaIdDeCurso = z.object({
  id: z.uuid('Curso inválido.'),
})

export const esquemaModulo = z.object({
  course_id: z.uuid('Curso inválido.'),
  title: z.string().trim().min(2, 'El título necesita al menos 2 caracteres.').max(160),
})

export const esquemaLeccion = z.object({
  module_id: z.uuid('Módulo inválido.'),
  title: z.string().trim().min(2, 'El título necesita al menos 2 caracteres.').max(200),
  lesson_type: z.enum(TIPOS_LECCION),
  status: z.enum(ESTADOS_LECCION),
  is_required: z.coerce.boolean(),
  description_rich: richText,
  bunny_video_id: opcional,
  video_duration_sec: enteroOpcional,
})

export type DatosCurso = z.infer<typeof esquemaCurso>
export type DatosModulo = z.infer<typeof esquemaModulo>
export type DatosLeccion = z.infer<typeof esquemaLeccion>
