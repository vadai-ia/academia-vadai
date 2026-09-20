# Marca — color, tipo y sus reglas de aplicación

> Extraído del CSS real de la landing (`base.css`, `landing.css`) el 3-sep-2026. Los valores
> viven en `activos/tokens.json`; este archivo dice **para qué sirve cada uno y cuándo no**.
> Patrón: color → rol → regla de aplicación → fallback.

## Colores por rol

| Token | Hex | Se usa para | Nunca para |
|---|---|---|---|
| `ink` | `#0A1A2F` | fondo navy de portada, sección, demo, cierre; titular sobre claro | fondo de láminas de contenido en perfil video (máx. 25% del deck) |
| `text` / `text2` / `text3` | `#072835` / `#4E6572` / `#859AA6` | cuerpo · secundario y eyebrow · pie de fuente, sobre claro | — |
| `accent` | `#00A0DB` | acento sobre navy; barras; serie 2 de gráfica | **texto sobre blanco o mesa** (2.8:1, reprueba AA) |
| `accentDeep` | `#006E96` | acento de titular y cifra sobre claro (5.4:1); serie 1 | — |
| `accent2` | `#4FC6EE` | extremo alto del cielo; acento de titular sobre navy | serie de gráfica; texto sobre claro |
| `coral` | `#FFB489` | la palabra CLAUDE; bloque de acento del titular sobre navy o cielo | serie de gráfica; texto de cuerpo; más de una vez por lámina |
| `lime` | `#C6F24E` | botones; la pantalla "tu turno" del ejercicio | **titulares, viñetas, filetes decorativos** |
| `surface` / `canvas` | `#EAF4FA` / `#FFFFFF` | mesa base · ficha y ventana | — |
| `line` / `lineStrong` | `#D2E3EC` / `#B3D0DE` | filete de 1 px entre filas; borde de chip | filetes bajo títulos, barras decorativas |
| `success` / `error` | `#12A150` / `#C4342C` | estado, siempre con ícono + texto | color como único portador de significado |

**Contraste verificado** (WCAG): navy sobre mesa 14.9:1 · `accentDeep` sobre blanco 5.4:1 ·
blanco sobre navy 17:1 · coral sobre navy 9.4:1 · cyan sobre navy 6.4:1 · lime-ink sobre lima
11:1 · **blanco sobre cyan 2.9:1 → prohibido para cifras**.

## Tipografía

| Rol | Familia | Cómo | Fallback (PPTX sin fuente) |
|---|---|---|---|
| Titular y cifra | **Anton** | mayúsculas, tracking −0.01em, interlínea 0.92, tamaños fijos 176 / 152 / 120 / 96 por longitud | Impact |
| Cuerpo, eyebrow, pie | **Inter** | 450 cuerpo, 600 eyebrow con +0.12em, interlínea 1.4 | Segoe UI / Arial |
| Prompts, valores, URLs | **JetBrains Mono** | 400–500, tabular | Consolas |

Las tres son OFL 1.1 y viajan **autohospedadas** en `activos/tipografias/` (woff2 para HTML;
TTF para instalar en la máquina de quien edita el PPTX). Nunca desde Google Fonts en un deck que
se proyecta: sin WiFi el titular cae al fallback frente al cliente.

## Dispositivos gráficos de la landing que se heredan

- **Píldora con punto** (eyebrow): `● Sesión 1 · 07 / 34`, radio 100, borde 1 px, 20 px, +0.12em.
  Es la marca de sección del sistema.
- **Botón lima** con flecha en círculo navy; **botón navy**; **botón fantasma** con borde.
- **Ficha / ventana**: blanco, radio 22, borde 1 px `line`, sombra sh-2 sobre mesa; sobre navy,
  `navyPanel` con borde `rgba(255,255,255,.14)` y sin sombra.
- **Barra "01 / 03"** y **chips con ícono** (Lucide, un solo set, dentro de cuadro redondeado).
- **Ventana de cielo**: bloque radio 32 con el degradado `cielo`, sin texto encima.
- **Mock-UI** `dashboard` / `doc` / `mail` / `deck`: la ilustración de producto de la landing,
  dibujada en HTML con los tokens (ver `arquetipos.md`).

## Marcas ajenas

- **El logo de Claude no se dibuja.** Lineamientos de Anthropic: *"only use our trademarks as
  specifically permitted by us and only in materials we approve beforehand"*; *"no alterations
  (changes to color, font, proportion…)"*. La palabra **CLAUDE** va como texto en Anton coral.
  Permisos: marketing@anthropic.com.
- Excel, Word, Outlook, Gmail se nombran en texto o con el ícono genérico de Lucide.

## Lo que la marca NO es

Inter en titulares · degradado morado · negro puro · tres tarjetas en fila · todo centrado ·
franja de color en el borde de una tarjeta · línea de acento bajo el título · emoji · foto de
stock · iconos de dos sets. Ver `antipatrones.md`.

## Corrección del 3-sep-2026 (jurado de tres lentes, verificada en `landing.css`)

- **Acento sobre navy o azul = lima.** `.vband__big em` y `.why--band .why__title em` usan
  `var(--brand-lime)`. El coral `#FFB489` es exclusivo de la palabra CLAUDE
  (`.hero__title-claude`). Antes este documento decía lo contrario; mandaba la memoria, no el CSS.
- **El texto no se apoya en el degradado cielo.** El cielo es una ventana de 706×784 en las
  columnas 8–12 (portada, sección, número con imagen) y no lleva texto: sobre `#00A0DB` el
  blanco da 2.9:1. El fondo oscuro es la banda `.vband` de la landing (165deg), no navy plano.
- **Eyebrow = `.badge`**: fondo `#DFF4FC`, texto `#006E96` peso 450, punto de 18 px cyan con
  anillo blanco; sobre oscuro, `.badge--on-blue`. No es la `.pill` con borde.
- **Pie de fuente sin filete lima**: etiqueta FUENTE en JetBrains Mono 14 px y texto en `#4E6572`
  (el `#859AA6` se perdía en proyector). La lima como filete decorativo es anti-patrón.
- **Retícula**: margen 96, 12 columnas de 122, canal 24 (col 8 en x = 1118). El 120.67 anterior
  no cuadraba.
