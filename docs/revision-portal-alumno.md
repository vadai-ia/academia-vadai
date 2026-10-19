# Portal de alumnos: revisión y propuesta

> 20-oct-2026. Pedido de Alejandro: «son demasiados botones y formas de llegar a los mismos
> lugares… quiero que la gente siga teniendo interacción a través de la comunidad V-AI-P y en la
> comunidad del curso, ya no incentivar el uso y su avance… que realmente vean sus cursos y su
> membresía». Revisión hecha sobre el código (cada pantalla, cada enlace) y con capturas a 390 y
> 1280 px de un alumno y de un miembro de V-AI-P. Nada se ha cambiado todavía.

## 1. Lo que encontramos

### 1.1 Demasiadas puertas al mismo lugar

El alumno tiene **9 pastillas** arriba (Inicio, Cursos, Dinámicas, Comunidad, Blog, V-AI-P, Tus
puntos, Mis certificaciones, Mi perfil), la campana, el menú de cuenta, y dentro de cada curso
**4 pestañas más** (Contenido, Dinámicas, En vivo, Comunidad). En el teléfono solo se ven tres
pastillas y media; las otras cinco hay que descubrirlas deslizando.

| Destino | Por dónde se llega hoy |
|---|---|
| Tus cursos | Inicio (rejilla) · Cursos (la misma rejilla) · V-AI-P (Biblioteca y Herramientas, otra vez los mismos) |
| Sesiones en vivo | Inicio · Contenido del curso · pestaña En vivo · insignia de la pestaña · campana · V-AI-P · cancelación de la membresía. **Siete lugares, con tres reglas distintas** para cuándo se prende «Entrar» |
| El muro de V-AI-P | Comunidad (pestaña) · el curso casa → Comunidad · los botones «Muro» y «Noticias» de V-AI-P · cada «Comentar» de una noticia · las pastillas de ranking de Inicio · «Ir a su comunidad» en Puntos |
| Puntos y ranking | Inicio (tarjeta de nivel con una pastilla por curso) · Tus puntos · encima del muro de cada curso · V-AI-P · perfil de miembro · el paso 1 de cancelar |
| Certificados | Mis certificaciones · Mi perfil (la misma lista, los mismos botones) · Inicio («Tus certificados», que lleva a **Mi perfil**) · el bloque del curso |
| Dinámicas | La pastilla · la pestaña de cada curso · la campana. Al salir de una, siempre regresa a la lista general aunque hayas entrado desde el curso |
| Inicio | La pastilla «Inicio» · el logo · «← Mis cursos» · «Ir a mis cursos» (tres nombres para lo mismo) |
| Membresía | «Administrar membresía» en V-AI-P y en Mi perfil · «Tarjeta y cobros» en dos lugares · a quien ya fue miembro, V-AI-P le muestra **dos** botones de suscribirse |

### 1.2 Todo empuja el avance del curso

- Inicio abre con un bloque grande «**Continúa donde te quedaste**» con botón lima, barra y %.
- Cada tarjeta de curso tiene barra de avance, «X de Y lecciones» y «Vence en N días» en rojo.
- El marco de cada curso repite «**Tu avance**» con barra en las cuatro pestañas.
- Contenido abre con otra tarjeta «Continúa donde te quedaste» y una lista de «**Te faltan N
  lecciones obligatorias**» para el certificado.
- Inicio cierra con «Tus certificados» vacío y una barra de «% del total».
- La lección termina con «Suma N puntos y avanza tu barra del curso».

### 1.3 V-AI-P no es el centro de nada

- **Inicio no menciona V-AI-P.** Para un miembro, lo primero que ve es el avance del curso base.
- El espacio de V-AI-P **no muestra el muro**: muestra la próxima clase, una «Biblioteca» de
  tarjetas, el ranking y diez logros. El muro está a un clic, dentro del «curso casa».
- Ese curso casa se pinta **como un curso más**, con barra de avance y «Sin lecciones todavía», en
  Inicio, Cursos, Comunidad y Puntos. La comunidad se siente como una tarea pendiente.
- Inicio y V-AI-P funcionan como **dos pantallas de inicio** («Buenas tardes» y «Hola») que
  repiten la clase, los anuncios y los cursos.

### 1.4 Nada trae de vuelta a la comunidad

- La campana avisa de anuncios, blog, sesiones, dinámicas y sesiones exclusivas. **No avisa
  cuando alguien te responde**, ni de las noticias de V-AI-P, ni de publicaciones nuevas en tus
  muros. Lo único que hace volver a una conversación es acordarse de ella.
- El contador de la pastilla Comunidad solo se apaga en `/comunidad`: si lees el muro desde el
  curso o desde V-AI-P, el número se queda.

### 1.5 Detalles que confunden

- «Entrar a la sesión» se prende a cualquier hora en Inicio, 15 minutos antes en En vivo, y de 15
  minutos antes a 2.5 horas después en V-AI-P.
- Un anuncio de la campana lleva a Inicio, que solo muestra el último: si había dos, el que
  clicaste puede no estar.
- Ayuda en `ayuda@` en unas pantallas y `hola@` en otras.
- Blog está en el menú y en Inicio, y no tiene entradas.
- «Tus puntos» no lista las dinámicas aunque sí las suma: las filas no cuadran con el total.

## 2. La propuesta

La idea en una línea: **cuatro lugares, cada cosa en uno, y la comunidad primero.**

### 2.1 El menú: de 9 pastillas a 4

| Pastilla | Qué es |
|---|---|
| **Inicio** | Lo que está pasando: tus comunidades, la próxima clase, tus cursos |
| **V-AI-P** | Para el miembro, su espacio (muro, clases, herramientas, ranking). Para los demás, la invitación |
| **Mis cursos** | Tus cursos y, abajo, los de la academia que puedes empezar o comprar |
| **Perfil** | Tus datos, tu membresía, tus certificaciones, tus puntos y logros |

A dónde va lo que sale del menú:

- **Cursos** → se junta con Mis cursos (era la misma rejilla dos veces).
- **Comunidad** → cada muro vive en su espacio (V-AI-P o el curso), e Inicio muestra lo último de
  todos.
- **Dinámicas** → dentro de cada curso y en la campana; en Inicio aparece una tarjeta solo cuando
  hay una abierta.
- **Blog** → sale del menú; si un día hay entradas, aparecen en Inicio.
- **Tus puntos** y **Mis certificaciones** → secciones de Perfil (la revelación del diploma se
  queda tal cual, se llega desde Perfil y desde la campana).

En el teléfono, cuatro pastillas caben completas: se acaba el «desliza para descubrir».

### 2.2 Inicio: lo que está pasando

Para un **miembro de V-AI-P**, en este orden:

1. **V-AI-P**: lo último del muro (3 publicaciones con su autor) y «Escribir en el muro», la
   próxima clase con «Entrar» cuando toca, y la noticia más reciente.
2. **Tus comunidades**: por cada curso, lo último que se publicó en su muro y «Ir al muro».
3. **Tus cursos**: una lista compacta (portada, nombre, «Abrir»). Sin barras ni porcentajes.

Para **quien no es miembro**: tus comunidades, tus cursos y una sola tarjeta «Conoce V-AI-P».

Sale de Inicio: el bloque «Continúa donde te quedaste», la tarjeta de nivel con sus pastillas de
ranking, el anuncio duplicado de la clase, el blog vacío y «Tus certificados».

### 2.3 V-AI-P: un espacio como Skool, no un curso

Pestañas propias, sin barra de avance:

- **Muro** (la que abre): publicaciones con sus temas (Noticias, Prompts…), escribir, responder.
- **Clases**: la próxima con «Entrar», el calendario y las grabaciones.
- **Herramientas**: los cursos del plan por área (Creativas, Administrativas, Comerciales).
- **Ranking**: el ranking de miembros, los perfiles y los logros.

«Administrar membresía» queda una sola vez, discreto, en Perfil. El curso casa deja de aparecer
como curso en Inicio, Mis cursos y Puntos: es V-AI-P.

### 2.4 Cada curso

- Pestañas: **Comunidad · Contenido · En vivo · Dinámicas**, con Comunidad primero.
- Fuera «Tu avance» del encabezado del curso y la tarjeta «Continúa donde te quedaste».
- El índice sigue marcando lo visto con su palomita, sin barras.
- El certificado aparece solo cuando ya está listo o emitido; se quita la lista de «te faltan».
- La lección sigue igual: video, material, «Marcar como completada» (necesario para el
  certificado) y las preguntas de la lección, sin el texto de «avanza tu barra».

### 2.5 La campana trae de vuelta a la comunidad

Se suman tres avisos, sin tabla nueva (con la misma regla de «nuevo desde la última vez que abriste
la campana»):

- **Te respondieron**: alguien comentó tu publicación o respondió tu pregunta de lección.
- **Noticia de V-AI-P**: se publicó una noticia.
- **Tu muro está activo**: N publicaciones nuevas en un muro donde participas (uno por muro).

### 2.6 Una regla por cosa

- «Entrar» a una sesión: el mismo botón y la misma regla en todos lados (de 15 minutos antes a
  2.5 horas después).
- El contador de cada muro se apaga al verlo, desde donde sea.
- Volver de una dinámica regresa a donde entraste.
- Un solo correo de ayuda.
- Puntos: la tabla suma las dinámicas.

## 3. Lo que decidió Alejandro (20-oct-2026)

1. **El avance que ya no se incentiva es el de los puntos**, no el del curso: el puntaje era por
   generación y ya se premió el top 3. **El avance del curso se queda como está** (barras,
   «Continúa donde te quedaste», certificado). Por eso 1.2 y las partes de 2.2 y 2.4 que quitaban
   barras **quedan fuera**.
2. **Puntos y ranking, en dos lugares**: V-AI-P → Ranking y Perfil. Salen de Inicio (la tarjeta de
   nivel), de encima del muro de cada curso y del menú.
3. **Un curso abre en Contenido**, como hoy. Las pestañas quedan Contenido · Comunidad · En vivo ·
   Dinámicas (la comunidad sube al segundo lugar).
4. **Menú de cuatro**: Inicio · V-AI-P · Mis cursos · Perfil. Blog fuera del menú (aparece en
   Inicio cuando haya entradas); Dinámicas dentro de cada curso, en la campana y en Inicio cuando
   hay una abierta. Las rutas viejas redirigen.

## 4. Cómo lo construimos (M22)

Es frontend y consultas, sin cambios en la base salvo, quizá, una vista para los avisos de
respuestas. Ninguna ruta se borra: las que salen del menú redirigen a su nuevo lugar
(`/cursos` → `/mis-cursos`, `/puntos` y `/certificaciones` → secciones de Perfil, `/comunidad` →
Inicio), para que ninguna liga de un correo viejo muera.

Orden: menú y Perfil → Inicio → V-AI-P con pestañas → marco del curso → campana → limpieza. Cierra
con su suite (cada destino tiene una sola entrada, la campana avisa respuestas, el miembro ve
V-AI-P en Inicio, nada de barras de avance) y capturas a 390 y 1280 px en los dos temas, que
revisas antes del push.
