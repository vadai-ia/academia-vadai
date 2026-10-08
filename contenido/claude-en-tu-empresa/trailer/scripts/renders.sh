#!/usr/bin/env bash
# Cadena de renders del video definitivo. Cada paso deja su log y se verifica.
#   bash scripts/renders.sh [subs] [ui] [4k] [mundo]
# Workers: 3 en 1080p y 2 en 4K (con 5, la VRAM de 6 GB y la RAM se saturan; ver ERRORES.md).
set -u
cd "$(dirname "$0")/.."
HF="npx --yes hyperframes@0.8.140"
LOGS="renders/logs"; mkdir -p "$LOGS"
pasos="${*:-subs ui 4k mundo}"
for p in $pasos; do
  inicio=$(date +%T)
  case "$p" in
    subs)  $HF render --fps 60 --format mov --workers 3 --variables '{"capas":"subs"}' --output renders/pase-subs.mov > "$LOGS/subs.log" 2>&1 ;;
    ui)    $HF render --fps 60 --format mov --workers 3 --variables '{"capas":"ui"}' --output renders/pase-ui.mov > "$LOGS/ui.log" 2>&1 ;;
    4k)    $HF render --fps 60 --quality delivery --resolution landscape-4k --workers 2 --variables '{"capas":"limpio"}' --output renders/master-limpio-4k.mp4 > "$LOGS/4k.log" 2>&1 ;;
    mundo) $HF render --fps 60 --quality delivery --workers 3 --variables '{"capas":"mundo"}' --output renders/pase-mundo.mp4 > "$LOGS/mundo.log" 2>&1 ;;
  esac
  codigo=$?
  echo "$p: $inicio → $(date +%T) · salida $codigo · $(grep -a 'capture ·' "$LOGS/$p.log" | tail -1 | sed 's/^ *//')"
  case "$p" in
    4k) node scripts/verificar-render.mjs renders/master-limpio-4k.mp4 ;;
    mundo) node scripts/verificar-render.mjs renders/pase-mundo.mp4 ;;
  esac
done
echo "cadena terminada $(date +%T)"
