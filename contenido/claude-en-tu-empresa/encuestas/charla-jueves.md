# Encuestas de la charla — listas para `/admin/encuestas`

> La plataforma ya tiene esto construido (M12): QR, sala de espera con nombres en la pared,
> cuenta regresiva, barras en vivo, nube de palabras, exportación a Excel y PDF. **No hay nada
> que programar.** Esto es la especificación para darlas de alta.
>
> Se cuelgan del **curso real** ("Claude en tu Empresa"), no de uno de prueba: cada persona que
> escanea queda en `academia.participants` con nombre, correo y teléfono, y nace como
> `invitado`. Es el padrón de la charla. Se exporta desde *Resultados → Excel*.
>
> `allow_guests = true` · `show_names = true` (ver el propio nombre en la pared es lo que hace
> que la gente escanee).

## Encuesta 1 · "Charla · Arranque"

Se proyecta antes de la primera cifra. Se abren en orden; se comenta la tercera.

| # | Enunciado | Tipo | Opciones |
|---|---|---|---|
| 1 | ¿Ya usas IA en tu día a día? | `opcion` | a · Sí, todos los días · b · A veces · c · No |
| 2 | ¿Sabes si alguien de tu equipo ya la usa para trabajar? | `opcion` | a · Sí, lo sé · b · Supongo que sí · c · No tengo idea |
| 3 | ¿Sabes exactamente qué hace tu equipo con la IA y con los datos de tu empresa? | `opcion` | a · Sí · b · Más o menos · c · No |

**Cómo se lee en escena:** la barra de "No" y "Más o menos" de la pregunta 3 es el gancho del
Acto 1.6 ("tu empresa ya usa IA, solo que sin ti"). Roberto Ortiz pidió conteos, no
porcentajes; las barras de M12 muestran conteo.

## Encuesta 2 · "Charla · ¿Dónde te duele?"

Se proyecta en el Acto 3.2. Alimenta la calculadora en vivo.

| # | Enunciado | Tipo | Opciones / ajustes |
|---|---|---|---|
| 1 | ¿En qué área te duele más el tiempo perdido? | `opcion` | a · Ventas · b · Administración y finanzas · c · Atención a clientes · d · Operaciones · e · Dirección |
| 2 | ¿Cuántas personas trabajan en esa área? | `opcion` | a · 1–3 · b · 4–10 · c · 11–30 · d · más de 30 |
| 3 | ¿Qué tarea repetida se come la semana? Una o dos palabras. | `nube` | tope 3 palabras por persona |
| 4 | Del 1 al 10, ¿qué tan seguro estás de saber qué hace tu equipo con la IA hoy? | `escala` | min 1 "nada" · max 10 "totalmente" |

**Cómo se lee en escena:** la pregunta 1 elige el área para la calculadora; la 2 da el número
de personas; la nube se lee en voz alta ("conciliación", "reportes", "correos" — y se conecta
con las cuatro fugas); la escala vuelve al gancho de la 3 de arranque.

## Después de la charla

1. *Resultados → Excel*: el padrón con nombre, correo y teléfono. Ese archivo es el que Marta
   usa para el seguimiento y la invitación al grupo de WhatsApp.
2. *Resultados → PDF*: el reporte con las gráficas tal como se proyectaron, para mandarlo a
   quien pida "los datos de la charla".
3. **No reiniciar la encuesta.** Para la próxima charla se usa *Empezar la corrida N+1*, que
   deja el padrón intacto.

## Formato JSON de opciones (por si se carga por script)

```json
[{ "id": "a", "text": "Sí, todos los días" }, { "id": "b", "text": "A veces" }, { "id": "c", "text": "No" }]
```
