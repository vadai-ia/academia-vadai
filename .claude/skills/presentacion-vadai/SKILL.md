---
name: presentacion-vadai
description: >-
  Construye presentaciones con la identidad visual de VADAI a partir de un laminas.md:
  Anton en titulares con una palabra en coral, Inter en cuerpo, mesa clara #EAF4FA y navy
  #0A1A2F para momentos, ventanas de cielo, fichas con sombra teñida, retícula asimétrica de
  12 columnas. Genera deck web (html), PDF vectorial con fuentes incrustadas y PPTX híbrido
  editable, exige que toda cifra cite una fila verificada de fuentes.md, y obliga a renderizar
  cada lámina a imagen y mirarla contra una lista de anti-patrones antes de entregar. Úsala
  cuando se pidan láminas, deck, slides, presentación, keynote, material para proyectar o para
  una sesión del curso; cuando se cree o edite cualquier laminas.md; o cuando un deck "parece
  hecho con IA" o "de consultor".
paths:
  - "contenido/**/laminas.md"
  - "presentacion/**"
  - ".claude/skills/presentacion-vadai/**"
allowed-tools:
  - Bash(python ${CLAUDE_SKILL_DIR}/scripts/verificar.py *)
  - Bash(python ${CLAUDE_SKILL_DIR}/scripts/construir.py *)
  - Bash(python ${CLAUDE_SKILL_DIR}/scripts/miniaturas.py *)
  - Bash(python ${CLAUDE_SKILL_DIR}/scripts/sincronizar-tokens.py *)
  - Read
  - Glob
  - Grep
metadata:
  marca: vadai
  contrato-laminas: v2
---

# Presentaciones VADAI

Una fuente (`laminas.md`), tres salidas (html · pdf · pptx), cero dependencias nuevas: Python
3.12 con python-pptx, Pillow y PyMuPDF, y el Chrome del sistema en modo headless. Todo lo que
sale de aquí se ve como la landing de `claude-en-tu-empresa.vadai.com.mx`.

## Antes de escribir una lámina

1. Lee `referencias/marca.md` (qué color para qué) y `referencias/arquetipos.md` (los 12
   tipos de lámina y su composición). No inventes un tipo nuevo: elige el que corresponde al
   contenido.
2. Lee `referencias/contrato-laminas.md`: es la gramática exacta que el motor entiende.
3. Toda cifra necesita una fila con estado `verificado` en
   `contenido/claude-en-tu-empresa/fuentes.md`. Si no existe, primero la fila con su fuente
   primaria; si no hay fuente, la cifra no se proyecta.

## El flujo (no se salta ningún paso)

```
1  escribir/editar   contenido/<curso>/<deck>/laminas.md         (contrato v2, con `concepto:`)
2  verificar         python ${CLAUDE_SKILL_DIR}/scripts/verificar.py <laminas.md> --imagenes
                     → si falla, se corrige el contenido; NO se construye
3  construir         python ${CLAUDE_SKILL_DIR}/scripts/construir.py <laminas.md>
                     → presentacion/salida/<deck>.html · .pdf · png/ · .pptx
4  mirar             python ${CLAUDE_SKILL_DIR}/scripts/miniaturas.py <deck>
                     → presentacion/salida/<deck>-hoja.png : LEER la imagen con Read y revisarla
                       contra referencias/antipatrones.md (desbordes, pisadas, dos láminas
                       iguales seguidas, bloque gris de texto, cifra sin colchón)
5  corregir          volver a 1 o a 3 hasta que la hoja pase limpia
6  entregar          html para proyectar · pdf para enviar · pptx + INSTALAR-FUENTES.md para editar
```

El paso 4 es el que separa este skill del generador que el cliente rechazó: aquel generaba y
nadie miraba. **Aquí se mira siempre.**

## Reglas que el motor hace cumplir solo

- Anton en titular y cifra; Inter en cuerpo; JetBrains Mono en prompts. Autohospedadas.
- Un `**acento**` por titular. Coral sobre navy/cielo; azul profundo sobre claro. Lima solo en
  botones y en la pantalla de ejercicio.
- Retícula de 12 columnas, texto nace en x = 96. Nada centrado por defecto.
- Cuatro tamaños de titular por longitud, apilado vertical calculado (nunca coordenadas fijas).
- Pie de fuente en coordenada fija en toda lámina con cifra.
- Perfil `video` por defecto: cuerpo ≥ 32 px, navy ≤ 25 % del deck, sin degradados sutiles.
- El logo de Claude no se dibuja. CLAUDE es texto.

## Cuando algo no encaja

- ¿La lámina necesita más de 30 palabras? Son dos láminas.
- ¿Una tabla de más de 7 filas? Es un ranking con barras de las 5 primeras y "y N más".
- ¿Una demo? Tres láminas: contrato · demo (con `respaldo:`) · conclusión.
- ¿Hace falta una imagen que no existe? Ver `referencias/ilustracion.md`: primitiva SVG,
  captura real o generación con paleta bloqueada, siempre pasando por la compuerta de estilo.

## Evaluaciones

`evaluaciones/` trae tres escenarios: deck nuevo desde cero, cifra sin fuente (debe negarse),
y rescate de un deck que parece hecho con IA (debe detectar los anti-patrones en la hoja).
