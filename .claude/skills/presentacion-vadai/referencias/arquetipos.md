# Arquetipos — los doce tipos de lámina y su composición

> Sistema "Fichas · la mesa de trabajo" con injertos de "Cielo editorial" (portada de capítulo,
> ventana de cielo) y de "Aula navy" (pantalla lima "tu turno"). Elegido por jurado el
> 3-sep-2026: 22 puntos contra 20.5 y 15.5. Retícula de 12 columnas de 112 px, canales de 32,
> margen 112 (`col(n)` en `plantillas.py`). Titular Anton medido con la fuente real; el motor
> baja un paso de tamaño (176 → 152 → 112 → 88) hasta que cabe en el número de líneas del
> arquetipo. Todo apilado se calcula: titular → gráfico → cuerpo. Nada centrado.

| Tipo | Fondo | Composición | Campos que usa | Cuándo | No alternar con |
|---|---|---|---|---|---|
| **portada** | cielo | titular Anton a ≤ 2 líneas en y = 320 (CLAUDE en coral); subtítulo debajo; placa blanca con los dos logos abajo-izquierda | titular, texto | abrir un módulo o una sesión | otra portada |
| **seccion** | cielo | titular Anton anclado abajo-izquierda a ≤ 2 líneas; subtítulo gris encima | titular, texto | cada 5–7 láminas, para respirar | seccion |
| **numero** | mesa | titular Anton 7 u 9 columnas (según haya imagen); cifra Anton 320 (baja si no cabe); cuerpo Inter una o dos líneas; **ventana de cielo** en columnas 9–12 solo si trae `imagen` | titular, cifra, texto, fuente, imagen | una cifra dura, con colchón en el titular y ancla en el cuerpo | numero |
| **frase** | mesa | titular Anton a todo el ancho, ≤ 3 líneas; cuerpo opcional debajo | titular, texto | una idea en siete palabras, después de una lámina densa | frase |
| **lista** | mesa | titular ≤ 2 líneas; lista de ≤ 5 ítems con viñeta cuadrada; nada de tarjetas | titular, texto (` · `) | pasos, reglas, preguntas | lista |
| **tabla** | mesa | titular ≤ 2 líneas + **una ficha** blanca con sombra que se adapta al contenido. Cuatro formas que el motor deduce: **bloques de hora** (`AAAA · N h`), **ranking con barras** (`etiqueta · número`, filas adaptativas, máx 7 + "y N más"), **comparación** (`a → b`, dos celdas y una flecha), **definiciones** (`etiqueta · texto`) | titular, texto (` \| `), fuente | datos con estructura | tabla |
| **demo** | navy | eyebrow "En vivo · pantalla compartida" con punto lima; titular Anton ≤ 112 en 5 columnas; el prompt en ficha mono; chip lima "Nadie envía nada" si es correo; **pantalla** 7 columnas con la captura real o el placeholder fechado | titular, texto (el prompt), imagen, respaldo, nota | antes de compartir pantalla; ≤ 10 s en la lámina | — (contrato · demo · conclusión es la secuencia) |
| **encuesta** | mesa | titular 6 columnas; cuerpo; **ficha QR** en columnas 8–12 con URL corta en mono; chip "sin respuesta buena" | titular, texto | abrir una sesión o un bloque con la sala; la proyección real vive en `/proyectar/[token]` | encuesta |
| **pacto** | mesa | **panorama** (titular sin acento): cinco fichas 304×704 con letra Anton 200, nombre, definición; la O lleva chip coral. **Detalle** (una letra en `**negrita**`): tira de tabs con la activa en navy, letra gigante a la izquierda, ficha con filas Mal · Bien (resaltada) · Error típico | titular, texto (` \| `) | el método; la secuencia P-A-C-T-O está permitida seguida | — |
| **ejercicio** | **lima** | titular ≤ 2 líneas en 9 columnas; chip cronómetro con anillo arriba-derecha; riel de hasta 4 fichas numeradas (Anton 72), título, detalle y dos líneas punteadas para escribir | titular, texto (`Título: detalle · …`), tiempo | "tu turno": trabajo individual con tiempo | ejercicio |
| **cita** | navy | frase en Inter 64 centrada verticalmente, origen en gris debajo | cita, fuente | una frase del libro o de la junta que se queda | cita |
| **cierre** | navy | titular Anton ≤ 152 a todo el ancho; cuerpo; tres acciones (Decide · Implementa · Aplica el lunes) con filete cyan | titular, texto, accion | cerrar una lección o sesión; la prueba del lunes | — |

## Qué va como texto editable en el PPTX

Cuerpo, listas, filas de definición del PACTO, detalle de las fichas de ejercicio, cita y las
tres acciones. Titulares, cifras, fichas, barras, bloques, chips, eyebrow y pie viajan en la
imagen de fondo. Un titular se corrige en `laminas.md` y se regenera.

## Cómo añadir un arquetipo

1. Nombre en `TIPOS` (`laminas.py`) y fila aquí.
2. Renderizador `r_<tipo>` en `plantillas.py` que devuelva `(html, cajas)` y use
   `titular_ajustado()` para medir; nunca coordenadas fijas para lo que sigue al titular.
3. Una lámina de ejemplo en `evaluaciones/prueba/laminas.md`, construir, **mirar** la hoja.
