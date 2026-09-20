# Contrato de `laminas.md` (v2)

Un deck es un archivo Markdown. `scripts/laminas.py` lo parsea; `verificar.py` lo audita;
`construir.py` lo renderiza. Lo que no está aquí, no existe para el motor.

## Cabecera (antes de la primera lámina)

```
# Módulo 0 · Antes de empezar
concepto: La prueba del lunes — si no cambia lo que haces el lunes a las 9, no fue implementación.
deck: modulo-0
medio: video          # video (Zoom/Meet, por defecto) | sala
sesion: Sesión 1 · Bloque A
```

`concepto:` es obligatorio: sin idea rectora no se construye.

## Una lámina

```
## 4 · Ocho horas
tipo: numero
eyebrow: Sesión 1 · Contexto              # opcional; si falta, el builder pone "deck · N / total"
titular: Ocho horas menos **por el mismo sueldo**.
cifra: 8 h
texto: por persona, por semana, en 2030. Nadie resuelve eso trabajando más rápido.
grafico: escalones                        # opcional; ver catálogo abajo
imagen: nubes-01.png                      # opcional; activos/primitivas/ o presentacion/imagenes/<deck>/
fuente: [^jornada-40]
nota: Decirlo así: "le pega a los dos lados de la mesa".
accion: decide: cuántas horas recuperar antes de enero | implementa: la lista de tareas a mano | aplica: anota una semana en qué se te van las horas
```

## Campos

| Campo | Obligatorio | Regla |
|---|---|---|
| `## N · nombre` | sí | N consecutivo; el nombre es interno |
| `tipo` | sí | uno de: `portada seccion numero frase lista tabla demo encuesta pacto ejercicio cita cierre` |
| `titular` | sí (salvo `cita`) | ≤ 3 líneas al tamaño que toque; **un solo `**acento**`**; con verbo (no etiqueta) |
| `cifra` | `numero` | una sola; puede llevar unidad ("8 h", "62%", "2.93 M") |
| `texto` | según tipo | `lista`: ítems separados por ` · ` (máx 5, ≤ 12 palabras cada uno) · `tabla`: filas por ` \| `, celdas por ` · ` · `pacto`: `letra · nombre · definición` por fila · resto: prosa ≤ 30 palabras |
| `grafico` | no | ver catálogo; si falta, el builder deduce (`AAAA · N h` → escalones; `nombre · 1,210,000` → barras; `a → b` → comparación) |
| `imagen` | no | nombre de archivo existente; en `demo` suele ser la captura real |
| `cita` | `cita` | `"frase" — origen` |
| `fuente` | `numero`, y toda lámina con cifra en el texto | uno o más `[^id]` que resuelvan en `fuentes.md` con estado `verificado`, `verificado-antiguo` o `proyección` (esta última pone badge) |
| `nota` | no | lo que dice quien presenta; va a las notas del PPTX |
| `accion` | cierres de lección | `decide: … \| implementa: … \| aplica: …` |
| `respaldo` | `demo` (recomendado) | archivo MP4 o PNG por si la demo falla |
| `tiempo` | `ejercicio` | minutos; pinta el cronómetro |

## Catálogo de `grafico`

| Valor | Qué dibuja | Datos |
|---|---|---|
| `escalones` | cinco columnas con bloques de hora huecos donde se pierde | filas `AAAA · N h` |
| `barras` | ranking horizontal proporcional, valor en Mono | filas `etiqueta · valor` |
| `bloques` | unit chart de cuadrados (p. ej. 6 de 100) | `cifra` como porcentaje |
| `comparacion` | dos columnas antes → después | filas `a → b` |
| `ventana` | marco de ventana con mock-UI o captura | `imagen` o mock por defecto |
| `mock:dashboard` `mock:doc` `mock:mail` `mock:deck` | el mock-UI de la landing con datos de la lámina | filas del `texto` |
| `pacto-rail` | las cinco letras con la activa encendida | letra en `**negrita**` del titular |
| `timer` | anillo de tiempo | `tiempo` |
| `pasos` | riel de fichas numeradas | ítems de `texto` |

## Ritmo (lo verifica `verificar.py`)

- Nunca dos láminas seguidas del mismo `tipo`.
- Una `seccion` cada 5–7 láminas.
- Después de una `tabla` o `lista` densa, una `frase`.
- Cada lección termina con una lámina que trae `accion:`.

## Ejemplo mínimo completo

```
# Prueba · tres láminas
concepto: Una sola idea por lámina.
deck: prueba
medio: video

## 1 · Portada
tipo: portada
titular: **Claude** en tu empresa
texto: Módulo de prueba

## 2 · Cifra
tipo: numero
titular: La ola ya pasó por **tu cuadra**.
cifra: 550,000
texto: empresas mexicanas empezaron a usar IA en 12 meses. Una cada minuto.
fuente: [^aws-550k]

## 3 · Cierre
tipo: cierre
titular: Si no cambia lo que haces **el lunes a las 9**, fue entretenimiento.
accion: decide: un proceso para empezar | implementa: las tres preguntas por escrito | aplica: tu siguiente prompt con verbo
```
