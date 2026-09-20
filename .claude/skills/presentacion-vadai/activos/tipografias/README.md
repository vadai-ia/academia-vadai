# Tipografías del sistema

| Rol | Familia | Archivos | Licencia | Fallback |
|---|---|---|---|---|
| Titular y cifra | Anton | `Anton-latin.woff2` (HTML) · `Anton-Regular.ttf` (instalar) | OFL 1.1 | Impact |
| Cuerpo | Inter (variable) | `Inter-latin.woff2` · `Inter-Variable.ttf` | OFL 1.1 | Segoe UI / Arial |
| Mono | JetBrains Mono (variable) | `JetBrainsMono-latin.woff2` · `JetBrainsMono-Variable.ttf` | OFL 1.1 | Consolas |

- El deck HTML **incrusta** las woff2 como data URI: un solo archivo, funciona sin red.
- El PDF de Chrome headless lleva las fuentes incrustadas como subconjuntos.
- El PPTX no puede incrustar fuentes: quien lo edite instala los TTF (`INSTALAR-FUENTES.md`
  en la carpeta de salida). Los titulares Anton van como píxeles en el fondo y no dependen de
  la instalación.
- Origen: Google Fonts (`github.com/google/fonts`, carpeta `ofl/`). Fecha: 3-sep-2026.
