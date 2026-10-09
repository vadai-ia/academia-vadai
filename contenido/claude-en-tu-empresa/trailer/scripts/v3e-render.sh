#!/usr/bin/env bash
# Propuesta 3 «La escalera infinita» · render completo: bash scripts/v3e-render.sh <h|v> <platica|curso> [...más pares]
# 1080p60 con 3 workers; audio = master WAV de su versión; vertical capturado a 1088 y recortado a 1080 (ERRORES E41);
# copia de teléfono < 30 MB (30 fps, dos pasadas, bitrate por duración); verificación; entregable con nombre claro.
# render lee index.html: se cambia por turnos y SIEMPRE se restaura la v1 (ERRORES E19).
set -u
cd "$(dirname "$0")/.."
HF="npx --yes hyperframes@0.8.140"
OUT="renders/v3"; LOGS="$OUT/logs"; mkdir -p "$LOGS"
cp index.html "$OUT/index-v1.respaldo.html"
trap 'cp "$OUT/index-v1.respaldo.html" index.html' EXIT
while [ $# -ge 2 ]; do
  formato="$1"; cierre="$2"; shift 2
  comp="v3e-$cierre.html"; [ "$formato" = v ] && comp="v3e-$cierre-v.html"
  id="escalera-$formato-$cierre"
  inicio=$(date +%T)
  cp "$comp" index.html
  $HF render --fps 60 --quality delivery --workers 3 --output "$OUT/$id-crudo.mp4" > "$LOGS/$id.log" 2>&1
  codigo=$?
  cp "$OUT/index-v1.respaldo.html" index.html
  echo "$id: $inicio → $(date +%T) · salida $codigo · $(grep -a 'capture ·' "$LOGS/$id.log" | tail -1 | sed 's/^ *//')"
  [ $codigo -eq 0 ] || continue
  if [ "$formato" = v ]; then
    ffmpeg -v error -y -i "$OUT/$id-crudo.mp4" -i "assets/v2/mezcla/master-v3e-$cierre.wav" -map 0:v -map 1:a -vf "crop=1080:1920:0:0" -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 256k -shortest "$OUT/$id.mp4"
  else
    ffmpeg -v error -y -i "$OUT/$id-crudo.mp4" -i "assets/v2/mezcla/master-v3e-$cierre.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest "$OUT/$id.mp4"
  fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$id.mp4"); kb=$(python -c "print(int(28.5e6*8/$dur/1000) - 128)")
  ( cd "$OUT" && ffmpeg -v error -y -i "$id.mp4" -r 30 -c:v libx264 -preset slow -b:v ${kb}k -pass 1 -passlogfile "pase-$id" -an -f mp4 NUL \
    && ffmpeg -v error -y -i "$id.mp4" -r 30 -c:v libx264 -preset slow -b:v ${kb}k -maxrate $((kb * 16 / 10))k -bufsize 6000k -pass 2 -passlogfile "pase-$id" -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k "$id-telefono.mp4" \
    && rm -f pase-$id* )
  node scripts/verificar-render.mjs "$OUT/$id.mp4" | tail -1
  echo "$id teléfono: $(stat -c %s "$OUT/$id-telefono.mp4") bytes"
  nom="Curso"; [ "$cierre" = platica ] && nom="Plática gratuita"
  fmt="Horizontal"; [ "$formato" = v ] && fmt="Vertical"
  mkdir -p entregables
  cp "$OUT/$id.mp4" "entregables/Propuesta 3 - $nom - $fmt - Alta calidad.mp4" && cp "$OUT/$id-telefono.mp4" "entregables/Propuesta 3 - $nom - $fmt - Para celular.mp4"
  echo "$id entregado: entregables/Propuesta 3 - $nom - $fmt - …"
done
echo "renders terminados $(date +%T)"
