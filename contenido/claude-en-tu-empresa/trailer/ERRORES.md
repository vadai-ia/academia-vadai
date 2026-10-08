# ERRORES — tráiler «Claude en tu Empresa»

Fallas encontradas y cómo se arreglaron. Se lee antes de tocar render, 3D o tipografía
animada (MOTION-RULES 11). Lo más nuevo arriba.

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
