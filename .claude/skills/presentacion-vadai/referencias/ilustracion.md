# Ilustración — un sistema, cuatro capas, una compuerta

## Gramática visual (aplica a todo lo dibujado y a todo lo generado)

- Trazo **2 px** constante, remates redondeados, uniones abiertas; radio de esquina 6.
- **Cuatro tintas**: navy `#0A1A2F` para línea; cielo claro `#DFF4FC` / `#D2EEFB` y coral
  `#FFB489` para rellenos; lima `#C6F24E` como puntuación en **un** elemento por escena.
- Sin sombras ni degradados **dentro** de la ilustración. Sin texto legible. Sin logos.
- Objetos del mundo del alumno: hoja de cálculo, documento, correo, calendario, reloj, factura,
  candado, teléfono, carpeta, equipo de tres personas, flecha. **Nunca** isométrico, cerebros,
  robots, nodos brillantes, manos estrechándose.
- Misma luz y misma cámara que el collage de la landing (`activos/marca/collage-landing.png`):
  tres cuartos, ligera picada, objetos flotando sobre nubes de alfa.

## Capas

| Capa | Qué | Dónde vive | Cómo se produce |
|---|---|---|---|
| Vector propio | píldoras, escalones, letras PACTO, mapa de la interfaz, diagramas, mock-UI, las primitivas | `activos/primitivas/*.svg` + componentes del builder | SVG a mano, tokens |
| Capturas reales | Claude: pantalla principal, configuración, habilidades, conectores, proyectos, artefacto | `presentacion/imagenes/<deck>/` | cuenta real, modo claro, zoom 125 %, datos personales difuminados en la imagen (gaussiano 16 px), chip con fecha |
| Fotos reales | Alejandro, Roberto, Roberto Ortiz, una sala | `presentacion/imagenes/equipo/` | las provee VADAI; máscara cuadro redondeado radio 32 |
| Generada · vectorial | objetos y escenas planas en paleta exacta | `presentacion/imagenes/<deck>/gen-*.png` | Higgsfield `recraft_v4_1` |
| Generada · escena | dispositivos flotando sobre nubes (continúa el collage) | ídem | Magnific `seedream-5-pro` o `imagen-nano-banana-2` con el collage como referencia de estilo |

## Parámetros de generación

**Recraft V4.1 (Higgsfield · `generate_image`)**
```
model: recraft_v4_1
model_type: utility_vector        # o vector para piezas más expresivas
colors: ["#0A1A2F","#006E96","#00A0DB","#4FC6EE","#DFF4FC","#FFB489","#C6F24E","#EAF4FA"]
background_color: "#EAF4FA"       # o null para transparente
aspect_ratio: 1:1 | 4:3 | 16:9
resolution: 2k
```

**Prompt maestro (vectorial)**
> Flat vector illustration, clean 2px outlines with rounded caps, minimal shading, no gradients,
> no text, no logos, no people. Subject: [objeto u objetos]. Palette strictly navy #0A1A2F
> outlines, pale sky #DFF4FC and coral #FFB489 fills, one small lime #C6F24E accent. Composition:
> three-quarter view, slight top-down, floating over a soft cloud shape, generous negative space,
> subject centered-left. Style: modern tech brand illustration, consistent line weight.

**Negativos** (siempre): `text, letters, watermark, logo, brand mark, photorealistic people,
isometric, 3D render, glossy, neon, purple gradient, dark background, brain, robot, network nodes`.

**Escena (Magnific · `images_generate`)**
```
mode: seedream-5-pro   (o imagen-nano-banana-2 para fidelidad de paleta)
aspectRatio: 16:9 | 4:3
references: [{ type: "style", identifier: <id del collage subido> }]
```
> Floating laptop, tablet and phone showing blue-cyan dashboard interfaces, hovering over soft
> white clouds against a sky gradient from #4FC6EE to #006E96, clean product-render look, no
> readable text on screens, no people, no logos, same lighting and camera as the reference.

## Compuerta de estilo (obligatoria antes de producir en serie)

1. `tablero-estilo.py` genera **6 pruebas**: 3 vectoriales (Recraft) y 3 escenas (Magnific) con
   los prompts maestros, mismos sujetos.
2. Se arma una hoja de contacto y **Alejandro elige** generador y ajusta el prompt.
3. Solo entonces se produce la lista de piezas del deck.

## Guardrails por pieza (los aplica `verificar.py --imagenes`)

- Sin texto ni logos (revisión visual en la hoja de contacto).
- Histograma: ≥ 85 % de los píxeles no transparentes a menos de ΔE 12 de algún token.
- Fondo transparente o `surface`; nunca blanco puro a sangre.
- Nombre de archivo `gen-<sujeto>-<nn>.png`, y fila en `presentacion/imagenes/<deck>/INDICE.md`
  con el prompt exacto, el modelo y la fecha.

## Lista de piezas para M0 y M1 (se confirma con la dirección ganadora)

Primitivas SVG (12): hoja-calculo · documento · correo · calendario · reloj · factura · candado ·
telefono · carpeta · equipo-3 · flecha · nube.
Escenas generadas (6, reusadas por recorte): dispositivos-flotando-01/02 · escritorio-con-excel ·
bandeja-de-correo · calendario-y-reloj · carpeta-de-proyecto.
Capturas reales (7): pantalla-principal · configuracion-perfil · configuracion-privacidad ·
uso · memoria · conectores-gmail · proyecto-armado.
