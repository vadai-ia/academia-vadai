import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
