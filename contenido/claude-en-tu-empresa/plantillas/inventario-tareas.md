# Inventario de tareas por área

> Para el mando medio. Se llena en la sesión 4 y alimenta el Proyecto del área. La versión en
> Excel (`inventario-tareas.xlsx`) se genera con `python plantillas/construir.py` y trae las
> fórmulas; esta es la referencia de qué columnas lleva y por qué.
>
> Lógica: una tarea vale la pena pasarla a la IA si se repite, toma tiempo, y es de la columna
> "en lugar de pensar". La hoja calcula horas al año y les pone precio con los mismos supuestos
> de la calculadora de la landing (42.5 h/semana · carga social 1.35 · 46 semanas).

## Hoja 1 · Tareas

| Columna | Qué se pone | Ejemplo |
|---|---|---|
| Área | | Finanzas |
| Tarea | Un verbo y un objeto | Conciliar el banco |
| Quién la hace | Nombre | Laura |
| Frecuencia | diaria · semanal · quincenal · mensual | semanal |
| Veces por semana | número (la hoja lo deriva de la frecuencia, editable) | 1 |
| Minutos cada vez | | 180 |
| Tipo | **A** en lugar de pensar · **B** pensando | A |
| Sueldo mensual bruto de quien la hace | para el costo (se puede dejar vacío y usar el promedio del área) | 18,000 |
| Horas al año | **fórmula** = veces × minutos ÷ 60 × 46 | 138 |
| Costo al año | **fórmula** = horas al año × (sueldo × 1.35 ÷ (42.5 × 4.33)) | $9,930 |
| Candidata a IA | **fórmula** = SÍ si Tipo = A y horas al año ≥ 20 | SÍ |
| Primer paso | habilidad · conector · proyecto · prompt | habilidad "Conciliar" |
| Quién revisa | nombre | Laura → Contralor |

## Hoja 2 · Resumen por área

| Área | Tareas | Horas al año tipo A | Costo al año tipo A | Candidatas | Horas recuperables (estimado 60%) |
|---|---|---|---|---|---|
| fórmulas | | | | | |

El "60%" es el factor de realización de la landing: no toda hora tipo A se recupera entera.

## Hoja 3 · Supuestos

| Supuesto | Valor | Origen |
|---|---|---|
| Horas por semana | 42.5 | landing, `data.js` |
| Factor de carga social | 1.35 | landing |
| Semanas al año | 46 | landing |
| Factor de realización | 0.6 | landing |
| Jornada 2027 | 46 h | `jornada-40` |
| Jornada 2030 | 40 h | `jornada-40` |

## Cómo se usa en la sesión 4

1. Cada jefe de área llena entre 10 y 20 tareas. Veinte minutos.
2. Se ordena por "Costo al año" y se ven las cinco primeras candidatas.
3. Las tres primeras se vuelven la primera habilidad, el primer conector y la primera
   conversación del Proyecto del área.
4. La columna "Quién revisa" es obligatoria. Sin nombre, no es candidata.
