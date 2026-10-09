# Análisis de las referencias (Kurzgesagt) para la Propuesta 3

**Qué se analizó.** Cinco videos de Kurzgesagt, bajados a 720p el 11-oct-2026: «AI Just Crossed the Terrifying Line», «This Woman Cured Her Cancer…», «How Are Memories Stored Inside Your Brain?», «The Uncomfortable Truth About Ozempic» y «The Fat Problem».

**Cómo.** `scripts/v3-referencias.py` detecta los cortes, mide la duración de cada plano, saca un cuadro por segundo de los primeros 2 minutos y limpia la transcripción. Se toma **su forma de contar**, no su ilustración plana ni sus colores.

## Los números

| Video | Duración | Cortes duros | Plano (mediana) |
|---|---|---|---|
| Cancer | 15:13 | 67 | 9.4 s |
| Memories | 13:56 | 79 | 7.5 s |
| Fat | 11:36 | 51 | 10.0 s |
| Ozempic | 15:53 | 140 | 5.1 s |
| AI | 21:44 | 73 | 12.0 s |

**El hallazgo principal:** casi no cortan. Un plano dura de 5 a 12 s porque la cámara **nunca deja de moverse dentro de un mismo mundo**: empuja, entra por un hueco, gira, sale. Lo nuevo entra *dentro* del plano, no con un corte. Cada 1–2 s pasa algo (un personaje reacciona, aparece una etiqueta, cambia la luz), pero el mundo es continuo.

## Lo que hacen, con ejemplos

1. **Arranque a mitad de la acción.**
   - Cancer: 16 s sin cortar, una aguja que entra al tumor.
   - AI: una pantalla en negro con la fecha «July 2026» que se enciende.
   - Primero el impacto; la explicación después.
2. **Portales y cambios de escala.**
   - Memories: se abre un hueco en la frente y la cámara se clava en el recuerdo.
   - Cancer: un iris entra por un punto que brilla en el cuerpo.

   Para pasar de una idea a otra **entran o salen de un objeto**, no cortan.
3. **Las ideas viven en recipientes.** En Memories cada recuerdo es una **esfera de vidrio** que flota alrededor de la persona, y un recuerdo completo es un diorama dentro de un tazón de vidrio. La idea abstracta se vuelve un objeto que se puede tocar.
4. **La interfaz como escenario.** En Cancer la protagonista aparece dentro de una ventana de software (Illustrator, After Effects), con cursor, mientras los personajes se asoman a la pantalla. En Ozempic los documentos reales (la lista de la OMS) son tarjetas de UI con filas que se iluminan.
5. **Cifras convertidas en multitudes.**
   - Ozempic: una fila de personas se vuelve siluetas y queda una sola encendida: «1 de cada 8».
   - Fat: platos contra montañas de comida: 750 millones contra 1,000 millones.
   - Ozempic: un pajarito en un campo infinito de cajas de medicina.

   La cifra se ve, no se lee.
6. **La luz cuenta la emoción.**
   - Cancer: todo se apaga hasta dejar un punto que brilla, o una silueta con un foco.
   - Fat: la «visión térmica» muestra lo que pasa dentro.

   Lo importante es lo único iluminado.
7. **Remolinos y distorsión como transición.** En Memories el recuerdo se deforma y un remolino se lo traga de regreso a la cara de la persona. En AI hay glitch con aberración cromática (rojo y cyan corridos).
8. **Personajes recurrentes que reaccionan:** pajaritos, células, un robot. Dan respiro, señalan cosas y miran a la cámara. En AI el robot crece en primer plano hasta volverse amenaza.
9. **Tipografía dentro de la escena.**
   - Golpes: «It's cancer.» en una cuña negra.
   - Onomatopeyas en el mundo: «CRASH», «HA HA HA», «WOOHOO».
   - Etiquetas y pastillas que aparecen sobre lo que nombran.
10. **Listas como insignias.**
    - Tres efectos secundarios en tres medallones que entran uno por uno.
    - «Stress / Genetics / Microbiome» en tres paneles.
    - Una barra de etapas (Stage 0–IV) que se llena como HUD.
11. **Rimas y callbacks.** El final regresa a la imagen del principio (la cara de Memories) y los videos citan a otros en paneles. Cerrar el círculo da sensación de historia completa.
12. **Profundidad por capas.**
    - Primer plano oscuro y desenfocado, fondo luminoso.
    - Paralaje constante.
    - En AI: cuartos isométricos y la cámara que sube por un edificio.

## Técnica de ellos → dónde la usamos (con las tendencias nuevas)

| Técnica | En nuestro video | Material / tendencia |
|---|---|---|
| Mundo continuo, casi sin cortes (5) | **Una sola página que hace scroll**: la cámara baja sin cortar de la apertura al CTA; cada sección nace dentro de la anterior. | Scrollytelling, UI espacial |
| Arranque a mitad de la acción (1) | En el primer segundo la gota ya cae sobre la pantalla y la parte; «TODO MUNDO HABLA DE» como golpe gigante. | Minimalismo exagerado |
| Ideas en recipientes de vidrio (3) | Cada herramienta de IA es una **esfera / tarjeta de vidrio**; el bucle es un tazón de vidrio donde giran. | Glassmorphism, liquid glass |
| Remolino que se lo traga todo (7) | El bucle como **remolino**: las esferas giran cada vez más rápido y se rompen. | Liquid glass + glitch con aberración cromática |
| Cifra como multitud con una sola encendida (5) | 100 píldoras de arcilla; 6 se vuelven vidrio encendido; las demás se apagan a silueta. | Claymorphism + minimalismo exagerado |
| La luz cuenta (6) | «¿Cuánto depende de ti?»: todo se apaga y queda un solo **botón neumórfico «TÚ»** iluminado, que cada petición hunde. | Neumorfismo |
| Portal / cambio de escala (2) | La gota cae en el botón «TÚ», se abre como portal de vidrio líquido y de ahí sale MÉTODO. | Liquid glass |
| La interfaz como escenario (4) | El escritorio es una **pantalla de arcilla** con ventanas brutalistas. Las notificaciones son UI real (pastillas, badges, contadores) que cae y aplasta. | Neo-brutalismo vs claymorphism |
| Personaje recurrente (8) | **La gota** (la chispa de Claude): reacciona, señala, presiona, rompe. Junto con figuras de arcilla sin cara (el equipo). | Claymorphism |
| Tipografía en la escena (9) | Stickers brutalistas: «NEW!», «GRATIS», «¡OTRA!». Golpes de texto gigante. Etiquetas pastilla sobre lo que nombran. | Neo-brutalismo |
| Listas como insignias (10) | Lo que aprendes: insignias de vidrio que entran una por una alrededor de Claude. La barra de carga que se atora en 94 % («vas tarde»). | Glassmorphism, UI espacial |
| Callback al inicio (11) | El cierre regresa a la gota del primer segundo, ahora en calma sobre la aurora; «todo mundo habla de IA» rima con el arranque. | Aurora & gradient mesh |
| Profundidad por capas (12) | Planos de vidrio a distintas profundidades, con desenfoque de profundidad y paralaje en cada scroll. | UI espacial |

## Ritmo para nuestro video (≈ 95 s)

- **Sin cortes duros salvo tres golpes:** «sale otra», MÉTODO y LO CARO. Todo lo demás es scroll y portales.
- **Un evento visual cada 1–2 s, dentro del plano:** una tarjeta, una presión, una etiqueta o un cambio de luz.
- **Cambio de luz como emoción.** Todo encendido y ruidoso en el problema; se apaga en «sé honesto»; aurora completa en el método y el CTA.
