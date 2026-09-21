#!/usr/bin/env python
"""
construir.py — laminas.md → html · pdf · png · pptx, con el Chrome del sistema y python-pptx.

    python construir.py contenido/claude-en-tu-empresa/modulo-0/laminas.md
    python construir.py <laminas.md> --solo html        # html | pdf | png | pptx
    python construir.py <laminas.md> --perfil sala      # por defecto, el `medio:` del deck

Salida en presentacion/salida/<deck>/:
    <deck>.html          deck para proyectar (un solo archivo, fuentes incrustadas, teclado)
    <deck>.pdf           una lámina por página, 1920×1080, fuentes incrustadas (Chrome headless)
    laminas/NN.html      una lámina por archivo, para el render a imagen
    png/NN.png           2× (3840×2160), la lámina completa
    png-fondo/NN.jpg     2×, la lámina SIN el texto editable (fondo del PPTX)
    <deck>.pptx          fondo + cajas de texto Inter reales + notas del presentador
    fuentes/ + INSTALAR-FUENTES.md   para quien edita el PPTX

Nunca corre sin `verificar.py` en verde: lo llama primero y se detiene si falla.
"""

from __future__ import annotations

import base64
import re
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).parent))
from laminas import leer_deck, leer_fuentes, raiz_repo, ruta_fuentes  # noqa: E402
import plantillas  # noqa: E402

SKILL = Path(__file__).parent.parent
ANCHO, ALTO = 1920, 1080

CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
]


def chrome() -> str:
    for c in CHROMES:
        if Path(c).exists(): return c
    raise SystemExit("No encontré Chrome ni Edge. Instala uno o pon la ruta en CHROMES.")


def correr_chrome(args: list[str]) -> None:
    with tempfile.TemporaryDirectory(prefix="deck-chrome-") as ud:
        cmd = [chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars",
               f"--user-data-dir={ud}", "--virtual-time-budget=8000", "--no-first-run", *args]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode not in (0,):
            # Chrome a veces devuelve 1 aunque escribió el archivo; se verifica por existencia después.
            pass


def fuente_b64(nombre: str) -> str:
    p = SKILL / "activos" / "tipografias" / nombre
    return base64.b64encode(p.read_bytes()).decode("ascii")


def css_fuentes() -> str:
    return (
        f"@font-face{{font-family:'Anton';src:url(data:font/woff2;base64,{fuente_b64('Anton-latin.woff2')}) format('woff2');font-display:block}}"
        f"@font-face{{font-family:'Inter';font-weight:100 900;src:url(data:font/woff2;base64,{fuente_b64('Inter-latin.woff2')}) format('woff2');font-display:block}}"
        f"@font-face{{font-family:'JetBrains Mono';font-weight:100 800;src:url(data:font/woff2;base64,{fuente_b64('JetBrainsMono-latin.woff2')}) format('woff2');font-display:block}}"
    )


def tokens() -> dict:
    return json.loads((SKILL / "activos" / "tokens.json").read_text(encoding="utf-8"))


def html_deck(deck, secciones: list[str], css: str, fuentes_css: str, titulo: str) -> str:
    nav = """
<script>
(function(){
  var s=[].slice.call(document.querySelectorAll('.l')),i=0;
  function fit(){var z=Math.min(innerWidth/1920,innerHeight/1080);document.documentElement.style.setProperty('--z',z);}
  function go(k){i=Math.max(0,Math.min(s.length-1,k));s.forEach(function(x,j){x.classList.toggle('activa',j===i)});location.hash='#'+(i+1);}
  addEventListener('resize',fit);fit();
  var h=parseInt(location.hash.slice(1),10);go(isNaN(h)?0:h-1);
  addEventListener('keydown',function(e){
    if(['ArrowRight','PageDown',' ','Enter','ArrowDown'].indexOf(e.key)>-1){e.preventDefault();go(i+1);}
    if(['ArrowLeft','PageUp','Backspace','ArrowUp'].indexOf(e.key)>-1){e.preventDefault();go(i-1);}
    if(e.key==='Home')go(0);if(e.key==='End')go(s.length-1);
    if(e.key==='f'||e.key==='F'){document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();}
  });
  addEventListener('click',function(e){if(e.clientX>innerWidth*0.66)go(i+1);else if(e.clientX<innerWidth*0.2)go(i-1);});
  var x0=null;addEventListener('touchstart',function(e){x0=e.touches[0].clientX});addEventListener('touchend',function(e){if(x0===null)return;var d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>50)go(d<0?i+1:i-1);x0=null;});
})();
</script>"""
    pantalla = """
@media screen{
  html{background:#0A1A2F;height:100%}body{margin:0;height:100%;overflow:hidden}
  .deck{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform:translate(-50%,-50%) scale(var(--z,1));transform-origin:center}
  .l{position:absolute;inset:0;display:none}.l.activa{display:block}
}
@media print{
  @page{size:1920px 1080px;margin:0}
  html,body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .deck{position:static;transform:none}
  .l{display:block;position:relative;width:1920px;height:1080px;page-break-after:always;break-after:page;overflow:hidden}
}"""
    return (f"<!doctype html><html lang='es'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<title>{titulo}</title><style>{fuentes_css}{css}{pantalla}</style></head>"
            f"<body><main class='deck'>{''.join(secciones)}</main>{nav}</body></html>")


def html_lamina(seccion: str, css: str, fuentes_css: str, modo_fondo: bool) -> str:
    extra = ".editable{visibility:hidden}" if modo_fondo else ""
    return (f"<!doctype html><html lang='es'><head><meta charset='utf-8'><style>{fuentes_css}{css}"
            f"html,body{{margin:0;width:1920px;height:1080px;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}}"
            f".l{{position:relative;width:1920px;height:1080px;overflow:hidden}}{extra}</style></head>"
            f"<body>{seccion}</body></html>")


def pptx_desde(deck, cajas_por_lamina: list[list[dict]], fondos: list[Path], destino: Path, tk: dict) -> None:
    """Fondo en imagen (solo lo que no es texto) + cada texto como caja o forma nativa editable.
    El marcador coral del titular va como resaltado de texto (a:highlight); las barras como rectángulos."""
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
    from pptx.oxml.ns import qn
    from pptx.oxml.xmlchemy import OxmlElement
    from pptx.util import Emu, Pt

    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)  # 13.333 × 7.5 in
    px = prs.slide_width / ANCHO
    E = lambda v: Emu(int(v * px))

    def rgb(h): h = h.lstrip("#"); return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

    def resaltar(run, hexcolor):
        rPr = run._r.get_or_add_rPr()
        hl = OxmlElement("a:highlight"); clr = OxmlElement("a:srgbClr"); clr.set("val", hexcolor.lstrip("#").upper()); hl.append(clr)
        latin = rPr.find(qn("a:latin"))
        if latin is not None: latin.addprevious(hl)
        else: rPr.append(hl)

    def escribir(tf, c):
        tf.word_wrap = c.get("ajustar", True); tf.auto_size = MSO_AUTO_SIZE.NONE
        m = c.get("margen") or (0, 0)
        mt, mr, mb, ml = (m[0], m[1], m[0], m[1]) if len(m) == 2 else m
        tf.margin_top, tf.margin_right, tf.margin_bottom, tf.margin_left = Pt(mt * 0.5), Pt(mr * 0.5), Pt(mb * 0.5), Pt(ml * 0.5)
        if c.get("valinear") == "middle": tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        elif c.get("valinear") == "bottom": tf.vertical_anchor = MSO_ANCHOR.BOTTOM
        else: tf.vertical_anchor = MSO_ANCHOR.TOP
        alinear = {"center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}.get(c.get("alinear"), PP_ALIGN.LEFT)
        def espaciar(p):
            if c.get("exacto"): p.line_spacing = Pt(c["exacto"] * 0.5)
            elif c.get("interlinea"): p.line_spacing = c["interlinea"]

        def trazar(r):
            if c.get("tracking"):
                r._r.get_or_add_rPr().set("spc", str(int(c["tracking"] * 0.5 * 100)))

        runs = c.get("runs")
        if runs:
            p = tf.paragraphs[0]; p.alignment = alinear; espaciar(p)
            for rn in runs:
                if rn.get("salto"): p.add_line_break(); continue
                r = p.add_run(); r.text = rn["texto"]
                r.font.color.rgb = rgb(rn.get("color", c["color"]))
                r.font.size = Pt(rn.get("pt", c["pt"])); r.font.bold = rn.get("negrita", c.get("negrita", False))
                r.font.name = rn.get("fuente", c.get("fuente", "Inter"))
                if rn.get("resaltado"): resaltar(r, rn["resaltado"])
                trazar(r)
            return
        lineas = c["texto"] if isinstance(c["texto"], list) else [c["texto"]]
        for k, linea in enumerate(lineas):
            p = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
            p.alignment = alinear; espaciar(p)
            if c.get("espacio"): p.space_after = Pt(c["espacio"])
            r = p.add_run(); r.text = linea
            r.font.color.rgb = rgb(c["color"]); r.font.size = Pt(c["pt"]); r.font.bold = c.get("negrita", False)
            r.font.name = c.get("fuente", "Inter"); trazar(r)

    for lam, cajas, fondo in zip(deck.laminas, cajas_por_lamina, fondos):
        s = prs.slides.add_slide(prs.slide_layouts[6])
        s.shapes.add_picture(str(fondo), 0, 0, width=prs.slide_width, height=prs.slide_height)
        for c in cajas:
            if c.get("relleno"):
                radio = c.get("radio") or 0
                forma = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radio else MSO_SHAPE.RECTANGLE, E(c["x"]), E(c["y"]), E(c["w"]), E(c["h"]))
                forma.fill.solid(); forma.fill.fore_color.rgb = rgb(c["relleno"]); forma.line.fill.background(); forma.shadow.inherit = False
                if radio: forma.adjustments[0] = min(0.5, radio / max(1, min(c["w"], c["h"])))
                if c.get("texto") or c.get("runs"): escribir(forma.text_frame, c)
                continue
            tb = s.shapes.add_textbox(E(c["x"]), E(c["y"]), E(c["w"]), E(c["h"]))
            escribir(tb.text_frame, c)
        if lam["nota"]:
            s.notes_slide.notes_text_frame.text = lam["nota"]
    prs.save(str(destino))

def main() -> int:
    if len(sys.argv) < 2: print(__doc__); return 2
    ruta = Path(sys.argv[1]).resolve()
    solo = sys.argv[sys.argv.index("--solo") + 1] if "--solo" in sys.argv else None
    raiz = raiz_repo(ruta)

    # 1 · verificar primero, siempre
    v = subprocess.run([sys.executable, str(Path(__file__).parent / "verificar.py"), str(ruta), "--imagenes"], capture_output=True, text=True, encoding="utf-8")
    print(v.stdout.strip().splitlines()[-1] if v.stdout.strip() else "")
    if v.returncode != 0:
        print(v.stdout); print("  construir.py se detiene: corrige el contenido."); return 1

    deck = leer_deck(ruta)
    tk = tokens()
    perfil = sys.argv[sys.argv.index("--perfil") + 1] if "--perfil" in sys.argv else deck.medio
    fuentes = leer_fuentes(ruta_fuentes(raiz))
    slug = deck.slug
    out = raiz / "presentacion" / "salida" / slug
    for d in ("laminas", "png", "png-fondo", "fuentes"): (out / d).mkdir(parents=True, exist_ok=True)
    imagenes = raiz / "presentacion" / "imagenes" / slug

    ctx = plantillas.Contexto(tokens=tk, perfil=perfil, fuentes=fuentes, deck=deck, imagenes=imagenes, skill=SKILL)
    css = plantillas.css(ctx)
    fcss = css_fuentes()

    secciones, cajas_todas = [], []
    for lam in deck.laminas:
        html, cajas = plantillas.render(lam, ctx)
        secciones.append(html); cajas_todas.append(cajas)

    # 2 · html del deck
    deck_html = out / f"{slug}.html"
    if solo in (None, "html", "pdf"):
        deck_html.write_text(html_deck(deck, secciones, css, fcss, deck.titulo), encoding="utf-8")
        print(f"  ✓ {deck_html.relative_to(raiz)}  ({len(secciones)} láminas)")
        # Variante para publicar como Artifact: sin doctype/html/head/body; title + style + main + script.
        src = deck_html.read_text(encoding="utf-8")
        t = re.search(r"<title>(.*?)</title>", src).group(1)
        st = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
        mn = re.search(r"(<main class='deck'>.*</main>)", src, re.S).group(1)   # codicioso: el deck es el ÚNICO main
        sc = re.search(r"(<script>.*?</script>)", src, re.S).group(1)
        NL = chr(10)
        (out / f"{slug}-artifact.html").write_text("<title>" + t + "</title>" + NL + "<style>" + st + NL + "html,body{height:100%}</style>" + NL + mn + NL + sc, encoding="utf-8")
        assert (out / f"{slug}-artifact.html").read_text(encoding="utf-8").count("<section class='l ") == len(secciones), "el artifact perdió láminas"
        print(f"  ✓ {slug}-artifact.html  ({len(secciones)} láminas, verificado)")

    # 3 · pdf
    if solo in (None, "pdf"):
        pdf = out / f"{slug}.pdf"
        correr_chrome([f"--print-to-pdf={pdf}", "--no-pdf-header-footer", deck_html.as_uri()])
        print(f"  ✓ {pdf.relative_to(raiz)}" if pdf.exists() else "  ✗ el PDF no se generó")

    # 4 · png por lámina (completa y fondo sin texto editable)
    fondos = []
    if solo in (None, "png", "pptx"):
        # Un deck que encoge deja PNG huérfanos y la hoja de contacto los sigue mostrando.
        vivos = {f"{lam.n:02d}" for lam in deck.laminas}
        for carpeta, sufijos in ((out / "png", (".png",)), (out / "png-fondo", (".jpg",)), (out / "laminas", (".html",))):
            for viejo in carpeta.glob("*"):
                if viejo.suffix in sufijos and viejo.stem.split("-")[0] not in vivos:
                    viejo.unlink()
        for lam, sec in zip(deck.laminas, secciones):
            nn = f"{lam.n:02d}"
            (out / "laminas" / f"{nn}.html").write_text(html_lamina(sec, css, fcss, False), encoding="utf-8")
            (out / "laminas" / f"{nn}-fondo.html").write_text(html_lamina(sec, css, fcss, True), encoding="utf-8")
            png = out / "png" / f"{nn}.png"
            correr_chrome([f"--screenshot={png}", f"--window-size={ANCHO},{ALTO}", "--force-device-scale-factor=2", (out / "laminas" / f"{nn}.html").as_uri()])
            pngf = out / "png-fondo" / f"{nn}.png"
            correr_chrome([f"--screenshot={pngf}", f"--window-size={ANCHO},{ALTO}", "--force-device-scale-factor=2", (out / "laminas" / f"{nn}-fondo.html").as_uri()])
            # el fondo del PPTX en JPEG para no inflar el archivo
            from PIL import Image
            jpg = out / "png-fondo" / f"{nn}.jpg"
            if pngf.exists():
                Image.open(pngf).convert("RGB").save(jpg, quality=90, optimize=True); pngf.unlink()
            fondos.append(jpg)
        print(f"  ✓ png/ y png-fondo/ ({len(fondos)} láminas a 2×)")

    # 5 · pptx híbrido
    if solo in (None, "pptx"):
        if not fondos: fondos = [out / "png-fondo" / f"{l.n:02d}.jpg" for l in deck.laminas]
        pptx = out / f"{slug}.pptx"
        pptx_desde(deck, cajas_todas, fondos, pptx, tk)
        for f in ("Anton-Regular.ttf", "Inter-Variable.ttf", "JetBrainsMono-Variable.ttf"):
            shutil.copy(SKILL / "activos" / "tipografias" / f, out / "fuentes" / f)
        (out / "INSTALAR-FUENTES.md").write_text(
            "# Antes de editar el PPTX\n\nInstala las tres fuentes de la carpeta `fuentes/` (doble clic → Instalar). "
            "Son gratuitas y de licencia abierta (OFL 1.1).\n\nSin ellas PowerPoint sustituye Inter por Calibri y el texto "
            "se reacomoda. Los titulares y los gráficos van dentro de la imagen de fondo y no cambian.\n\n"
            "Para corregir un titular, se cambia en `laminas.md` y se vuelve a generar: es un comando.\n", encoding="utf-8")
        print(f"  ✓ {pptx.relative_to(raiz)} + fuentes/ + INSTALAR-FUENTES.md")

    print(f"\n  Ahora: python {Path(__file__).parent / 'miniaturas.py'} {slug}  → y MIRAR la hoja.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
