"""
laminas.py — parser compartido de laminas.md (contrato v2) y de fuentes.md.

Lo usan verificar.py, construir.py y miniaturas.py. Sin dependencias externas.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

TIPOS = {"portada", "seccion", "numero", "frase", "lista", "tabla", "demo", "encuesta",
         "pacto", "ejercicio", "cita", "cierre"}

CAMPOS = {"tipo", "eyebrow", "titular", "cifra", "texto", "grafico", "imagen", "cita",
          "fuente", "nota", "accion", "respaldo", "tiempo"}

RE_LAMINA = re.compile(r"^## (\d+) · (.+)$")
RE_CAMPO = re.compile(r"^([a-z]+):\s*(.*)$")
RE_CITA = re.compile(r"\[\^([a-z0-9-]+)\]", re.I)
RE_ACENTO = re.compile(r"\*\*([^*]+)\*\*")


@dataclass
class Lamina:
    n: int
    nombre: str
    campos: dict = field(default_factory=dict)

    def __getitem__(self, k): return self.campos.get(k, "")
    def get(self, k, d=""): return self.campos.get(k, d)

    @property
    def tipo(self): return self.campos.get("tipo", "")

    @property
    def citas(self): return RE_CITA.findall(self.campos.get("fuente", ""))

    @property
    def acentos(self): return RE_ACENTO.findall(self.campos.get("titular", ""))

    def palabras(self) -> int:
        t = " ".join(self.campos.get(k, "") for k in ("titular", "texto", "cifra"))
        return len(re.findall(r"\S+", re.sub(r"\*\*|\[\^[a-z0-9-]+\]", "", t)))


@dataclass
class Deck:
    titulo: str
    cabecera: dict
    laminas: list

    @property
    def concepto(self): return self.cabecera.get("concepto", "")
    @property
    def medio(self): return self.cabecera.get("medio", "video")
    @property
    def slug(self): return self.cabecera.get("deck", "deck")


def leer_deck(ruta: Path) -> Deck:
    texto = ruta.read_text(encoding="utf-8")
    titulo, cabecera, laminas = "", {}, []
    actual: Lamina | None = None
    for cruda in texto.splitlines():
        linea = cruda.rstrip()
        if not titulo and linea.startswith("# "):
            titulo = linea[2:].strip(); continue
        m = RE_LAMINA.match(linea)
        if m:
            actual = Lamina(int(m.group(1)), m.group(2).strip()); laminas.append(actual); continue
        m = RE_CAMPO.match(linea)
        if m and m.group(1) in CAMPOS | {"concepto", "deck", "medio", "sesion"}:
            k, v = m.group(1), m.group(2).strip()
            if actual is None: cabecera[k] = v
            else: actual.campos[k] = v
            continue
        # continuación de un campo (línea que empieza con dos espacios)
        if actual is not None and linea.startswith("  ") and actual.campos:
            ultimo = list(actual.campos)[-1]
            actual.campos[ultimo] += " " + linea.strip()
    return Deck(titulo, cabecera, laminas)


def leer_fuentes(ruta: Path) -> dict:
    """id -> {estado, audiencias, fuente, cifra}. Misma lógica que scripts/check-curso.mjs."""
    filas = {}
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\|\s*`([a-z0-9-]+)`\s*\|(.*)\|\s*$", linea, re.I)
        if not m: continue
        id_, celdas = m.group(1), [c.strip() for c in m.group(2).split("|")]
        if id_.startswith("fix-"): continue
        if id_.startswith("p-"):
            filas[id_] = {"estado": "pendiente", "audiencias": set(), "fuente": "", "cifra": ""}; continue
        if len(celdas) < 5: continue
        filas[id_] = {
            "estado": celdas[4].lower(),
            "audiencias": {a.strip().lower() for a in celdas[3].split("·") if a.strip()},
            "fuente": re.sub(r"\*", "", celdas[2]),
            "cifra": re.sub(r"\*", "", celdas[1]),
        }
    return filas


def raiz_repo(desde: Path | None = None) -> Path:
    p = (desde or Path(__file__)).resolve()
    for cand in [p, *p.parents]:
        if (cand / "CLAUDE.md").exists() and (cand / "contenido").exists():
            return cand
    return Path.cwd()


def ruta_fuentes(raiz: Path) -> Path:
    return raiz / "contenido" / "claude-en-tu-empresa" / "fuentes.md"


def filas_tabla(texto: str) -> list[list[str]]:
    return [[c.strip() for c in f.split("·")] for f in texto.split("|") if f.strip()]


def items_lista(texto: str) -> list[str]:
    return [i.strip() for i in re.split(r"\s·\s", texto) if i.strip()]


def html_acento(titular: str) -> str:
    """'Texto **acento**' -> 'Texto <b>acento</b>' con escape básico."""
    def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    partes, out = re.split(r"\*\*", titular), []
    for i, tr in enumerate(partes):
        if not tr: continue
        out.append(f"<b>{esc(tr)}</b>" if i % 2 else esc(tr))
    return "".join(out)
