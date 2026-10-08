# v2 · hojas de revisión del vertical: cada cuadro de un snapshot a 1/3, con la zona segura de redes
# (Reels / TikTok / Shorts) marcada encima. Lo que importa (texto, flecha, logos) va dentro del recuadro.
#   python scripts/v2-hoja-vertical.py <carpeta de snapshot> [cuadros por hoja]
import sys, re, pathlib
from PIL import Image, ImageDraw

# zona segura en 1080×1920: arriba la barra de la app, abajo la descripción y la música, a la derecha
# los botones (me gusta, comentar, compartir). Las posiciones verticales de v2/2d/*.js se eligieron dentro de ella.
ZS = (90, 250, 950, 1440)
carpeta = pathlib.Path(sys.argv[1]); por = int(sys.argv[2]) if len(sys.argv) > 2 else 12
cuadros = sorted(carpeta.glob("frame-*-at-*s.png"), key=lambda p: int(re.search(r"frame-(\d+)", p.name).group(1)))
k, cols = 3, 6
for h in range(0, len(cuadros), por):
    grupo = cuadros[h:h + por]
    filas = (len(grupo) + cols - 1) // cols
    hoja = Image.new("RGB", (cols * 360, filas * 670), (24, 24, 24))
    for i, ruta in enumerate(grupo):
        im = Image.open(ruta).convert("RGB").resize((360, 640))
        d = ImageDraw.Draw(im)
        d.rectangle([ZS[0] / k, ZS[1] / k, ZS[2] / k, ZS[3] / k], outline=(255, 70, 70), width=2)
        x, y = (i % cols) * 360, (i // cols) * 670
        hoja.paste(im, (x, y + 30))
        ImageDraw.Draw(hoja).text((x + 8, y + 8), re.search(r"at-([\d.]+)s", ruta.name).group(1) + " s", fill=(255, 255, 255))
    hoja.save(carpeta / f"hoja-zs-{h // por + 1}.jpg", quality=88)
    print(carpeta / f"hoja-zs-{h // por + 1}.jpg")
