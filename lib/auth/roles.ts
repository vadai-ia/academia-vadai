/**
 * Qué rol es qué, en un solo lugar (3-oct-2026, al nacer `community_manager`).
 *
 * Sin `server-only`: lo leen también el middleware y componentes de cliente.
 *
 *   - EQUIPO: entra al panel y para el alumno firma como «Equipo VADAI».
 *     admin, superadmin y community manager.
 *   - ADMIN: además arma cursos, da de alta, elimina cuentas y ve pagos.
 *     admin y superadmin.
 *
 * Es el espejo de `academia.is_equipo()` y `academia.is_admin()` en la base
 * (migración 0036). La base es la que protege; esto decide qué se enseña.
 */

export type Rol = 'superadmin' | 'admin' | 'community_manager' | 'alumno' | 'invitado'

export function esRolDeEquipo(role: string | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'community_manager'
}

export function esRolAdmin(role: string | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin'
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  community_manager: 'Community manager',
  alumno: 'Alumno',
  invitado: 'Invitado',
}

export function etiquetaDeRol(role: string | null | undefined): string {
  return role && role in ETIQUETA_ROL ? ETIQUETA_ROL[role as Rol] : (role ?? '')
}
