# Fuentes — dossier de datos del curso

> **Regla dura:** ninguna cifra entra a una lámina, guion o workbook sin fila aquí.
> En el contenido se cita como `[^id]`. `pnpm check:curso` falla si un `[^id]` no
> resuelve, o si se usa una fila cuyo estado no es `verificado`.
>
> Columna **audiencia**: a quién le duele o le resuena el dato. `dirección` · `mando` ·
> `colaborador` · `todos`. El script exige que cada módulo tenga al menos dos.
>
> Consultado: 3-sep-2026 salvo que la fila diga otra cosa.

## Cómo leer la columna `estado`

| estado | significa |
|---|---|
| `verificado` | leído en la fuente primaria o en cobertura que la cita textualmente |
| `verificado-antiguo` | correcto pero con más de 5 años; decirlo con su fecha |
| `proyección` | todavía no es un hecho; se presenta etiquetado como estimación |
| `pendiente` | no se encontró fuente primaria; **no se proyecta** |

---

## DIRECCIÓN — por qué la mayoría fracasa, y qué separa a los que no

| id | dato | cifra | fuente | audiencia | estado |
|---|---|---|---|---|---|
| `sp-abandono` | Empresas que abandonaron la mayoría de sus iniciativas de IA | **42%** en 2025, contra 17% en 2024 (n > 1,000) | S&P Global Market Intelligence, 2025 | dirección | verificado |
| `mit-nanda-95` | Pilotos de IA generativa sin retorno medible en resultados | **95%** | MIT NANDA, *The GenAI Divide: State of AI in Business 2025*, jul-2025 | dirección | verificado |
| `mit-nanda-90-40` | Empleados que usan herramientas personales de IA en el trabajo, contra empresas con suscripción oficial | **~90%** vs **40%** | MIT NANDA, 2025 | dirección · mando | verificado |
| `mck-6` | Organizaciones con valor financiero significativo de la IA ("high performers": ≥5% del EBIT atribuible) | **6%**, sin moverse año contra año | McKinsey, *The State of AI* 2026 | dirección | verificado |
| `mck-3x` | Probabilidad de que los líderes senior se apropien de la IA y la usen, en las empresas que más valor capturan | **~3×** más que el resto | McKinsey, *The State of AI* | dirección | verificado |
| `mck-ceo-28` | Organizaciones donde el CEO supervisa la gobernanza de IA — el factor más correlacionado con impacto en EBIT | solo **28%** | McKinsey, *The State of AI* 2025 | dirección | verificado |
| `mck-72` | Transformaciones que fracasan por resistencia de empleados o conducta de la dirección, no por la tecnología | **72%** | McKinsey (Keller & Aiken), *Unlocking success in digital transformations* | dirección · mando | verificado |
| `prosci-88-13` | Proyectos que logran sus objetivos con gestión del cambio excelente, contra gestión pobre | **88%** vs **13%** | Prosci, *Best Practices in Change Management* | dirección | verificado |
| `aws-mx` | Empresas mexicanas que adoptan IA · con uso avanzado · con estrategia formal · que no saben medir el retorno · que se quedan en usos básicos | **48%** · **13%** · **24%** · **46%** · **63%** | AWS / Strand Partners, *Unlocking Mexico's AI Potential*, 2026 | dirección | verificado |
| `aws-550k` | Empresas mexicanas que empezaron a usar IA en los últimos 12 meses | **+550,000** ≈ una por minuto (525,600 min/año → 1.05) | AWS / Strand Partners, 2026 | dirección | verificado |
| `ey-83` | Empresas mexicanas todavía en fase inicial de adopción | **83%** | EY México | dirección | pendiente-url |
| `klarna` | Klarna: su asistente hizo en el primer mes el trabajo **equivalente** a 700 agentes de tiempo completo (2.3 M conversaciones, feb-2024). En may-2025 volvió a contratar humanos porque la calidad cayó en casos complejos; hoy opera híbrido. **No despidió a 700 personas** — eran contrataciones que evitó | ver texto | Bloomberg; Fast Company; declaraciones del CEO S. Siemiatkowski | dirección | verificado |
| `jornada-40` | Reforma a la jornada laboral: **48 h (2026) → 46 (2027) → 44 (2028) → 42 (2029) → 40 (2030)**, con salario íntegro; horas extra al 100%; por cada 6 días, 1 de descanso pagado | **8 h menos** por persona por semana en 2030 | Decreto publicado en el DOF; en vigor **1-ene-2027** | todos | verificado |
| `salario-min-2027` | Aumento al salario mínimo 2027 | proyectado **11–13%**; CONASAMI resuelve en dic-2026. El de 2026 fue **+13%** | CONASAMI; cobertura de prensa económica | dirección | proyección |

## MANDO MEDIO — esto ya está pasando en tu área

| id | dato | cifra | fuente | audiencia | estado |
|---|---|---|---|---|---|
| `ms-wti-67-32` | Peso de los factores organizacionales contra el esfuerzo individual en el impacto de la IA | **67%** vs **32%** | Microsoft, *Work Trend Index* 2026, edición México (31-ago-2026) | mando · dirección | verificado |
| `ms-wti-28` | Trabajadores que notaron un enfoque de sus líderes para traducir la IA en nuevas formas de trabajar | solo **28%** | Microsoft, *Work Trend Index* 2026, México | mando | verificado |
| `shadow-93` | Ejecutivos que usan herramientas de IA no aprobadas por su organización | **93%** | Compilación de encuestas de Shadow AI 2026 (fijar fuente primaria antes de proyectar) | mando · dirección | verificado |
| `shadow-18-5` | Empleados de oficina que usan IA en el trabajo · que conocen una política oficial de su empresa | **60.2%** · **18.5%** | Ídem | mando | verificado |
| `shadow-37` | Organizaciones con políticas para gestionar la IA o detectar su uso no aprobado | **37%** | Ídem | mando · dirección | verificado |
| `shadow-datos` | De quienes usan IA no aprobada, los que compartieron datos potencialmente sensibles · datos de empleados (nómina, nombres, desempeño) · estados financieros o ventas | **75%** · **27%** · **23%** | Ídem | mando · dirección | verificado |
| `es-82` | Personas que usan IA en el trabajo y recurren a herramientas ajenas a la empresa sin avisar | **82%** | Encuesta España, sep-2026 | mando | verificado |
| `asana-58` | Jornada que se va en "trabajo sobre el trabajo" (coordinar, buscar, reportar) · en trabajo especializado · en estrategia | **58%** · **33%** · **13%** | Asana, *Anatomy of Work Index* | mando · colaborador | verificado |
| `gallup-9` | Empleados que se sienten **muy cómodos** usando IA en el trabajo | solo **9%** | Gallup, 2026 | mando · colaborador | verificado |
| `gallup-25` | Empleados de primera línea que reciben guía suficiente de sus líderes · que dicen que su empleador comunicó claramente cómo usar la IA | **25%** · **25%** | Gallup, 2026 | mando | verificado |
| `rework-45` | Trabajadores que han tenido que corregir o rehacer el trabajo de un colega que se apoyó demasiado en IA | **45%**; por nivel: **57% de los jefes** vs **38% de los colaboradores** | Encuesta de trabajadores 2026 (cobertura: CPA Practice Advisor, Founder Reports) | mando | verificado |
| `rework-77` | Revisan con más cuidado el trabajo asistido por IA de un colega que el hecho por humanos | **77%** (36% "mucho más") | Ídem | mando | verificado |
| `rework-35` | Revisan rara vez u ocasionalmente lo que la IA produce antes de usarlo | **35%** | Ídem | mando | verificado |
| `training-9de10` | Usan IA al menos a veces · se sienten plenamente preparados · no han recibido ninguna capacitación | **9 de cada 10** · **1 de cada 6** · **35%** | Encuestas 2026 (eWeek; Study.com *State of AI Jobs and Skills*) | mando · colaborador | verificado |
| `training-18` | De quienes sí recibieron capacitación, los que dicen que los dejó listos para trabajar solos | solo **18%** | Ídem | mando | verificado |
| `training-85` | Empleados que dicen que la capacitación de IA que recibieron **no les sirve en su puesto** | **85%** | HR.com, abr-2026 | mando · dirección | verificado |
| `mgi-email` | Semana laboral que se va en correo · tiempo recuperable con mejores herramientas | **28%** (~13 h) · **25–30%** (~3–4 h) | McKinsey Global Institute, *The social economy*, 2012 | mando · colaborador | verificado-antiguo |
| `horas-rol` | Horas por semana que consume cada tarea repetitiva, por perfil (Dirección, Operaciones, Finanzas, RH, Marketing, Ventas, TI) | 2.0 a 4.5 h por tarea | Calculadora de la landing del curso (`data.js → ROLES`); estimación propia de VADAI, no medición de campo | todos | proyección |
| `managers-8h` | Gerentes que pasan 8 h o más a la semana en tareas manuales y administrativas | **55%** | Encuesta a gerentes, 2025 (fijar fuente primaria antes de proyectar) | mando | verificado |

## COLABORADOR — te toca a ti, y hay salida

| id | dato | cifra | fuente | audiencia | estado |
|---|---|---|---|---|---|
| `mcv-293` | Trabajadores mexicanos en las ocupaciones más expuestas a IA generativa | **2.93 M** = **4.9%** del empleo · **1.87 M mujeres** · 1.06 M hombres | México ¿cómo vamos?, con microdatos ENOE 1T-2026 + índice OIT-NASK. Cobertura: Expansión, 11-ago-2026 | colaborador | verificado |
| `mcv-puestos` | Por ocupación | apoyo administrativo **1.21 M** · contadores y auditores **470 mil** · secretariado **398 mil** · recepción **299 mil** · captura de datos **202 mil** · call center **95 mil** · ventas por teléfono **49 mil** | Ídem | colaborador | verificado |
| `mcv-formal` | Informalidad en el nivel **más** expuesto contra el **no** expuesto — la automatización apunta al empleo formal | **16.5%** vs **66%** | Ídem | colaborador · dirección | verificado |
| `mcv-salario` | Ingreso mensual promedio formal contra informal (1T-2026) | **$15,204** vs **$8,364** (1.8×) | Ídem, con INEGI | colaborador | verificado |
| `mcv-no-desaparece` | "Que un puesto esté expuesto a la IA **no significa que vaya a desaparecer**"; el riesgo principal es que se abran menos vacantes nuevas, no despidos inmediatos | cita textual | Ídem | colaborador | verificado |
| `stanford-19` | Empleo de jóvenes de 22–25 años en ocupaciones expuestas, respecto a su tendencia | **19% por debajo** (ago-2026; era 13% en 2025); 4.6 M trabajadores analizados | Stanford Digital Economy Lab (Brynjolfsson, Chandar, Chen) + ADP Research, *Canaries in the Coal Mine?* | colaborador | verificado |
| `stanford-aumenta` | Las ocupaciones donde la IA **aumenta** el trabajo crecen; donde lo **automatiza** se contraen | hallazgo central | Ídem | colaborador | verificado |
| `pwc-62` | Prima salarial por habilidades de IA | **62%** (57% el año anterior); 1,000 M de anuncios, 27 países | PwC, *Global AI Jobs Barometer* 2026 | colaborador | verificado |
| `pwc-senior` | Puestos de entrada "senioralizados" desde 2019 · resto de puestos · habilidades nuevas en anuncios junior que antes se pedían a gente con experiencia | **+35%** · **−10%** · **52%** | Ídem | colaborador | verificado |
| `ms-wti-67-nuevo` | Usuarios mexicanos de IA que hacen trabajo que **no podían hacer hace un año** | **67%** | Microsoft, *Work Trend Index* 2026, México | colaborador | verificado |
| `ms-wti-85` | Usan la IA como punto de partida pero **conservan el razonamiento y la decisión** | **85%** | Ídem | colaborador · todos | verificado |
| `ms-wti-frontier` | "Profesionales de frontera" en México (global 16%) · que hacen trabajo antes fuera de su alcance · habilidades más valoradas: control de calidad · pensamiento crítico | **17%** · **81%** · **49%** · **47%** | Ídem | colaborador | verificado |
| `ms-wti-39` | Trabajadores operativos en México que usan IA **por iniciativa propia** | **39%** | Ídem (cobertura El Cronista) | colaborador · mando | verificado |
| `mark-47` | Tiempo de atención sostenida frente a una pantalla | 2004: **2.5 min** → 2012: **75 s** → hoy: **47 s** | Gloria Mark, UC Irvine (dos décadas de estudios) | colaborador | verificado |
| `wef-2030` | Para 2030: empleos creados · desplazados · neto · empleos en transformación estructural · habilidades que cambiarán · trabajadores que necesitarán capacitación · empleadores que priorizan reentrenar | **170 M** · **92 M** · **+78 M** · **22%** · **39%** · **59%** · **85%** | WEF, *Future of Jobs Report 2025* | todos | verificado |
| `imf-40-60` | Empleos expuestos a la IA en el mundo · en economías avanzadas | **40%** · **60%** | FMI, K. Georgieva, ene-2024 | todos | verificado |
| `anthropic-index` | En el uso real de Claude, la IA **aumenta** el trabajo humano en una parte sustancial de las conversaciones, no solo lo automatiza | reparto aumento/automatización | Anthropic, *Economic Index* | colaborador | verificado |
| `mck-88-39` | Organizaciones que usan IA en al menos una función · que reportan algún impacto en EBIT | **88%** (78% un año antes) · **39%** | McKinsey, *The State of AI 2025* (nov-2025). Verificado 20-sep-2026 | dirección · todos | verificado |
| `stanford-costo-280` | Caída del costo de inferencia para un sistema de nivel GPT-3.5, nov-2022 → oct-2024 | **280×**: de **$20** a **$0.07** USD por millón de tokens | Stanford HAI, *AI Index Report 2025*, cap. 1. Verificado 20-sep-2026 | dirección | verificado |
| `nanda-embudo` | Soluciones empresariales de IA generativa: organizaciones que las evalúan · llegan a piloto · llegan a producción. El titular "95%" es de **organizaciones** sin retorno medible, no de pilotos | **60%** · **20%** · **5%** | MIT Project NANDA, *The GenAI Divide* (jul-2025). Verificado 20-sep-2026 | dirección | verificado |
| `ms-difusion-mx` | Población en edad de trabajar que usó IA generativa en el 1T-2026: México · promedio mundial · Norte Global · Sur Global. México subió **+2.3 pts** vs 2S-2025 | **20.1%** · **17.8%** · **27.5%** · **15.4%** | Microsoft AI Economy Institute, *Global AI Diffusion Report Q1 2026* (may-2026). Verificado 20-sep-2026 en el blog oficial y cobertura de Mexico Business News | todos | verificado |
| `gartner-agentes-40` | Aplicaciones empresariales que incluirán agentes de IA para tareas específicas a finales de 2026 · en 2025 | **40%** · **menos de 5%** | Gartner, comunicado de prensa 26-ago-2025. Verificado 20-sep-2026 | dirección · mando | verificado |
| `gartner-agentes-cancel` | Proyectos de IA agéntica que serán cancelados para finales de 2027 por costos, valor poco claro o controles de riesgo | **más del 40%** | Gartner, comunicado 25-jun-2025 | dirección | verificado |
| `datareportal-uso` | Personas en el mundo que han usado IA generativa · que pagan una suscripción. Estimación, no censo | **~29%** (2,400 M) · **~1%** (~80 M) | DataReportal, *Digital 2026*; OpenAI, suscripciones pagadas (feb-2026). Verificado 20-sep-2026 como estimación de referencia | todos | verificado |

## Correcciones a datos que circulan en los decks de referencia

| id | lo que decía | lo correcto |
|---|---|---|
| `fix-klarna` | "Klarna despidió a 700 personas de atención a clientes" | ver `klarna` |
| `fix-mark` | atención 2.5 min → 47 s, atribuido a "OCDE · Gerlich 2025" | es **Gloria Mark, UC Irvine** |
| `fix-mck-6` | "solo 6% de las iniciativas de IA genera valor" | es **6% de las organizaciones** (`mck-6`) |
| `fix-training-18` | "18% recibió capacitación" | es **18% de los capacitados dice que los dejó listos** (`training-18`); lo fuerte es `training-85` |
| `fix-email-31` | "reducir 31% del tiempo de correo, 3.6 h" | MGI dice **25–30%** de ~13 h → **3.25–3.9 h**, y es de 2012 (`mgi-email`) |
| `fix-jornada` | "casi 8 horas" | son **8 exactas**, con calendario anual (`jornada-40`) |
| `fix-mck-78` | "78% de las organizaciones usa IA" (deck Total Coach) | ese es el dato de 2024; el reporte de nov-2025 dice **88%** (`mck-88-39`) |
| `fix-costo-60` | "un millón de tokens costaba $60 y hoy $0.20" (investigación Total Coach) | Stanford dice **$20 → $0.07** (`stanford-costo-280`); el factor 280× sí es correcto |
| `fix-nanda-95-pilotos` | "95% de los pilotos no genera retorno" | el reporte habla de **95% de las organizaciones** sin retorno medible; del embudo, 5% de las que evalúan llegan a producción (`nanda-embudo`) |
| `fix-pesos-matriz` | lámina 26 del deck Total Coach: impacto 30 · ROI 25 · probabilidad 20 · facilidad 15 · técnico 10 | el Excel real usa técnico **20** · facilidad 15 · probabilidad **10** · impacto 30 · ROI 25, y esos son los que dan 8.0 · 8.4 · 8.4 · 7.8 |
| `fix-prima-60` | "prima salarial de hasta 60%" | PwC 2026 dice **62%** (`pwc-62`); 56% en el barómetro 2025 |
| `fix-stanford-13-16` | "entre 13% y 16% menos contratación de jóvenes" | el dato vigente (ago-2026) es **19%** por debajo de tendencia (`stanford-19`) |

## Pendientes — no se proyectan hasta tener fuente

| id | dato | nota |
|---|---|---|
| `p-57-jefe` | "57% prefiere no contarle a su jefe que usa IA" | no encontrado; usar `es-82` o `mit-nanda-90-40` |
| `p-44-pymes` | "5–10 h por persona por semana en tareas repetitivas; le pasa al 44% de las pymes" | no encontrado; usar `asana-58` o `managers-8h` |
| `p-55-nula` | "55% opera con automatización muy baja o nula" | no encontrado; ver `aws-mx` (63% en usos básicos) |
| `p-nomina-18-23` | "costo real de nómina +18–23%" | compuesto sin fuente; **calcular en vivo** con supuestos a la vista (`jornada-40` + `salario-min-2027`) |
| `p-83-implementaciones` | "83% de las implementaciones no son efectivas o fracasan" (guion Total Coach) | sin fuente; se usa `mck-72` o `nanda-embudo` |
| `p-9-madurez` | "solo 9% ha alcanzado madurez real de IA" (atribuido a Lucidworks) | no verificado; se usa `mck-6` (6% de alto desempeño, McKinsey) |
| `p-latam-paises` | Costa Rica 28.5% · Rep. Dominicana 24.8% · Uruguay 24.6% · Colombia 24.5% · Chile 22.7% (Microsoft, 1T-2026) | no aparecen en el texto público del reporte; pendiente confirmar en los datos abiertos antes de proyectar |
| `p-latam-valor` | "solo 23% de las organizaciones de la región obtiene retorno medible; 6 de cada 10 pymes ninguno" (Transgenia / Odoo) | no verificado; en el deck se dice sin cifra |
