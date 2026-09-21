# Sesión 1 · Alineación — carpeta definitiva

> El primer día del curso. La sesión de alineación diseñada por Roberto Martínez Ortiz (Total
> Coach): WIIFM, quiénes somos, la IA hoy, diagnóstico personal, metodología de decisión y
> alineación por empresa. Construida el 20-sep-2026 con el sistema visual del curso
> (`.claude/skills/presentacion-vadai/`), a partir del guion "Etapa 1 WIIFM", el deck de 35
> láminas de Total Coach y su documento de investigación.

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `laminas.md` | La única fuente. 35 láminas, una por cada una del deck de Total Coach; se edita aquí y se reconstruye con `construir.py`. |
| `entregables/sesion-1-alineacion.pptx` | Para Total Coach: **todo el texto es editable** (titulares en Anton con el resaltado coral nativo, cifras, etiquetas, filas de tabla, pies y notas). Las barras son rectángulos nativos; solo las ilustraciones, fichas blancas e íconos viajan en la imagen de fondo. Instalar las fuentes de `entregables/fuentes/` antes de abrir, o Anton se sustituye. |
| `entregables/sesion-1-alineacion.pdf` | 1920×1080, fuentes incrustadas. Para entregar y para adjuntar a la lección. |
| `entregables/sesion-1-alineacion.html` | El deck para proyectar: flechas, F pantalla completa, funciona sin internet. |
| `entregables/hoja-de-decision.xlsx` | La hoja de decisión que usan las empresas en las salas, con fórmulas vivas y el ejemplo de la aseguradora. |
| `hoja-de-decision.py` | Genera el xlsx. |

## Estructura

Las 35 láminas del deck de Total Coach, en el mismo orden y con su etiqueta de etapa en la
cinta superior. Lo que cambió es la forma: 16 láminas llevan ilustración a un lado y el texto
corto al otro; 4 son gráficas de barras con escala honesta y fuente al pie; 3 son comparaciones
de dos columnas; 3 son encuestas en vivo (13, 16 y la expectativa) **sin QR de relleno**, porque
el QR se proyecta en tiempo real desde la academia; 3 son ejercicios cronometrados (17, 21, 30);
y la 27 muestra la hoja de decisión real. La lámina 5 no lleva nombres ni firmas.

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

- **Las tres encuestas** (láminas 13, 16 y la expectativa) se crean en el panel de la academia
  antes de la sesión; el QR se proyecta en vivo desde ahí, no desde el deck.
- **Los países de América Latina** vuelven a la lámina 17 en cuanto se confirmen en los datos
  abiertos del reporte (`p-latam-paises` en `fuentes.md`).
- Nada de esto está commiteado.
