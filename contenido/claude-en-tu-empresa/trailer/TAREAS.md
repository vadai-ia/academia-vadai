# Tráiler «Claude en tu Empresa» — lista de tareas

Brief: el documento «Course trailer — master video, v1» (7-oct-2026). Cada `→ ALTO` es una
compuerta: no se pasa a la siguiente fase sin el visto bueno de Alejandro.
Regla de trabajo: primero la base, luego un punto a la vez; tras aprobar, solo cambian
las tomas nombradas en la retroalimentación.

## 0a · Auditoría de herramientas
- [x] Node ≥ 22 (v24.13.1), FFmpeg 8.1.1, Chrome headless de HyperFrames
- [x] Skills de HyperFrames instaladas y cargadas en esta sesión (no hizo falta reiniciar)
- [x] `hyperframes doctor` en verde, salvo lo opcional (Docker, Kokoro, MusicGen)
- [x] whisper.cpp b5454 (binario oficial win-x64) + modelo `medium` multilingüe; probado en español con tiempos por palabra
- [x] three 0.186.1, postprocessing 6.39.5, gsap 3.15.0 (CustomEase, SplitText, MotionPath, MorphSVG, DrawSVG), opentype.js 2.0.0
- [x] Fuentes locales: los TTF de los decks (Anton, Inter variable, JetBrains Mono variable, OFL), copiados por `npm run vendor`
- [x] Sonda en el navegador de captura: carga local, WebGL por hardware, DOF + bloom, fuentes sin fallback
- [x] → ALTO: aprobado 7-oct (tokens de tokens.json, logos de Dropbox + Total Coach PNG, GPU RTX)

## 0b · Prueba de factibilidad
- [x] `npm run vendor`: librerías, fuentes y logos dentro del proyecto (el render no toca `node_modules` ni la red)
- [x] Bloque de estilo único: `estilo/marca.json` → `tokens.css`, `mundo.js`, `semilla.js`, `gsap.js`
- [x] Toma 05 real en 3D, master 28.5–31.5 s, 1080p 60 fps, calidad de entrega, motion blur por submuestreo
- [x] Medido con RTX 4050 y Radeon 780M; 4K con 5 y con 2 workers
- [x] Determinismo: 177/180 cuadros idénticos pixel a pixel entre 5 y 3 workers; 3 con 1 nivel en el título
- [x] Sin red: Chrome de captura con todo host externo bloqueado → 15 recursos, todos locales
- [x] `scripts/verificar-render.mjs` en cada render (detecta cuadros sin 3D)
- [x] MOTION-RULES.md + ERRORES.md + conflictos listados (C1–C11)
- [x] → ALTO: aprobado 7-oct-2026 («esa es la calidad que realmente estaba buscando»); C1–C11 resueltos en MOTION-RULES.md

## 1 · Rebanada vertical: toma 05 al 100 % (C7) — empieza tras el reinicio de cuota del 8-oct
- [ ] Toma 05 completa (24–33 s): la chispa entra a «CLAUDE», el título se arma, las pestañas se ordenan en la ventana y el retroceso revela el edificio
- [ ] Pendientes de 0b: TI fuera del 15 % inferior; el edificio no pasa detrás del título; tope del obturador más alto en los picos; utilería menos primitiva; título sin escala animada (E5)
- [ ] Texto con máscara + desenfoque a nítido + tracking (C5); salida empujada por la cámara
- [ ] MP4 720p + hoja a 4 fps; calificación en 7 ejes (C9), todo ≥ 4 antes de mostrarla
- [ ] Commit `feat(trailer): rebanada vertical toma 05`
- [ ] → ALTO

## 2 · Styleframes de las otras 14 tomas
- [ ] Mundo continuo: nubes, escritorio, edificio de 7 pisos, chispa (activos procedurales soft clay)
- [ ] UI firma recreada: píldora «En vivo · pantalla compartida», tarjeta de prompt, ventana de chat, barras durazno, píldora «NADIE ENVÍA NADA»
- [ ] 14 stills finales (la 05 ya sale de la rebanada) + hoja de cuadros de las 15
- [ ] Autocrítica 1–5 por toma en 7 ejes: composición, movimiento, marca, legibilidad, sincronía, dinamismo, wow; rehacer lo < 4
- [ ] Auditorías: copy contra el brief carácter por carácter, color, una lima por cuadro, zonas seguras
- [ ] Commit `feat(trailer): styleframes v1 — Claude en tu Empresa`
- [ ] → ALTO

## 3 · Animatic
- [ ] Línea de tiempo completa (150 s) a baja resolución, tiempos finales del shot list
- [ ] Rejilla de 100 BPM con clic de tiempo en vez de música
- [ ] Las cuatro transiciones héroe (02→03, 04→05, 08→09, 13→14) + vocabulario §3 en todos los cortes
- [ ] Revisar cuadros de inicio, medio y fin de cada toma
- [ ] Commit `feat(trailer): animatic v1`
- [ ] → ALTO

## 4 · Final
- [ ] VO de Alejandro: transcribir (medium, es), verificar contra el audio, re-anclar cada evento a su palabra
- [ ] Música licenciada de Alejandro; SFX sintetizados en código (tick, contador, llave, impacto, campanita)
- [ ] Mezcla ≈ −14 LUFS, voz inteligible, música ~20 dB abajo, sin clipping
- [ ] Subtítulos en capa propia + `.srt`
- [ ] Entregables §8: master con subtítulos, master limpio, 4K limpio, póster, hoja de cuadros, pases por capas, encode web (reportar tamaños)
- [ ] Checklist de verificación completo
- [ ] Commit `feat(trailer): final master v1`
- [ ] → ALTO

## 5 · Fase 2 (solo con el master aprobado)
- [ ] Cortes 9:16 (60 s) y 4:5 recompuestos, texto en el 80 % central
