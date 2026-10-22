/**
 * A dónde lleva una publicación (22-oct-2026). Desde que el feed es de
 * tarjetas, cada publicación tiene su página y las ligas de la campana, Inicio,
 * el panel y el agente apuntan ahí, no a un ancla del feed.
 *
 *   V-AI-P   /vaip/muro/<id>, o /vaip/noticias/<id> si es una noticia
 *   curso    /curso/<slug>/comunidad/<id> (la casa de V-AI-P redirige a /vaip)
 */

export function ligaEnVaip(postId: string, esNoticia: boolean): string {
  return esNoticia ? `/vaip/noticias/${postId}` : `/vaip/muro/${postId}`
}

export function ligaEnGrupo(cursoSlug: string, postId: string): string {
  return `/curso/${cursoSlug}/comunidad/${postId}`
}
