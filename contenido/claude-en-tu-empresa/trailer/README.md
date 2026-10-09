# Tráiler «Claude en tu Empresa»

## Dónde están los videos

Todo en **`entregables/`**, una sola carpeta. Cada nombre dice qué es: **versión - formato - tipo de archivo**.

| Versión | Formato | Archivos |
|---|---|---|
| `Plática gratuita` | `Horizontal` (1920×1080) | `Alta calidad.mp4` · `Para celular.mp4` |
| `Plática gratuita` | `Vertical` (1080×1920, zona segura de redes) | igual |
| `Curso` | `Horizontal` | igual |
| `Curso` | `Vertical` | igual |

- **Alta calidad:** master a 1080p60 (~260 MB), para subir a YouTube, Meta, TikTok o la página.
- **Para celular:** menos de 30 MB, para mandar por WhatsApp o verlo en el teléfono.
- Los subtítulos (`.srt`) no van aquí: se generan en `renders/v2/entregables/` con `node scripts/v2-srt.mjs`.

**Propuesta 3 «La escalera infinita»** (9-oct): los mismos ocho archivos con el prefijo `Propuesta 3 - …`. Mismo guion, voz y música; otra historia visual (la escalera de Penrose como el bucle, la multitud que forma «IA», el manual en blanco que al final se escribe solo) y sus propios efectos de sonido.

El curso tiene su propia voz (toma C) y dura 96.6 s; la plática, 94 s. Las versiones anteriores (v1, 3D, rebanadas) ya se borraron; su código sigue en git.

## Cómo está armado el código

| Ruta | Qué es |
|---|---|
| `v2-2d.html`, `v2-3d.html` | Las composiciones v2 (horizontal). Las genera `scripts/v2-html.mjs`; no se editan a mano. |
| `v2-2d-v.html` | La 2D en vertical (mismos módulos; las posiciones verticales son el segundo valor de cada `q(h, v)`). |
| `v2/` | Guion, tiempos de la voz, hoja de cues (lo que pasa en cada palabra), logos. |
| `v2/2d/` | La versión 2D: `apertura` (0–31 s), `medio` (31–53 s), `cierre` (53 s–fin), `dibujos` (figuras de línea que traza la chispa). |
| `v2/3d/` | La versión 3D, con las mismas tres partes, más `final` (la tarjeta con el CTA). |
| `v3e-*.html`, `v3/escalera/` | Propuesta 3: `apertura` (0–31 s), `medio` (31–53 s), `cierre` (53 s–fin) sobre un mundo three.js con cámara ortográfica (`mundo.js`), personajes y utilería (`objetos.js`), tipografía cinética y tarjetas de golpe (`texto.js`), fondo vivo, partículas y cursor (`capas.js`). `eventos.js` y `sonido.js` comparten los tiempos con la mezcla. Genera `scripts/v3e-html.mjs`; renderiza `scripts/v3e-render.sh`. |
| `estilo/`, `mundo/` | Motor compartido: render 3D, cámara, utilería, tipografía. |
| `index.html`, `tomas/` | La v1 (2:30, entregada el 7-oct). |
| `assets/v2/` | Voz, música y mezclas de la v2. |
| `assets/sfx/` | Efectos de sonido. |
| `scripts/` | Voz, mezcla, render, subtítulos y verificación (`v2-sonda.mjs`: revisa que la composición se construya sin errores). |
| `renders/` | Salidas de trabajo y registros. No se versionan. |

## Reglas y errores

- `MOTION-RULES.md`: cómo se hace cada video.
- `ERRORES.md`: lo que ya falló una vez. Se lee antes de tocar render, 3D o tipografía.
