# Módulo 1 — evaluación

> Mismo formato que `../modulo-0/evaluacion.md`: `passing_score = 70`, `reveal_answers = true`.
> Mide criterio de uso, no memoria de rutas de menú (que cambian).

## Preguntas

### 1
**Estás conciliando el banco en una conversación y de pronto necesitas un correo de ventas. Lo correcto es…**
- a · pedirlo en la misma conversación; Claude sabe separar
- b · abrir una conversación nueva: una tarea, una conversación ✓
- c · borrar la conversación de conciliación
- d · pedir las dos cosas en un solo mensaje

```json
{ "options": [{"id":"a","text":"pedirlo en la misma conversación; Claude sabe separar"},{"id":"b","text":"abrir una conversación nueva: una tarea, una conversación"},{"id":"c","text":"borrar la conversación de conciliación"},{"id":"d","text":"pedir las dos cosas en un solo mensaje"}], "correct_option_id": "b" }
```

### 2
**La información que necesitas está en un PDF de 30 páginas. Lo mejor es…**
- a · describirle a Claude lo que dice el PDF
- b · copiar y pegar el texto completo en el mensaje
- c · adjuntar el PDF, o solo las páginas que importan ✓
- d · pedirle a Claude que lo busque en internet

```json
{ "options": [{"id":"a","text":"describirle a Claude lo que dice el PDF"},{"id":"b","text":"copiar y pegar el texto completo en el mensaje"},{"id":"c","text":"adjuntar el PDF, o solo las páginas que importan"},{"id":"d","text":"pedirle a Claude que lo busque en internet"}], "correct_option_id": "c" }
```

### 3
**Para trabajar con datos de la empresa, el ajuste de privacidad "usar mis conversaciones para mejorar el modelo" debe estar…**
- a · encendido, para que aprenda de mi empresa
- b · apagado ✓
- c · da igual; no afecta
- d · encendido solo en Team

```json
{ "options": [{"id":"a","text":"encendido, para que aprenda de mi empresa"},{"id":"b","text":"apagado"},{"id":"c","text":"da igual; no afecta"},{"id":"d","text":"encendido solo en Team"}], "correct_option_id": "b" }
```

### 4
**¿Cuál de estas cosas gasta MÁS de tu límite de uso?**
- a · una conversación de 80 mensajes ✓
- b · ocho conversaciones de 10 mensajes
- c · renombrar conversaciones
- d · activar una habilidad

```json
{ "options": [{"id":"a","text":"una conversación de 80 mensajes"},{"id":"b","text":"ocho conversaciones de 10 mensajes"},{"id":"c","text":"renombrar conversaciones"},{"id":"d","text":"activar una habilidad"}], "correct_option_id": "a" }
```

### 5
**Una Habilidad bien hecha…**
- a · hace varias cosas relacionadas
- b · hace una sola cosa, con PACTO permanente ✓
- c · reemplaza al Proyecto
- d · solo existe en el plan Enterprise

```json
{ "options": [{"id":"a","text":"hace varias cosas relacionadas"},{"id":"b","text":"hace una sola cosa, con PACTO permanente"},{"id":"c","text":"reemplaza al Proyecto"},{"id":"d","text":"solo existe en el plan Enterprise"}], "correct_option_id": "b" }
```

### 6
**Con el conector de Gmail, en este curso Claude…**
- a · lee, organiza y redacta borradores; tú envías ✓
- b · contesta los correos automáticamente
- c · solo lee; no puede redactar
- d · envía si tú lo apruebas una vez

```json
{ "options": [{"id":"a","text":"lee, organiza y redacta borradores; tú envías"},{"id":"b","text":"contesta los correos automáticamente"},{"id":"c","text":"solo lee; no puede redactar"},{"id":"d","text":"envía si tú lo apruebas una vez"}], "correct_option_id": "a" }
```

### 7
**Un Proyecto sirve para…**
- a · guardar el contexto de un área u objetivo una sola vez ✓
- b · hacer una tarea concreta en cualquier conversación
- c · ver el uso de cada empleado
- d · conectar el correo

```json
{ "options": [{"id":"a","text":"guardar el contexto de un área u objetivo una sola vez"},{"id":"b","text":"hacer una tarea concreta en cualquier conversación"},{"id":"c","text":"ver el uso de cada empleado"},{"id":"d","text":"conectar el correo"}], "correct_option_id": "a" }
```

### 8
**La diferencia entre Proyecto y Habilidad es…**
- a · ninguna; son lo mismo
- b · el Proyecto es el lugar (contexto); la Habilidad es el cómo (una tarea) ✓
- c · el Proyecto es de pago; la Habilidad es gratis
- d · la Habilidad es solo para Excel

```json
{ "options": [{"id":"a","text":"ninguna; son lo mismo"},{"id":"b","text":"el Proyecto es el lugar (contexto); la Habilidad es el cómo (una tarea)"},{"id":"c","text":"el Proyecto es de pago; la Habilidad es gratis"},{"id":"d","text":"la Habilidad es solo para Excel"}], "correct_option_id": "b" }
```

### 9
**Según el semáforo de información, la nómina con nombres y sueldos es…**
- a · 🟢 se puede subir
- b · 🟡 con cuidado
- c · 🔴 no se sube ✓
- d · depende del plan

```json
{ "options": [{"id":"a","text":"verde: se puede subir"},{"id":"b","text":"amarillo: con cuidado"},{"id":"c","text":"rojo: no se sube"},{"id":"d","text":"depende del plan"}], "correct_option_id": "c" }
```

### 10
**Con perfil, proyecto y habilidad configurados, tu prompt del día debería ser…**
- a · el PACTO completo, cada vez
- b · solo la A: la acción ✓
- c · solo el contexto
- d · una lista de omisiones

```json
{ "options": [{"id":"a","text":"el PACTO completo, cada vez"},{"id":"b","text":"solo la A: la acción"},{"id":"c","text":"solo el contexto"},{"id":"d","text":"una lista de omisiones"}], "correct_option_id": "b" }
```

### 11
**"Pásame el deste de la desta que está ahí" es un ejemplo de un prompt al que le falta…**
- a · tono
- b · contexto ✓
- c · longitud
- d · un perfil

```json
{ "options": [{"id":"a","text":"tono"},{"id":"b","text":"contexto"},{"id":"c","text":"longitud"},{"id":"d","text":"un perfil"}], "correct_option_id": "b" }
```

### 12
**En PACTO, la letra O significa…**
- a · Objetivo: el resultado de negocio que buscas
- b · Orden: en qué secuencia debe responder
- c · Omisiones: lo que la IA NO debe hacer ✓
- d · Origen: de dónde saca la información

```json
{ "options": [{"id":"a","text":"Objetivo: el resultado de negocio que buscas"},{"id":"b","text":"Orden: en qué secuencia debe responder"},{"id":"c","text":"Omisiones: lo que la IA NO debe hacer"},{"id":"d","text":"Origen: de dónde saca la información"}], "correct_option_id": "c" }
```

### 13
**Este prompt: "Actúa como contralor de una pyme. Analiza estas dos columnas y explica las cinco variaciones más grandes. El director no es financiero. Tabla con concepto, diferencia y una línea de explicación. No propongas acciones todavía." ¿Qué letra de PACTO le falta?**
- a · Perfil
- b · Acción
- c · Contexto
- d · Ninguna: están las cinco ✓

```json
{ "options": [{"id":"a","text":"Perfil"},{"id":"b","text":"Acción"},{"id":"c","text":"Contexto"},{"id":"d","text":"Ninguna: están las cinco"}], "correct_option_id": "d" }
```

### 14
**La IA te devuelve un correo que no te convence. Lo correcto es…**
- a · aceptarlo; la primera respuesta es la definitiva
- b · cambiar de herramienta
- c · decirle qué no te gustó y pedir otra versión ✓
- d · escribirlo tú desde cero

```json
{ "options": [{"id":"a","text":"aceptarlo; la primera respuesta es la definitiva"},{"id":"b","text":"cambiar de herramienta"},{"id":"c","text":"decirle qué no te gustó y pedir otra versión"},{"id":"d","text":"escribirlo tú desde cero"}], "correct_option_id": "c" }
```

### 15
**Antes de meter la IA a un proceso de la empresa, las tres preguntas son: qué resultado busco, cómo sé que quedó bien, y…**
- a · cuánto cuesta la licencia
- b · quién lo revisa y quién lo opera cada semana ✓
- c · qué modelo de IA usar
- d · si la competencia ya lo hace

```json
{ "options": [{"id":"a","text":"cuánto cuesta la licencia"},{"id":"b","text":"quién lo revisa y quién lo opera cada semana"},{"id":"c","text":"qué modelo de IA usar"},{"id":"d","text":"si la competencia ya lo hace"}], "correct_option_id": "b" }
```

### 16
**La "prueba del lunes" dice que una implementación de IA es real si…**
- a · el equipo tomó el curso completo
- b · se compró la licencia para toda la empresa
- c · cambió lo que alguien hace el lunes a las 9 de la mañana ✓
- d · hay un reporte de ROI

```json
{ "options": [{"id":"a","text":"el equipo tomó el curso completo"},{"id":"b","text":"se compró la licencia para toda la empresa"},{"id":"c","text":"cambió lo que alguien hace el lunes a las 9 de la mañana"},{"id":"d","text":"hay un reporte de ROI"}], "correct_option_id": "c" }
```

## Tarea (assignment) del Módulo 1

`allow_text = true`, `allow_files = true`.

**Instrucciones:** Sube una captura de tu Proyecto en Claude (nombre, instrucciones y lista de
archivos de conocimiento visibles) y pega el prompt de una línea — solo la A — con el que
corriste tu primera conversación dentro de él, más las primeras cinco líneas de la respuesta.
Se califica que el proyecto exista con las tres preguntas en sus instrucciones y que el prompt
sea corto. No se califica la respuesta de la IA.

## Segunda tarea del Módulo 1 · sesión 3

`academia.assignments` con `allow_text = true`, `allow_files = true`.

**Instrucciones:** Corre en Claude el prompt PACTO que armaste en el Ejercicio 1.7 del
workbook. Pega aquí (1) el prompt completo, (2) las primeras cinco líneas de lo que respondió,
y (3) una línea con qué letra cambiarías y por qué. No se califica el resultado de la IA; se
califica que las cinco letras estén y que hayas revisado la respuesta.
