#!/usr/bin/env python
"""
construir.py — De laminas.md a .pptx y .html

Una fuente (cada `laminas.md`), dos formatos: el .pptx editable para quien presenta y el
.html para proyectar o mandar por link. Nunca se desincronizan porque los dos salen de aquí.

Colores: los tokens de app/globals.css, a mano porque una lámina proyectada es una superficie
navy forzada (misma excepción que el QR y el PDF de M12), no texto de interfaz.

    python presentacion/construir.py            # construye todo
    python presentacion/construir.py modulo-0   # solo uno
"""

import html
import re
import sys
from pathlib import Path

# La consola de Windows arranca en cp1252 y no sabe pintar un ✓.
sys.stdout.reconfigure(encoding="utf-8")

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Emu, Inches, Pt

RAIZ = Path(__file__).resolve().parent.parent
CONTENIDO = RAIZ / "contenido" / "claude-en-tu-empresa"
SALIDA = RAIZ / "presentacion" / "salida"

NAVY = RGBColor(0x0A, 0x1A, 0x2F)
CYAN = RGBColor(0x00, 0xA0, 0xDB)
AZUL = RGBColor(0x00, 0x6E, 0x96)
LIMA = RGBColor(0xC6, 0xF2, 0x4E)
TEXTO = RGBColor(0xF5, 0xF8, 0xFB)
GRIS = RGBColor(0x93, 0xA3, 0xB5)
BLANCO = RGBColor(0xFF, 0xFF, 0xFF)

FUENTE = "Inter"

DECKS = {
    "charla-invitacion": ("Claude en tu Empresa · Charla", CONTENIDO / "charla-invitacion" / "laminas.md"),
    "modulo-0": ("Módulo 0 · Antes de empezar", CONTENIDO / "modulo-0" / "laminas.md"),
    "modulo-1": ("Módulo 1 · Aprende a usar Claude", CONTENIDO / "modulo-1" / "laminas.md"),
}


# --- lectura ---------------------------------------------------------------

def leer_laminas(ruta: Path):
    """Devuelve una lista de dicts, uno por bloque `## N · Título`."""
    laminas = []
    actual = None
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## (\d+) · (.+)$", linea)
        if m:
            actual = {"n": int(m.group(1)), "nombre": m.group(2).strip(), "tipo": "frase"}
            laminas.append(actual)
            continue
        if actual is None:
            continue
        m = re.match(r"^(tipo|titular|cifra|texto|fuente|nota):\s*(.*)$", linea)
        if m:
            actual[m.group(1)] = m.group(2).strip()
    return laminas


def leer_fuentes():
    """id -> texto corto de la fuente, para el pie de lámina."""
    fuentes = {}
    for linea in (CONTENIDO / "fuentes.md").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\|\s*`([a-z0-9-]+)`\s*\|(.*)\|\s*$", linea)
        if not m or m.group(1).startswith(("fix-", "p-")):
            continue
        celdas = [c.strip() for c in m.group(2).split("|")]
        if len(celdas) >= 5:
            fuentes[m.group(1)] = re.sub(r"\*", "", celdas[2])
    return fuentes


def pie_de_fuente(campo: str, fuentes: dict) -> str:
    ids = re.findall(r"\[\^([a-z0-9-]+)\]", campo or "")
    partes = [fuentes.get(i, i) for i in ids]
    # Sin duplicados, en orden.
    vistos, salida = set(), []
    for p in partes:
        if p not in vistos:
            vistos.add(p)
            salida.append(p)
    return " · ".join(salida)


def partes_acento(titular: str):
    """'Texto **acento** más' -> [('Texto ', False), ('acento', True), (' más', False)]"""
    out = []
    for i, trozo in enumerate(re.split(r"\*\*", titular)):
        if trozo:
            out.append((trozo, i % 2 == 1))
    return out


# --- pptx --------------------------------------------------------------------

def fondo(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def caja(slide, x, y, w, h):
    return slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)).text_frame


def parrafo(tf, texto, tam, color, negrita=False, alinear=PP_ALIGN.LEFT, primero=False):
    p = tf.paragraphs[0] if primero else tf.add_paragraph()
    p.alignment = alinear
    r = p.add_run()
    r.text = texto
    r.font.size = Pt(tam)
    r.font.color.rgb = color
    r.font.bold = negrita
    r.font.name = FUENTE
    return p


def titular_con_acento(tf, titular, tam, primero=True):
    p = tf.paragraphs[0] if primero else tf.add_paragraph()
    for trozo, acento in partes_acento(titular):
        r = p.add_run()
        r.text = trozo
        r.font.size = Pt(tam)
        r.font.name = FUENTE
        r.font.bold = False
        r.font.color.rgb = CYAN if acento else TEXTO
    return p


def construir_pptx(nombre, titulo_deck, laminas, fuentes):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    en_blanco = prs.slide_layouts[6]

    for lam in laminas:
        s = prs.slides.add_slide(en_blanco)
        tipo = lam.get("tipo", "frase")
        fondo(s, NAVY)

        if tipo == "portada":
            tf = caja(s, 1, 2.3, 11.3, 2.5)
            tf.word_wrap = True
            titular_con_acento(tf, lam.get("titular", ""), 44)
            if lam.get("texto"):
                parrafo(tf, lam["texto"], 20, GRIS)
            # Placa blanca para el logo: el logo es arte negro sobre transparente.
            placa = s.shapes.add_shape(1, Inches(1), Inches(5.6), Inches(2.6), Inches(0.9))
            placa.fill.solid(); placa.fill.fore_color.rgb = BLANCO; placa.line.fill.background()
            ptf = placa.text_frame; ptf.text = "VADAI"
            ptf.paragraphs[0].runs[0].font.color.rgb = NAVY
            ptf.paragraphs[0].runs[0].font.size = Pt(18)
            ptf.paragraphs[0].alignment = PP_ALIGN.CENTER

        elif tipo == "seccion":
            tf = caja(s, 1, 2.6, 11.3, 2)
            tf.word_wrap = True
            titular_con_acento(tf, lam.get("titular", ""), 40)
            if lam.get("texto"):
                parrafo(tf, lam["texto"], 20, GRIS)

        elif tipo == "numero":
            tf = caja(s, 1, 0.8, 11.3, 1.4)
            tf.word_wrap = True
            titular_con_acento(tf, lam.get("titular", ""), 28)
            ctf = caja(s, 1, 2.2, 11.3, 2.2)
            parrafo(ctf, lam.get("cifra", ""), 96, CYAN, primero=True)
            if lam.get("texto"):
                ttf = caja(s, 1, 4.4, 11.3, 1.8)
                ttf.word_wrap = True
                parrafo(ttf, lam["texto"], 20, TEXTO, primero=True)

        elif tipo in ("frase", "cita", "cierre"):
            tf = caja(s, 1, 1.8, 11.3, 3)
            tf.word_wrap = True
            titular_con_acento(tf, lam.get("titular", ""), 36 if tipo != "cierre" else 34)
            if lam.get("texto"):
                parrafo(tf, lam["texto"], 20, LIMA if tipo == "cierre" else GRIS)

        elif tipo in ("lista", "demo", "encuesta"):
            tf = caja(s, 1, 0.8, 11.3, 1.4)
            tf.word_wrap = True
            titular_con_acento(tf, lam.get("titular", ""), 30)
            if lam.get("texto"):
                btf = caja(s, 1, 2.3, 11.3, 4)
                btf.word_wrap = True
                items = [i.strip() for i in re.split(r" [·—] ", lam["texto"]) if i.strip()]
                primero = True
                for it in items:
                    parrafo(btf, ("•  " if tipo == "lista" else "") + it, 20, TEXTO, primero=primero)
                    primero = False
            if tipo == "encuesta":
                etf = caja(s, 9.3, 5.2, 3.5, 1)
                parrafo(etf, "▣ escanea el QR", 16, LIMA, primero=True, alinear=PP_ALIGN.RIGHT)

        elif tipo == "tabla":
            tf = caja(s, 1, 0.8, 11.3, 1.4)
            tf.word_wrap = True
            titular_con_acento(tf, lam.get("titular", ""), 30)
            filas = [f.strip() for f in lam.get("texto", "").split("|") if f.strip()]
            if filas:
                alto = min(0.55, 4.2 / max(len(filas), 1))
                tabla = s.shapes.add_table(len(filas), 1, Inches(1), Inches(2.3), Inches(11.3), Inches(alto * len(filas))).table
                for i, fila in enumerate(filas):
                    celda = tabla.cell(i, 0)
                    celda.fill.solid()
                    celda.fill.fore_color.rgb = AZUL if i % 2 == 0 else NAVY
                    celda.text = fila
                    for p in celda.text_frame.paragraphs:
                        for r in p.runs:
                            r.font.size = Pt(16); r.font.color.rgb = TEXTO; r.font.name = FUENTE

        # Pie: fuente abajo a la izquierda en toda lámina con dato.
        pie = pie_de_fuente(lam.get("fuente", ""), fuentes)
        if pie:
            ftf = caja(s, 1, 6.7, 10, 0.5)
            parrafo(ftf, "Fuente: " + pie, 11, GRIS, primero=True)

        # Número de lámina abajo a la derecha.
        ntf = caja(s, 12.2, 6.9, 1, 0.4)
        parrafo(ntf, str(lam["n"]), 10, GRIS, primero=True, alinear=PP_ALIGN.RIGHT)

        # Nota del presentador.
        if lam.get("nota"):
            s.notes_slide.notes_text_frame.text = lam["nota"]

    destino = SALIDA / f"{nombre}.pptx"
    prs.save(destino)
    return destino


# --- html ----------------------------------------------------------------------

CSS = """
:root{--navy:#0A1A2F;--cyan:#00A0DB;--azul:#006E96;--lima:#C6F24E;--texto:#F5F8FB;--gris:#93A3B5}
*{box-sizing:border-box}html,body{margin:0;background:var(--navy);color:var(--texto);font-family:Inter,system-ui,sans-serif;font-weight:500}
.l{min-height:100vh;padding:8vh 8vw;display:flex;flex-direction:column;justify-content:center;position:relative;border-bottom:1px solid rgba(147,163,181,.15)}
h1{font-size:clamp(28px,4.2vw,56px);line-height:1.1;margin:0 0 .5em;font-weight:500;letter-spacing:-.01em}
h1 b{color:var(--cyan);font-weight:500}
.cifra{font-size:clamp(72px,13vw,180px);color:var(--cyan);line-height:1;margin:.1em 0}
p{font-size:clamp(16px,1.6vw,22px);line-height:1.5;color:var(--texto);max-width:60ch;margin:.4em 0}
p.gris{color:var(--gris)}p.lima{color:var(--lima)}
ul{font-size:clamp(16px,1.6vw,22px);line-height:1.6;padding-left:1.2em;margin:.6em 0}
table{border-collapse:collapse;margin:.8em 0;font-size:clamp(14px,1.4vw,19px)}td{padding:.5em .9em;border-top:1px solid rgba(147,163,181,.25)}tr:nth-child(odd) td{background:rgba(0,110,150,.35)}
.fuente{position:absolute;left:8vw;bottom:3vh;font-size:12px;color:var(--gris)}
.n{position:absolute;right:4vw;bottom:3vh;font-size:12px;color:var(--gris)}
.placa{display:inline-block;background:#fff;color:var(--navy);padding:.5em 1.4em;border-radius:10px;margin-top:2em;font-size:18px}
.qr{position:absolute;right:8vw;bottom:8vh;color:var(--lima);font-size:18px}
.seccion h1{font-size:clamp(34px,5vw,64px)}
.cierre p{color:var(--lima)}
@media print{.l{page-break-after:always;min-height:100vh}}
"""


def html_titular(titular):
    out = []
    for trozo, acento in partes_acento(titular):
        t = html.escape(trozo)
        out.append(f"<b>{t}</b>" if acento else t)
    return "".join(out)


def construir_html(nombre, titulo_deck, laminas, fuentes):
    partes = [f"<!doctype html><html lang='es'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>{html.escape(titulo_deck)}</title><style>{CSS}</style></head><body>"]
    for lam in laminas:
        tipo = lam.get("tipo", "frase")
        cls = "l " + tipo
        partes.append(f"<section class='{cls}' id='l{lam['n']}'>")
        partes.append(f"<h1>{html_titular(lam.get('titular',''))}</h1>")
        if tipo == "numero" and lam.get("cifra"):
            partes.append(f"<div class='cifra'>{html.escape(lam['cifra'])}</div>")
        texto = lam.get("texto", "")
        if texto:
            if tipo == "tabla":
                filas = [f.strip() for f in texto.split("|") if f.strip()]
                partes.append("<table>" + "".join(f"<tr><td>{html.escape(f)}</td></tr>" for f in filas) + "</table>")
            elif tipo in ("lista", "demo", "encuesta"):
                items = [i.strip() for i in re.split(r" [·—] ", texto) if i.strip()]
                partes.append("<ul>" + "".join(f"<li>{html.escape(i)}</li>" for i in items) + "</ul>")
            else:
                clase = "lima" if tipo == "cierre" else ("gris" if tipo in ("portada", "seccion", "frase") else "")
                partes.append(f"<p class='{clase}'>{html.escape(texto)}</p>")
        if tipo == "portada":
            partes.append("<div><span class='placa'>VADAI</span></div>")
        if tipo == "encuesta":
            partes.append("<div class='qr'>▣ escanea el QR</div>")
        pie = pie_de_fuente(lam.get("fuente", ""), fuentes)
        if pie:
            partes.append(f"<div class='fuente'>Fuente: {html.escape(pie)}</div>")
        partes.append(f"<div class='n'>{lam['n']}</div></section>")
    partes.append("<script>document.addEventListener('keydown',e=>{const s=[...document.querySelectorAll('.l')];const y=window.scrollY+1;const i=s.findIndex(x=>x.offsetTop>y);if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();(s[i]||s[s.length-1]).scrollIntoView({behavior:'smooth'})}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();(s[Math.max(i-2,0)]).scrollIntoView({behavior:'smooth'})}});</script></body></html>")
    destino = SALIDA / f"{nombre}.html"
    destino.write_text("".join(partes), encoding="utf-8")
    return destino


# --- artifact (claude.ai) --------------------------------------------------------
#
# Misma fuente, tercer formato: una página publicable como Artifact. Sin doctype ni <body>
# (el publicador los pone). Dos temas de verdad, por token, con el claro por defecto como
# manda CLAUDE.md, y los pares elegidos aparte: sobre claro el acento es azul profundo
# (#006E96, 5.5:1) porque el cyan reprueba AA; sobre navy es cyan (6.4:1).

ARTIFACT_CSS = """
:root{
  --fondo:#F5F8FB;--tinta:#0A1A2F;--acento:#006E96;--gris:#5B6B7D;--linea:rgba(10,26,47,.14);
  --placa:#FFFFFF;--suave:rgba(0,110,150,.08);--lima:#6F8F00;--cta:#C6F24E;--cta-tinta:#0A1A2F;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --fondo:#0A1A2F;--tinta:#F5F8FB;--acento:#00A0DB;--gris:#93A3B5;--linea:rgba(245,248,251,.14);
  --placa:#FFFFFF;--suave:rgba(0,160,219,.12);--lima:#C6F24E;--cta:#C6F24E;--cta-tinta:#0A1A2F;
}}
:root[data-theme="dark"]{
  --fondo:#0A1A2F;--tinta:#F5F8FB;--acento:#00A0DB;--gris:#93A3B5;--linea:rgba(245,248,251,.14);
  --placa:#FFFFFF;--suave:rgba(0,160,219,.12);--lima:#C6F24E;--cta:#C6F24E;--cta-tinta:#0A1A2F;
}
*{box-sizing:border-box}
body{margin:0;background:var(--fondo);color:var(--tinta);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-weight:500;font-size:16px;line-height:1.5}
.deck{scroll-snap-type:y proximity}
.l{min-height:100svh;padding:clamp(28px,7vh,72px) clamp(20px,8vw,120px) clamp(64px,10vh,96px);display:flex;flex-direction:column;justify-content:center;gap:18px;position:relative;scroll-snap-align:start;border-bottom:1px solid var(--linea)}
.eyebrow{position:absolute;top:clamp(20px,4vh,36px);left:clamp(20px,8vw,120px);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gris)}
h1{font-size:clamp(28px,4.4vw,58px);line-height:1.08;margin:0;font-weight:500;letter-spacing:-.015em;text-wrap:balance;max-width:22ch}
h1 b{color:var(--acento);font-weight:500}
.seccion h1{font-size:clamp(34px,5.4vw,72px);max-width:18ch}
.cifra{font-size:clamp(84px,15vw,200px);line-height:.95;font-weight:600;color:var(--acento);letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin:6px 0 0}
p{margin:0;max-width:62ch;font-size:clamp(17px,1.7vw,22px);line-height:1.5}
p.gris{color:var(--gris)}p.cta{color:var(--lima)}
ul{margin:4px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;max-width:70ch}
ul li{font-size:clamp(17px,1.7vw,22px);line-height:1.45;padding-left:1.1em;position:relative}
ul li::before{content:"";position:absolute;left:0;top:.62em;width:.45em;height:.45em;border-radius:50%;background:var(--acento)}
.filas{display:flex;flex-direction:column;max-width:72ch;margin-top:6px;border-top:1px solid var(--linea)}
.filas div{padding:12px 0;border-bottom:1px solid var(--linea);font-size:clamp(16px,1.5vw,20px);line-height:1.4;display:flex;gap:14px;align-items:baseline}
.filas div b{color:var(--acento);font-weight:500;min-width:2ch}
.escalones{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:end;max-width:760px;height:min(38vh,320px);margin-top:10px}
.escalones div{display:flex;flex-direction:column;justify-content:flex-end;gap:8px;height:100%}
.escalones .barra{background:var(--acento);border-radius:6px 6px 0 0;opacity:.92}
.escalones .h{font-size:clamp(18px,2.4vw,32px);font-variant-numeric:tabular-nums;line-height:1}
.escalones .a{font-size:13px;color:var(--gris);letter-spacing:.06em}
.chip{display:inline-flex;align-items:center;gap:10px;align-self:flex-start;margin-top:8px;padding:12px 18px;border:1px solid var(--linea);border-radius:10px;background:var(--suave);font-size:15px}
.chip i{width:14px;height:14px;border:2px solid var(--acento);border-radius:3px;display:inline-block}
.placa{display:inline-flex;align-items:center;gap:12px;align-self:flex-start;margin-top:22px;background:var(--placa);color:#0A1A2F;padding:12px 22px;border-radius:10px;font-size:15px;letter-spacing:.04em;text-transform:uppercase}
.placa span{color:#006E96}
.fuente{position:absolute;left:clamp(20px,8vw,120px);right:clamp(60px,8vw,120px);bottom:clamp(16px,3vh,28px);font-size:12px;line-height:1.4;color:var(--gris)}
.n{position:absolute;right:clamp(20px,4vw,48px);bottom:clamp(16px,3vh,28px);font-size:12px;color:var(--gris);font-variant-numeric:tabular-nums}
.rail{position:fixed;top:0;left:0;height:3px;background:var(--acento);width:0;z-index:2;transition:width .2s}
.cierre p.cta{font-size:clamp(19px,2vw,26px)}
.cierre .boton{display:inline-block;align-self:flex-start;margin-top:14px;background:var(--cta);color:var(--cta-tinta);padding:14px 22px;border-radius:10px;font-size:16px}
a:focus-visible,.l:focus-visible{outline:2px solid var(--acento);outline-offset:4px}
@media (prefers-reduced-motion:reduce){.rail{transition:none}html{scroll-behavior:auto}}
@media (max-width:640px){.l{padding-bottom:84px}.fuente{right:56px}.escalones{gap:6px}}
"""

ARTIFACT_JS = """
(function(){
  var s=[].slice.call(document.querySelectorAll('.l')),rail=document.querySelector('.rail');
  function idx(){var y=window.scrollY+window.innerHeight*0.4;var i=0;for(var k=0;k<s.length;k++){if(s[k].offsetTop<=y)i=k;}return i;}
  function pinta(){rail.style.width=((idx()+1)/s.length*100)+'%';}
  window.addEventListener('scroll',pinta,{passive:true});pinta();
  document.addEventListener('keydown',function(e){
    var i=idx();
    if(['ArrowRight','PageDown',' ','ArrowDown'].indexOf(e.key)>-1){e.preventDefault();(s[i+1]||s[s.length-1]).scrollIntoView({behavior:'smooth'});}
    if(['ArrowLeft','PageUp','ArrowUp'].indexOf(e.key)>-1){e.preventDefault();(s[i-1]||s[0]).scrollIntoView({behavior:'smooth'});}
  });
})();
"""


def _es_calendario(filas):
    return len(filas) >= 3 and all(re.match(r"^\d{4} · \d+ h$", f) for f in filas)


def construir_artifact(nombre, titulo_deck, laminas, fuentes):
    partes = [f"<title>{html.escape(titulo_deck)}</title>",
              "<link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Inter:wght@500;600&display=swap'>",
              f"<style>{ARTIFACT_CSS}</style>", "<div class='rail'></div><main class='deck'>"]
    acto = ""
    for lam in laminas:
        tipo = lam.get("tipo", "frase")
        if tipo == "seccion":
            acto = re.sub(r"\*\*|·.*$", "", lam.get("titular", "")).strip()
        elif tipo == "portada":
            acto = ""
        partes.append(f"<section class='l {tipo}' id='l{lam['n']}' tabindex='-1'>")
        if acto and tipo not in ("portada", "seccion"):
            partes.append(f"<div class='eyebrow'>{html.escape(acto)}</div>")
        partes.append(f"<h1>{html_titular(lam.get('titular',''))}</h1>")
        if tipo == "numero" and lam.get("cifra"):
            partes.append(f"<div class='cifra'>{html.escape(lam['cifra'])}</div>")
        texto = lam.get("texto", "")
        if texto:
            if tipo == "tabla":
                filas = [f.strip() for f in texto.split("|") if f.strip()]
                if _es_calendario(filas):
                    horas = [int(re.search(r"(\d+) h", f).group(1)) for f in filas]
                    top = max(horas)
                    partes.append("<div class='escalones'>" + "".join(
                        f"<div><span class='h'>{h} h</span><div class='barra' style='height:{int(h/top*100)}%'></div><span class='a'>{f.split(' · ')[0]}</span></div>"
                        for f, h in zip(filas, horas)) + "</div>")
                    resto = re.search(r"—\s*(.+)$", texto)
                    if resto:
                        partes.append(f"<p class='gris'>{html.escape(resto.group(1).strip())}</p>")
                else:
                    celdas = []
                    for f in filas:
                        m = re.match(r"^([A-Z0-9]{1,3}) · (.+)$", f)
                        celdas.append(f"<div><b>{html.escape(m.group(1))}</b><span>{html.escape(m.group(2))}</span></div>" if m else f"<div>{html.escape(f)}</div>")
                    partes.append("<div class='filas'>" + "".join(celdas) + "</div>")
            elif tipo in ("lista", "demo", "encuesta"):
                items = [i.strip() for i in re.split(r" [·—] ", texto) if i.strip()]
                partes.append("<ul>" + "".join(f"<li>{html.escape(i)}</li>" for i in items) + "</ul>")
            else:
                clase = "cta" if tipo == "cierre" else "gris"
                partes.append(f"<p class='{clase}'>{html.escape(texto)}</p>")
        if tipo == "portada":
            partes.append("<div class='placa'>VADAI <span>+</span> Total Coach</div>")
        if tipo == "encuesta":
            partes.append("<div class='chip'><i></i> Escanea el QR de la pantalla para contestar</div>")
        if tipo == "cierre":
            partes.append("<div class='boton'>El paso uno empieza hoy</div>")
        pie = pie_de_fuente(lam.get("fuente", ""), fuentes)
        if pie:
            partes.append(f"<div class='fuente'>Fuente: {html.escape(pie)}</div>")
        partes.append(f"<div class='n'>{lam['n']} / {len(laminas)}</div></section>")
    partes.append(f"</main><script>{ARTIFACT_JS}</script>")
    destino = SALIDA / f"{nombre}-artifact.html"
    destino.write_text("".join(partes), encoding="utf-8")
    return destino


# --- main --------------------------------------------------------------------

def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    fuentes = leer_fuentes()
    pedidos = sys.argv[1:] or list(DECKS)
    for nombre in pedidos:
        if nombre not in DECKS:
            print(f"  no conozco el deck '{nombre}'. Opciones: {', '.join(DECKS)}")
            sys.exit(1)
        titulo, ruta = DECKS[nombre]
        laminas = leer_laminas(ruta)
        if not laminas:
            print(f"  ✗ {ruta} no tiene láminas")
            sys.exit(1)
        p = construir_pptx(nombre, titulo, laminas, fuentes)
        h = construir_html(nombre, titulo, laminas, fuentes)
        a = construir_artifact(nombre, titulo, laminas, fuentes)
        print(f"  ✓ {nombre}: {len(laminas)} láminas → {p.name}, {h.name}, {a.name}")


if __name__ == "__main__":
    main()
