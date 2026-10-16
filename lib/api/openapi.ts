/**
 * La especificación OpenAPI de /api/v1 (M20). Pública en /api/v1/openapi.json:
 * describe la API, no trae datos. La lee Ajustes → API y cualquier plataforma
 * que la importe (Make, Zapier, n8n).
 */

const planParam = {
  name: 'plan',
  in: 'query',
  required: false,
  description: 'Slug del plan. Por omisión, v-ai-p.',
  schema: { type: 'string', default: 'v-ai-p' },
}

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }

const errores = {
  '401': { description: 'Falta la llave, o es inválida, está revocada o venció.' },
  '403': { description: 'La llave no tiene el permiso del endpoint.' },
  '429': { description: 'Se pasó el límite de 600 llamadas por hora de la llave.' },
}

const ok = (descripcion: string) => ({ description: descripcion, content: { 'application/json': {} } })

export function especificacion(base: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'API de la academia VADAI',
      version: '1.0.0',
      description:
        'Noticias, clases y eventos, el muro, los miembros y las métricas de una membresía. Cada llamada lleva ' +
        '`Authorization: Bearer vadai_…` con una llave creada en Ajustes → API, y cada endpoint exige un permiso.',
    },
    servers: [{ url: `${base}/api/v1` }],
    security: [{ llave: [] }],
    components: {
      securitySchemes: { llave: { type: 'http', scheme: 'bearer', description: 'vadai_<id>_<secreto>' } },
    },
    paths: {
      '/noticias': {
        get: { summary: 'Las noticias del plan (permiso noticias:leer)', parameters: [planParam, { name: 'limite', in: 'query', schema: { type: 'integer', maximum: 50 } }], responses: { '200': ok('{ noticias: [...] }'), ...errores } },
        post: {
          summary: 'Publica una noticia como Equipo VADAI (noticias:escribir)',
          parameters: [planParam],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['titulo', 'cuerpo'],
                  properties: {
                    titulo: { type: 'string', minLength: 3, maxLength: 200 },
                    cuerpo: { type: 'string', description: 'Texto plano; párrafos separados por una línea en blanco.' },
                    fuente: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
          responses: { '201': ok('{ id, url }'), ...errores },
        },
      },
      '/noticias/{id}': {
        patch: { summary: 'Edita una noticia (noticias:escribir)', parameters: [idParam, planParam], responses: { '200': ok('{ id }'), ...errores } },
        delete: { summary: 'Retira una noticia del muro (noticias:escribir)', parameters: [idParam, planParam], responses: { '200': ok('{ id, retirada }'), ...errores } },
      },
      '/eventos': {
        get: { summary: 'Clases y eventos desde ayer, o desde ?desde= (eventos:leer)', parameters: [planParam, { name: 'desde', in: 'query', schema: { type: 'string', format: 'date-time' } }], responses: { '200': ok('{ eventos: [...] }'), ...errores } },
        post: {
          summary: 'Agenda una clase o un evento (eventos:escribir)',
          parameters: [planParam],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['titulo', 'inicio'],
                  properties: {
                    titulo: { type: 'string' },
                    inicio: { type: 'string', format: 'date-time', description: 'ISO con zona, p. ej. 2026-11-05T18:00:00-06:00' },
                    tipo: { type: 'string', enum: ['clase', 'evento'] },
                    lugar: { type: 'string' },
                    liga: { type: 'string', format: 'uri' },
                    descripcion: { type: 'string' },
                    anunciar: { type: 'boolean', description: 'Publicarlo en Anuncios de la casa.' },
                  },
                },
              },
            },
          },
          responses: { '201': ok('{ id }'), ...errores },
        },
      },
      '/eventos/{id}': {
        delete: { summary: 'Cancela una clase o un evento (eventos:escribir)', parameters: [idParam, planParam], responses: { '200': ok('{ id, cancelada }'), ...errores } },
      },
      '/comunidad/hilos': {
        get: { summary: 'Hilos del muro; por omisión solo los que esperan respuesta (comunidad:leer)', parameters: [planParam, { name: 'estado', in: 'query', schema: { type: 'string', enum: ['sin', 'todos'] } }], responses: { '200': ok('{ hilos: [...] }'), ...errores } },
      },
      '/comunidad/hilos/{id}/respuestas': {
        post: {
          summary: 'Responde un hilo como Equipo VADAI (comunidad:escribir)',
          parameters: [idParam, planParam],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['texto'], properties: { texto: { type: 'string', maxLength: 5000 } } } } } },
          responses: { '201': ok('{ id }'), ...errores },
        },
      },
      '/miembros': {
        get: {
          summary: 'Miembros con acceso, último acceso y puntos (miembros:leer; correo con miembros:pii; suscripción con cobros:leer)',
          parameters: [planParam, { name: 'estado', in: 'query', schema: { type: 'string', enum: ['todos', 'vigentes', 'vencidos'] } }, { name: 'inactivos_dias', in: 'query', schema: { type: 'integer', minimum: 0 } }],
          responses: { '200': ok('{ miembros: [...], total }'), ...errores },
        },
      },
      '/metricas': {
        get: { summary: 'Cómo va la comunidad hoy (metricas:leer; lo cobrado con cobros:leer)', parameters: [planParam], responses: { '200': ok('{ miembrosConAcceso, nuevosEsteMes, ... }'), ...errores } },
      },
    },
    webhooks: {
      evento: {
        post: {
          summary: 'Lo que la academia manda a tus webhooks',
          description:
            'Cuerpo { id, tipo, creado, datos }. Encabezados: X-VADAI-Evento, X-VADAI-Id (igual en cada reintento) y ' +
            'X-VADAI-Firma: t=<unix>,v1=<HMAC-SHA256(secreto, "t.cuerpo")>. Tipos: noticia.publicada, miembro.entro, ' +
            'miembro.salio, sesion.creada.',
          responses: { '200': { description: 'Respóndelo con un 2xx; si no, se reintenta.' } },
        },
      },
    },
  }
}
