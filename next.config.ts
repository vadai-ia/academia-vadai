import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // M24: las imágenes de las noticias se dibujan con Inter (lib/noticias/imagen.tsx),
  // que se lee del disco. Sin esto Vercel no copia los .ttf a las funciones que
  // dibujan: el panel de V-AI-P, la vista previa y los crons.
  outputFileTracingIncludes: {
    '/admin/vaip/**': ['./lib/noticias/fuentes/*.ttf'],
    '/api/noticias/**': ['./lib/noticias/fuentes/*.ttf'],
    '/api/cron/**': ['./lib/noticias/fuentes/*.ttf'],
  },
  experimental: {
    serverActions: {
      // 4 MB, no el 1 MB por defecto (24-sep-2026). Es el respaldo del
      // formulario de adjuntos SIN JavaScript: con JavaScript el archivo va
      // directo del navegador a Supabase y no pasa por aquí. Por encima de
      // 4.5 MB Vercel lo corta de todas formas, así que subir más este número
      // no serviría de nada.
      bodySizeLimit: '4mb',
    },
  },
  async redirects() {
    return [
      // M16: las generaciones ya no tienen página propia; viven en su curso.
      { source: '/admin/cohortes/:id', destination: '/admin/generaciones/:id', permanent: false },
      // M22: Puntos y Certificaciones son pestañas de Mi perfil. Las ligas viejas
      // (correos del diploma, marcadores) siguen llegando.
      { source: '/puntos', destination: '/perfil/puntos', permanent: false },
      { source: '/certificaciones', destination: '/perfil/certificaciones', permanent: false },
      // M25: el panel en «dos mundos». Publicar vive en el Muro, el Contenido
      // se llama Herramientas, Cobros y Planes son una sola página, y los
      // ajustes del agente viven dentro de Agente IA.
      { source: '/admin/vaip/publicar', destination: '/admin/vaip/muro', permanent: false },
      { source: '/admin/vaip/contenido', destination: '/admin/vaip/herramientas', permanent: false },
      { source: '/admin/vaip/cobros', destination: '/admin/vaip/planes', permanent: false },
      { source: '/admin/ajustes/agente', destination: '/admin/agente/ajustes', permanent: false },
    ]
  },
};

export default nextConfig;
