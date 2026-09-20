# Anti-patrones — lo que delata un deck hecho con IA, y cómo se rechaza

> Síntesis de 925studios, superdesign, mania.design, chatslide, el skill `pptx` de Anthropic y
> el diagnóstico del deck rechazado de este repo (Inter en todo, todo centrado, radio 10 en
> todo, cero coral, cero ilustración, nadie miró el render). Cada fila dice **quién lo cacha**:
> `V` = `verificar.py` (contenido), `C` = `construir.py` (render), `M` = la mirada humana sobre
> `miniaturas.py`.

## Tipografía

| # | Anti-patrón | Cacha | Corrección |
|---|---|---|---|
| 1 | Inter (o Roboto) en titulares | C | Anton en titular y cifra; Inter solo cuerpo |
| 2 | Negrita como único recurso de jerarquía | M | tamaño y espacio; peso 450/600 |
| 3 | Más de dos familias (mono aparte) | C | Anton + Inter + JetBrains Mono, nada más |
| 4 | Cuerpo por debajo de 28 px proyectados (32 en video) | V | subir tamaño o partir la lámina |

## Color

| # | Anti-patrón | Cacha | Corrección |
|---|---|---|---|
| 5 | Degradado azul→morado | C | solo los tres degradados de tokens |
| 6 | Cualquier hex fuera de `tokens.json` | C | usar el token por rol |
| 7 | Lima fuera de botón o pantalla de ejercicio | V | coral o accentDeep |
| 8 | Dos acentos en un mismo titular | V | uno, y es el verbo de la tesis |
| 9 | Negro puro `#000` | C | `ink` |
| 10 | Cyan `#00A0DB` como texto sobre claro | C | `accentDeep` |

## Composición

| # | Anti-patrón | Cacha | Corrección |
|---|---|---|---|
| 11 | Tres tarjetas redondeadas en fila | M | una ficha, o riel con números Anton |
| 12 | Todo centrado vertical y horizontal | C | retícula de 12, texto nace en x=96 |
| 13 | Radio idéntico en todos los elementos | C | escala 8 / 14 / 22 / 32 / 100 por rol |
| 14 | Padding idéntico en todos los contenedores | M | jerarquía por espacio |
| 15 | **Franja de color en el borde izquierdo** de una tarjeta | C | tinte de fondo o sombra |
| 16 | **Línea de acento bajo el título** | C | espacio en blanco |
| 17 | Sombra genérica negra a 0.1 | C | las sh-1/2/3 teñidas de azul |
| 18 | Dos láminas consecutivas del mismo `tipo` | V | alternar; `seccion` cada 5–7 |
| 19 | Lámina 100% texto | M | cifra, gráfico, ventana o ficha |
| 20 | Titular de etiqueta ("Beneficios", "Metodología") | V | frase con verbo que se pueda refutar |

## Imagen e ícono

| # | Anti-patrón | Cacha | Corrección |
|---|---|---|---|
| 21 | Foto de stock (sonrisas de oficina, apretón de manos) | M | foto real del equipo o ilustración del sistema |
| 22 | Emoji como ícono | V | Lucide dentro de cuadro redondeado |
| 23 | Iconos de línea intercambiables que ilustran cualquier producto | M | solo cuando el ícono nombra algo concreto |
| 24 | Fondo abstracto decorativo sin relación con el contenido | M | la ventana de cielo lleva contenido o nada |
| 25 | Mezclar dos sets de iconos | C | solo `activos/iconos/` |
| 26 | Ilustración isométrica, cerebros, robots, nodos brillantes | M | objetos del alumno: Excel, correo, reloj, factura |
| 27 | Texto legible o logos dentro de una imagen generada | M | regenerar con negativo `text, logo, watermark` |

## Contenido

| # | Anti-patrón | Cacha | Corrección |
|---|---|---|---|
| 28 | Muletillas: "en el mundo actual", "sinergias", "transformación digital", "ecosistema", "impulsar" | V | decir el hecho |
| 29 | Cifra sin fila en `fuentes.md` o sin pie en pantalla | V | fila verificada + `[^id]` |
| 30 | Cifra sin colchón, sin ancla o sin escala honesta | M | ver arquetipo `numero` |
| 31 | Gráfica decorativa con datos que no son los datos | V | datos del `texto` de la lámina, o nada |
| 32 | Lista de más de 5 ítems o ítem de más de 12 palabras | V | partir la lámina |
| 33 | Emojis, negritas o cursivas dentro de un prompt entregado al alumno | V | texto plano |

## La prueba final

Renderizar la hoja de contacto (`miniaturas.py`) y **mirarla**: si dos láminas seguidas se ven
iguales con el texto cambiado, si alguna se lee al 25% como un bloque gris de texto, o si la
cifra se pisa con el titular, no se entrega.
