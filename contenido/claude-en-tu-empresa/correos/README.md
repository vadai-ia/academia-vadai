# Correos comerciales

`comercial-mas-informacion.plantilla.html` es la plantilla. Se llenan cuatro huecos:
`{{SALUDO}}`, `{{PARRAFO_EMPRESA}}`, `{{EMPRESA}}`, `{{REMITENTE}}` y `{{PUESTO}}`.

Cada destinatario tiene dos archivos: el `.html` que se pega en el correo y el `.txt` que va
como versión de texto plano. Mandar las dos versiones mejora la entrega y evita que el correo
caiga en spam.

## Cómo se manda

1. Abre el `.html`, selecciona todo y pégalo en el cuerpo del correo (Gmail y Outlook conservan
   el formato de tabla). O súbelo como plantilla en la herramienta de envío.
2. El asunto va en la tabla de abajo.
3. Manda **uno por uno**, no en copia oculta masiva: son clientes que preguntaron, no una lista.

| Destinatario | Archivo | Asunto |
|---|---|---|
| Telas Bayón | `telas-bayon.html` | Telas Bayón · el curso de IA para su equipo, en una página |
| Telas Artell | `telas-artell.html` | Telas Artell · el curso de IA para su equipo, en una página |

## Antes de mandarlo, confirmar

- **Los dos precios.** $4,900 por persona y $24,890 empresarial hasta 10 personas salen de lo que
  Roberto Ortiz dijo en la junta del 2-sep y del `precio` en `data.js` de la landing. La landing
  publica solo el de 24,890. Si el de 4,900 cambió, se corrige en los dos archivos.
- **Quién firma.** Hoy dice Alejandro Martínez, director general. Si lo manda Robe o Marta, se cambia.
- **El correo de respuesta** desde el que sale, para que las respuestas lleguen a quien atiende.

## Lo que este correo NO usa, a propósito

- **Los testimonios de la landing**: están marcados como inventados en el código. Publicar reseñas
  falsas es sancionable por PROFECO. Van cuando haya reales, con permiso de quien las dio.
- **El contador de oferta**: la fecha de la landing venció el 10 de agosto. Meter una urgencia
  falsa a un cliente que apenas preguntó es la forma más rápida de perderlo.
- **Cifras de ahorro prometidas**: nada de "recupera X horas". Lo que se promete es el temario.
