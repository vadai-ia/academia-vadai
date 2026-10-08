# ERRORES — tráiler «Claude en tu Empresa»

Fallas encontradas y cómo se arreglaron. Se lee antes de tocar render, 3D o tipografía
animada (MOTION-RULES 11). Lo más nuevo arriba.

## 10-oct-2026 · v2 2D plática, Ronda E (toma G, escenas nuevas)

### E37 · Opentype pega un 0 al número anterior
- **Síntoma:** «?», «!» y «$» de los signos y billetes no se dibujaban. La consola decía `Expected number, "…M20.20L2.70…"`.
- **Causa:** `getPath(c, 0, 0, tam).toPathData()` escribe `M20.2 0` como `M20.20` cuando una coordenada vale exactamente 0.
- **Arreglo:** el glifo se pide lejos del origen (`getPath(c, 1000, 1000, tam)`) y se centra con su caja. `texto()` no lo sufre porque nunca cae en 0.

### E36 · Un nombre de módulo tapado por una variable local deja la escena a medias
- **Síntoma:** en el render no aparecían el bucle, los logos ni la chispa. La personita del 06 salía desde el segundo 0.
- **Causa:** en `medio.js`, `D` ya era la posición del escritorio y tapó `import * as D from "./dibujos.js"`. La construcción se cayó a la mitad, el reloj y la chispa nunca se montaron, y el snapshot no lo reporta.
- **Arreglo:** el import se llama `Dib`. Antes de renderizar se corre la sonda de Chrome (`node scripts/v2-sonda.mjs v2-2d.html t1,t2,…`). **Un snapshot «bien guardado» no prueba que la construcción terminó.**

### E35 · Imágenes en blanco en los primeros cuadros de un worker
- **Síntoma:** los logos oficiales (Excel, PowerPoint) salían como círculos blancos en los primeros cuadros de cada snapshot.
- **Arreglo:** la plantilla decodifica las imágenes (`new Image().decode()`) antes de construir.

### E34 · La línea de comando del mezclador pasó del límite de Windows
- **Síntoma:** `spawnSync ffmpeg ENAMETOOLONG` con 173 efectos.
- **Arreglo:** cada archivo de efecto entra una sola vez y se reparte con `asplit`; el grafo va en `-filter_complex_script`.

### E33 · Al cambiar la voz, los compases quietos de la canción caen en otro lado
- **Síntoma:** con la toma G (3.4 s más larga antes de «método»), los compases 16–17 de n5 caían en «diariamente… y aun así»: un hueco de 12 dB a media escena.
- **Arreglo:** se quitan el 16 y el 17 (antes 19–21) y la entrada se retrasa 1.4 s. La edición se revisa con el nivel de la música segundo por segundo, no solo con dónde cae el golpe.

### E32 · Empalmar una frase de otra toma cambia el acento
- **Síntoma:** la frase del respaldo, tomada de otra generación, sonó «sumamente española» en medio de una voz mexicana.
- **Arreglo:** nunca se empalma. Se generan tomas completas, se verifican con whisper y se elige una sola para todo el video.

## 9-oct-2026 · v2 plática: voz de mujer, música nueva, texto de golpe

### E31 · La duración de la composición estaba fija en el generador
- **Síntoma:** al cambiar de voz el video siguió en 87.0 s en vez de 88.5. La tarjeta final duraba 1.3 s y el acorde final se cortaba.
- **Arreglo:** `scripts/v2-html.mjs` importa `DURACION` de `v2/tiempos.js`. Nada de duraciones copiadas a mano.

### E30 · Detener el script de render no detiene el render
- **Síntoma:** después de `TaskStop` siguió el siguiente video de la cola, con Chrome y Node vivos e `index.html` cambiado.
- **Arreglo:** matar toda la cadena (`hyperframes`, `v2-render.sh`, `chrome-headless-shell`, `ffmpeg`) y restaurar la v1 desde `renders/v2/index-v1.respaldo.html`.

### E29 · `transcribe` sin whisper.cpp no falla: se salta
- **Síntoma:** no se escribió ningún `.json`; el aviso solo sale si se ve la salida («whisper-cpp not found»).
- **Arreglo:** `HYPERFRAMES_WHISPER_PATH` apunta a `~/.local/whisper.cpp/b5454/Release/whisper-cli.exe`, ya fijado dentro de `scripts/v2-voz.mjs` y `v2-voz-platica.mjs`.

### E28 · La pista de la plática terminaba con media palabra del curso
- **Síntoma (lo oyó Alejandro):** al final se oía una palabra cortada.
- **Causa:** la pista era «la toma tal cual» más 0.6 s de cola, y en esa cola ya empezaba el cierre del curso.
- **Arreglo:** la pista muere en la última palabra (+0.35 s) con un fundido de 0.25 s, y nada de la toma entra después.

### E27 · La voz IA no es estable de una toma a otra
- **Síntoma:** con el mismo texto y los mismos ajustes, «VADAI» salió en dos sílabas en una toma y en tres en cuatro. Otra toma dijo «se irá» por «sigue».
- **Arreglo:** cada toma se verifica palabra por palabra contra el guion. Se arma con la mejor base y se empalman frases completas de otra toma, siempre en silencios.
- **Cómo se distingue:** «Badaï» (0.3–0.4 s) es la buena; «Badaie» (0.45–0.5 s) es la mala. La pronunciación correcta es la de Joaquín.

### E26b · Afinado por islas frágil con voces que casi no pausan
- **Síntoma:** palabras empujadas 0.3 s hacia atrás en cascada; la última frase terminaba después de la pista.
- **Arreglo:** cada frase se pega al silencio que termina donde ella empieza y al que termina donde empieza la siguiente. Dentro de la frase solo se corta en pausas con puntuación. Nada pasa del final de la pista.

## 8-oct-2026 · v2 completa (8 videos: 3D/2D × plática/curso × horizontal/vertical)

### E26 · Filos de piso que se volvían un plano lima enorme
- **Síntoma:** en vertical, entre pisos, el borde encendido de la losa de arriba llenaba medio cuadro de lima.
- **Causa:** cada «encendido» de un piso duraba para siempre (se tomaba el máximo) y la cámara lo veía de cerca y desde abajo.
- **Arreglo:** `enciende(k, t, fuerza, dur)` en `v2/3d/cierre.js`. Los pisos de un tiempo se apagan al terminarlo; solo las cascadas finales se quedan. Intensidad máxima 0.95.

### E25 · Tildes de Ñ y acentos encima de la línea de arriba
- **Síntoma:** «ENSEÑAMOS» en segunda línea se veía sin tilde. La tilde estaba ahí, pero encima de «NOSOTROS».
- **Causa:** Anton es muy alto; con interlínea 0.92 los acentos de una línea invaden la anterior.
- **Arreglo:** interlínea 1.0 y aire extra (0.16 em) arriba de cada línea con Ñ o vocal acentuada: `texto()` en 2D, `airear()` en 3D.
- **Cómo se vio:** con `snapshot --zoom` sobre el texto. A escala de hoja de contactos parecía letra sin tilde.

### E24 · «qué» y «que» son la misma palabra para las anclas
- **Síntoma:** un «QUE» suelto aparecía segundos antes, encimado en otra frase.
- **Causa:** `clave()` quita acentos, así que `T.w(i, "que", n)` cuenta también los «qué».
- **Arreglo:** contar la aparición n sobre la frase completa con acentos quitados (qué, qué, que, que…).
- **Regla:** antes de anclar una palabra que se repite, listar la frase con `T.porFrase[i]`.

### E23 · En la 3D dos claves de cámara chocaban por 0.05 s
- **Síntoma:** en «con Claude…» la cámara regresaba a un piso en vez de subir a la ventana.
- **Causa:** la clave final de los pisos (59.68 s) quedó después de la primera de la ventana (59.63 s). El director ordena por tiempo e interpoló hacia atrás.
- **Arreglo:** cada tramo suelta la cámara antes de que el siguiente la tome (−0.55 s / −0.2 s).

### E22 · `visibility` dentro de un tween que también mueve
- **Riesgo:** GSAP puede cambiar `visibility` hasta el final del tween, y el objeto viajaría invisible.
- **Arreglo:** la visibilidad va siempre en su propio `fromTo` de 0.001 s.

### E21 · El reloj 2D congela el último estado de cada rutina
- **Síntoma:** la barra de MÉTODO siguió en pantalla de 47 a 76 s.
- **Causa:** con el tiempo acotado (E17), una rutina que termina antes de apagar su objeto lo deja encendido para siempre.
- **Regla:** el tramo de cada rutina cubre hasta que su objeto deja de verse, y su último estado es invisible. Las figuras «dibuja» llevan `fin`.

### E20 · Las tarjetas que vuelan con `fromTo` se veían desde el segundo 0
- **Causa:** `immediateRender` las deja en su posición de salida, que estaba en los bordes del cuadro.
- **Arreglo:** cada una con su `visibility` oculta hasta que despega (E22).

## 8-oct-2026 · v2 (rebanadas 3D y 2D)

### E19 · `lint` y `snapshot` solo leen `index.html`
- **Síntoma:** `hyperframes lint v2-3d.html` → "Not a directory". `snapshot` no tiene `-c`; `render` sí.
- **Arreglo:** se copia la composición sobre `index.html` y se restaura la v1 al terminar, con `trap` en `scripts/v2-rebanadas.sh`.
- **Ojo:** con `v2-3d.html` y `v2-2d.html` en la raíz, `lint` marca `multiple_root_compositions`. No estorba al render, pero cuando se elija la versión hay que dejar una sola raíz.

### E18 · Puntos sueltos en toda la versión 2D
- **Síntoma:** motitas en fila donde había o iba a haber texto, y alrededor del bucle.
- **Causa:** un trazo de largo cero (DrawSVG en `0% 0%` o `100% 100%`) con `stroke-linecap: round` pinta un punto.
- **Arreglo:** fuera de su ventana de dibujo, cada glifo, cometa, anillo e ícono va con `opacity 0` o `visibility hidden`. Lo hacen `dibujar()` y `borrar()` en `v2/2d/trazo.js`.

### E17 · Rutinas 2D que dependían del orden de los cuadros
- **Riesgo:** es el mismo de E12. Un `seek` que salta deja con el estado viejo a una rutina que ya no corre.
- **Arreglo:** el reloj de `v2-2d.html` corre **todas** las rutinas en cada cuadro, con el tiempo acotado a su tramo.
- **Cómo se dispara:** desde un `modifier` de GSAP, que se ejecuta aunque el `seek` suprima callbacks, y desde `hf-seek`.

### E16 · Dos titulares encimados por palabras muy juntas
- **Síntoma:** «tarde» (24.44 s) y «nadie» (24.81 s) están a 0.37 s. Sacar la primera frase en «nadie» la encimaba con la segunda.
- **Arreglo:** la primera frase se queda 0.7 s más para que se lea. La segunda entra completa en «ha».
- **Regla:** cuando dos anclas van a menos de 0.6 s, la segunda frase entra en bloque en la siguiente palabra, nunca encima de la primera.

### E15 · Objetos de la v1 que nadie apagaba
- **Síntoma:** la ventana de Claude (`s.ventana`) salía encima del titular en 01 y en medio de los cien puntos.
- **Causa:** en la v1 solo `tomas/titulo.js` controlaba su visibilidad, y la v2 no carga esa toma.
- **Arreglo:** cada módulo v2 declara explícitamente la visibilidad de todo objeto compartido de `crearEscena()` que no use.

### E14 · La mezcla no llegaba a −14 LUFS
- **Síntoma:** −15.4 LUFS con `loudnorm` lineal y −15.1 con ganancia + limitador. El pico real de los golpes limitaba la ganancia.
- **Arreglo:** ganancia → limitador → se vuelve a medir y se suma lo que falta, hasta quedar a ±0.3 dB. Hoy da −14.2 LUFS / −1.6 dBTP.

## 7-oct-2026 · video definitivo (voz, música, 15 tomas)

### E13 · `snapshot` capturaba cuadros vacíos en el primer arranque en frío
- **Síntoma:** una corrida de `snapshot` salió entera en navy, sin 3D ni tipografía, con el aviso «Runtime did not become render-ready within 5000ms».
- **Causa:** el límite de `snapshot` es de 5 s. Armar el mundo tarda 108 ms; lo lento era el `<audio>` con el WAV maestro (43 MB) y la compilación de shaders en frío.
- **Arreglo:** la composición usa `master-previa.m4a`; el WAV maestro solo se monta en los entregables con ffmpeg.
- **Regla:** si aparece el aviso, se repite la captura y se revisa que no salga vacía. `verificar-render.mjs` ahora mide el rango de luminancia del cuadro entero.

### E12 · Brillo de los filos de piso con historia
- **Causa:** la rutina de la cascada (12) solo corría de su momento en adelante; un worker que pintara 120 s y luego 30 s veía los pisos encendidos.
- **Arreglo:** toda rutina que toca un objeto siempre visible cubre el video entero (0–150 s) y calcula su estado desde T.
- **Mismo motivo:** el aro tenue de 14 es una instancia propia; nunca se cambia la opacidad de materiales compartidos con otra toma.

### E11 · `autoAlpha: 0` deja el nodo con `visibility: hidden`
- **Síntoma:** la ventana que la cámara atraviesa en 08→09 nunca apareció; el `pop` solo anima la opacidad.
- **Arreglo:** si un nodo se oculta con `autoAlpha`, se vuelve a mostrar con `tl.set(n, { autoAlpha: 1 }, t)` antes de su entrada.

### E10 · La rejilla de compases estaba 3 pulsos corrida
- **Causa:** el detector de tempo acertó el BPM (99.84) pero eligió como tiempo fuerte el pulso equivocado.
- **Arreglo:** la fase se fijó con tres golpes audibles de la pista (entrada de A a 38.38 s, de B a 76.8 s, del clímax a 110.4 s): primer tiempo fuerte en −0.085 s. Nunca confiar solo en el detector.

### E9 · whisper movía palabras hasta 1.3 s junto a las pausas
- **Síntoma:** en la toma 14, «Te» quedaba en 136.96 s; suena en 138.25 s, después de la pausa de 1 s.
- **Arreglo:** `voz-montar.mjs` asigna cada silencio real (< −45 dB por ≥ 150 ms) a una frontera entre palabras y reescala cada isla de habla a su inicio y fin reales.
- **Primer intento descartado:** mover cada palabra al ataque siguiente amontonaba palabras («Es el método» en el mismo instante).

### E8 · La voz IA pegó «con PACTO» en «compacto» y «prompt» sonaba «pronto»
- **Detección:** con la autorrevisión de whisper.
- **Arreglo:** se regeneró con una pausa breve antes de PACTO y énfasis en PROMPT (tomas 07a y 10b), y se volvió a verificar contra el guion, palabra por palabra.

## 7-oct-2026 · 0b, prueba de factibilidad

### E5 · El texto DOM cambiaba según cuántos workers hubiera
- **Síntoma:** 5 workers contra 3 daban hasta 108 cuadros distintos, siempre en las etiquetas de piso; hasta 97 niveles de diferencia en los filos de las letras.
- **Causa:** Chrome promueve a capa de composición un nodo cuyo `transform` cambia. Una capa se rasteriza una vez y luego solo se desplaza, así que el suavizado del texto dependía de lo que ese worker había pintado antes. Fijar `will-change` lo empeoró: congela la rasterización en la primera posición.
- **Arreglo:**
  - `estilo/gsap.js` con `gsap.config({ force3D: false })`, para que GSAP solo escriba transformaciones 2D.
  - Lo que se coloca cuadro a cuadro desde el 3D (etiquetas) va con `left`/`top` en pixeles enteros, nunca con `transform`.
  - Prohibido `will-change` en texto animado.
- **Queda:** 3 de 180 cuadros difieren en 1 nivel de 255 en el título (escala animada 1 → 0.985). Se revisa en styleframes.

### E4 · El foco de la profundidad de campo salía con un cuadro de retraso
- **Síntoma:** renders con distinto número de workers divergían desde que la cámara empezaba a moverse.
- **Causa:** `mundo.enfocar()` se llamaba después de `mundo.pintar()`, así que cada cuadro se pintaba con el foco del cuadro anterior que vio ese worker.
- **Arreglo:** primero `aplicar(T)`, luego `enfocar`, y al final `pintar`. Regla: **todo** estado que lee el post-proceso se fija antes de pintar.

### E3 · Render «completo» con 108 de 180 cuadros sin el 3D
- **Síntoma:** en 3 de 5 workers el canvas nunca se pintó; solo salieron el fondo y la tipografía. El CLI reportó éxito.
- **Causa:** `window.__hf.buildReady` se registraba dentro de un `<script type="module">`, que es diferido y espera sus imports. El runtime revisó antes de que existiera y capturó sin esperar.
- **Arreglo:**
  - La promesa se registra en un `<script>` clásico al parsear.
  - El módulo la resuelve al terminar, o la rechaza si la construcción falla o se pierde el contexto WebGL.
  - `scripts/verificar-render.mjs` revisa cada cuadro y falla si alguno salió sin luces altas en la mitad derecha. **Todo render pasa por él.**

### E2 · Moteado distinto entre dos corridas del mismo cuadro
- **Síntoma:** diferencias de hasta 86 niveles alrededor de la laptop.
- **Causa:** postprocessing (SSAO) genera su textura de ruido con `Math.random` sin semilla al construirse.
- **Arreglo:** `estilo/semilla.js` es el primer script de toda composición y fija `Math.random` con semilla antes de cargar cualquier librería.

### E1 · Chrome de captura en la GPU integrada
- **Síntoma:** la sonda reportaba la Radeon 780M aunque la RTX 4050 estaba asignada.
- **Causa:** no había entrada para `chrome-headless-shell.exe` en `HKCU\Software\Microsoft\DirectX\UserGpuPreferences`.
- **Arreglo:** se escribió `GpuPreference=2;` para esa ruta exacta (sin admin).
- **Ojo:** si HyperFrames actualiza su Chrome, la ruta cambia y hay que repetirlo.

### Notas de rendimiento (no son errores)
- 4K con 5 workers satura los 6 GB de VRAM: la captura tarda 8 min 15 s por 3 s. Con 2 workers tarda 49 s. **4K siempre con `--workers 2`.**
- three r186 quitó `PCFSoftShadowMap`; se usa `PCFShadowMap` con `shadow.radius`.
