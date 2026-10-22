# -*- coding: utf-8 -*-
"""Genera los iconos de la plataforma a partir del sello de marca.

El original vive en la carpeta de branding (arte a 1024 px con fondo
transparente) y de ahí salen los cuatro PNG de `public/`:

    vadai-sello-16/32/64.png  favicon; el navegador elige el tamaño
    vadai-sello.png           512 px, también el sello del encabezado
    vadai-apple.png           180 px para iOS, con el CUADRADO blanco entero
    vadai-app-192/512.png     la app instalada en Android (app/manifest.ts),
                              cuadrado blanco opaco como el de iOS
    vadai-app-maskable.png    512 px con el sello al 70 % dentro de la zona
                              segura: Android le recorta círculo o gota

El disco blanco va HORNEADO en el PNG, no puesto con CSS: la pestaña la pinta
el navegador y ahí no llega ninguna hoja de estilos. Si el arte trae su propio
disco (como el favicon del 26-sep-2026, con anillo lima), se respeta tal cual y
solo se rellena el transparente de fuera en la versión de iOS, que compone
sobre negro y pondría las esquinas oscuras.

    pnpm iconos            (usa el original de Dropbox)
    pnpm iconos ruta.png   (usa otro archivo)
"""

import sys
from pathlib import Path

from PIL import Image

ORIGINAL = Path(
    r'C:/Users/Alejandro Martinez/Dropbox/Alejandro Martinez/VADAI/BRANDING VADAI/vadai_favicon.png'
)
DESTINO = Path(__file__).resolve().parent.parent / 'public'
TAMANOS = {'vadai-sello-16.png': 16, 'vadai-sello-32.png': 32, 'vadai-sello-64.png': 64, 'vadai-sello.png': 512}
APPLE = ('vadai-apple.png', 180)
APP = {'vadai-app-192.png': 192, 'vadai-app-512.png': 512}
MASCARA = ('vadai-app-maskable.png', 512, 0.7)


def main() -> int:
    origen = Path(sys.argv[1]) if len(sys.argv) > 1 else ORIGINAL
    if not origen.exists():
        print(f'No encontré el original: {origen}')
        return 1

    arte = Image.open(origen).convert('RGBA')
    print(f'original: {origen.name} {arte.size[0]}x{arte.size[1]}')

    for nombre, lado in TAMANOS.items():
        arte.resize((lado, lado), Image.LANCZOS).save(DESTINO / nombre)
        print(f'  {nombre:<22} {lado}x{lado}')

    # iOS compone sobre NEGRO y aplica su propia máscara redondeada: va el
    # cuadrado entero blanco, no un disco sobre transparente.
    nombre, lado = APPLE
    cuadrado = Image.new('RGBA', arte.size, (255, 255, 255, 255))
    cuadrado.alpha_composite(arte)
    cuadrado.convert('RGB').resize((lado, lado), Image.LANCZOS).save(DESTINO / nombre)
    print(f'  {nombre:<22} {lado}x{lado} (cuadrado blanco para iOS)')

    for nombre, lado in APP.items():
        cuadrado.convert('RGB').resize((lado, lado), Image.LANCZOS).save(DESTINO / nombre)
        print(f'  {nombre:<22} {lado}x{lado} (app instalada)')

    # Maskable: Android recorta el icono a la forma del teléfono; solo el
    # círculo central del 80 % es seguro, así que el sello va más chico.
    nombre, lado, escala = MASCARA
    lienzo = Image.new('RGBA', (lado, lado), (255, 255, 255, 255))
    interior = round(lado * escala)
    sello = arte.resize((interior, interior), Image.LANCZOS)
    lienzo.alpha_composite(sello, ((lado - interior) // 2, (lado - interior) // 2))
    lienzo.convert('RGB').save(DESTINO / nombre)
    print(f'  {nombre:<22} {lado}x{lado} (maskable)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
