# Módulo 1 · Aprende a usar Claude

> **Para quién:** el equipo completo. **Cuándo:** sesión 1 (tour, 1.5 h), sesión 3 (conectores y
> habilidades), sesión 4 (proyectos). **Da:** Alejandro.
> **Cumple** los cuatro bullets vendidos en la landing: contexto/proyectos (1.7), tokens y costo
> (1.4), configuración segura (1.9), prompts que funcionan (1.10). Y el tour "como niños
> chiquitos" que pidió Roberto Ortiz (1.1–1.3).
>
> **Sobre la interfaz:** Claude cambia cada pocas semanas. Las lecciones describen cada función
> por **lo que hace**, y dónde suele estar. Antes de cada sesión, quien presenta abre su cuenta
> y confirma que los nombres y las rutas siguen igual — hay una lista al final. Las capturas se
> toman de la cuenta real de Alejandro la semana del curso, nunca de internet.
>
> **Fuera de alcance por decisión de la junta:** agentes autónomos y respuesta automática de
> correo. Se muestran, se dice que existen, no se practican.

---

## 1.1 · El recorrido guiado

Todos somos nuevos en esto. Así que vamos a hacer lo que nadie hace: abrir Claude y mirar cada
cosa que hay en la pantalla, una por una, y decir para qué sirve.

**La pantalla principal.** Al entrar ves tres zonas:

1. **El espacio para escribir**, en el centro. Es donde pasa todo. Ahí va tu PACTO.
2. **La barra lateral**, a la izquierda. Tiene tus conversaciones recientes, tus **Proyectos**,
   y el acceso a lo que le has enseñado (**Habilidades**) y a lo que le has conectado
   (**Conectores**). Se puede esconder para tener más espacio.
3. **Tu cuenta**, abajo o arriba según el dispositivo. Ahí vive la **Configuración**: quién
   eres, cómo te llamas, qué plan tienes, cuánto has usado, qué recuerda de ti.

**Lo que hay alrededor del espacio de escribir.** Un botón para **adjuntar** (archivos, fotos,
capturas), otro para elegir **qué modelo** contesta (el rápido, el que piensa más), y según tu
cuenta, accesos rápidos a herramientas: buscar en internet, usar un conector, activar una
habilidad.

**La regla del tour:** no hay botón que no se pueda picar. Nada se rompe. Si algo no sabes qué
hace, pícale y mira.

*(Demostración en vivo: Alejandro recorre la pantalla completa con el cursor, nombrando cada
elemento, en el orden de arriba. Sin explicar todavía. Solo "esto está aquí".)*

### Qué haces con esto
- **Decide:** que todos en la empresa vean la misma pantalla: la versión de escritorio
  (`claude.ai`) y la app del celular. El mapa de la interfaz (`plantillas/`) es la referencia.
- **Implementa:** en tu área, diez minutos de "tour" con la pantalla proyectada antes de
  cualquier ejercicio. Nombrar las cosas quita más miedo que explicarlas.
- **Aplica el lunes:** abre Claude y pícale a cada botón una vez. Sin pedir nada. Solo mira.

---

## 1.2 · Conversaciones que sí sirven

Cada chat es una conversación con memoria propia: lo que dijiste al principio, lo sigue
teniendo presente al final. Eso es lo que hace que "hazlo más corto" funcione sin repetir todo.

**Cuándo abrir una conversación nueva.** Cuando cambias de tema. Si estás conciliando un banco
y de pronto pides un correo de ventas, la conversación se contamina: la IA mezcla contextos.
Regla simple: **una tarea, una conversación**. Se pueden tener cien; no cuestan.

**Ponerles nombre.** Claude les pone título solo, pero conviene renombrarlas cuando vas a
volver: "Conciliación agosto", "Correo cliente X". Se buscan después.

**Adjuntar.** PDFs, Excel, Word, imágenes, capturas de pantalla. Esto es el **Contexto** de
PACTO hecho archivo. Regla de oro: si la información existe en un documento, adjunta el
documento; no lo describas.

**Estilos.** Claude puede escribir como tú le pidas siempre: más formal, más directo, con tu
forma de redactar. Se configura una vez y aplica a todo. Es la **T** de PACTO, guardada.

**Los dos botones que más se ignoran:** *editar* tu mensaje anterior (para corregir el prompt
sin abrir conversación nueva) y *volver a generar* (para pedir otra versión de la misma
respuesta).

*(Demostración: una conversación de conciliación con dos archivos adjuntos; una pregunta fuera
de tema para mostrar la contaminación; abrir una nueva; renombrar.)*

### Qué haces con esto
- **Decide:** que las conversaciones de trabajo se nombren con el estándar de la empresa —
  "área · tarea · mes" — para que cualquiera las encuentre.
- **Implementa:** define el estilo de redacción de tu área una vez, y que todos lo carguen.
- **Aplica el lunes:** abre una conversación por tarea. Adjunta el archivo real. Nómbrala.

---

## 1.3 · La configuración, campo por campo

Roberto Ortiz lo pidió así: *"cómo te metes a la configuración del perfil, del avatar, el
nombre, instrucciones, la cuenta, la privacidad, facturación, porcentajes de uso, capacidad,
memoria… hasta estos temas."* Vamos campo por campo.

**Perfil.**
- *Nombre y cómo quieres que te llame.* Sirve más de lo que parece: "Alejandro" vs "Ing.
  Martínez" cambia el tono de todo.
- *A qué te dedicas.* Una o dos líneas: "Dirijo una empresa de 40 personas de distribución en
  Morelia." Claude lo usa como contexto permanente. Es el **C** de PACTO que no tienes que
  repetir.
- *Instrucciones personales.* Cómo quieres que te responda siempre: "directo, sin adornos, en
  español de México, sin emojis". Es la **T** y la **O** guardadas para siempre.
- *Avatar.* Cosmético. Pero en Team, que cada quien tenga foto ayuda a saber quién compartió qué.

**Cuenta.** Correo, contraseña, cerrar sesión en otros dispositivos. Aquí es donde se ve
**qué plan tienes**.

**Privacidad.** Dos cosas que hay que saber y decidir:
- Si tus conversaciones **se usan para mejorar el modelo**. Se puede apagar. Para trabajo con
  datos de la empresa, se apaga. En Team viene apagado por defecto.
- Cuánto tiempo **se guardan** las conversaciones y cómo borrarlas.

**Facturación.** Plan, fecha de cobro, factura. Aquí se cambia de Pro a Team.

**Uso.** Cuánto has usado en el periodo, cuánto queda. Es el "tanque de gasolina". Se explica a
fondo en 1.4.

**Capacidades.** Los interruptores de lo que Claude puede hacer:
- **Memoria.** Claude recuerda cosas entre conversaciones — tu empresa, tus preferencias, tus
  proyectos. Se puede ver qué recuerda, editarlo y borrarlo. Está desde marzo de 2026 en todos
  los planes. Para trabajo: encendida, y revisada una vez al mes.
- **Pensamiento extendido.** Cuando quieres que razone más antes de contestar. Más lento, más
  caro en uso, mejor para análisis.
- **Búsqueda en internet.** Para datos actuales. Se apaga cuando no quieres que salga de tus
  archivos.

**Conectores y Habilidades** tienen su propia sección. Van en 1.5 y 1.6.

*(Demostración: Alejandro abre su configuración y recorre cada pestaña. Se detiene en
Privacidad y Memoria: son las dos que la gente no sabía que existían.)*

### Qué haces con esto
- **Decide:** la política de privacidad de la empresa en tres líneas: entrenamiento apagado,
  memoria encendida y revisada, búsqueda según la tarea. Va en "Reglas de información".
- **Implementa:** que cada persona de tu área llene "a qué te dedicas" e "instrucciones
  personales" en la sesión. Diez minutos que ahorran cien.
- **Aplica el lunes:** entra a Configuración → Privacidad y decide tú. Luego a Memoria y mira
  qué sabe de ti.

---

## 1.4 · Qué se cobra y cómo no gastar de más

Esto es el bullet "tokens" de la landing, sin la palabra "tokens" hasta el final.

**Cómo cobra Claude.** Con Pro pagas $20 al mes y tienes un **límite de uso** que se renueva
cada cierto tiempo. No pagas por mensaje; pagas por una cantidad de trabajo. Cuando se acaba,
esperas a que se renueve o subes de plan.

**Qué gasta más.**
- Conversaciones **largas**: cada mensaje nuevo vuelve a leer toda la conversación. Una de 80
  mensajes gasta mucho más que ocho de 10.
- **Archivos grandes** adjuntos: un PDF de 200 páginas se lee completo cada vez.
- **Pensamiento extendido**: piensa más, gasta más.
- El modelo **más potente** gasta más que el rápido.

**Cómo no gastar de más.**
1. Una tarea, una conversación (otra vez).
2. Adjunta solo las páginas que importan, no el archivo entero.
3. Pon lo que se repite en un **Proyecto** (1.7): se carga una vez, no en cada mensaje.
4. Usa el modelo rápido para lo rutinario; el potente para análisis.
5. Mira el medidor de **Uso** en Configuración antes de una sesión larga.

**Para el dueño:** en Team se ve el uso de cada persona. No para vigilar; para saber quién ya
le sacó jugo y quién necesita ayuda.

**Y ahora sí, la palabra:** todo esto se mide en *tokens* — pedazos de texto, más o menos
tres cuartos de una palabra. No necesitas contarlos. Necesitas saber que lo largo cuesta.

### Qué haces con esto
- **Decide:** Pro para todos hoy; Team cuando haya tres o más personas trabajando el mismo
  proyecto. Ver `../planes-claude.md`.
- **Implementa:** la regla de "una tarea, una conversación" en tu área. Es la que más ahorra.
- **Aplica el lunes:** revisa tu medidor de uso al inicio y al final del día. Aprende tu ritmo.

---

# Sesión 3 · PACTO y criterio

> La sesión más importante del módulo. Va **después** del tour de Claude: de nada sirve saber
> qué botones picar si no le sabes hablar. Decidido el 4-sep-2026; antes vivía en el Módulo 0.

## 1.5 · No es la herramienta, es el criterio

Hay algo importante que quiero dejar claro antes de enseñarte el método.

La Inteligencia Artificial es una herramienta. Nada más.

Así como un martillo sirve para clavar un clavo pero no decide qué construir, la IA no piensa
por ti, no decide por ti y no vive tus consecuencias.

**El valor no está en la herramienta. Está en cómo la usas.**

Hay una confusión muy común: la idea de que usar IA es "no esforzarse" o "dejar que piense por
ti". En realidad pasa lo contrario. Cuando usas IA bien:

- tienes que explicar lo que necesitas
- tienes que leer la respuesta
- tienes que decidir si tiene sentido o no
- tienes que ajustar la pregunta si no te sirve

Eso es pensamiento activo, no pasivo.

Y no lo digo yo: **85%** de los mexicanos que usan IA la usa como punto de partida, pero
**conserva el razonamiento y la decisión**. [^ms-wti-85] Las habilidades que más valoran las
empresas en la gente que trabaja con IA son dos: control de calidad (49%) y pensamiento crítico
(47%). [^ms-wti-frontier]

O sea: lo que te hace valioso no es que la IA escriba por ti. Es que tú sepas qué pedirle y
sepas si lo que devolvió está bien.

La IA no tiene criterio propio. No sabe qué te sirve y qué no. No conoce tu contexto completo.
Tú sí. Por eso la parte más importante del proceso no es lo que la IA responde, sino lo que tú
decides hacer con esa respuesta. Leer. Pensar. Aceptar una parte. Descartar otra.

### Qué haces con esto
- **Decide:** medir a tu equipo por lo que decide con la IA, no por cuánto la usa.
- **Implementa:** en cada entregable hecho con IA, que alguien firme "lo revisé". Sin firma, no
  se entrega.
- **Aplica el lunes:** lee lo que la IA te dé antes de mandarlo. Siempre. Es la única regla que
  no se negocia.

---

## 1.6 · Cuestiónate antes de escribir

Roberto lo pidió así en la junta: *"cuestiónate, cuestiónate, cuestiónate, para que ya sabiendo
lo que quieres, ahora sí lo puedas plasmar."*

Pensemos en algo muy nuestro. Seguro alguna vez tu mamá te dijo:

*"Pásame el deste de la desta que está ahí."*

Y tú te quedaste parado, mirando alrededor. ¿El qué… de cuál… y de dónde? No porque no quieras
ayudar. Sino porque no tienes información suficiente.

Ahora imagina que te dice: *"Pásame el vaso azul que está sobre la mesa."*

Mismo objetivo. Resultado completamente distinto.

Con la IA pasa exactamente lo mismo. Cuando le pedimos algo sin contexto, no es que falle. Es
que no sabe qué estamos pensando. **La IA no adivina. Y eso no es un defecto, es una ventaja.**

Por eso, antes de escribirle algo, cuatro preguntas. Aunque sea mentalmente:

1. **¿Qué quiero exactamente?** No "ideas de regalo". "Ideas de regalo para un adolescente de
   15 años, con presupuesto moderado, que no sea ropa."
2. **¿Para quién es?** ¿Lo va a leer el director? ¿Un cliente? ¿Yo nada más?
3. **¿En qué contexto lo voy a usar?** ¿Es un correo? ¿Una junta? ¿Un reporte que se archiva?
4. **¿Qué no quiero que haga?** Que no invente cifras. Que no use tecnicismos. Que no pase de
   una cuartilla.

Con solo pensar esto unos segundos, los resultados cambian muchísimo. No porque la IA sea más
inteligente. Porque tú estás siendo más claro.

**No cambió la herramienta. Cambió la claridad.**

Y cuando la respuesta no te convence, no te detengas. *"Explícamelo más sencillo." "Hazlo más
corto." "Eso no aplica a mi caso." "Dame un ejemplo diferente."* Eso no es usar mal la
herramienta. Eso es usarla bien. **La primera respuesta no es la última.**

### Qué haces con esto
- **Decide:** que en tu empresa "pedirle mal a la IA" se trate como "explicar mal a un
  compañero": se corrige la explicación, no se culpa a la herramienta.
- **Implementa:** pega las cuatro preguntas junto a la pantalla de tu equipo una semana.
- **Aplica el lunes:** antes de tu siguiente prompt, contesta las cuatro en un renglón cada una.

---

## 1.7 · PACTO, letra por letra

Ahora sí. Las cuatro preguntas de arriba tienen nombre. Es el método que uso en todas las
capacitaciones de IAlextremo, y funciona con cualquier IA: Claude, ChatGPT, Gemini, la que sea.

**P · A · C · T · O**

### P — Perfil
*Quién quieres que sea la IA para esta tarea.*

Cuando le dices "actúa como un contador con experiencia en pymes mexicanas", cambia el
vocabulario, el nivel de detalle y lo que considera importante. Sin perfil, te contesta un
generalista.

- Mal: *"Ayúdame con el reporte."*
- Bien: *"Actúa como director de finanzas de una empresa mediana en México."*

Error típico: perfiles vagos ("eres un experto"). Dale oficio, nivel y contexto.

### A — Acción
*Qué quieres que haga, con un verbo concreto, y para quién.*

Redacta, resume, compara, ordena, explica, traduce, revisa, propón. Un verbo, un resultado.

- Mal: *"Dime algo sobre las ventas."*
- Bien: *"Resume las ventas del trimestre en cinco puntos para presentar al consejo."*

Error típico: pedir dos cosas en una ("resume y también propón y de paso corrige"). Una acción
por mensaje; las demás después.

### C — Contexto
*Lo que la IA no puede saber si no se lo dices.*

Tu empresa, tu situación, los datos, qué pasó antes, qué está en juego. Es el "vaso azul sobre
la mesa". Aquí van los archivos, las cifras, el correo del cliente.

- Mal: *"Contesta este correo."*
- Bien: *"Este cliente nos pidió la cotización hace dos semanas, ya se la mandamos, y hoy
  pregunta por descuento. No podemos bajar de precio pero sí ofrecer pago a 60 días."*

Error típico: asumir que "ya sabe". No sabe nada de ti. **La IA no espera perfección. Espera
contexto.**

### T — Tono y Formato
*Cómo debe sonar y en qué forma debe salir.*

Tono: formal, cercano, directo, sin tecnicismos. Formato: correo, tabla, lista de cinco puntos,
una cuartilla, un párrafo. Longitud explícita.

- Mal: *(nada — y sale un ensayo)*
- Bien: *"En tono cercano pero profesional. Máximo 120 palabras. Formato de correo, con
  saludo y despedida."*

Error típico: no decir longitud. La IA por defecto escribe de más.

### O — Omisiones
*Lo que NO debe hacer.*

Es la letra que casi todos se saltan y la que más problemas evita. Que no invente datos. Que
no use emojis. Que no mencione a la competencia. Que no ofrezca descuento. Que no pase de tres
párrafos.

- Mal: *(nada — y la IA rellena huecos con cosas que no pediste)*
- Bien: *"No inventes cifras: si te falta un dato, pregúntamelo. No uses la palabra
  'solución'. No prometas fechas."*

Error típico: descubrir la omisión después de que ya salió mal. Ponla antes.

---

### PACTO completo, un ejemplo por perfil

Todos siguen el mismo esqueleto. Cambia el trabajo real, no el método. *(Entregados en texto
plano, sin adornos, en `../prompts/`.)*

**Dirección**
> Actúa como asesor de un director general de una empresa mediana en México. Resume este
> reporte de 40 páginas en una página: qué decidir, qué riesgos, qué preguntas hacerle al
> equipo. Contexto: es el reporte trimestral de operaciones y mañana tengo junta de consejo.
> Tono directo, sin adjetivos. Formato: tres bloques con viñetas. No incluyas nada que el
> reporte no diga; si algo no está claro, márcalo como duda.

**Operaciones**
> Actúa como jefe de operaciones con experiencia en plantas medianas. Convierte estas notas de
> voz transcritas en un reporte de incidencia. Contexto: fue una falla de la línea 2 el martes,
> paró 3 horas, ya está resuelta. Tono neutro, hechos. Formato: qué pasó, causa, qué se hizo,
> qué falta, en ese orden, media cuartilla. No asignes culpas a personas por nombre.

**Finanzas**
> Actúa como contralor de una pyme mexicana. Analiza estas dos columnas — presupuesto y real
> del mes — y explica las cinco variaciones más grandes. Contexto: el director no es financiero
> y quiere entender, no auditar. Tono claro, sin jerga contable. Formato: tabla con concepto,
> diferencia en pesos y en porcentaje, y una línea de explicación. No propongas acciones
> todavía; solo explica.

**RH**
> Actúa como gerente de recursos humanos. Redacta la descripción de puesto para un auxiliar
> administrativo. Contexto: empresa de 40 personas, el puesto reporta a administración, sueldo
> según tabulador. Tono formal y cercano. Formato: objetivo del puesto, cinco funciones, tres
> requisitos, dos deseables. No pidas título universitario; no incluyas sueldo.

**Marketing**
> Actúa como estratega de contenido para una marca B2B en México. Propón el calendario de
> publicaciones de LinkedIn para septiembre. Contexto: vendemos software a empresas medianas,
> tono serio, dos publicaciones por semana, y en septiembre lanzamos una capacitación. Tono
> profesional, sin exclamaciones. Formato: tabla con fecha, tema, formato y llamada a la
> acción. No uses emojis ni hashtags; no inventes cifras de la empresa.

**Ventas**
> Actúa como director comercial con experiencia en venta consultiva. Redacta la respuesta a
> este correo del cliente. Contexto: pidió cotización hace dos semanas, se la mandamos, y hoy
> pide descuento; no podemos bajar precio pero sí ofrecer pago a 60 días y capacitación sin
> costo. Tono cercano y seguro. Formato: correo de máximo 120 palabras con saludo y
> despedida. No menciones a la competencia; no prometas nada que no esté en este mensaje.

**TI**
> Actúa como responsable de sistemas de una empresa mediana. Redacta la política interna de uso
> de herramientas de IA. Contexto: 60 usuarios, usan Google Workspace, ya hay gente usando IA
> por su cuenta y no hay regla escrita. Tono claro, para gente no técnica. Formato: una
> cuartilla con tres secciones: qué sí, qué no, a quién preguntar. No uses siglas sin
> explicarlas; no amenaces con sanciones.

### Qué haces con esto
- **Decide:** que PACTO sea el estándar de la empresa para hablarle a cualquier IA. Un método,
  un lenguaje común. Es la respuesta a "diez personas, diez métodos, cero estándares".
- **Implementa:** la Tarjeta PACTO (en `plantillas/`) impresa en cada escritorio de tu área.
- **Aplica el lunes:** reescribe con PACTO el último prompt que te salió mal. Compara.

---

## 1.8 · Las tres preguntas antes de cualquier prompt

PACTO es cómo se escribe. Esto es si conviene escribirlo.

Antes de meter la IA a un proceso de tu empresa — no a una tarea suelta, a un proceso — tres
preguntas. Son de Roberto y son de negocio:

1. **¿Qué resultado de negocio busco?** Ahorrar horas, cobrar antes, responder mejor. Si la
   respuesta es "usar IA", todavía no es una respuesta.
2. **¿Cómo voy a saber que quedó bien?** El estándar de calidad se define **antes**, no
   después. ¿Qué tiene que tener el correo para que se mande? ¿Qué tiene que cuadrar en la
   conciliación?
3. **¿Quién lo revisa y quién lo opera cada semana?** Sin dueño del proceso, no hay proceso.
   Con nombre y apellido.

Si las tres no tienen respuesta, todavía no es momento de abrir la IA en ese proceso. Abre otro.

Y la prueba final, para cualquier cosa que aprendas aquí o en otro lado:

**Si no cambia lo que alguien de tu equipo hace el lunes a las 9 de la mañana, no fue
implementación. Fue entretenimiento.**

### Qué haces con esto
- **Decide:** un proceso — uno — para empezar. El que más duela y menos riesgo tenga.
- **Implementa:** contesta las tres preguntas de ese proceso por escrito. Es la primera página
  de tu Proyecto en la sesión 4.
- **Aplica el lunes:** si te asignan "meter IA" a algo, pide las tres respuestas primero.

---

## 1.9 · De preguntar a ejecutar

Casi todo el mundo usa la IA como buscador: le pregunta algo, lee la respuesta, se va.

Está bien. Pero es el 10% de lo que puede hacer.

Con Google buscas información. Con la IA pides una explicación. Y con la IA bien usada, pides
**un entregable**.

La diferencia está en el verbo:

| Preguntar | Ejecutar |
|---|---|
| ¿Qué es una conciliación bancaria? | Concilia este estado de cuenta con este auxiliar y dime qué no cuadra |
| ¿Cómo escribo un correo de cobranza? | Redacta el correo de cobranza para este cliente con estos datos, en nuestro tono |
| ¿Qué debe llevar un reporte semanal? | Arma el reporte semanal con estas cifras, en este formato, para este lector |
| ¿Qué opinas de esta propuesta? | Compara estas dos propuestas en una tabla: costo, plazo, riesgo, y recomienda una |

La columna de la izquierda te da conocimiento. La de la derecha te da tiempo.

Todo lo que sabes hacer — lo que tienes en la cabeza, lo que nadie te ha pedido escribir — se
puede convertir en instrucciones. Y cuando está en instrucciones, la IA lo ejecuta. Una vez, y
luego cada vez.

Eso es lo que vamos a hacer en el Módulo 1: pasar de la pregunta suelta a la conversación que
sí sirve, al proyecto que guarda tu contexto, a la habilidad que le enseña tu forma de
trabajar, y al conector que le da tus datos de verdad.

Pero el orden importa. Primero PACTO. Después los botones.

### Qué haces con esto
- **Decide:** dejar de evaluar "si usan IA" y empezar a evaluar "qué entregables salen con IA".
- **Implementa:** toma las tres tareas más repetidas de tu área y escríbelas en la columna de
  la derecha. Ese es tu primer inventario.
- **Aplica el lunes:** convierte tu siguiente pregunta a la IA en una instrucción con verbo.

---

---

# Sesiones 4 y 5 · Habilidades, conectores y proyectos

## 1.10 · Habilidades (Skills)

Si en ChatGPT "creabas un GPT", aquí le enseñas una **Habilidad**. Y es mejor, porque no es una
copia separada de la IA: es una instrucción que Claude carga cuando la necesita.

**Qué es.** Un documento donde le explicas a Claude **cómo se hace algo en tu empresa**: el
formato de tus cotizaciones, el tono de tus correos, los pasos de tu conciliación, la
estructura de tu reporte semanal. Una vez escrita, la activas en cualquier conversación y
Claude trabaja a tu manera.

**De dónde salen.**
- Hay habilidades **listas** — para Excel, Word, PowerPoint, PDF, y cientos más — que se
  activan con un clic.
- Y están las **tuyas**, que escribes tú. Son las que valen.

**Cómo se escribe una habilidad — con PACTO.** Una habilidad es un PACTO permanente:
- *P*: quién es Claude cuando hace esto ("contralor de esta empresa").
- *A*: qué hace ("concilia el estado de cuenta con el auxiliar").
- *C*: lo que siempre es igual ("nuestras cuentas son estas, los conceptos que se cruzan son
  estos, el banco manda el archivo así").
- *T*: el formato de salida ("tabla con estas cinco columnas, y al final un resumen de tres
  líneas").
- *O*: lo que nunca ("no marques como conciliado nada con diferencia mayor a $1; no propongas
  asientos").

**El ejemplo que se construye en vivo:** la habilidad "Cotización" de una empresa de la sala.
Se toma una cotización real, se describe cómo está hecha, se escribe la habilidad, se activa, y
se le pide "cotiza esto" con un correo de cliente. Sale en el formato de la casa.

**La regla:** una habilidad hace **una** cosa. "Cotizar" es una habilidad. "Cotizar y dar
seguimiento y facturar" son tres.

*(Nota para quien presenta: las habilidades personalizadas y su marketplace existen en Pro; se
confirma en pantalla la semana del curso qué se puede compartir con el equipo — eso es Team.)*

### Qué haces con esto
- **Decide:** las tres tareas de la empresa que más se repiten igual. Esas son las tres
  primeras habilidades.
- **Implementa:** escribe una con tu equipo en la sesión. Que la persona que hoy hace la tarea
  dicte los pasos; ella es la que sabe.
- **Aplica el lunes:** activa una habilidad lista (la de Excel) y pídele algo que hoy haces a
  mano.

---

## 1.11 · Conectores

Hasta aquí Claude solo sabe lo que le dices o le adjuntas. Un **conector** le da acceso a
donde ya viven tus datos: tu correo, tu calendario, tus archivos en la nube, tu CRM.

**Qué se puede conectar hoy** (confirmar en pantalla): Gmail y Google Calendar, Google Drive,
Microsoft 365 (Outlook, OneDrive), Slack, Notion, y herramientas de negocio como HubSpot. La
lista crece cada mes.

**Cómo se conecta.** Configuración → Conectores → elegir → autorizar con tu cuenta. Claude pide
permiso de **leer**; tú decides cuáles.

**Qué cambia cuando está conectado.** En vez de pegar el correo, le dices: *"lee los últimos 15
correos de clientes y dime cuáles piden cotización"*. En vez de subir el Excel: *"abre el
archivo 'Ventas agosto' de mi Drive y resume por vendedor"*. En vez de dictarle tu agenda:
*"¿qué tengo mañana y qué debería preparar?"*.

**La regla que decidió la junta, y que se dice completa en la sesión:**

> Claude lee, organiza y **redacta borradores**. **No envía.** Tú revisas y tú mandas.

Alejandro fue claro: una IA contestando correos sola, con información de la empresa, no es
algo para lo que vamos a capacitar a nadie. Existe. Se puede. No lo hacemos. Por dos razones:
un error en un correo a un cliente cuesta más que las horas que ahorra, y la persona que revisa
es la que conserva el criterio (`ms-wti-85`).

**Seguridad.** Conectar una cuenta es dar acceso. Tres preguntas antes: ¿es mi cuenta o la de
la empresa? ¿qué puede leer? ¿lo puede leer alguien más con acceso a mi Claude? Va en 1.9.

**El ejemplo en vivo:** Gmail conectado. *"Lee mis últimos 15 correos, dime cuáles piden
cotización y redáctame un borrador para cada uno con nuestro formato."* Salen los borradores.
Nadie envía nada.

*(Demostración adicional, solo mostrar: Claude in Chrome — la extensión que ve la pestaña que
tienes abierta y puede actuar en ella. Es GA en todos los planes de pago desde agosto de 2026.
Se enseña como "existe y así se ve", no como práctica: puede operar de forma autónoma, y esa
es justamente la línea que no cruzamos en este curso.)*

### Qué haces con esto
- **Decide:** qué cuentas se pueden conectar (la de trabajo) y cuáles no (la personal). En Team
  esto se decide centralmente; es la respuesta al 93% que usa IA no aprobada (`shadow-93`).
- **Implementa:** conecta el correo del área en la sesión. Empieza con leer y organizar; los
  borradores vienen solos.
- **Aplica el lunes:** *"resume los correos que no he contestado y dime cuáles urgen"*. Ese es
  el primer conector que se paga solo.

---

## 1.12 · Proyectos: el segundo cerebro de tu área

Este es el bullet "contexto y proyectos" de la landing, y es el que más tiempo ahorra.

**El problema.** Cada conversación empieza de cero. Vuelves a explicar tu empresa, tu área,
tus reglas, tu formato. Eso es la **C** de PACTO repetida cien veces.

**La solución.** Un **Proyecto** es una carpeta que guarda el contexto **una sola vez**:
- **Instrucciones del proyecto:** el PACTO permanente de esa área o ese objetivo.
- **Archivos de conocimiento:** los documentos que siempre importan — el catálogo, el
  tabulador, la política, el formato, el organigrama.
- **Las conversaciones** que pasan dentro de él, que ya nacen sabiendo todo eso.

**Cómo se arma uno — en la sesión, cada quien el suyo.** Alejandro lo pidió así: *"que
comiencen ya a estructurar un proyecto con un objetivo de lo que quieren trabajar las siguientes
cuatro semanas."*

1. **Nombre:** área + objetivo. "Finanzas · Cierre mensual". "Ventas · Seguimiento de cuentas".
2. **Instrucciones:** las tres preguntas de la lección 0.11 (qué resultado, cómo sé que quedó
   bien, quién revisa) + el PACTO del área.
3. **Conocimiento:** entre tres y diez archivos. Los que siempre consultas. No todo.
4. **Primera conversación:** la tarea más repetida de esa área.

**Lo que cambia.** Dentro del proyecto, *"concilia agosto"* ya sabe qué banco, qué cuentas, qué
formato. Fuera, tendrías que explicarlo todo.

**[Team]** Un proyecto se puede **compartir** con el área: todos parten del mismo contexto, con
las mismas reglas. Es el "un método, un lenguaje común" del Acto 4 de la charla, hecho botón.

**Proyecto vs Habilidad.** El proyecto es el **lugar** (el contexto de un área u objetivo). La
habilidad es el **cómo** (una tarea concreta, reutilizable en cualquier lugar). Se combinan:
dentro del proyecto "Finanzas", activas la habilidad "Conciliar".

### Qué haces con esto
- **Decide:** un proyecto por área, con dueño. Empiezan con el que más duele.
- **Implementa:** en la sesión 4 sales con tu proyecto armado: nombre, instrucciones, tres
  archivos, una conversación. Es el entregable de la sesión.
- **Aplica el lunes:** trabaja **dentro** del proyecto toda la semana. Nada fuera.

---

## 1.13 · De respuesta a entregable

Claude no solo contesta. **Produce archivos.**

**Artefactos.** Cuando le pides algo con forma — una tabla, un documento, una presentación, una
página, un gráfico — lo crea aparte del chat, en un panel donde lo puedes editar, versionar y
descargar. No es texto en la conversación: es el archivo.

**Lo que sale listo hoy** (confirmar en pantalla): documentos Word, hojas Excel con fórmulas,
presentaciones PowerPoint, PDFs, y páginas o tableros interactivos. Con la habilidad correcta
activada, salen en tu formato.

**El flujo que cambia el día:**
1. Contexto (proyecto) + habilidad activa.
2. *"Arma el reporte semanal con estas cifras."*
3. Sale el archivo. Lo revisas en el panel. *"Cambia la gráfica a barras. Quita el párrafo
   tres."*
4. Descargas. Envías tú.

**Lo que no cambia:** revisas antes de mandar. Siempre.

*(Demostración: reporte semanal de operaciones en Excel con dos gráficas, desde una tabla
pegada. Se edita en vivo. Se descarga. Se abre en Excel real.)*

### Qué haces con esto
- **Decide:** qué entregables de la empresa se van a producir con Claude primero. Pista: los
  que se arman "a mano" cada semana con los mismos datos.
- **Implementa:** que el reporte semanal de tu área salga de Claude desde la sesión 5.
- **Aplica el lunes:** pide tu siguiente reporte como archivo, no como texto. Descárgalo.

---

## 1.14 · Configuración segura para tu empresa

Este es el bullet "configuración segura" de la landing. Es corto porque son reglas, no
opciones.

**Lo que dicen los datos.** 82% usa IA sin avisar; 75% de ellos compartió datos sensibles; 18.5%
conoce una política (`es-82`, `shadow-datos`, `shadow-18-5`). El problema no es que la gente use
IA. Es que nadie les dijo cómo.

**Las cinco reglas — y van en "Reglas de información" (`plantillas/`):**

1. **Cuenta de trabajo, no personal.** Lo que se hace con datos de la empresa, en la cuenta de
   la empresa.
2. **Entrenamiento apagado.** Configuración → Privacidad. En Team, por defecto.
3. **Semáforo de información.**
   - 🟢 Se puede subir: información pública, procesos internos sin datos personales, plantillas.
   - 🟡 Con cuidado: cifras internas, listas de clientes sin datos personales, contratos con
     nombres anonimizados.
   - 🔴 No se sube: datos personales (nómina, INE, salud), contraseñas, información de terceros
     bajo confidencialidad, secretos comerciales sin autorización.
4. **Conectores solo de trabajo, y solo lectura.** Se conecta el correo del área; no el
   personal. Claude lee y redacta; no envía.
5. **Alguien revisa antes de que salga.** Sin excepción. Es la firma de la lección 0.8.

**Qué ve TI.** En Team y Enterprise hay controles de admin: quién puede conectar qué, qué
habilidades se permiten, uso por persona. Eso es una conversación aparte con sistemas.

### Qué haces con esto
- **Decide:** firmar las cinco reglas como política de la empresa. La plantilla está lista;
  toma veinte minutos adaptarla.
- **Implementa:** léelas con tu equipo en voz alta. Pregunta qué de lo que ya hacen queda en
  rojo. Sin castigo.
- **Aplica el lunes:** antes de subir un archivo, pregúntate de qué color es.

---

## 1.15 · Los prompts que sí funcionan

Este es el bullet "prompts que funcionan" y cierra el módulo donde empezó el 0: en PACTO.

**Ya sabes el método.** Ahora, cómo se ve aplicado a Claude, con todo lo que aprendiste:

| Letra | Sin Claude configurado | Con Claude configurado |
|---|---|---|
| **P** Perfil | lo escribes cada vez | vive en el perfil o en el proyecto |
| **A** Acción | lo escribes cada vez | lo escribes cada vez — es lo único que cambia |
| **C** Contexto | lo pegas cada vez | vive en el proyecto y en los conectores |
| **T** Tono y formato | lo escribes cada vez | vive en instrucciones personales y en la habilidad |
| **O** Omisiones | lo escribes cada vez | vive en la habilidad y en las reglas de información |

Cuando todo está configurado, tu prompt del día es **solo la A**: *"concilia agosto"*, *"resume
los correos que urgen"*, *"arma el reporte"*. Lo demás ya está.

**Los siete prompts por perfil** están en `../prompts/`, en texto plano, listos para copiar.
Cada uno trae la versión "completa" (para cuando no tienes nada configurado) y la versión
"corta" (para cuando ya tienes proyecto y habilidad).

**Los cuatro errores que más vemos, y su arreglo:**
1. *Pedir dos cosas.* → Una acción por mensaje.
2. *No decir longitud.* → "Máximo N palabras" o "una cuartilla".
3. *No dar el archivo.* → Adjunta o conecta. No describas.
4. *Aceptar la primera respuesta.* → "Eso no; hazlo así." La primera no es la última.

**Y la prueba, otra vez:** si el prompt no cambia lo que haces el lunes a las 9, es un
ejercicio. Si lo cambia, es implementación.

### Qué haces con esto
- **Decide:** que los prompts del área se guarden en el proyecto compartido, con nombre. Son
  activos de la empresa.
- **Implementa:** los siete de `prompts/` adaptados a tu área, en la sesión. Que el equipo los
  corra y los corrija.
- **Aplica el lunes:** tu prompt del día es solo la A. Si necesitas escribir más, algo falta en
  la configuración — y ya sabes dónde.

---

## Lista de verificación antes de cada sesión (quien presenta)

Abrir la cuenta real y confirmar, con la pantalla proyectada:

- [ ] La barra lateral muestra Proyectos, Habilidades y Conectores con esos nombres
- [ ] Configuración tiene: Perfil · Cuenta · Privacidad · Facturación · Uso · Capacidades ·
      Conectores · Habilidades (o el nombre que tengan esa semana)
- [ ] Memoria está en Capacidades y se puede ver/editar/borrar
- [ ] La opción de entrenamiento está en Privacidad y se puede apagar
- [ ] El medidor de uso muestra periodo y consumo
- [ ] Gmail conecta y **lee**; el borrador se crea y **no se envía**
- [ ] Una habilidad lista (Excel) se activa y produce un archivo descargable
- [ ] Claude in Chrome instalado en el navegador de demo, para mostrarlo diez segundos
- [ ] Todas las capturas de `laminas.md` son de esta semana

Si algo cambió de nombre o de lugar, se actualiza la lámina esa mañana. El producto se mueve
rápido; el guion describe funciones, no rutas.
