# Claude en tu Empresa — contenido del curso

Todo lo que se dice, se proyecta, se imprime y se carga a la plataforma para el curso. Rama
`curso/claude-en-tu-empresa`. Arranca el 21-sep-2026.

## Mapa

| Archivo | Qué es |
|---|---|
| `fuentes.md` | **El dossier.** Toda cifra del curso tiene fila aquí con su fuente, audiencia y estado. Ninguna cifra se proyecta sin fila |
| `audiencias.md` | Los cuatro activos (charla, onboarding, sesiones, grabados) y las tres audiencias del curso |
| `voz-y-marca.md` | Cómo se escribe: diez reglas y las frases propias que se reutilizan |
| `planes-claude.md` | Pro obligatorio, Team recomendado, qué exige cada uno |
| `mapa-curso.md` | Las 8 sesiones × los 5 módulos + el 0, con quién da cada una |
| `charla-invitacion/` | La charla del jueves: `guion.md` (con la auditoría de datos) y `laminas.md` |
| `encuestas/` | Las encuestas de la charla, listas para `/admin/encuestas` (M12) |
| `modulo-0/` · `modulo-1/` | `guion.md` · `laminas.md` · `workbook.md` · `evaluacion.md` |
| `prompts/` | Los primeros 21 de los +50 prometidos, siete perfiles, texto plano |
| `plantillas/` | Tarjeta PACTO · Tu puesto en el mapa · Reglas de información · Inventario de tareas |
| `onboarding/` | Los tres videos gratuitos: plataforma · sesiones en vivo · cuenta de Claude |
| `correos/` | La secuencia de bienvenida y sesiones, para `lib/correo/plantillas.ts` |

## Cómo se verifica

```
pnpm check:curso
```

Falla si una cita `[^id]` no resuelve a `fuentes.md`, si se usa una fila `pendiente`, si un
módulo se apoya en una sola audiencia, si un archivo de módulo quedó vacío, o si la charla
promete algo antes de la sesión que lo enseña.

## Cómo se construyen las presentaciones

```
python presentacion/construir.py
```

Lee cada `laminas.md` y produce el `.pptx` editable y el `.html` para proyectar, con los tokens
de `app/globals.css`. Una fuente, dos formatos, nunca desincronizados.

## Cómo se carga a la plataforma

```
pnpm curso:sembrar
```

Lee `modulo-*/guion.md`, convierte a JSON de Tiptap y siembra curso, módulos y lecciones en
`academia.*` con UUID fijos (idempotente, `on conflict do update`). Las lecciones nacen en
`draft`: se publican a mano después de cada sesión, que es la regla de la junta.

## Formato de `laminas.md`

Una lámina por bloque `## N · Título`, con campos `tipo`, `titular` (acento en `**negritas**`),
`cifra`, `texto` (separador ` | ` para filas de tabla, ` · ` para ítems de lista), `fuente`
(`[^id]`), `nota` (no se proyecta).

## Lo que falta y quién lo decide

- **Precio** — la landing dice $24,890; la junta habló de $4,900/persona y paquete empresarial.
- **Zoom o Meet.**
- **Capturas** de la cuenta real de Claude, la semana del curso.
- **Testimonios reales** para la landing: los actuales están marcados en el código como
  inventados.
- El contador de oferta de la landing venció el 10-ago-2026.
