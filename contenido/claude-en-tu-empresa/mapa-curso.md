# Mapa del curso — sesiones × módulos × lecciones

> Dictado por Alejandro en la junta del 2-sep-2026 y contrastado con lo que promete la landing.
> 8 sesiones de 2.5 h — Roberto Ortiz: **2 h de contenido + 30 min de preguntas** —, lunes y
> jueves, 4 semanas. Arranca el **21-sep-2026**. Cada módulo grabado se libera **después** de
> su sesión en vivo (decisión de la junta: no dar Finanzas a quien no llevó lo básico).

## Las 8 sesiones

> **Cambio del 20-sep-2026 (Alejandro).** El primer día es la **sesión de alineación de Total
> Coach** (WIIFM, la IA hoy, diagnóstico personal, metodología de decisión, salas por empresa):
> `sesion-1/laminas.md`, 55 láminas. El contexto del Módulo 0 y el tour del Módulo 1 recorren a
> partir de la sesión 2. Pendiente: reacomodar la tabla de sesiones con Alejandro.


| S | Semana | Tema | Quién | Módulo | Entregables que se abren |
|---|---|---|---|---|---|
| 1 | 1 · lun 21-sep | **Contexto del mundo (45 min) + arranque del tour de Claude** | Alejandro | M0 + M1 | Módulo 0 · "Tu puesto en el mapa" |
| 2 | 1 · jue 24-sep | **Tour completo de Claude**, botón por botón, incluida toda la configuración | Alejandro | M1 | Mapa de la interfaz |
| 3 | 2 · lun 28-sep | **PACTO completo + pensamiento crítico.** *"La más importante de todas"* | Alejandro | M1 | Tarjeta PACTO · Prompts por perfil |
| 4 | 2 · jue 1-oct | **Conectores y Habilidades (Skills)** | Alejandro | M1 | Reglas de información |
| 5 | 3 · lun 5-oct | **Proyectos** + Excel, Word, PowerPoint + Claude in Chrome como *existe* | Alejandro | M1 + M2 | Inventario de tareas por área |
| 6 | 3 · jue 8-oct | Skills avanzadas, formatos y **dashboards**. Empieza el corte por áreas | Alejandro | M3 | — |
| 7 | 4 · lun 12-oct | Áreas específicas y ventas: cotizaciones dentro de Claude con sus inventarios | Roberto | M4 | — |
| 8 | 4 · jue 15-oct | **Alineación de equipos** | Roberto Ortiz (Total Coach) | M5 | Plan de adopción |

> **Cambio del 4-sep-2026 (Alejandro).** PACTO sale del Módulo 0 y pasa a la **sesión 3, dentro
> del Módulo 1**: primero se conoce la herramienta, después se aprende a hablarle. Los cinco
> módulos siguen siendo los de la landing; lo que cambia es en qué sesión se enseña cada parte
> del Módulo 1, que ahora ocupa las sesiones 1 a 5. El Módulo 0 queda como puro contexto.

**Puente 2 → 3** (Alejandro): *"no te sirve de nada saber qué botones picar si no le sabes cómo
hablar"*. **Puente 3 → 4**: *"ya le sabes hablar; ahora te enseño a darle más habilidades y
herramientas"*.

**Regla comercial:** de la 1 a la 7, puro valor, cero venta. La implementación se conversa en la
8 y en la asesoría 1 a 1.

## La promesa de la landing, mapeada

| Módulo landing | Bullets vendidos | Lecciones que los cumplen | Sesión |
|---|---|---|---|
| 01 Aprende a usar Claude | contexto/proyectos · tokens y costo · configuración segura · prompts que funcionan | 1.7 · 1.4 · 1.9 · 1.10 | 1–4 |
| 02 Claude en Excel, Word y correo | Excel · Word · PowerPoint · Correo | *(mapeado, no escrito en esta fase)* | 3–4 |
| 03 Dashboard y reportes | KPIs · tableros que se actualizan solos · reportes por link · variación | *(mapeado)* | 6 |
| 04 Finanzas, Operaciones y Ventas | casos, plantillas y prompts por área | *(mapeado)* | 6–7 |
| 05 Alineación de equipos (bonus) | reglas de información · plan de adopción · ROI · hábitos | *(mapeado)* | 8 |
| **00 Antes de empezar** (bono, fuera de la cuenta de 5) | — | 0.1–0.13 | 1–2 |

## Índice de lecciones escritas en esta fase

**Módulo 0 — Antes de empezar**
- Contexto (sesión 1): 0.1 No estás atrasado · 0.2 El reloj que ya corre ·
  0.3 Tu puesto en el mapa · 0.4 Las dos rutas · 0.5 Por qué la mayoría fracasa · 0.6 Ya está
  pasando en tu área · 0.7 Qué es la IA en realidad
- 0.8 Tu primera conversación (tarea de la sesión 1)

**Módulo 1 — Aprende a usar Claude** (sesiones 1 a 5)
- Sesiones 1–2 · el tour: 1.1 El recorrido guiado · 1.2 Conversaciones que sí sirven ·
  1.3 La configuración, campo por campo · 1.4 Qué se cobra y cómo no gastar de más
- Sesión 3 · PACTO y criterio: 1.5 No es la herramienta, es el criterio · 1.6 Cuestiónate antes
  de escribir · 1.7 PACTO letra por letra · 1.8 Las tres preguntas · 1.9 De preguntar a ejecutar
- Sesiones 4–5: 1.10 Habilidades · 1.11 Conectores · 1.12 Proyectos · 1.13 De respuesta a
  entregable · 1.14 Configuración segura para tu empresa · 1.15 Los prompts que sí funcionan

## Cómo se carga a la plataforma

`academia.courses → modules → lessons`. Cada lección lleva `lesson_type` (video · text · quiz ·
assignment), `description_rich` en JSON de Tiptap y adjuntos en el bucket `academia-adjuntos`.

Dos caminos, los dos válidos:
1. **A mano**, desde `/admin/cursos/[id]` → *Nueva lección* → editor rico. Para una lección.
2. **`scripts/seed-curso.mjs`**, con el patrón de `seed.mjs` (idempotente, UUID fijos, `on
   conflict do update`): lee `modulo-*/guion.md`, convierte Markdown → Tiptap y siembra. Para
   las 23 lecciones de esta fase.

## Lo que la junta dejó fuera del temario

- Agentes autónomos y auto-respuesta de correo. Se mencionan, no se practican.
- Sistemas externos que impliquen pagar algo más (n8n, Make, Whaapy…): hasta la sesión 8 o la
  asesoría, nunca en las 1–7.

## Pendientes de calendario

- Zoom o Meet: la junta lo dejó para "esta semana". El master document (§0) dice Google Meet.
- La charla de invitación: jueves 6 PM. Sus encuestas se cuelgan del curso real para que
  quien vote quede en el padrón.
