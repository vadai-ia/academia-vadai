# Comercial Zafiro — la empresa de ejemplo del curso

> **Es ficticia.** No existe, no se parece a ningún cliente y ninguna cifra de aquí es real.
> Se inventó el 7-sep-2026 para que las demos de los módulos 2 a 5 encadenen entre sesiones:
> el mismo negocio, la misma gente y los mismos archivos de la sesión 5 a la 8.
>
> **Regla:** nada de Comercial Zafiro se proyecta como dato del mundo. Vive en prompts de demo,
> en tablas rotuladas y en los archivos de práctica. Nunca en una lámina de tipo `numero`, que
> es donde van las cifras verificadas de `fuentes.md`.
>
> **Por qué una empresa inventada y no una real:** una empresa de la sala exige permiso y
> anonimizado que no se pueden preparar antes del curso, y usar cifras de VADAI o Total Coach
> expone números internos frente a clientes.

## El negocio

Distribuidora de insumos industriales en Querétaro: tornillería, abrasivos y equipo de
seguridad. **62 personas.** Vende a talleres, constructoras y plantas medianas del Bajío.

| | |
|---|---|
| Clientes activos | 340 |
| Productos en catálogo | 1,800 |
| Rutas de reparto | 4, con dos camionetas propias |
| Sistemas que usan | Excel, correo, un ERP viejo de inventarios, WhatsApp |
| Lo que no tienen | CRM, tablero de indicadores, reglas escritas de información |

## Las siete áreas y quién las lleva

| Área | Persona | Su dolor en una línea |
|---|---|---|
| Dirección | Ing. Salas | decide con reportes que llegan el miércoles |
| Operaciones | Memo | captura lo mismo en el ERP y en Excel |
| Finanzas | Lucía | el cierre se le come la primera semana del mes |
| Recursos Humanos | Paty | contesta las mismas dudas todos los días |
| Marketing | Karla | escribe el mismo mensaje para cinco canales |
| Ventas | Diego | cotiza a mano y el seguimiento se le cae |
| TI / Sistemas | Beto | los mismos tickets, una y otra vez |

## Cifras del negocio (inventadas, coherentes entre sí)

| Concepto | Valor |
|---|---|
| Venta mensual | $8.4 millones |
| Margen bruto | 28% |
| Días de cobro (DSO) | 41 días |
| Entregas a tiempo (OTIF) | 91.5% |
| Rotación de personal anual | 18% |
| Ticket promedio | $24,700 |

## Nombres que se repiten en las demos

- **Clientes:** Metálicos Reyna · Talleres Bermúdez · Constructora Ocotlán · Herrajes del Centro
- **Proveedores:** Aceros Poniente · Abrasivos Tepeji · Seguridad Industrial Nava
- **Archivos:** `Ventas_agosto.xlsx` · `Estado_cuenta_banco2.pdf` · `Lista_precios_sep.xlsx` ·
  `Incidencias_ruta3.docx` · `Encuesta_clima_2026.xlsx` · `Tickets_agosto.csv`

## Cómo se usa en cada módulo

| Módulo | Qué se demuestra con Zafiro |
|---|---|
| 2 · Excel, Word y correo | cruzar `Ventas_agosto.xlsx` con la lista de precios; cotización en el formato de Zafiro; bandeja del lunes |
| 3 · Dashboard y reportes | el tablero semanal de Zafiro como artefacto de Claude, con sus seis indicadores |
| 4 · Áreas | una tarea real por cada una de las siete personas de la tabla de arriba |
| 5 · Alineación | las reglas de información y el plan de adopción de Zafiro, área por área |

## Los archivos de práctica

Se generan con `scripts/empresa-demo.mjs` y se entregan como adjuntos de la lección: cinco
archivos que el alumno descarga y usa en su propia cuenta durante la sesión. Si alguien prefiere
trabajar con los suyos, mejor: Zafiro es la red de seguridad, no la meta.
