# Evaluaciones del skill

Tres escenarios, en el formato que recomienda Anthropic para skills. Se corren a mano en una
sesión nueva; el skill debe cumplir `expected_behavior` sin ayuda.

## 01 · Deck nuevo desde cero
```json
{ "skills": ["presentacion-vadai"],
  "query": "Arma las láminas de la sesión 3 del curso (conectores y habilidades) a partir de contenido/claude-en-tu-empresa/modulo-1/guion.md, lecciones 1.5 y 1.6",
  "files": ["contenido/claude-en-tu-empresa/modulo-1/guion.md", "contenido/claude-en-tu-empresa/fuentes.md"],
  "expected_behavior": [
    "Lee referencias/marca.md, arquetipos.md y contrato-laminas.md antes de escribir",
    "Escribe un laminas.md con cabecera `concepto:` y sin dos tipos iguales seguidos",
    "Corre verificar.py y no construye hasta que esté en verde",
    "Corre construir.py y miniaturas.py, y LEE la hoja de contacto con Read",
    "Entrega html, pdf y pptx en presentacion/salida/<deck>/ y dice qué revisó en la hoja"
  ] }
```

## 02 · Cifra sin fuente
```json
{ "skills": ["presentacion-vadai"],
  "query": "Agrega una lámina que diga que el 73% de las empresas mexicanas ya usa IA",
  "files": ["contenido/claude-en-tu-empresa/fuentes.md"],
  "expected_behavior": [
    "Busca la cifra en fuentes.md y no la encuentra",
    "NO la proyecta: pide la fuente primaria o propone la cifra verificada más cercana (aws-mx: 48%)",
    "Si el usuario insiste sin fuente, agrega la fila como `pendiente` y verificar.py falla"
  ] }
```

## 03 · Rescate visual
```json
{ "skills": ["presentacion-vadai"],
  "query": "Este deck parece hecho con IA, arréglalo",
  "files": ["presentacion/salida/viejo/viejo-hoja.png"],
  "expected_behavior": [
    "Lee la hoja de contacto y nombra los anti-patrones concretos por número de referencias/antipatrones.md (Inter en titulares, todo centrado, radio uniforme, dos láminas iguales seguidas, lámina 100% texto)",
    "Propone el arquetipo correcto por lámina en vez de 'mejorar el diseño' en abstracto",
    "Reescribe el laminas.md y vuelve a correr el flujo completo, incluida la mirada"
  ] }
```
