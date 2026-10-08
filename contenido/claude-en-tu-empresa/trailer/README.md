# Tráiler «Claude en tu Empresa»

## Dónde están los videos

**`entregables/platica/`**: lo que se está revisando, solo el cierre de la plática.

| Carpeta | Qué contiene |
|---|---|
| `entregables/platica/2d/` | Versión 2D «Un solo trazo» (voz de Camila, toma G). Desde el 10-oct es la única que se trabaja; la 3D se borró de entregables y su código sigue en `v2/3d/` y en git. |

En cada carpeta hay tres archivos:
- `…-telefono.mp4`: para verlo en el celular (< 30 MB).
- `….mp4`: el master a 1080p60.
- `….srt`: los subtítulos.

Las versiones anteriores ya se borraron (9-oct): v1, rebanadas, curso y verticales con la voz anterior. El código de cada una sigue en git.

## Cómo está armado el código

| Ruta | Qué es |
|---|---|
| `v2-2d.html`, `v2-3d.html` | Las composiciones v2 (horizontal). Las genera `scripts/v2-html.mjs`; no se editan a mano. |
| `v2-2d-v.html`, `v2-3d-v.html` | Las mismas composiciones en vertical (en pausa; hay que volver a renderizarlas con la voz nueva). |
| `v2/` | Guion, tiempos de la voz, hoja de cues (lo que pasa en cada palabra), logos. |
| `v2/2d/` | La versión 2D: `apertura` (0–31 s), `medio` (31–53 s), `cierre` (53 s–fin), `dibujos` (figuras de línea que traza la chispa). |
| `v2/3d/` | La versión 3D, con las mismas tres partes, más `final` (la tarjeta con el CTA). |
| `estilo/`, `mundo/` | Motor compartido: render 3D, cámara, utilería, tipografía. |
| `index.html`, `tomas/` | La v1 (2:30, entregada el 7-oct). |
| `assets/v2/` | Voz, música y mezclas de la v2. |
| `assets/sfx/` | Efectos de sonido. |
| `scripts/` | Voz, mezcla, render, subtítulos y verificación (`v2-sonda.mjs`: revisa que la composición se construya sin errores). |
| `renders/` | Salidas de trabajo y registros. No se versionan. |

## Reglas y errores

- `MOTION-RULES.md`: cómo se hace cada video.
- `ERRORES.md`: lo que ya falló una vez. Se lee antes de tocar render, 3D o tipografía.
