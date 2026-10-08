# Quita SOLO el margen transparente de los logos oficiales (no toca el arte, el color ni la
# proporción). El PNG horizontal de VADAI trae el logo en 3839x1302 dentro de 5000x5000.
#   python -I scripts/recortar-logos.py
import sys
from pathlib import Path
from PIL import Image
raiz = Path(__file__).resolve().parent.parent
for nombre in ["vadai-horizontal.png", "totalcoach.png"]:
    src = raiz / "assets/marca" / nombre
    im = Image.open(src).convert("RGBA")
    caja = im.getchannel("A").point(lambda v: 255 if v > 0 else 0).getbbox()
    salida = src.with_name(src.stem + "-recorte.png")
    im.crop(caja).save(salida, optimize=True)
    print(nombre, im.size, "->", im.crop(caja).size)
