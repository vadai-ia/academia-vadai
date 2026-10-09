#!/usr/bin/env bash
# v2 · render completo de una versión: bash scripts/v2-render.sh <3d|2d> <h|v> <platica|curso> [...más tripletas]
# 1080p60 (3 workers; ERRORES), audio = master WAV de su versión, copia de teléfono < 30 MB (30 fps,
# dos pasadas: a 60 fps el bitrate por cuadro no alcanza; el bitrate sale de la duración para quedar en ~28.5 MB) y verificación. render lee index.html para
# lint: se cambia por turnos y SIEMPRE se restaura la v1 (ERRORES E19).
set -u
cd "$(dirname "$0")/.."
HF="npx --yes hyperframes@0.8.140"
OUT="renders/v2"; LOGS="$OUT/logs"; mkdir -p "$LOGS"
cp index.html "$OUT/index-v1.respaldo.html"
trap 'cp "$OUT/index-v1.respaldo.html" index.html' EXIT
while [ $# -ge 3 ]; do
  estilo="$1"; formato="$2"; cierre="$3"; shift 3
  base="v2-$estilo"; [ "$cierre" = curso ] && [ "$estilo" = 2d ] && base="$base-curso"
  comp="$base.html"; [ "$formato" = v ] && comp="$base-v.html"
  id="$estilo-$formato-$cierre"
  workers=3; [ "$estilo" = 3d ] && [ "$formato" = v ] && workers=2
  inicio=$(date +%T)
  sed "s/\"default\":\"platica\"/\"default\":\"$cierre\"/" "$comp" > index.html
  $HF render --fps 60 --quality delivery --workers $workers --variables "{\"cierre\":\"$cierre\"}" --output "$OUT/$id-crudo.mp4" > "$LOGS/$id.log" 2>&1
  codigo=$?
  cp "$OUT/index-v1.respaldo.html" index.html
  echo "$id: $inicio → $(date +%T) · salida $codigo · $(grep -a 'capture ·' "$LOGS/$id.log" | tail -1 | sed 's/^ *//')"
  [ $codigo -eq 0 ] || continue
  ffmpeg -v error -y -i "$OUT/$id-crudo.mp4" -i "assets/v2/mezcla/master-$estilo-$cierre.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest "$OUT/$id.mp4"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$id.mp4"); kb=$(python -c "print(int(28.5e6*8/$dur/1000) - 128)")
  ( cd "$OUT" && ffmpeg -v error -y -i "$id.mp4" -r 30 -c:v libx264 -preset slow -b:v ${kb}k -pass 1 -passlogfile "pase-$id" -an -f mp4 NUL \
    && ffmpeg -v error -y -i "$id.mp4" -r 30 -c:v libx264 -preset slow -b:v ${kb}k -maxrate $((kb * 16 / 10))k -bufsize 6000k -pass 2 -passlogfile "pase-$id" -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 128k "$id-telefono.mp4" \
    && rm -f pase-$id* )
  node scripts/verificar-render.mjs "$OUT/$id.mp4" | tail -1
  echo "$id teléfono: $(stat -c %s "$OUT/$id-telefono.mp4") bytes"
  # entregable con nombre claro, todo en entregables/ (11-oct, nota de Alejandro: «solo quiero ver las
  # versiones finales fácilmente»): «Curso - Vertical - Para celular.mp4», «Plática gratuita - Horizontal - …»
  nom="Curso"; [ "$cierre" = platica ] && nom="Plática gratuita"
  fmt="Horizontal"; [ "$formato" = v ] && fmt="Vertical"
  mkdir -p entregables
  cp "$OUT/$id.mp4" "entregables/$nom - $fmt - Alta calidad.mp4" && cp "$OUT/$id-telefono.mp4" "entregables/$nom - $fmt - Para celular.mp4"
  [ -f "renders/v2/entregables/claude-en-tu-empresa-$cierre.srt" ] && cp "renders/v2/entregables/claude-en-tu-empresa-$cierre.srt" "entregables/$nom - $fmt - Subtitulos.srt"
  echo "$id entregado: entregables/$nom - $fmt - …"
done
echo "renders terminados $(date +%T)"
