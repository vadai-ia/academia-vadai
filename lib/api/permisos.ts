/**
 * Los permisos de una llave de la API (M20). Sin `server-only`: los pinta el
 * formulario de Ajustes → API. La base valida la misma lista (academia_0044).
 */

export const PERMISOS = [
  { clave: 'noticias:leer', etiqueta: 'Leer noticias' },
  { clave: 'noticias:escribir', etiqueta: 'Publicar y editar noticias' },
  { clave: 'eventos:leer', etiqueta: 'Leer clases y eventos' },
  { clave: 'eventos:escribir', etiqueta: 'Agendar y cancelar clases y eventos' },
  { clave: 'comunidad:leer', etiqueta: 'Leer el muro' },
  { clave: 'comunidad:escribir', etiqueta: 'Responder en el muro como Equipo VADAI' },
  { clave: 'miembros:leer', etiqueta: 'Leer miembros (sin correos)' },
  { clave: 'miembros:pii', etiqueta: 'Ver el correo de cada miembro' },
  { clave: 'metricas:leer', etiqueta: 'Leer las métricas de la comunidad' },
  { clave: 'cobros:leer', etiqueta: 'Ver cobros y suscripciones (la llave vence en 90 días o menos)' },
] as const

export type Permiso = (typeof PERMISOS)[number]['clave']

export const esPermiso = (v: unknown): v is Permiso => PERMISOS.some((p) => p.clave === v)

/** Los eventos que una plataforma externa puede recibir por webhook. */
export const EVENTOS_DE_WEBHOOK = [
  { clave: 'noticia.publicada', etiqueta: 'Se publicó una noticia' },
  { clave: 'miembro.entro', etiqueta: 'Entró un miembro' },
  { clave: 'miembro.salio', etiqueta: 'Salió un miembro' },
  { clave: 'sesion.creada', etiqueta: 'Se agendó una clase o un evento' },
] as const

export type EventoDeWebhook = (typeof EVENTOS_DE_WEBHOOK)[number]['clave']

export const esEventoDeWebhook = (v: unknown): v is EventoDeWebhook => EVENTOS_DE_WEBHOOK.some((e) => e.clave === v)
