#!/usr/bin/env python
"""
sincronizar-tokens.py — falla si activos/tokens.json se despega de la landing o de globals.css.

    python sincronizar-tokens.py            # compara contra la landing en línea y app/globals.css
    python sincronizar-tokens.py --sin-red  # solo contra app/globals.css

Compara los hex de color (sin distinguir mayúsculas). Los tokens que solo existen en el deck
(navyPanel, navyLine, coral) se declaran en EXTRA y no se exigen en la landing.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).parent))
from laminas import raiz_repo  # noqa: E402

LANDING = "https://claude-en-tu-empresa.vadai.com.mx/assets/css/base.css"
MAPA_LANDING = {  # token del deck -> variable de la landing
    "ink": "--brand-ink", "accent": "--brand-accent", "accent2": "--brand-accent-2",
    "accentDeep": "--brand-accent-deep", "accentSoft": "--brand-accent-soft",
    "lime": "--brand-lime", "limeInk": "--brand-lime-ink", "signalSoft": "--brand-signal-soft",
    "success": "--brand-success", "canvas": "--c-canvas", "surface": "--c-surface",
    "surface2": "--c-surface-2", "line": "--c-line", "lineStrong": "--c-line-strong",
    "text": "--c-text", "text2": "--c-text-2", "text3": "--c-text-3",
}
MAPA_GLOBALS = {"ink": "--color-vadai-navy", "accent": "--color-vadai-cyan",
                "accentDeep": "--color-vadai-azul", "lime": "--color-vadai-lima"}
EXTRA = {"coral", "navyPanel", "navyLine", "error"}  # viven en landing.css a mano o solo en el deck


def variables(css: str) -> dict:
    return {m.group(1): m.group(2).strip().upper() for m in re.finditer(r"(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})", css)}


def main() -> int:
    raiz = raiz_repo(Path(__file__))
    tokens = json.loads((Path(__file__).parent.parent / "activos" / "tokens.json").read_text(encoding="utf-8"))
    mios = {k: v["hex"].upper() for k, v in tokens["color"].items()}
    fallas = 0

    g = variables((raiz / "app" / "globals.css").read_text(encoding="utf-8"))
    for tok, var in MAPA_GLOBALS.items():
        if var in g and g[var] != mios[tok]:
            print(f"  ✗ {tok}: tokens.json {mios[tok]} ≠ globals.css {var} {g[var]}"); fallas += 1
        else:
            print(f"  ✓ {tok} = globals.css {var}")

    if "--sin-red" not in sys.argv:
        try:
            css = urllib.request.urlopen(LANDING, timeout=15).read().decode("utf-8")
            v = variables(css)
            for tok, var in MAPA_LANDING.items():
                if var not in v: print(f"  ! {var} ya no existe en la landing"); continue
                if v[var] != mios[tok]:
                    print(f"  ✗ {tok}: tokens.json {mios[tok]} ≠ landing {var} {v[var]}"); fallas += 1
                else:
                    print(f"  ✓ {tok} = landing {var}")
        except Exception as e:  # sin red no es falla
            print(f"  ! no se pudo leer la landing ({e}); usa --sin-red para omitir")

    print("\n  tokens en sincronía." if not fallas else f"\n  {fallas} token(s) divergen: corrige tokens.json o la fuente.\n")
    return 1 if fallas else 0


if __name__ == "__main__":
    sys.exit(main())
