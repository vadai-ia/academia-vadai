# Sesión 1 · Alineación — carpeta definitiva

> El primer día del curso. La sesión de alineación diseñada por Roberto Martínez Ortiz (Total
> Coach): WIIFM, quiénes somos, la IA hoy, diagnóstico personal, metodología de decisión y
> alineación por empresa. Construida el 20-sep-2026 con el sistema visual del curso
> (`.claude/skills/presentacion-vadai/`), a partir del guion "Etapa 1 WIIFM", el deck de 35
> láminas de Total Coach y su documento de investigación.

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `laminas.md` | La única fuente. 55 láminas; se edita aquí y se reconstruye con `construir.py`. |
| `entregables/sesion-1-alineacion.pptx` | Para Total Coach: fondo en imagen, cuerpo y notas como texto editable en Inter. Instalar las fuentes de `entregables/fuentes/` antes de abrir. |
| `entregables/sesion-1-alineacion.pdf` | 1920×1080, fuentes incrustadas. Para entregar y para adjuntar a la lección. |
| `entregables/sesion-1-alineacion.html` | El deck para proyectar: flechas, F pantalla completa, funciona sin internet. |
| `entregables/hoja-de-decision.xlsx` | La hoja de decisión que usan las empresas en las salas, con fórmulas vivas y el ejemplo de la aseguradora. |
| `hoja-de-decision.py` | Genera el xlsx. |

## Estructura (sigue el deck original de Total Coach, con las etapas numeradas 1 a 5)

Etapa 1 · WIIFM (láminas 2–6) · Etapa 2 · Quiénes somos (7–9) · Etapa 3 · La IA hoy, América
Latina, futuro del trabajo (10–24) · Etapa 4 · Diagnóstico personal, liderazgo, tu proyecto,
por qué no se implementan, metodología (25–46) · Etapa 5 · Alineación por empresa, salas,
portavoz, salón general (47–51) · Lo que viene, tarea, cierre (52–55).

**Interactivo:** tres encuestas en vivo (26, 28, 30), tres ejercicios cronometrados (31, 36, 49)
y las salas por empresa. **Gráficas:** nueve de barras, todas con escala honesta y fuente al pie.

## Cifras: qué se verificó y qué cambió respecto al deck original

Todas las cifras proyectadas tienen fila `verificado` en `../fuentes.md`. Lo que se corrigió:

| En el deck original | Aquí | Por qué |
|---|---|---|
| 78% usa IA (McKinsey) | **88%** | 78% era el dato de 2024; el reporte de nov-2025 dice 88% |
| $60 → $0.20 por millón de tokens | **$20 → $0.07** | así lo publica Stanford; el factor 280× sí era correcto |
| 9% madurez real (Lucidworks) | **6%** de alto desempeño (McKinsey) | el 9% no se pudo verificar |
| 83% de implementaciones fracasan | **72%** por razones humanas (McKinsey) | el 83% no tiene fuente |
| 95% de los **pilotos** sin retorno | 95% de las **organizaciones**; embudo 60 → 20 → 5 | así lo dice MIT NANDA |
| 60% prima salarial | **62%** | PwC 2026 |
| 13–16% menos contratación joven | **19%** | dato vigente de Stanford, ago-2026 |
| Pesos 30/25/20/15/10 (lámina 26) | **20/15/10/30/25** | son los del Excel real, y los únicos que dan 8.0 · 8.4 · 8.4 · 7.8 |
| Costa Rica 28.5 · Colombia 24.5 · Chile 22.7 | **fuera** | no aparecen en el texto público del reporte de Microsoft; México 20.1, mundial 17.8, Norte 27.5 y Sur 15.4 sí |

## Pendientes

- **Códigos de encuesta.** Las láminas 26, 28 y 30 traen un QR de relleno. Se crean las tres
  encuestas en el panel de la academia (`/admin`, encuestas en vivo), se ponen los códigos en
  `laminas.md` y se reconstruye.
- **Los presentadores.** La lámina 8 lleva nombres y firma; faltan fotos y una línea de
  trayectoria de cada uno si se quieren mostrar.
- **Los países de América Latina** vuelven a la lámina 17 en cuanto se confirmen en los datos
  abiertos del reporte (`p-latam-paises` en `fuentes.md`).
- Nada de esto está commiteado.
