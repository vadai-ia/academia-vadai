import 'server-only'

import { exigirEquipo } from '@/lib/auth/sesion'
import { esPorGeneraciones } from '@/lib/generaciones'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * La lista de acceso de una sesión exclusiva (0038, 9-oct-2026).
 *
 * Alejandro: "elegir quiénes sí pueden tener acceso… buscándolos y teniendo un
 * control de cuáles ya elegí y cuáles me faltan". Se elige SOLO entre los
 * inscritos en la generación del módulo (o en el curso, si no es por
 * generaciones): es lo que decidió, y lo que exige el trigger
 * `module_members_inscrito`.
 */

export type PersonaParaAcceso = {
  userId: string
  nombre: string
  email: string
  empresa: string | null
  /** Ya está en la lista guardada. */
  enLista: boolean
  agregadaEn: string | null
  avisadaEn: string | null
  acceso: 'vigente' | 'vencido' | 'revocado'
}

export type AccesoDeModulo = {
  modulo: {
    id: string
    titulo: string
    exclusiva: boolean
    cursoId: string
    cursoTitulo: string
    cohorteId: string | null
    generacion: string | null
  }
  personas: PersonaParaAcceso[]
  empresas: string[]
}

export async function accesoDeModulo(moduloId: string): Promise<AccesoDeModulo | null> {
  await exigirEquipo()
  const supabase = await crearClienteServidor()

  const { data: modulo, error } = await supabase
    .from('modules')
    .select('id, title, is_restricted, course_id, cohort_id, courses(title, course_type), cohorts(name)')
    .eq('id', moduloId)
    .maybeSingle()
  if (error || !modulo) {
    if (error) console.error(JSON.stringify({ operacion: 'accesoDeModulo', moduloId, error: error.message }))
    return null
  }
  type ModuloAnidado = {
    id: string
    title: string
    is_restricted: boolean
    course_id: string
    cohort_id: string | null
    courses: { title: string; course_type: string } | null
    cohorts: { name: string } | null
  }
  const m = modulo as unknown as ModuloAnidado

  const inscritos = supabase
    .from('enrollments')
    .select('user_id, status, expires_at, cohort_id, profiles(full_name, email, role, companies(name))')
    .eq('course_id', m.course_id)
  const [{ data: inscripciones, error: e1 }, { data: miembros, error: e2 }] = await Promise.all([
    esPorGeneraciones(m.courses?.course_type) && m.cohort_id ? inscritos.eq('cohort_id', m.cohort_id) : inscritos,
    supabase.from('module_members').select('user_id, added_at, notified_at').eq('module_id', moduloId),
  ])
  if (e1 || e2) {
    console.error(JSON.stringify({ operacion: 'accesoDeModulo', moduloId, error: (e1 ?? e2)?.message }))
    return null
  }

  const enLista = new Map((miembros ?? []).map((x) => [x.user_id, x]))
  type Inscripcion = {
    user_id: string
    status: string
    expires_at: string | null
    profiles: { full_name: string; email: string; role: string; companies: { name: string } | null } | null
  }
  const ahora = Date.now()
  const personas: PersonaParaAcceso[] = ((inscripciones ?? []) as unknown as Inscripcion[])
    // El equipo ve todo sin estar en ninguna lista; aquí solo alumnos.
    .filter((i) => i.profiles && i.profiles.role === 'alumno')
    .map((i) => {
      const p = i.profiles!
      const miembro = enLista.get(i.user_id)
      const vigente = i.status === 'active' && (!i.expires_at || new Date(i.expires_at).getTime() > ahora)
      return {
        userId: i.user_id,
        nombre: p.full_name.trim() || p.email.split('@')[0] || p.email,
        email: p.email,
        empresa: p.companies?.name ?? null,
        enLista: Boolean(miembro),
        agregadaEn: miembro?.added_at ?? null,
        avisadaEn: miembro?.notified_at ?? null,
        acceso: (i.status === 'revoked' ? 'revocado' : vigente ? 'vigente' : 'vencido') as PersonaParaAcceso['acceso'],
      }
    })
    // Los elegidos primero; dentro, por nombre.
    .sort((a, b) => Number(b.enLista) - Number(a.enLista) || a.nombre.localeCompare(b.nombre, 'es'))

  return {
    modulo: {
      id: m.id,
      titulo: m.title,
      exclusiva: m.is_restricted,
      cursoId: m.course_id,
      cursoTitulo: m.courses?.title ?? 'Curso',
      cohorteId: m.cohort_id,
      generacion: m.cohorts?.name ?? null,
    },
    personas,
    empresas: [...new Set(personas.flatMap((p) => (p.empresa ? [p.empresa] : [])))].sort((a, b) => a.localeCompare(b, 'es')),
  }
}
