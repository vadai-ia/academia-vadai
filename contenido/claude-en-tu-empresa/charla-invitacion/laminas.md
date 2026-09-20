# Charla de invitación — láminas

> Fuente única para `presentacion/construir.py`. Una lámina por bloque `## N ·`. Campos:
> `tipo` (portada · seccion · numero · frase · lista · tabla · encuesta · demo · cita · cierre),
> `titular` (con `**acento**` para la palabra en color), `cifra`, `texto`, `fuente` (`[^id]`),
> `nota` (lo que dice quien presenta, no se proyecta).
> Regla visual: una idea por lámina · titular condensado · fuente abajo a la izquierda en toda
> lámina con dato · número grande, frase corta.

## 1 · Portada
tipo: portada
titular: La IA no va a transformar tu empresa. **Tu equipo pensando bien y trabajando con IA, sí.**
texto: Claude en tu Empresa · VADAI + Total Coach
nota: Placa blanca con los dos logos. Nada más.

## 2 · Tres preguntas
tipo: encuesta
titular: Antes de una sola cifra, **mírense**.
texto: Escanea y contesta. No hay respuesta buena.
nota: Proyectar `/proyectar/[token]` de "Charla · Arranque". Esperar ~70% de la sala. Comentar la tercera barra.

## 3 · Acto 1
tipo: seccion
titular: Acto 1 · **La tormenta perfecta**
texto: Por qué es hoy y no el próximo trimestre.

## 4 · El reloj contra tu nómina
tipo: tabla
titular: Ya es ley. Entra el **1 de enero**.
texto: 2026 · 48 h | 2027 · 46 h | 2028 · 44 h | 2029 · 42 h | 2030 · 40 h — salario íntegro, horas extra al doble
fuente: [^jornada-40]
nota: "Ocho horas menos por persona por semana. No casi ocho. Ocho."

## 5 · Salario mínimo
tipo: numero
titular: Y el salario mínimo, **otra vez**.
cifra: +13%
texto: fue el aumento de 2026. El de 2027 lo decide CONASAMI en diciembre; se espera entre 11 y 13. Proyección, no dato.
fuente: [^salario-min-2027]

## 6 · La cuenta, en vivo
tipo: demo
titular: Hagamos **tu** cuenta.
texto: Calculadora de la landing. Supuestos a la vista: 42.5 h/semana · carga social 1.35 · 46 semanas.
nota: Pedir a alguien de la sala: personas en administración y sueldo promedio. Dejar el número en pantalla.

## 7 · Una por minuto
tipo: numero
titular: La ola ya pasó por **tu cuadra**.
cifra: 550,000
texto: empresas mexicanas empezaron a usar IA en los últimos 12 meses. Una cada minuto.
fuente: [^aws-550k]

## 8 · Todos la tienen
tipo: lista
titular: Todos la tienen. **Casi nadie cobra con ella.**
texto: 95% de los pilotos sin impacto medible · 42% abandonó sus iniciativas (era 17%) · 63% de las mexicanas en usos básicos · 46% no sabe si funciona · 6% le saca valor real
fuente: [^mit-nanda-95] [^sp-abandono] [^aws-mx] [^mck-6]
nota: "El problema nunca fue el acceso. Fue dejarla entrar sin criterio, sin método y sin equipo."

## 9 · Sin ti
tipo: numero
titular: Tu empresa ya usa IA. **Solo que sin ti.**
cifra: 82%
texto: de quienes usan IA en el trabajo recurre a herramientas que la empresa no aprobó, sin avisar. 75% de ellos compartió datos sensibles. Solo 18.5% conoce una política.
fuente: [^es-82] [^shadow-datos] [^shadow-18-5]

## 10 · Tampoco es de abajo
tipo: numero
titular: Y no es un problema **de los de abajo**.
cifra: 93%
texto: de los ejecutivos usa herramientas de IA no aprobadas por su organización.
fuente: [^shadow-93]
nota: Volver a la tercera barra de la encuesta.

## 11 · Acto 2
tipo: seccion
titular: Acto 2 · **El criterio**
texto: Qué separa a los que sí le sacan dinero.

## 12 · Basura más rápido
tipo: frase
titular: Un equipo sin criterio no recibe soluciones. **Recibe basura, solo que más rápido.**
nota: "La IA es velocidad. La dirección la pone tu gente."

## 13 · Lo paga el jefe
tipo: numero
titular: El tiempo que la IA ahorró abajo **lo está pagando el jefe arriba**.
cifra: 57%
texto: de los jefes ha tenido que corregir o rehacer trabajo de alguien que se apoyó demasiado en la IA (38% entre colaboradores). 77% revisa con más cuidado lo hecho con IA.
fuente: [^rework-45] [^rework-77]

## 14 · Nadie fue entrenado
tipo: lista
titular: Todos la usan. **Casi nadie fue entrenado.**
texto: 9 de cada 10 la usa · 1 de cada 6 se siente preparado · 35% sin ninguna capacitación · 9% se siente muy cómodo · 59% tendrá que reentrenarse antes de 2030
fuente: [^training-9de10] [^gallup-9] [^wef-2030]

## 15 · No le sirve
tipo: numero
titular: Y la capacitación que reciben **no les sirve**.
cifra: 85%
texto: de los empleados dice que la capacitación de IA que recibió no le ayuda en su puesto.
fuente: [^training-85]
nota: "Por eso este curso se da con SU Excel, SUS correos y SU reporte del viernes."

## 16 · Tres preguntas
tipo: lista
titular: Antes de cualquier prompt, **tres preguntas**.
texto: 1 · ¿Qué resultado de negocio busco? — 2 · ¿Cómo voy a saber que quedó bien? — 3 · ¿Quién lo revisa y quién lo opera cada semana?
nota: "Si las tres no tienen respuesta, todavía no es momento."

## 17 · La prueba del lunes
tipo: frase
titular: Si no cambia lo que alguien hace **el lunes a las 9**, no fue implementación. Fue entretenimiento.
nota: "Aplícala a cualquier curso, herramienta o consultor. Incluido este."

## 18 · Postura
tipo: numero
titular: El pensamiento crítico no se descarga. **Se entrena en equipo.**
cifra: 67%
texto: del impacto de la IA depende de factores organizacionales. 32% del esfuerzo individual. Medido en México, 2026.
fuente: [^ms-wti-67-32]

## 19 · Acto 3
tipo: seccion
titular: Acto 3 · **¿Dónde está el dinero?**
texto: Las horas ya las estás perdiendo. Solo que no las estás cobrando.

## 20 · Trabajo sobre el trabajo
tipo: numero
titular: Más de la mitad del día **no es el trabajo**.
cifra: 58%
texto: de la jornada se va en coordinar, buscar, reportar y dar seguimiento. Solo 33% en el trabajo para el que contrataste a la persona.
fuente: [^asana-58]

## 21 · Un día completo
tipo: numero
titular: Tus gerentes pierden **un día a la semana**.
cifra: 55%
texto: de los gerentes pasa 8 horas o más a la semana en tareas manuales y administrativas. El correo solo: 13 horas, y hasta 30% es recuperable (MGI, 2012 — hoy es peor).
fuente: [^managers-8h] [^mgi-email]

## 22 · Las cuatro fugas
tipo: lista
titular: Las **cuatro fugas** típicas.
texto: Conciliaciones bancarias · Facturas y capturas · Reportes que se arman a mano · Correos de seguimiento

## 23 · ¿Dónde te duele?
tipo: encuesta
titular: **¿Dónde te duele** a ti?
texto: Escanea otra vez. Área, personas, y la tarea que se come tu semana.
nota: Proyectar "Charla · ¿Dónde te duele?". Leer la nube en voz alta.

## 24 · Escena 1
tipo: demo
titular: Escena 1 · **Correo**
texto: "Lee mis últimos 15 correos, dime cuáles piden cotización y redáctame un borrador para cada uno con nuestro formato."
nota: Claude con conector de Gmail. Aparecen los BORRADORES. Nadie envía nada. Se revisan.

## 25 · Escena 2
tipo: demo
titular: Escena 2 · **Excel**
texto: "Concilia este estado de cuenta con este auxiliar y dime qué no cuadra."
nota: Subir los dos archivos. Sale la lista de diferencias con explicación.

## 26 · Tu cuenta
tipo: demo
titular: Las horas que tu equipo pierde **ya tienen precio**.
texto: Calculadora con las respuestas de la sala. Equivalencias: dos viajes en familia · seis meses de renta · capacitar a 13 personas.
nota: "La diferencia es que hoy te vas sabiendo cuál es."

## 27 · Acto 4
tipo: seccion
titular: Acto 4 · **En equipo, o no funciona**

## 28 · Es humano
tipo: numero
titular: El fracaso es **humano**, no técnico.
cifra: 72%
texto: de las transformaciones fracasan por resistencia de la gente o conducta de la dirección. Con la gente preparada, 88% logra sus objetivos. Sin prepararla, 13%.
fuente: [^mck-72] [^prosci-88-13]

## 29 · Cero estándares
tipo: frase
titular: Diez personas. Diez métodos. **Cero estándares.**
texto: La respuesta no es prohibir. Es alinear: una visión, un método, un lenguaje común.

## 30 · Empieza arriba
tipo: numero
titular: Empieza arriba. **Contigo.**
cifra: 3×
texto: más probabilidad de que sus líderes usen la IA ellos mismos, en las empresas que más valor capturan. Y solo 28% tiene al director supervisando la IA: el factor que más pesa en el resultado.
fuente: [^mck-3x] [^mck-ceo-28]
nota: Roberto Ortiz: "Antes un líder se medía por el tamaño de su departamento. Hoy, por más eficiencia con menos gente y menos costo."

## 31 · Un genio, un equipo
tipo: frase
titular: Un genio con IA acelera su escritorio. **Un equipo alineado con IA acelera la empresa.**
nota: "Mientras tú seas el único que sabe, tu empresa depende de ti para todo."

## 32 · El cómo
tipo: seccion
titular: Todo lo que viste fue el porqué. **Esto es el cómo.**
texto: Con método, fechas y dos firmas detrás.

## 33 · Tres pasos
tipo: lista
titular: Alinear · Aplicar · **Acompañar**
texto: 1 · Alinear con Total Coach: diagnóstico de horas y procesos, sesión de visión con dirección — 2 · Aplicar con VADAI: 8 sesiones en vivo, 4 semanas, con el trabajo real de cada persona — 3 · Acompañar: asesoría 1 a 1, respaldo de ambas firmas, descuentos en implementación

## 34 · Los módulos
tipo: tabla
titular: Lo que se lleva **tu equipo**.
texto: 0 · Antes de empezar: el método PACTO y el criterio | 1 · Aprende a usar Claude: el tour completo | 2 · Claude en Excel, Word y correo | 3 · Dashboard y reportes | 4 · Finanzas, Operaciones y Ventas | 5 · Alineación de equipos
nota: Alejandro: "Elegimos Claude porque es la más poderosa hoy. Pero van a aprender a hablarle a cualquier IA."

## 35 · El lunes de la semana 3
tipo: frase
titular: Así se ve el lunes de tu equipo **en la semana 3**.
texto: Los 14 correos de proveedores ya tienen borrador. Jorge pide el resumen de sus 8 cuentas. Y tú abres un tablero que se armó solo desde tu Excel.
nota: Borrador, no enviado. El tablero es semana 4. Alivio, ambición y control.

## 36 · Incluye
tipo: lista
titular: **Acceso de por vida**, con factura.
texto: Plataforma con los módulos grabados · +50 prompts · plantillas de clase · asesoría 1 a 1 · descuentos VADAI

## 37 · Dos maneras
tipo: lista
titular: Dos maneras de **empezar hoy**.
texto: 1 · Inscribe a tu equipo — precio de lanzamiento — 2 · 30 minutos con Total Coach, sin costo
nota: PRECIO PENDIENTE. No proyectar la cifra hasta que se decida ($24,890 en la landing vs $4,900/persona y paquete empresarial en la junta).

## 38 · La objeción
tipo: frase
titular: "Mi gente no es de tecnología."
texto: Por eso es en su Excel, su Word y su correo. Si saben mandar un mail, pueden con esto.

## 39 · Cierre
tipo: cierre
titular: El 1 de enero de 2027 llega igual para todos. **La diferencia es con qué equipo lo recibes.**
texto: La IA no va a transformar tu empresa. Tu equipo pensando bien y trabajando con IA, sí.
nota: QR de registro. Paso uno empieza hoy.
