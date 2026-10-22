-- academia_0050_noticias_por_caceria.sql
-- Cuántas noticias deja cada cacería, ajustable desde el panel.
--
-- POR QUÉ
-- Alejandro (22-oct-2026): "quiero poder ajustar desde el frontend la cantidad
-- de noticias que busca por día y que se quede guardado el valor que dejo.
-- Ahorita de inicio quiero que solo busque la noticia TOP 1 y más relevante de
-- la actualidad y que sea realmente lo más hablado en el mercado".
--
-- Hasta hoy el top 5 estaba fijo en el código (`MAX_PROPUESTAS`). Vive en los
-- ajustes del agente porque la cacería, el botón y el cron de las 7:00 ya los
-- leen de ahí. Arranca en 1 para todos, también para el agente QA; la suite fija
-- el valor que necesita y lo regresa al terminar.
--
-- Con 1 la cacería no arma un top variado: elige la noticia que más medios
-- distintos están cubriendo (lib/noticias/prompt.ts, `reglasDeRedaccion`).
--
-- Quién lo cambia: lo que ya decide `agent_settings_admin` (admin y superadmin).
-- El community manager lo lee (`agent_settings_equipo_lee`) pero no lo edita.

alter table academia.agent_settings
  add column noticias_por_caceria smallint not null default 1
    check (noticias_por_caceria between 1 and 5);
