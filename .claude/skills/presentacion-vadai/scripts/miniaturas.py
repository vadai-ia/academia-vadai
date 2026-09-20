#!/usr/bin/env python
"""
miniaturas.py — hoja de contacto de un deck, para MIRARLA antes de entregar.

    python miniaturas.py modulo-0                 # lee presentacion/salida/modulo-0/png/*.png
    python miniaturas.py modulo-0 --video         # además simula pantalla compartida (1280×720, JPEG q55)

Produce presentacion/salida/<deck>/<deck>-hoja.png (5 columnas, con número y tipo de cada
lámina) y, con --video, <deck>-hoja-video.png. Después: Read de la imagen y revisión contra
referencias/antipatrones.md. Este paso no se salta.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).parent))
from laminas import leer_deck, raiz_repo  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

COLS, W = 5, 384  # ancho de miniatura


def hoja(pngs: list[Path], etiquetas: list[str], destino: Path, simular_video: bool) -> None:
    H = int(W * 9 / 16)
    filas = (len(pngs) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * (W + 16) + 16, filas * (H + 40) + 16), (234, 244, 250))
    d = ImageDraw.Draw(sheet)
    try: fuente = ImageFont.truetype(str(Path(__file__).parent.parent / "activos" / "tipografias" / "Inter-Variable.ttf"), 16)
    except Exception: fuente = ImageFont.load_default()
    for i, (p, et) in enumerate(zip(pngs, etiquetas)):
        im = Image.open(p).convert("RGB")
        if simular_video:
            im = im.resize((1280, 720), Image.LANCZOS)
            import io
            buf = io.BytesIO(); im.save(buf, "JPEG", quality=55, subsampling=2); buf.seek(0); im = Image.open(buf)
        im = im.resize((W, H), Image.LANCZOS)
        x, y = 16 + (i % COLS) * (W + 16), 16 + (i // COLS) * (H + 40)
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x + W - 1, y + H - 1], outline=(210, 227, 236))
        d.text((x, y + H + 8), et, fill=(10, 26, 47), font=fuente)
    sheet.save(destino)


def main() -> int:
    if len(sys.argv) < 2: print(__doc__); return 2
    raiz = raiz_repo(Path(__file__))
    slug = sys.argv[1]
    out = raiz / "presentacion" / "salida" / slug
    pngs = sorted((out / "png").glob("*.png"))
    if not pngs: print(f"  no hay png en {out / 'png'} — corre construir.py primero"); return 1
    # etiquetas con el tipo, si el laminas.md está a la mano
    etiquetas = [p.stem for p in pngs]
    for cand in (raiz / "contenido").rglob("laminas.md"):
        try:
            deck = leer_deck(cand)
            if deck.slug == slug:
                tipos = {f"{l.n:02d}": l.tipo for l in deck.laminas}
                etiquetas = [f"{p.stem} · {tipos.get(p.stem, '')}" for p in pngs]; break
        except Exception: pass
    hoja(pngs, etiquetas, out / f"{slug}-hoja.png", False)
    print(f"  ✓ {out / f'{slug}-hoja.png'}")
    if "--video" in sys.argv:
        hoja(pngs, etiquetas, out / f"{slug}-hoja-video.png", True)
        print(f"  ✓ {out / f'{slug}-hoja-video.png'}  (simulación de pantalla compartida)")
    print("  → Read de la hoja y revisión contra referencias/antipatrones.md antes de entregar.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
