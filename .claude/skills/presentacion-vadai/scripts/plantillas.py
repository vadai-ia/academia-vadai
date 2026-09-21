"""
plantillas.py — el sistema visual "Fichas · la mesa de trabajo" con injertos de "Cielo editorial".

Dirección ganadora del jurado (3-sep-2026): mesa clara #EAF4FA como base, UNA ficha blanca por
lámina de datos, navy solo para demo, cita y cierre; portada y sección en cielo (injerto de
Cielo); ventana de cielo para cifras (injerto de Cielo); pantalla lima "tu turno" para el
ejercicio (injerto de Aula navy). Retícula de 12 columnas de 112 px con canales de 32
(12×112 + 11×32 = 1696; márgenes 112). Anton 176/152/112/88 por longitud, MEDIDA con la fuente
real (PIL) — nunca estimada —, y apilado vertical calculado: titular → gráfico/cifra → cuerpo.

Cada renderizador devuelve (html_de_la_seccion, cajas). `cajas` = bloques de texto que en el
PPTX van como texto editable; en el render "fondo" llevan la clase `editable` y se ocultan.
"""

from __future__ import annotations
import base64
import io
from pathlib import Path
from functools import lru_cache

import html as H
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from PIL import ImageFont

from laminas import Lamina, filas_tabla, html_acento, items_lista

SKILL = Path(__file__).parent.parent
M, CANAL, COL = 96, 24, 122            # margen, canal, ancho de columna (tokens.json · col 8 en x=1118)
ANCHO_UTIL = 1728                      # 12 columnas
TOP_TIT = 176


def col(n: int) -> int:
    """x de la columna n (1..12)."""
    return M + (n - 1) * (COL + CANAL)


def ancho_cols(n: int) -> int:
    return n * COL + (n - 1) * CANAL


@dataclass
class Contexto:
    tokens: dict
    perfil: str
    fuentes: dict
    deck: object
    imagenes: Path
    skill: Path


# --- medición de texto con las fuentes reales -----------------------------------

@lru_cache(maxsize=64)
def _font(nombre: str, tam: int):
    ruta = SKILL / "activos" / "tipografias" / nombre
    f = ImageFont.truetype(str(ruta), tam)
    if nombre.startswith("Inter"):
        try: f.set_variation_by_axes([14, 450])
        except Exception: pass
    return f


def envolver(texto: str, fuente: str, tam: int, ancho: int, mayusculas=False) -> list[str]:
    """Parte `texto` en líneas que caben en `ancho` px con la fuente real."""
    f = _font(fuente, tam)
    t = texto.upper() if mayusculas else texto
    lineas, actual = [], ""
    for w in t.split():
        prueba = (actual + " " + w).strip()
        if f.getlength(prueba) <= ancho or not actual:
            actual = prueba
        else:
            lineas.append(actual); actual = w
    if actual: lineas.append(actual)
    return lineas


def titular_ajustado(texto: str, ctx, ancho: int, max_lineas=3) -> tuple[int, int]:
    """(tamaño, líneas) del mayor tamaño de la escala que cabe en max_lineas."""
    limpio = re.sub(r"\*\*", "", texto or "")
    t = ctx.tokens["escala"]["titular"]
    for clave in ("xl", "l", "m", "s"):
        n = len(envolver(limpio, "Anton-Regular.ttf", t[clave], ancho, mayusculas=True))
        if n <= max_lineas: return t[clave], n
    return t["s"], len(envolver(limpio, "Anton-Regular.ttf", t["s"], ancho, mayusculas=True))


def alto_cuerpo(texto: str, tam: int, ancho: int, interlinea=1.4, fuente="Inter-Variable.ttf") -> int:
    return int(len(envolver(texto or "", fuente, tam, ancho)) * tam * interlinea)


# --- utilidades ------------------------------------------------------------------

def C(ctx, k): return ctx.tokens["color"][k]["hex"]
def esc(s): return H.escape(s or "")
def px_a_pt(px: float) -> float: return px * 0.5   # 1920 px = 13.333 in → 1 px = 0.5 pt


@lru_cache(maxsize=128)
def uri(p) -> str:
    """Data-URI de una imagen. El html se abre sin red y se publica en un sandbox: nada de file://."""
    p = Path(p)
    if not p.exists(): return ""
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml", "webp": "image/webp"}.get(p.suffix.lower().lstrip("."), "application/octet-stream")
    return f"data:{mime};base64,{base64.b64encode(p.read_bytes()).decode('ascii')}"


@lru_cache(maxsize=32)
def uri_jpeg(p, ancho: int = 800) -> str:
    """Imagen reducida a JPEG como data-URI: una ventana de 706 px no necesita 4 MB de PNG."""
    from PIL import Image
    p = Path(p)
    if not p.exists(): return ""
    im = Image.open(p).convert("RGB")
    if im.width > ancho: im = im.resize((ancho, int(im.height * ancho / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=88, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


ILUSTRACIONES = sorted(p for p in (SKILL / "activos" / "ilustraciones").iterdir() if p.suffix in (".png", ".svg"))
_SECCIONES = [0]   # contador por deck: las secciones rotan la ilustración una a una


def css_imagenes() -> str:
    """Clases con las imágenes de ventana incrustadas una sola vez."""
    reglas = [f".img-collage{{background-image:url({uri_jpeg(SKILL / 'activos' / 'marca' / 'collage-landing.png')})}}"]
    reglas += [f".img-ilus-{k}{{background-image:url({uri(p) if p.suffix == '.svg' else uri_jpeg(p)})}}" for k, p in enumerate(ILUSTRACIONES)]
    return "\n".join(reglas)


_ico = SKILL / "activos" / "marca" / "claude-simple-icons.svg"
CLAUDE_ICO = _ico.read_text(encoding="utf-8").replace('width="1em" height="1em"', "class='claude-ico'") if _ico.exists() else ""


def caja(x, y, w, h, texto, pt, color, fuente="Inter", negrita=False, espacio=0, runs=None, interlinea=None,
         relleno=None, radio=0, alinear=None, valinear=None, margen=(0, 0), exacto=None, tracking=0, ajustar=True):
    """Una caja de texto (o una forma con relleno y texto) del PPTX. Coordenadas en px del lienzo 1920×1080.
    runs: tramos [{texto, color, pt?, fuente?, negrita?, resaltado?}]; relleno: hex de una forma redondeada."""
    return {"x": x, "y": y, "w": w, "h": h, "texto": texto, "pt": pt, "color": color, "fuente": fuente, "negrita": negrita,
            "espacio": espacio, "runs": runs, "interlinea": interlinea, "relleno": relleno, "radio": radio,
            "alinear": alinear, "valinear": valinear, "margen": margen, "exacto": exacto, "tracking": tracking, "ajustar": ajustar}


# Cajas que registran los helpers (titular, eyebrow, pie, número) mientras se arma una lámina.
_EXTRA: list = []
_TIT: dict | None = None
# Desfase vertical (en em) entre la caja de PowerPoint con interlineado exacto y el bloque CSS; se calibra mirando el render.
ANTON_DESFASE = 0.19   # medido el 20-sep-2026 contra el render de PowerPoint: +0.19 em en cuatro láminas


def medir(texto: str, tam: int, mayus=False, factor=1.0) -> int:
    """Ancho en px de un texto en Inter, medido con la fuente real."""
    t = texto.upper() if mayus else texto
    return int(_font("Inter-Variable.ttf", tam).getlength(t) * factor)


def chip_caja(texto, x, y, estilo, ctx, derecha=False):
    """Un chip o eyebrow como forma redondeada con texto, con las mismas medidas que su CSS."""
    c = {k: v["hex"] for k, v in ctx.tokens["color"].items()}
    if estilo in ("eyebrow-claro", "eyebrow-oscuro"):
        tam, mayus, h = 24, False, 49
        w = 12 + 18 + 12 + medir(texto, tam, False, 1.06) + 24
        margen, alinear = (0, 24, 0, 42), "left"
        fondo, color = (c["accentSoft"], c["accentDeep"]) if estilo == "eyebrow-claro" else ("#22344C", "#FFFFFF")
        negrita = False
    else:
        tam, mayus, h = 20, True, 44
        w = medir(texto, tam, True, 1.10) + int(len(texto) * 0.06 * tam) + 36
        margen, alinear, negrita = (0, 18, 0, 18), "left", True
        fondo, color = {"lima": (c["lime"], c["limeInk"]), "suave": (c["accentSoft"], c["accentDeep"]),
                        "blanco": (c["canvas"], c["text2"]), "navypanel": (c["navyPanel"], c["text3"]),
                        "coral": (c["coral"], c["ink"])}[estilo]
    if derecha: x = x - w
    forma = caja(x, y, w, h, texto.upper() if mayus else texto, px_a_pt(tam), color, negrita=negrita,
                 relleno=fondo, radio=100, alinear=alinear, valinear="middle", margen=margen, ajustar=False,
                 tracking=int(0.06 * tam) if mayus else 0)
    if estilo.startswith("eyebrow"):
        punto = c["accent"] if estilo == "eyebrow-claro" else "#FFFFFF"
        _EXTRA.append(caja(x + 12, y + (h - 18) // 2, 18, 18, "", 1, "#000000", relleno=punto, radio=9))
    return forma


ANTON_ASC, ANTON_DESC = 1.177, 0.330


def base_linea(top, tam, k, interlinea):
    """Base tipográfica de la línea k de un bloque Anton con line-height `interlinea`, como en CSS."""
    return top + k * interlinea * tam + ((interlinea - (ANTON_ASC + ANTON_DESC)) / 2 + ANTON_ASC) * tam


def marcadores_titular(T, color, ancho):
    """Un rectángulo por cada tramo de **acento**, en cada línea donde cae, medido con Anton real."""
    out, spans = "", []
    for k, parte in enumerate(re.split(r"\*\*(.+?)\*\*", T["titular"])):
        if not parte: continue
        up = parte.upper()
        if k % 2 == 1: spans.append((len(out), len(out) + len(up)))
        out += up
    plain = out
    lineas = envolver(plain, "Anton-Regular.ttf", T["tam"], ancho, True)
    f = _font("Anton-Regular.ttf", T["tam"]); tam = T["tam"]
    cajas, inicio = [], 0
    for k, linea in enumerate(lineas):
        i = plain.find(linea, inicio)
        if i < 0: i = inicio
        fin = i + len(linea)
        for a, b in spans:
            s0, e0 = max(a, i), min(b, fin)
            if s0 < e0:
                x0 = M + f.getlength(linea[:s0 - i]) - 0.1 * tam
                x1 = M + f.getlength(linea[:e0 - i]) + 0.1 * tam
                base = base_linea(T["top"], tam, k, .92)
                cajas.append(caja(int(x0), int(base - 0.91 * tam), int(x1 - x0), int(0.96 * tam), "", 1, "#000000", relleno=color, radio=0))
        inicio = fin
    return cajas


def runs_titular(titular, base, acento, resaltado=None, claude=None, tam=None, ancho=None):
    """Tramos del titular en mayúsculas, con los mismos saltos de línea que en pantalla (si se
    dan tam y ancho): un tramo por segmento de línea, y {"salto": True} entre líneas."""
    plain, spans = "", []
    for k, parte in enumerate(re.split(r"\*\*(.+?)\*\*", titular)):
        if not parte: continue
        up = parte.upper()
        if k % 2 == 1: spans.append((len(plain), len(plain) + len(up), parte.strip().lower() == "claude"))
        plain += up
    lineas = envolver(plain, "Anton-Regular.ttf", tam, ancho, True) if (tam and ancho) else [plain]
    out, inicio = [], 0
    for k, linea in enumerate(lineas):
        if k: out.append({"salto": True})
        i = plain.find(linea, inicio)
        if i < 0: i = inicio
        fin = i + len(linea); pos = i
        cortes = sorted({i, fin} | {max(a, i) for a, b, _ in spans if a < fin and b > i} | {min(b, fin) for a, b, _ in spans if a < fin and b > i})
        for c0, c1 in zip(cortes, cortes[1:]):
            seg = plain[c0:c1]
            if not seg: continue
            acc = next(((a, b, cl) for a, b, cl in spans if a <= c0 and c1 <= b), None)
            if acc:
                es_claude = bool(claude) and acc[2]
                out.append({"texto": seg, "color": claude if es_claude else acento, "resaltado": None if es_claude else resaltado})
            else:
                out.append({"texto": seg, "color": base})
        inicio = fin
    return out


def cuerpo_px(ctx) -> int:
    e = ctx.tokens["escala"]
    return max(e["cuerpo"], ctx.tokens["perfil"].get(ctx.perfil, {}).get("cuerpoMinimo", e["cuerpo"]))


def pie_fuente(l: Lamina, ctx) -> str:
    ids = l.citas
    if not ids: return ""
    nombres, vistos = [], set()
    for i in ids:
        f = ctx.fuentes.get(i, {}).get("fuente", i)
        if f not in vistos: vistos.add(f); nombres.append(f)
    badge = " <span class='badge'>proyección</span>" if any(ctx.fuentes.get(i, {}).get("estado") == "proyección" for i in ids) else ""
    texto = " · ".join(nombres)
    if len(texto) > 120: texto = texto[:117].rstrip(" ,;·") + "…"
    return f"<div class='pie editable'><span class='fk'>Fuente</span>{esc(texto)}{badge}</div>"


def pie_texto(l: Lamina, ctx) -> str:
    nombres, vistos = [], set()
    for i in l.citas:
        f = ctx.fuentes.get(i, {}).get("fuente", i)
        if f not in vistos: vistos.add(f); nombres.append(f)
    texto = " · ".join(nombres)
    if len(texto) > 120: texto = texto[:117].rstrip(" ,;·") + "…"
    if any(ctx.fuentes.get(i, {}).get("estado") == "proyección" for i in l.citas): texto += "   ·   PROYECCIÓN"
    return texto


def eyebrow(l: Lamina, ctx, tema: str, texto: str | None = None) -> str:
    t = texto or l["eyebrow"] or f"{ctx.deck.cabecera.get('sesion', ctx.deck.titulo)} · {l.n:02d} / {len(ctx.deck.laminas):02d}"
    return f"<div class='eyebrow eb-{tema} editable'><i></i>{esc(t)}</div>"


def h1(l: Lamina, tam: int, top: int, ancho: int, extra: str = "") -> str:
    global _TIT
    lineas = len(envolver(re.sub(r"\*\*", "", l["titular"]), "Anton-Regular.ttf", tam, ancho, True))
    _TIT = {"top": top, "tam": tam, "ancho": ancho, "lineas": lineas, "titular": l["titular"]}
    return f"<h1 class='tit editable' style='top:{top}px;font-size:{tam}px;width:{ancho}px;{extra}'>{html_acento(l['titular'])}</h1>"


def seccion(l: Lamina, tema: str, interior: str, ctx, eb: str | None = "") -> str:
    c = {k: v["hex"] for k, v in ctx.tokens["color"].items()}
    oscuro = tema in ("navy", "cielo")
    ebh = "" if eb is None else eyebrow(l, ctx, "claro" if tema in ("mesa", "lima") else "oscuro", eb or None)
    if eb is not None:
        t = eb or l["eyebrow"] or f"{ctx.deck.cabecera.get('sesion', ctx.deck.titulo)} · {l.n:02d} / {len(ctx.deck.laminas):02d}"
        _EXTRA.append(chip_caja(t, M, 64, "eyebrow-oscuro" if oscuro else "eyebrow-claro", ctx))
    if _TIT:
        T = _TIT
        geo = dict(tam=T["tam"], ancho=T["ancho"])
        if oscuro: runs = runs_titular(T["titular"], "#FFFFFF", c["lime"], None, claude=c["coral"], **geo)
        elif tema == "lima":
            runs = runs_titular(T["titular"], c["limeInk"], c["ink"], **geo); _EXTRA.extend(marcadores_titular(T, "#FFFFFF", T["ancho"]))
        else:
            runs = runs_titular(T["titular"], c["ink"], c["ink"], **geo); _EXTRA.extend(marcadores_titular(T, c["coral"], T["ancho"]))
        w = min(int(T["ancho"] * 1.02) + 24, 1920 - M - 24)
        _EXTRA.append(caja(M, T["top"] + int(ANTON_DESFASE * T["tam"]), w, int(T["lineas"] * T["tam"] * .92) + int(.6 * T["tam"]),
                           re.sub(r"\*\*", "", T["titular"]).upper(), px_a_pt(T["tam"]), c["ink"], fuente="Anton", runs=runs,
                           exacto=int(T["tam"] * .92), tracking=-int(0.01 * T["tam"])))
    if l.citas:
        _EXTRA.append(caja(M, 1080 - 44 - 34, 1600, 34, "", 11, c["text2"], valinear="bottom", runs=[
            {"texto": "FUENTE   ", "color": c["accent2"] if oscuro else c["accentDeep"], "pt": 7, "fuente": "JetBrains Mono"},
            {"texto": pie_texto(l, ctx), "color": "#93A3B5" if oscuro else c["text2"], "pt": 11}]))
    _EXTRA.append(caja(1920 - 48 - 80, 1080 - 44 - 34, 80, 34, f"{l.n:02d}", 10, c["text3"], fuente="JetBrains Mono", alinear="right", valinear="bottom"))
    interior = re.sub(r"<b>(claude)</b>", lambda m: f"<b class='claude'>{m.group(1)}{CLAUDE_ICO}</b>", interior, flags=re.I)  # CLAUDE + ícono, en coral
    return (f"<section class='l t-{tema}' data-tipo='{l.tipo}' data-n='{l.n}'>{ebh}{interior}"
            f"{pie_fuente(l, ctx)}<div class='num editable'>{l.n:02d}</div></section>")


# --- css ---------------------------------------------------------------------------

def css(ctx) -> str:
    return css_base(ctx) + "\n" + css_imagenes()


def css_base(ctx) -> str:
    c = {k: v["hex"] for k, v in ctx.tokens["color"].items()}
    e, r, s, g = ctx.tokens["escala"], ctx.tokens["radio"], ctx.tokens["sombra"], ctx.tokens["gradiente"]
    cp = cuerpo_px(ctx)
    return f"""
.l{{font-family:Inter,'Segoe UI',Arial,sans-serif;font-weight:450;font-variation-settings:'wght' 450;color:{c['text']};background:{c['surface']}}}
.l,.l *{{box-sizing:border-box}}
.t-navy{{background:{g['vband']};color:{c['canvas']}}}
.t-cielo{{background:{g['vband']};color:{c['canvas']}}}
.vcielo{{position:absolute;left:{col(8)}px;top:96px;width:{ancho_cols(5)}px;height:784px;border-radius:32px;background:{g['ventana']};overflow:hidden;box-shadow:{s['shBlue']};background-size:cover;background-repeat:no-repeat;background-position:center}}
.t-lima{{background:{c['lime']};color:{c['limeInk']}}}
.eyebrow{{position:absolute;left:{M}px;top:64px;display:inline-flex;align-items:center;gap:12px;font-weight:450;font-variation-settings:'wght' 450;font-size:{e['eyebrow']}px;letter-spacing:-.01em;padding:10px 24px 10px 12px;border-radius:{r['pildora']}px;white-space:nowrap}}
.eyebrow i{{width:18px;height:18px;border-radius:50%;background:{c['accent']};box-shadow:inset 0 0 0 4px rgba(255,255,255,.85)}}
.eb-claro{{color:{c['accentDeep']};background:{c['accentSoft']}}}
.eb-oscuro{{color:#fff;background:rgba(255,255,255,.18)}}
.eb-oscuro i{{background:#fff;box-shadow:inset 0 0 0 4px rgba(0,160,219,.9)}}
.tit{{position:absolute;left:{M}px;margin:0;font-family:Anton,Impact,'Arial Narrow',sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:-.01em;line-height:.92;color:{c['ink']}}}
.tit b{{font-weight:400;color:{c['ink']};background:linear-gradient({c['coral']},{c['coral']}) no-repeat 0 0.267em/100% 0.960em;padding:0 .1em;-webkit-box-decoration-break:clone;box-decoration-break:clone}}
.t-navy .tit,.t-cielo .tit{{color:{c['canvas']}}}
.t-navy .tit b,.t-cielo .tit b{{color:{c['lime']};background:none;padding:0}}
.t-navy .tit b.claude,.t-cielo .tit b.claude{{color:{c['coral']}}}
.t-lima .tit{{color:{c['limeInk']}}}.t-lima .tit b{{color:{c['ink']};background:linear-gradient({c['canvas']},{c['canvas']}) no-repeat 0 0.267em/100% 0.960em;padding:0 .1em;-webkit-box-decoration-break:clone;box-decoration-break:clone}}
.cifra{{position:absolute;left:{M - 8}px;margin:0;font-family:Anton,Impact,sans-serif;font-weight:400;line-height:.85;letter-spacing:-.02em;color:{c['accentDeep']};font-variant-numeric:tabular-nums;white-space:nowrap}}
.t-navy .cifra{{color:{c['accent']}}}
.cuerpo{{position:absolute;left:{M}px;margin:0;font-size:{cp}px;line-height:1.4;color:{c['text']}}}
.t-navy .cuerpo,.t-cielo .cuerpo{{color:{c['canvas']}}}
.t-cielo .cuerpo{{color:rgba(245,248,251,.92)}}
.t-lima .cuerpo{{color:{c['limeInk']}}}
.sub{{color:{c['text2']}}}
.t-navy .sub,.t-cielo .sub{{color:{c['text3']}}}
.lista{{position:absolute;left:{M}px;margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:20px}}
.lista li{{font-size:{cp}px;line-height:1.35;padding-left:52px;position:relative}}
.lista li::before{{content:"";position:absolute;left:0;top:.45em;width:14px;height:14px;border-radius:3px;background:{c['coral']}}}
.t-lima .lista li::before{{background:{c['limeInk']}}}
.pie{{position:absolute;left:{M}px;bottom:44px;font-size:{e['pie']}px;color:{c['text2']};display:flex;align-items:baseline;gap:16px;white-space:nowrap}}
.pie .fk{{font-family:'JetBrains Mono',Consolas,monospace;font-size:14px;letter-spacing:.12em;text-transform:uppercase;font-weight:500;color:{c['accentDeep']}}}
.t-navy .pie .fk{{color:{c['accent2']}}}
.badge{{margin-left:10px;padding:4px 10px;border-radius:{r['pildora']}px;background:{c['accentSoft']};color:{c['accentDeep']};font-size:16px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}}
.num{{position:absolute;right:48px;bottom:44px;font-family:'JetBrains Mono',Consolas,monospace;font-size:20px;color:{c['text3']}}}
.ficha{{position:absolute;background:{c['canvas']};border:1px solid {c['line']};border-radius:{r['l']}px;box-shadow:{s['sh2']};padding:48px}}
.t-navy .ficha{{background:{c['navyPanel']};border-color:rgba(255,255,255,.14);box-shadow:none}}
.ventana-cielo{{position:absolute;border-radius:{r['xl']}px;background:{g['cielo']};box-shadow:{s['shBlue']};overflow:hidden}}
.ventana-cielo img{{width:100%;height:100%;object-fit:cover;display:block}}
.chip{{display:inline-flex;align-items:center;gap:10px;padding:10px 18px;border-radius:{r['pildora']}px;font-weight:600;font-variation-settings:'wght' 600;font-size:20px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}}
.chip.lima{{background:{c['lime']};color:{c['limeInk']}}}
.chip.suave{{background:{c['accentSoft']};color:{c['accentDeep']}}}
.chip.coral{{background:{c['coral']};color:{c['ink']}}}
.chip.blanco{{background:{c['canvas']};color:{c['text2']};border:1px solid {c['lineStrong']}}}
.mono{{font-family:'JetBrains Mono',Consolas,monospace;font-size:{e['mono']}px;line-height:1.45;white-space:pre-wrap}}
/* tabla · barras */
.filas{{display:flex;flex-direction:column}}
.fila{{display:grid;grid-template-columns:480px 1fr 240px;align-items:center;gap:32px;height:72px;border-top:1px solid {c['line']};font-size:32px;font-weight:500;font-variation-settings:'wght' 500}}
.fila:first-child{{border-top:0}}
.fila .barra{{height:32px;border-radius:8px;background:{c['accent']}}}
.fila:first-child .barra{{background:{c['accentDeep']}}}
.fila .valor{{font-family:'JetBrains Mono',monospace;font-weight:500;text-align:right;color:{c['ink']};font-variant-numeric:tabular-nums}}
/* tabla · bloques de hora */
.bloques{{display:grid;grid-template-columns:repeat(5,288px);gap:40px}}
.bloq{{display:flex;flex-direction:column;gap:16px}}
.bloq .h{{font-family:'JetBrains Mono',monospace;font-size:36px;font-weight:500;color:{c['ink']}}}
.bloq .rej{{display:grid;grid-template-columns:repeat(8,24px);gap:4px}}
.bloq .rej i{{width:24px;height:24px;border-radius:4px;background:{c['accentDeep']}}}
.bloq .rej i.perdida{{background:#FDE7D6;border:2px solid {c['coral']}}}
.bloq .a{{font-family:Anton,Impact,sans-serif;font-size:48px;color:{c['ink']};letter-spacing:.02em}}
/* comparación */
.comp{{display:grid;grid-template-columns:1fr 64px 1fr;gap:24px;align-items:center}}
.comp>div{{padding:28px 32px;border-radius:{r['m']}px;font-size:{cp - 4}px;line-height:1.35}}
.comp .antes{{background:{c['surface']};color:{c['text2']}}}
.comp .despues{{background:{c['accentSoft']};color:{c['text']}}}
.comp .flecha{{padding:0;text-align:center;font-family:Anton,Impact,sans-serif;font-size:56px;color:{c['coral']};text-shadow:0 0 0 {c['coral']}}}
.comp .despues{{border-left:0}}
/* definiciones */
.defi{{display:grid;grid-template-columns:420px 1fr;gap:32px;align-items:start;padding:22px 0;border-top:1px solid {c['line']};font-size:{cp - 4}px;line-height:1.35}}
.defi:first-child{{border-top:0;padding-top:0}}
.defi .k{{font-weight:600;font-variation-settings:'wght' 600;color:{c['ink']}}}
/* pacto */
.tabs{{position:absolute;left:{M}px;top:{TOP_TIT}px;display:flex;gap:16px}}
.tabs span{{width:112px;height:80px;display:flex;align-items:center;justify-content:center;font-family:Anton,Impact,sans-serif;font-size:44px;border-radius:{r['m']}px;background:{c['canvas']};border:1px solid {c['line']};color:{c['lineStrong']}}}
.tabs span.on{{background:{c['coral']};color:{c['ink']};border-color:{c['coral']}}}
.letra{{position:absolute;width:360px;height:360px;display:flex;align-items:center;justify-content:center;font-family:Anton,Impact,sans-serif;font-size:280px;line-height:1;color:{c['ink']};background:{c['coral']};border-radius:{r['xl']}px}}
.pac{{display:grid;grid-template-columns:200px 1fr;gap:32px;align-items:start;padding:22px 0;border-top:1px solid {c['line']};font-size:32px;line-height:1.35}}
.pac:first-child{{border-top:0}}
.pac.bien{{background:{c['accentSoft']};margin:0 -48px;padding:22px 48px}}
.riel{{position:absolute;display:flex;gap:32px}}
.riel .ficha{{position:relative;padding:40px;display:flex;flex-direction:column;gap:14px}}
.riel .L{{font-family:Anton,Impact,sans-serif;font-size:200px;line-height:.9;color:{c['accentDeep']}}}
.riel .N{{font-family:Anton,Impact,sans-serif;font-size:72px;line-height:1;color:{c['accentDeep']}}}
.riel .P{{font-weight:600;font-variation-settings:'wght' 600;font-size:28px;letter-spacing:.08em;text-transform:uppercase;color:{c['ink']}}}
.riel .T{{font-weight:600;font-variation-settings:'wght' 600;font-size:32px;color:{c['ink']};line-height:1.25}}
.riel .D{{font-size:28px;line-height:1.35;color:{c['text2']}}}
.riel .lineas{{margin-top:auto;display:flex;flex-direction:column;gap:40px;padding-top:24px}}
.riel .lineas i{{display:block;border-top:2px dotted {c['lineStrong']}}}
/* demo */
.pantalla{{position:absolute;background:{c['canvas']};border-radius:{r['l']}px;box-shadow:{s['sh3']};overflow:hidden;border:1px solid rgba(255,255,255,.14)}}
.pantalla .barra-t{{height:44px;background:{c['surface']};border-bottom:1px solid {c['line']};display:flex;align-items:center;gap:8px;padding-left:18px}}
.pantalla .barra-t i{{width:10px;height:10px;border-radius:50%;background:{c['lineStrong']}}}
.pantalla img{{display:block;width:100%;height:calc(100% - 44px);object-fit:cover;object-position:top}}
.pantalla .vacia{{height:calc(100% - 44px);background:{c['surface']};display:flex;align-items:center;justify-content:center;color:{c['text3']};font-size:28px}}
.prompt{{position:absolute;padding:32px;border-radius:{r['l']}px;background:{c['navyPanel']};border:1px solid rgba(255,255,255,.14);color:{c['canvas']};font-family:'JetBrains Mono',monospace;font-size:30px;line-height:1.45}}
/* encuesta */
.qr{{width:400px;height:400px;margin:0 auto;border-radius:8px;background:repeating-conic-gradient({c['ink']} 0 25%,{c['canvas']} 0 50%) 0 0/40px 40px}}
/* timer chip */
.timer{{position:absolute;right:{M}px;top:{TOP_TIT}px;height:56px;padding:0 20px;display:inline-flex;align-items:center;gap:14px;border-radius:{r['pildora']}px;background:{c['canvas']};border:1px solid {c['lineStrong']};font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:500;color:{c['ink']}}}
.timer svg{{width:28px;height:28px}}
/* cita */
.cita-t{{position:absolute;left:{M}px;margin:0;font-size:64px;line-height:1.25;font-weight:450;color:{c['canvas']}}}
.cita-o{{position:absolute;left:{M}px;margin:0;font-size:28px;color:{c['text3']}}}
/* cierre */
.accion{{position:absolute;left:{M}px;bottom:128px;width:{ANCHO_UTIL}px;display:grid;grid-template-columns:repeat(3,1fr);gap:32px}}
.accion div{{border-top:3px solid {c['coral']};padding-top:16px;font-size:30px;line-height:1.35}}
.accion b{{display:block;font-weight:600;font-variation-settings:'wght' 600;font-size:{e['eyebrow']}px;letter-spacing:.12em;text-transform:uppercase;color:{c['coral']};margin-bottom:8px}}
/* portada */
.placa{{position:absolute;display:inline-flex;align-items:center;gap:36px;background:{c['canvas']};padding:22px 36px;border-radius:{r['m']}px}}
.placa img{{height:52px;display:block}}
.claude-ico{{height:.72em;width:auto;vertical-align:-.04em;margin-left:.08em;display:inline-block}}
.comillas{{position:absolute;left:{M - 6}px;font-family:Anton,Impact,sans-serif;font-size:220px;line-height:1;color:{c['coral']}}}
.mock{{display:grid;grid-template-columns:200px 1fr;height:calc(100% - 44px);background:{c['canvas']}}}
.mock aside{{background:{c['surface']};border-right:1px solid {c['line']};padding:22px 20px;display:flex;flex-direction:column;gap:16px}}
.mock aside .logo{{width:30px;height:30px;border-radius:9px;background:{c['coral']};margin-bottom:10px}}
.mock aside b{{display:block;height:12px;border-radius:6px;background:{c['surface2']}}}
.mock aside b:nth-child(3){{width:70%}}.mock aside b:nth-child(5){{width:55%}}
.mock .panel{{padding:36px 40px;display:flex;flex-direction:column;gap:24px;position:relative}}
.mock .hola{{font-size:24px;color:{c['text3']}}}
.mock .burbuja{{align-self:flex-end;max-width:80%;background:{c['accentSoft']};color:{c['text']};border-radius:22px 22px 8px 22px;padding:18px 24px;font-size:22px;line-height:1.4}}
.mock .resp{{display:flex;flex-direction:column;gap:14px;padding-right:20%}}
.mock .resp i{{display:block;height:14px;border-radius:7px;background:{c['surface2']}}}
.mock .composer{{margin-top:auto;border:1px solid {c['lineStrong']};border-radius:16px;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;color:{c['text3']};font-size:22px}}
.mock .composer em{{width:40px;height:40px;border-radius:50%;background:{c['coral']};color:{c['ink']};display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:600;font-size:22px}}
"""


# --- renderizadores ------------------------------------------------------------------

def ventana_cielo(ctx, posicion: str, clase: str = "img-collage") -> str:
    """La ventana de cielo de portada y sección. Portada: el collage del hero de la landing.
    Sección: una de las ilustraciones propias, rotando. Sin texto encima, nunca."""
    return f"<div class='vcielo {clase}' style='background-position:{posicion}'></div>"


def r_portada(l, ctx):
    if l.n == 1: _SECCIONES[0] = 0   # cada deck arranca la rotación de ilustraciones desde cero
    ancho = ancho_cols(7)
    tam, n = titular_ajustado(l["titular"], ctx, ancho, 2)
    top = 392 if n <= 2 else 320
    interior = h1(l, tam, top, ancho)
    y = top + int(tam * .92 * n) + 40
    cajas = []
    if l["texto"]:
        interior += f"<p class='cuerpo editable' style='top:{y}px;width:{ancho}px;font-size:40px'>{esc(l['texto'])}</p>"
        cajas.append(caja(M, y, ancho, 120, l["texto"], px_a_pt(40), "#F5F8FB"))
    interior += ventana_cielo(ctx, "50% 50%")
    logo = ctx.skill / "activos" / "marca" / "vadai-wordmark-900.png"
    tc = ctx.skill / "activos" / "marca" / "totalcoach-logo-1200.png"
    interior += f"<div class='placa' style='left:{M}px;bottom:96px'><img src='{uri(logo)}' alt='VADAI'><img src='{uri(tc)}' alt='Total Coach' style='height:40px'></div>"
    return seccion(l, "cielo", interior, ctx, eb=None), cajas


def r_seccion(l, ctx):
    ancho = ancho_cols(7)
    tam, n = titular_ajustado(l["titular"], ctx, ancho, 4)
    top = 880 - int(tam * .92 * n)
    interior = h1(l, tam, top, ancho)
    cajas = []
    if l["texto"]:
        y = top - 24 - alto_cuerpo(l["texto"], 36, ancho)
        interior += f"<p class='cuerpo sub editable' style='top:{y}px;width:{ancho}px'>{esc(l['texto'])}</p>"
        cajas.append(caja(M, y, ancho, 80, l["texto"], px_a_pt(36), "#F5F8FB"))
    clase = f"img-ilus-{_SECCIONES[0] % len(ILUSTRACIONES)}" if ILUSTRACIONES else "img-collage"
    _SECCIONES[0] += 1
    interior += ventana_cielo(ctx, "center", clase)
    return seccion(l, "cielo", interior, ctx), cajas


def ventana_imagen(l, ctx):
    """Si la lámina trae `imagen:` y existe, devuelve (html de la ventana en cols 9–12, True).
    Es el injerto de Cielo editorial: imagen a un lado, texto corto al otro. Sin imagen no se
    dibuja nada: una ventana vacía sería fondo decorativo."""
    img = ctx.imagenes / l["imagen"] if l["imagen"] else None
    if not (img and img.exists()): return "", False
    return f"<div class='ventana-cielo' style='left:{col(9)}px;top:144px;width:{ancho_cols(4)}px;height:808px'><img src='{uri(img)}' alt=''></div>", True


def r_numero(l, ctx):
    img = ctx.imagenes / l["imagen"] if l["imagen"] else None
    con_ventana = bool(img and img.exists())
    ancho_tit = ancho_cols(7) if con_ventana else ancho_cols(9)
    tam, n = titular_ajustado(l["titular"], ctx, ancho_tit, 3)
    y = TOP_TIT + int(tam * .92 * n) + 40
    ctam = ctx.tokens["escala"]["cifra"]["xl"] if len(l["cifra"]) <= 5 else ctx.tokens["escala"]["cifra"]["l"]
    # la cifra baja si el titular es alto; nunca por debajo del cuerpo mínimo
    cp = cuerpo_px(ctx)
    while y + int(ctam * .85) + 40 + alto_cuerpo(l["texto"], cp, ancho_tit) > 1080 - 120 and ctam > 160:
        ctam -= 40
    interior = h1(l, tam, TOP_TIT, ancho_tit)
    interior += f"<div class='cifra editable' style='top:{y}px;font-size:{ctam}px'>{esc(l['cifra'])}</div>"
    _EXTRA.append(caja(M - 8, y + int(ANTON_DESFASE * ctam), ancho_tit, int(ctam * .85) + int(.6 * ctam), l["cifra"], px_a_pt(ctam), C(ctx, "accentDeep"), fuente="Anton", exacto=int(ctam * .85), tracking=-int(0.02 * ctam), ajustar=False))
    yc = y + int(ctam * .85) + 40
    interior += f"<p class='cuerpo editable' style='top:{yc}px;width:{ancho_tit}px'>{esc(l['texto'])}</p>"
    # ventana de cielo (injerto de Cielo editorial): solo cuando trae imagen; vacía sería fondo decorativo
    if con_ventana:
        interior += f"<div class='ventana-cielo' style='left:{col(9)}px;top:144px;width:{ancho_cols(4)}px;height:808px'><img src='{uri(img)}' alt=''></div>"
    return seccion(l, "mesa", interior, ctx), [caja(M, yc, ancho_tit, alto_cuerpo(l["texto"], cp, ancho_tit) + 10, l["texto"], px_a_pt(cp), "#072835")]


def r_frase(l, ctx):
    ventana, con_ventana = ventana_imagen(l, ctx)
    ancho = ancho_cols(7) if con_ventana else ANCHO_UTIL
    tam, n = titular_ajustado(l["titular"], ctx, ancho, 4 if con_ventana else 3)
    interior = h1(l, tam, TOP_TIT, ancho)
    cajas = []
    if l["texto"]:
        y = TOP_TIT + int(tam * .92 * n) + 56
        cp = cuerpo_px(ctx)
        w = min(1200, ancho)
        interior += f"<p class='cuerpo editable' style='top:{y}px;width:{w}px'>{esc(l['texto'])}</p>"
        cajas.append(caja(M, y, w, alto_cuerpo(l["texto"], cp, w) + 10, l["texto"], px_a_pt(cp), "#072835"))
    return seccion(l, "mesa", interior + ventana, ctx), cajas


def _ficha_bajo_titular(l, ctx, ancho_tit=ANCHO_UTIL, max_lineas=2):
    tam, n = titular_ajustado(l["titular"], ctx, ancho_tit, max_lineas)
    y = TOP_TIT + int(tam * .92 * n) + 40
    return h1(l, tam, TOP_TIT, ancho_tit), y, 1080 - 120 - y


def r_lista(l, ctx):
    ventana, con_ventana = ventana_imagen(l, ctx)
    ancho = ancho_cols(7) if con_ventana else ANCHO_UTIL
    tit, y, alto = _ficha_bajo_titular(l, ctx, ancho, 3 if con_ventana else 2)
    items = items_lista(l["texto"])
    cp = cuerpo_px(ctx)
    w = min(1100, ancho)
    ul = "<ul class='lista editable' style='top:%dpx;width:%dpx'>%s</ul>" % (y + 8, w, "".join(f"<li>{esc(i)}</li>" for i in items))
    return seccion(l, "mesa", tit + ul + ventana, ctx), [caja(M + 52, y + 8, w - 52, alto, items, px_a_pt(cp), "#072835", espacio=12)]


def r_tabla(l, ctx):
    tit, y, alto = _ficha_bajo_titular(l, ctx)
    filas = filas_tabla(l["texto"])
    # (a) bloques de hora: filas 'AAAA · N h'
    if len(filas) >= 3 and all(len(f) >= 2 and re.match(r"^\d{4}$", f[0]) and re.search(r"(\d+)\s*h", f[-1]) for f in filas):
        horas = [int(re.search(r"(\d+)\s*h", f[-1]).group(1)) for f in filas]
        mx = max(horas)
        cols = []
        for f, h in zip(filas, horas):
            celdas = "".join(f"<i class='{'perdida' if k >= h else ''}'></i>" for k in range(mx))
            cols.append(f"<div class='bloq'><span class='h'>{h} h</span><div class='rej'>{celdas}</div><span class='a'>{esc(f[0])}</span></div>")
        chip = "<span class='chip suave' style='position:absolute;right:48px;top:40px'>salario íntegro</span>" if "salario" in (l["texto"] + l["nota"]).lower() or True else ""
        ficha = f"<div class='ficha' style='left:{M}px;top:{y}px;width:{ANCHO_UTIL}px;height:{alto}px'>{chip}<div class='bloques' style='margin-top:32px'>{''.join(cols)}</div></div>"
        return seccion(l, "mesa", tit + ficha, ctx), []
    # (b) comparación: filas 'a → b' — dos celdas y una flecha, sin cabeceras que presuman antes/después
    if all(len(f) == 1 and "→" in f[0] for f in filas):
        pares = [(a.strip(), b.strip()) for a, b in (f[0].split("→", 1) for f in filas)]
        celdas = "".join(f"<div class='antes'>{esc(a)}</div><div class='flecha'>→</div><div class='despues'>{esc(b)}</div>" for a, b in pares)
        ficha = f"<div class='ficha' style='left:{M}px;top:{y}px;width:{ANCHO_UTIL}px;height:auto'><div class='comp editable'>{celdas}</div></div>"
        cp = cuerpo_px(ctx); fs = cp - 4
        cellw = (ANCHO_UTIL - 96 - 64 - 48) // 2
        cajas, yy = [], y + 48
        for a, b in pares:
            ha = alto_cuerpo(a, fs, cellw - 64, 1.35) + 56; hb = alto_cuerpo(b, fs, cellw - 64, 1.35) + 56; hh = max(ha, hb)
            cajas.append(caja(M + 48, yy + (hh - ha) // 2, cellw, ha, a, px_a_pt(fs), C(ctx, "text2"), relleno=C(ctx, "surface"), radio=14, valinear="middle", margen=(28, 32)))
            cajas.append(caja(M + 48 + cellw + 24, yy, 64, hh, "→", 28, C(ctx, "coral"), fuente="Anton", alinear="center", valinear="middle"))
            cajas.append(caja(M + 48 + cellw + 24 + 64 + 24, yy + (hh - hb) // 2, cellw, hb, b, px_a_pt(fs), C(ctx, "text"), relleno=C(ctx, "accentSoft"), radio=14, valinear="middle", margen=(28, 32)))
            yy += hh + 24
        return seccion(l, "mesa", tit + ficha, ctx), cajas
    # (c) ranking con barras cuando hay números; (d) definiciones cuando no
    nums = []
    for f in filas:
        m = re.fullmatch(r"\s*[+\-−]?([\d][\d,\.]*)\s*(%|M|mil|h|d|×|x)?\s*", f[-1]) if len(f) >= 2 else None
        nums.append(float(m.group(1).replace(",", "")) if m else None)
    con_numeros = any(n is not None for n in nums)
    if not con_numeros:
        fk = _font("Inter-Variable.ttf", 32)
        ancho_k = max(120, min(420, int(max(fk.getlength(f[0]) for f in filas) * 1.06) + 24))
        pad = 22 if len(filas) < 5 else 14
        html_f = "".join(f"<div class='defi' style='grid-template-columns:{ancho_k}px 1fr;padding:{pad}px 0'><span class='k editable'>{esc(f[0])}</span><span class='editable'>{esc(' · '.join(f[1:]))}</span></div>" for f in filas[:6])
        ficha = f"<div class='ficha' style='left:{M}px;top:{y}px;width:{ANCHO_UTIL}px;height:auto'><div class='filas'>{html_f}</div></div>"
        cp = cuerpo_px(ctx); fs = cp - 4
        wt = ANCHO_UTIL - 96 - ancho_k - 32
        cajas, yy = [], y + 48
        for i, f in enumerate(filas[:6]):
            tx = " · ".join(f[1:]); arriba = 0 if i == 0 else pad
            h = max(alto_cuerpo(tx, fs, wt, 1.35), alto_cuerpo(f[0], fs, ancho_k, 1.35))
            cajas.append(caja(M + 48, yy + arriba, ancho_k, h + 6, f[0], px_a_pt(fs), C(ctx, "ink"), negrita=True))
            cajas.append(caja(M + 48 + ancho_k + 32, yy + arriba, wt, h + 6, tx, px_a_pt(fs), C(ctx, "text")))
            yy += arriba + h + pad
        return seccion(l, "mesa", tit + ficha, ctx), cajas
    mx = max([n for n in nums if n], default=None)
    n_filas = min(len(filas), 7)
    alto_fila = 72 if 96 + 72 * n_filas <= alto else max(52, (alto - 96) // n_filas)
    fs = 32 if alto_fila >= 64 else 26
    html_f, cajas, yy = [], [], y + 48
    for k, (f, n) in enumerate(zip(filas[:7], nums)):
        et, val = (f[0], f[-1]) if len(f) >= 2 else (f[0], "")
        wb = max(24, int(n / mx * 880)) if (n and mx) else 0
        barra = f"<div class='barra editable' style='width:{wb}px'></div>" if wb else "<div></div>"
        html_f.append(f"<div class='fila' style='height:{alto_fila}px;font-size:{fs}px'><span class='editable'>{esc(et)}</span>{barra}<span class='valor editable'>{esc(val)}</span></div>")
        cajas.append(caja(M + 48, yy, 480, alto_fila, et, px_a_pt(fs), C(ctx, "text"), valinear="middle"))
        if wb: cajas.append(caja(M + 48 + 512, yy + (alto_fila - 32) // 2, min(848, wb), 32, "", 1, "#000000", relleno=C(ctx, "accentDeep" if k == 0 else "accent"), radio=8))
        cajas.append(caja(M + 1440, yy, 240, alto_fila, val, px_a_pt(fs), C(ctx, "ink"), fuente="JetBrains Mono", alinear="right", valinear="middle"))
        yy += alto_fila
    mas = f"<div class='cuerpo sub editable' style='position:static;font-size:24px;margin-top:16px'>y {len(filas) - 7} más</div>" if len(filas) > 7 else ""
    if mas: cajas.append(caja(M + 48, yy + 16, 600, 36, f"y {len(filas) - 7} más", 12, C(ctx, "text2")))
    alto_ficha = min(alto, 96 + alto_fila * n_filas + (56 if mas else 0))
    ficha = f"<div class='ficha' style='left:{M}px;top:{y}px;width:{ANCHO_UTIL}px;height:{alto_ficha}px'><div class='filas'>{''.join(html_f)}</div>{mas}</div>"
    return seccion(l, "mesa", tit + ficha, ctx), cajas


def mock_claude(prompt: str) -> str:
    """Boceto de la pantalla de Claude dibujado en HTML: barra lateral, burbuja con el prompt,
    respuesta en esqueleto y caja para escribir. Se usa mientras no hay captura real."""
    p = (prompt or "").strip()
    if len(p) > 170: p = p[:167].rstrip() + "…"
    return ("<div class='mock'><aside><i class='logo'></i><b></b><b></b><b></b><b></b></aside><div class='panel'>"
            "<div class='hola'>¿En qué te ayudo hoy?</div>"
            f"<div class='burbuja'>{esc(p)}</div>"
            "<div class='resp'><i style='width:96%'></i><i style='width:78%'></i><i style='width:88%'></i><i style='width:42%'></i></div>"
            "<div class='composer'><span>Escribe a Claude…</span><em>↑</em></div></div></div>")


def r_demo(l, ctx):
    ancho_tit = ancho_cols(5)
    tam, n = titular_ajustado(l["titular"], ctx, ancho_tit, 3)
    if tam > 112: tam = 112; n = len(envolver(re.sub(r"\*\*", "", l["titular"]), "Anton-Regular.ttf", 112, ancho_tit, True))
    interior = h1(l, tam, TOP_TIT, ancho_tit)
    y = TOP_TIT + int(tam * .92 * n) + 40
    if l["texto"]:
        interior += f"<div class='prompt editable' style='left:{M}px;top:{y}px;width:{ancho_tit}px'>{esc(l['texto'])}</div>"
        hp = alto_cuerpo(l["texto"], 30, ancho_tit - 64, 1.45, "JetBrainsMono-Variable.ttf") + 64
        _EXTRA.append(caja(M, y, ancho_tit, hp, l["texto"], 15, "#FFFFFF", fuente="JetBrains Mono", relleno=C(ctx, "navyPanel"), radio=22, margen=(32, 32), interlinea=1.45))
        y += hp + 24
    if "correo" in (l["texto"] + l["titular"]).lower():
        interior += "<span class='chip lima editable' style='position:absolute;left:%dpx;top:%dpx'>Nadie envía nada</span>" % (M, y)
        _EXTRA.append(chip_caja("Nadie envía nada", M, y, "lima", ctx))
    img = ctx.imagenes / l["imagen"] if l["imagen"] else None
    interior += (f"<div class='pantalla' style='left:{col(6)}px;top:208px;width:{ancho_cols(7)}px;height:704px'><div class='barra-t'><i></i><i></i><i></i></div>"
                 + (f"<img src='{uri(img)}' alt=''>" if img and img.exists() else mock_claude(l["texto"])) + "</div>")
    etiqueta = (l["respaldo"] or l["imagen"]) if (img and img.exists()) else "boceto · la captura real entra la semana del curso"
    interior += f"<span class='chip blanco editable' style='position:absolute;left:{col(6)}px;top:936px;background:{C(ctx, 'navyPanel')};color:{C(ctx, 'text3')};border-color:rgba(255,255,255,.14)'>{esc(etiqueta)}</span>"
    _EXTRA.append(chip_caja(etiqueta, col(6), 936, "navypanel", ctx))
    return seccion(l, "navy", interior, ctx, eb="En vivo · pantalla compartida"), []


def r_encuesta(l, ctx):
    """Encuesta en vivo. El QR NO se dibuja aquí: se muestra en tiempo real desde la pantalla
    de proyección de la academia. Un QR de relleno confunde a la sala (Alejandro, 20-sep-2026)."""
    ventana, con_ventana = ventana_imagen(l, ctx)
    ancho = ancho_cols(7) if con_ventana else ancho_cols(9)
    tam, n = titular_ajustado(l["titular"], ctx, ancho, 3)
    interior = h1(l, tam, TOP_TIT, ancho)
    y = TOP_TIT + int(tam * .92 * n) + 48
    cp = cuerpo_px(ctx)
    cajas = []
    if l["texto"]:
        interior += f"<p class='cuerpo editable' style='top:{y}px;width:{ancho}px'>{esc(l['texto'])}</p>"
        cajas.append(caja(M, y, ancho, alto_cuerpo(l["texto"], cp, ancho) + 10, l["texto"], px_a_pt(cp), "#072835"))
    interior += f"<span class='chip lima editable' style='position:absolute;left:{M}px;bottom:128px'>Contesta desde tu celular · el QR va en pantalla</span>"
    _EXTRA.append(chip_caja("Contesta desde tu celular · el QR va en pantalla", M, 1080 - 128 - 44, "lima", ctx))
    return seccion(l, "mesa", interior + ventana, ctx), cajas


def r_pacto(l, ctx):
    activa = (l.acentos[0].strip()[:1].upper() if l.acentos else "")
    filas = filas_tabla(l["texto"])
    if not activa or activa not in "PACTO":  # panorama: cinco fichas
        fichas = []
        nombres = {"P": "Perfil", "A": "Acción", "C": "Contexto", "T": "Tono y formato", "O": "Omisiones"}
        defs = {}
        for f in filas:
            letra = f[0].strip().upper()[:1]
            if len(f) >= 3: defs[letra] = (f[1], f[2])
            elif len(f) == 2: defs[letra] = (nombres.get(letra, ""), f[1])
        for k, letra in enumerate("PACTO"):
            nom, de = defs.get(letra, (nombres[letra], ""))
            extra = "<span class='chip coral' style='position:absolute;right:16px;top:16px;font-size:16px;padding:8px 12px'>la que se saltan</span>" if letra == "O" else ""
            fichas.append(f"<div class='ficha' style='width:304px;height:704px'>{extra}<span class='L'>{letra}</span><span class='P'>{esc(nom)}</span><span class='D'>{esc(de)}</span></div>")
        interior = f"<div class='riel' style='left:{M}px;top:224px'>{''.join(fichas)}</div>"
        return seccion(l, "mesa", interior, ctx), []
    tabs = "<div class='tabs'>" + "".join(f"<span class='{'on' if k == activa else ''}'>{k}</span>" for k in "PACTO") + "</div>"
    y = TOP_TIT + 80 + 40
    filas_html, cajas = [], []
    yy = y + 48
    for f in filas:
        et = f[0] if f else ""; tx = " · ".join(f[1:]) if len(f) > 1 else ""
        cls = "bien" if et.lower().startswith("bien") else ""
        filas_html.append(f"<div class='pac {cls}'><span class='chip {'suave' if cls else 'blanco'}' style='justify-self:start'>{esc(et)}</span><span class='editable'>{esc(tx)}</span></div>")
        x_txt = col(4) + 48 + 200 + 32  # ficha + padding + columna del chip + canal
        cajas.append(caja(x_txt, yy + 24, ANCHO_UTIL - ancho_cols(3) - CANAL - 48 - 200 - 32 - 48, 90, tx, px_a_pt(32), "#072835")); yy += 118
    interior = (tabs + f"<div class='letra' style='left:{M}px;top:{y + 20}px'>{activa}</div>"
                f"<div class='ficha' style='left:{col(4)}px;top:{y}px;width:{ANCHO_UTIL - ancho_cols(3) - CANAL}px;height:auto;min-height:320px'><div class='filas'>{''.join(filas_html)}</div></div>")
    return seccion(l, "mesa", interior, ctx), cajas


def r_ejercicio(l, ctx):
    ancho_tit = ancho_cols(9)
    tam, n = titular_ajustado(l["titular"], ctx, ancho_tit, 2)
    if tam > 112: tam = 112; n = len(envolver(re.sub(r"\*\*", "", l["titular"]), "Anton-Regular.ttf", 112, ancho_tit, True))
    interior = h1(l, tam, TOP_TIT, ancho_tit)
    interior += f"<div class='timer editable'><svg viewBox='0 0 28 28'><circle cx='14' cy='14' r='11' fill='none' stroke='#D2E3EC' stroke-width='4'/><circle cx='14' cy='14' r='11' fill='none' stroke='#006E96' stroke-width='4' stroke-dasharray='69' stroke-dashoffset='17' transform='rotate(-90 14 14)'/></svg>{esc(l['tiempo'] or '20')} min</div>"
    y = max(TOP_TIT + int(tam * .92 * n) + 40, 320)
    items = items_lista(l["texto"])[:4]
    k = len(items) or 1
    w = (ANCHO_UTIL - (k - 1) * CANAL) // k
    fichas = []
    for i, it in enumerate(items, 1):
        t, _, d = it.partition(":")
        fichas.append(f"<div class='ficha' style='width:{w}px;height:{1080 - 120 - y}px'><span class='N editable'>{i:02d}</span><span class='T editable'>{esc(t.strip())}</span><span class='D editable'>{esc(d.strip())}</span><div class='lineas'><i></i><i></i></div></div>")
    interior += f"<div class='riel' style='left:{M}px;top:{y}px'>{''.join(fichas)}</div>"
    cajas = []
    for i, it in enumerate(items):
        t, _, d = it.partition(":")
        fx = M + i * (w + CANAL) + 40
        ht = alto_cuerpo(t.strip(), 32, w - 80, 1.25)
        cajas.append(caja(fx, y + 40 + int(ANTON_DESFASE * 72), 120, 76 + 40, f"{i + 1:02d}", 36, C(ctx, "accentDeep"), fuente="Anton", exacto=72, ajustar=False))
        cajas.append(caja(fx, y + 40 + 72 + 14, w - 80, ht + 6, t.strip(), 16, C(ctx, "ink"), negrita=True))
        cajas.append(caja(fx, y + 40 + 72 + 14 + ht + 14, w - 80, 160, d.strip(), px_a_pt(28), "#4E6572"))
    cajas.append(chip_caja(f"{l['tiempo'] or '20'} min", 1920 - M, TOP_TIT, "blanco", ctx, derecha=True))
    return seccion(l, "lima", interior, ctx), cajas


def r_cita(l, ctx):
    m = re.match(r'^"?(.+?)"?\s+—\s+(.+)$', l["cita"] or "")
    frase, origen = (m.group(1), m.group(2)) if m else (l["cita"], "")
    h = alto_cuerpo(frase, 64, 1500, 1.25)
    top = (1080 - h) // 2 + 40
    interior = f"<span class='comillas' style='top:{top - 170}px'>“</span><p class='cita-t editable' style='top:{top}px;width:1500px'>{esc(frase)}</p><p class='cita-o editable' style='top:{top + h + 32}px'>— {esc(origen)}</p>"
    cajas = [caja(M, top, 1500, h + 10, frase, px_a_pt(64), "#F5F8FB"), caja(M, top + h + 32, 1200, 50, f"— {origen}", px_a_pt(28), "#93A3B5")]
    return seccion(l, "navy", interior, ctx), cajas


def r_cierre(l, ctx):
    tam, n = titular_ajustado(l["titular"], ctx, ANCHO_UTIL, 3)
    if tam > 152: tam = 152; n = len(envolver(re.sub(r"\*\*", "", l["titular"]), "Anton-Regular.ttf", 152, ANCHO_UTIL, True))
    interior = h1(l, tam, TOP_TIT, ANCHO_UTIL)
    cajas = []
    y = TOP_TIT + int(tam * .92 * n) + 48
    if l["texto"]:
        interior += f"<p class='cuerpo editable' style='top:{y}px;width:1200px'>{esc(l['texto'])}</p>"
        cajas.append(caja(M, y, 1200, alto_cuerpo(l["texto"], cuerpo_px(ctx), 1200) + 10, l["texto"], px_a_pt(cuerpo_px(ctx)), "#F5F8FB"))
    partes = [p.strip() for p in (l["accion"] or "").split("|") if p.strip()]
    if partes:
        celdas = []
        for k, p in enumerate(partes):
            mm = re.match(r"^(decide|implementa|aplica)\s*:\s*(.+)$", p, re.I)
            rot, tx = (mm.group(1).capitalize(), mm.group(2)) if mm else ("", p)
            if rot == "Aplica": rot = "Aplica el lunes"
            celdas.append(f"<div><b class='editable'>{esc(rot)}</b><span class='editable'>{esc(tx)}</span></div>")
            cw = (ANCHO_UTIL - 2 * CANAL) // 3; cx = M + k * (cw + CANAL)
            cajas.append(caja(cx, 1080 - 128 - 100 - 40, cw, 32, rot.upper(), 12, C(ctx, "coral"), negrita=True))
            cajas.append(caja(cx, 1080 - 128 - 100, cw, 100, tx, px_a_pt(30), "#F5F8FB"))
        interior += f"<div class='accion'>{''.join(celdas)}</div>"
    return seccion(l, "navy", interior, ctx), cajas


RENDER = {"portada": r_portada, "seccion": r_seccion, "numero": r_numero, "frase": r_frase, "lista": r_lista,
          "tabla": r_tabla, "demo": r_demo, "encuesta": r_encuesta, "pacto": r_pacto, "ejercicio": r_ejercicio,
          "cita": r_cita, "cierre": r_cierre}


def render(l: Lamina, ctx) -> tuple[str, list]:
    global _TIT
    _EXTRA.clear(); _TIT = None
    html, cajas = RENDER.get(l.tipo, r_frase)(l, ctx)
    return html, list(cajas) + list(_EXTRA)
