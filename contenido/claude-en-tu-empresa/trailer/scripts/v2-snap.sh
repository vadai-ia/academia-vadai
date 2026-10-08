#!/usr/bin/env bash
# v2 · cuadros de revisión de una composición que no es index.html (ERRORES E19).
#   bash scripts/v2-snap.sh <composición.html> <platica|curso> <t1,t2,…> <carpeta de salida>
# snapshot no acepta --variables: el cierre se fija cambiando el default en la copia temporal.
set -u
cd "$(dirname "$0")/.."
comp="$1"; cierre="$2"; ts="$3"; out="$4"
respaldo="$(mktemp)"
cp index.html "$respaldo"
trap 'cp "$respaldo" index.html; rm -f "$respaldo"' EXIT
sed "s/\"default\":\"platica\"/\"default\":\"$cierre\"/" "$comp" > index.html
rm -rf "$out"
npx --yes hyperframes@0.8.140 snapshot . --at "$ts" --no-end --timeout 120000 --describe false -o "$out" 2>&1 | grep -iE "error|fail|saved" | grep -v "^ *C:"
