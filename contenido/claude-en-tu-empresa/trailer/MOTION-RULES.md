# Motion Rules

> Reglas de oficio de Alejandro para **todo** video de HyperFrames, actual y futuro
> (recibidas el 7-oct-2026; regla central de audio agregada el mismo día). Texto íntegro, sin editar.
> Fuente canónica: la skill `~/.claude/skills/motion-rules/SKILL.md`.
>
> **Regla de conflicto:** el brief de cada video gana en contenido, textos bloqueados y marca;
> MOTION-RULES.md gana en oficio, ritmo y proceso. Los conflictos se **listan**, no se
> resuelven en silencio. Los de este proyecto están al final.

## Audio is always part of the job (core rule)
Every video ships with voice-over, an original song and sound effects, all created by you with AI. Never deliver a silent video and never ask me to record or supply audio. You make every audio decision yourself, as a top sound designer and music supervisor would, and keep moving.

1. Audio before animation: generate the voice first; it is the sync clock for every visual cue.
2. Voice:
   - Choose the voice that best fits the brand, audience and tone (Mexican Spanish by default).
   - Read the approved script word for word, directed with pacing, pauses and emphasis.
   - Regenerate any take with mispronunciations, robotic prosody, skipped words or clipping.
3. Song:
   - Compose an original instrumental for that specific video: tempo, mood and structure follow its acts, with a lift on the key reveal and a resolve on the ending.
   - Exact video length with an intentional ending.
   - Snap edit cuts to beats wherever they don't fight the voice.
4. SFX:
   - Generated with AI or synthesized in code.
   - Clicks, ticks, pops and counters on meaningful events; designed swells and impacts on hero transitions and punch cards.
   - No generic stock whooshes.
5. Mix:
   - The voice is always intelligible.
   - Music is ducked about 18–20 dB under the voice while it speaks and rises between lines.
   - SFX sit under the voice.
   - Master at −14 LUFS integrated, true peak ≤ −1 dBTP.
   - Always export stems: voice, music, SFX.
6. Self-review: before moving on, listen-check your choices against the brief (transcribe the voice locally with whisper-cpp and verify it matches the script word for word; sync cues to word timings with drift ≤ 2 frames). If something doesn't fit, regenerate it yourself.
7. Provider: use a commercial-use AI audio provider (ElevenLabs API preferred, or an equivalent you justify). Only stop if a key is missing; then tell me the exact `.env` variable name. Never print keys.

In every delivery, briefly state which voice, music style and sound approach you chose and why, so I can redirect if I want.

This section overrides any earlier rule about audio (including rule 12 below where they differ).

## Pacing and dynamism
1. Something changes every 2–3 s (word, diagram step, camera move, reveal). No static frame over 1.5 s, except end-card holds.
2. Max ~1 hard cut per 25 s. Every other scene change is a match, morph or camera move: an element of scene A becomes an element of scene B.
3. Punch cards: full-bleed brand-color card, one giant word from the script, hard cut in and out on that exact word, held 0.4–0.6 s. Use 2–4 per minute, to reset attention.
4. Give every video one leader element (a spark, line or shape) that leads the eye, points at each new element before it appears, and starts every transition.

## Typography is the spine
5. Narration becomes kinetic type: each sentence gets an on-screen line made ONLY of its own words, entering on its exact word. Stressed words change weight, color or scale when spoken.
6. Text enters with blur-to-sharp, directional motion blur and a slight letter-spacing collapse. It exits by pushing out along the camera move. Never a plain fade.

## Depth and finish
7. 2.5D first: HTML/CSS perspective, blur, light and parallax for all type and UI. Use real WebGL 3D only where it adds something 2.5D can't. If WebGL capture fails or render time is unworkable, render 3D passes headless in Blender (deterministic) and composite them.
8. Use a density layer: faint grid, thin rules, mono micro-labels, self-drawing diagrams and arrows. Labels come only from approved text.
9. Finish: real sub-frame motion blur, depth of field with focus pulls, subtle bloom on highlights only, one unified grade, fine grain (raise `--crf` if size explodes). Every move has anticipation, inertia and follow-through.
10. Use solid cards, not frosted glass, on anything exported with transparency.

## Sync and sound
11. Sync to words, not seconds. Transcribe locally (whisper-cpp), anchor every cue to a word, keep drift ≤ 2 frames, and log fixes in ERRORES.md.
12. Narration leads the edit, and music is a ducked bed.
    - Small SFX only on meaningful events (tick, pop, counter, chime), ~20 dB under the voice. No generic whooshes.
    - Hero transitions and punch cards get a designed swell that resolves on the cut.
    - Master at −14 LUFS, true peak ≤ −1 dBTP.

## Process
13. Base first, then one spot at a time. Never rebuild everything in one pass.
14. One style block per project (tokens, type, materials, easing), inherited by every shot.
15. Finish one shot at 100 % (vertical slice) and get my approval before finishing the rest.
16. Deterministic renders: everything is a function of timeline time, seeded randomness, no clocks, no network, and fonts and assets loaded before frame 0.
17. Vertical cuts: keep text inside the middle 80 % of the width and clear of the caption zone. Reframe; don't just crop.

## Review
18. You can't see motion in a still. At every gate deliver a 720p preview MP4 plus a 4-fps contact sheet per shot. If the project has a reference video, add a side-by-side sheet against it. I'm the final judge.
19. Score every shot 1–5 on composition, motion, brand fidelity, legibility, sync and dynamism. Anything under 4 is reworked before you show me.
20. Test before claiming: never say it works, renders or syncs without rendering and checking the frames.

---

## Conflictos con el brief del tráiler — resueltos 7-oct-2026

Listados al recibir estas reglas. Alejandro aceptó las propuestas el 7-oct-2026. Donde no
hubo propuesta explícita, queda la lectura por defecto, marcada con «(por defecto)».

| # | Regla | Brief | Decisión |
|---|---|---|---|
| C1 | 7 · 2.5D primero | §3 3D real, mundo continuo | El mundo es WebGL 3D real; tipografía, UI y etiquetas van en 2.5D (DOM) encima, como en 0b |
| C2 | 3 · tarjetas de golpe | §4 OST bloqueado | (por defecto) Solo con palabras que ya están en el OST bloqueado («MÉTODO» en 04 y 14 son los candidatos naturales). No se agrega texto nuevo |
| C3 | 2 contra 3 · cortes duros | §3b sin cortes duros sin intención | (por defecto) Con tarjetas limitadas a palabras del OST, los cortes duros caben en el tope de ~6 en 150 s |
| C4 | 5 · cada oración como línea cinética | §4 OST por toma, máx. 7 palabras, subtítulos | (por defecto) La narración completa vive en los subtítulos; en pantalla solo el OST del brief, que sí entra en su palabra exacta y con la palabra clave acentuada |
| C5 | 6 · desenfoque a nítido + motion blur + tracking | §3 máscara, slide-and-lock, letter-split | Se combinan: la técnica del brief más desenfoque a nítido y compresión de tracking; la salida se empuja con la cámara, nunca un fundido simple |
| C6 | 8 · micro-etiquetas mono | §2 mono solo en la tarjeta de prompt | Micro-etiquetas en Inter; mono sigue exclusivo de la tarjeta de prompt |
| C7 | 15 · rebanada vertical | §9 styleframes → animatic → final | Hito 1 = toma 05 al 100 % (rebanada vertical) → aprobación → styleframes de las otras 14 → animatic → final |
| C8 | 18 · MP4 + hoja 4 fps en cada compuerta | §9 styleframes = stills | (por defecto) La rebanada y toda compuerta posterior llevan MP4 720p + hoja a 4 fps por toma; los styleframes son stills, la única excepción |
| C9 | 19 · seis ejes | §3b cinco ejes con «wow» | Los seis de la regla + «wow» como séptimo |
| C10 | 12 · swell | §6 sin risers en cada corte | Swell solo en las cuatro transiciones héroe y en las tarjetas de golpe |
| C11 | 3 · tarjeta a sangre | §2 lima y durazno restringidos | Tarjetas de golpe solo en navy o azul |

| C12 | Audio (regla central) · voz, canción y SFX creados con IA | §5 «Alejandro records it later»; §6 música con licencia que él aporta, «none is composed or downloaded by you» | La regla central dice que manda sobre cualquier regla anterior de audio: la crea Claude. Proveedor: Magnific (Premium+, licencia comercial) con modelos de ElevenLabs y Lyria; no hay `ELEVENLABS_API_KEY` |
| C13 | Audio (regla central, versión final del 7-oct) · Claude decide voz, canción y SFX y sigue | Versión previa de la misma regla: 3 opciones y compuerta | La versión final reemplaza a la previa: sin opciones ni compuerta; en cada entrega se dice qué voz, qué música y qué enfoque de sonido se eligió y por qué |

**Decisiones del 0b, aceptadas el mismo día:**
- La chispa es la marca de los decks (`claude-simple-icons.svg`), no un asterisco de 8 rayos dibujado aparte.
- Sobre el cielo, el título va en navy en la zona clara, con «CLAUDE» sobre la barra durazno, como en los decks.
- Orden de pisos de arriba abajo: Dirección, Operaciones, Finanzas, Ventas, RH, Marketing, TI, para que el descenso 06→09 nunca suba.
- Sigue abierto el grano contra el peso del encode web.
