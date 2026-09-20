#!/usr/bin/env python
"""
verificar.py — puerta de calidad del contenido de un deck ANTES de construirlo.

    python verificar.py contenido/claude-en-tu-empresa/modulo-0/laminas.md
    python verificar.py <laminas.md> --imagenes    # además valida las imágenes referenciadas

Falla (exit 1) si:
  · falta `concepto:` en la cabecera
  · un `tipo` no existe, o falta `titular` (salvo cita)
  · un titular trae dos o más **acentos**
  · una lámina `numero` no trae `cifra` o `fuente`
  · una cita [^id] no resuelve en fuentes.md, o resuelve a estado `pendiente*`
  · dos láminas consecutivas tienen el mismo `tipo`
  · una lista pasa de 5 ítems o un ítem de 12 palabras
  · una lámina pasa de 50 palabras
  · una `imagen` referenciada no existe
  · aparece una muletilla prohibida
  · aparece un emoji en titular, texto o prompt
Avisa (sin fallar) si: titular sin verbo aparente · más de 30 palabras · más de 7 láminas sin
`seccion` · `demo` sin `respaldo` · cita en estado `proyección` (debe decirse como estimación).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from laminas import TIPOS, items_lista, leer_deck, leer_fuentes, raiz_repo, ruta_fuentes  # noqa: E402

MULETILLAS = ["en el mundo actual", "sinergia", "transformación digital", "ecosistema",
              "impulsar el impacto", "es importante notar", "aprovechar", "de cara a"]
VERBOS = re.compile(r"\b(es|son|va|van|está|están|tiene|tienen|hace|hacen|cambia|entra|pasa|"
                    r"usa|usan|cobra|cuesta|pierde|pierden|llega|sabe|saben|falta|faltan|puede|"
                    r"pueden|no|ya|sí|hoy|deja|dejan|se|te|le|arma|lee|conecta|configura|arranca|"
                    r"empieza|termina|paga|pagan|acelera|multiplica|recibe|reciben|revisa|manda|"
                    r"decide|implementa|aplica|adivina|espera|funciona|sirve|nace|vive|queda|"
                    r"resuelve|escribe|responde|piensa|hablas|hablar|aprender|perder|dibuja|"
                    r"produce|contesta|existe|importa|duele|mírense|hagamos|míralo)\b", re.I)
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿\U0001F1E6-\U0001F1FF]")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__); return 2
    ruta = Path(sys.argv[1]).resolve()
    con_imagenes = "--imagenes" in sys.argv
    raiz = raiz_repo(ruta)
    deck = leer_deck(ruta)
    fuentes = leer_fuentes(ruta_fuentes(raiz))
    tokens = json.loads((Path(__file__).parent.parent / "activos" / "tokens.json").read_text(encoding="utf-8"))
    minimo = tokens["perfil"].get(deck.medio, tokens["perfil"]["video"])["cuerpoMinimo"]

    fallas, avisos = [], []
    F = lambda n, m: fallas.append(f"lámina {n}: {m}")
    A = lambda n, m: avisos.append(f"lámina {n}: {m}")

    print(f"\nVERIFICAR · {deck.titulo or ruta.name} · {len(deck.laminas)} láminas · medio {deck.medio}\n")

    if not deck.concepto:
        fallas.append("cabecera: falta `concepto:` — sin idea rectora no se construye")
    if not deck.laminas:
        fallas.append("no hay láminas `## N · nombre`")

    anterior, desde_seccion = None, 0
    for l in deck.laminas:
        n = l.n
        if l.tipo not in TIPOS:
            F(n, f"tipo desconocido `{l.tipo}`"); continue
        if not l["titular"] and l.tipo != "cita":
            F(n, "falta `titular`")
        if len(l.acentos) > 1:
            F(n, f"{len(l.acentos)} acentos en el titular; va uno, y es el verbo de la tesis")
        if l.tipo == "numero":
            if not l["cifra"]: F(n, "`numero` sin `cifra`")
            if not l.citas: F(n, "`numero` sin `fuente`")
        if l.tipo == "cita" and not l["cita"]: F(n, "`cita` sin `cita:`")
        if l.tipo == "ejercicio" and not l["tiempo"]: A(n, "`ejercicio` sin `tiempo:`")
        if l.tipo == "demo" and not l["respaldo"]: A(n, "`demo` sin `respaldo:` (MP4 o PNG por si falla)")
        for c in l.citas:
            fila = fuentes.get(c)
            if not fila: F(n, f"cita [^{c}] no existe en fuentes.md")
            elif fila["estado"].startswith("pendiente"): F(n, f"cita [^{c}] está `{fila['estado']}`")
            elif fila["estado"] == "proyección": A(n, f"[^{c}] es proyección: decirlo como estimación (badge)")
        # pacto y demo son secuencias por diseño (el rail avanza; la demo tiene contrato · demo · conclusión)
        if anterior and anterior.tipo == l.tipo and l.tipo not in ("demo", "pacto"):
            F(n, f"dos `{l.tipo}` seguidas (láminas {anterior.n} y {n})")
        if l.tipo in ("seccion", "portada", "cierre"): desde_seccion = 0
        else:
            desde_seccion += 1
            if desde_seccion == 8: A(n, "van 8 láminas sin `seccion`; conviene un respiro")
        if l.tipo == "lista":
            items = items_lista(l["texto"])
            if len(items) > 5: F(n, f"lista de {len(items)} ítems; máximo 5")
            for it in items:
                if len(it.split()) > 12: F(n, f"ítem de {len(it.split())} palabras: «{it[:40]}…»")
        p = l.palabras()
        if p > 50: F(n, f"{p} palabras; el tope duro es 50")
        elif p > 30: A(n, f"{p} palabras; ideal ≤ 30")
        tit = re.sub(r"\*\*", "", l["titular"])
        if tit and l.tipo not in ("portada", "seccion", "pacto") and not VERBOS.search(tit) and len(tit.split()) <= 4:
            A(n, f"titular sin opinión aparente: «{tit}» — ¿tiene verbo?")
        cuerpo = " ".join(l.get(k) for k in ("titular", "texto", "cita"))
        for mu in MULETILLAS:
            if mu in cuerpo.lower(): F(n, f"muletilla «{mu}»")
        if EMOJI.search(cuerpo): F(n, "emoji en el contenido")
        if con_imagenes and l["imagen"]:
            candidatos = [raiz / "presentacion" / "imagenes" / deck.slug / l["imagen"],
                          Path(__file__).parent.parent / "activos" / "primitivas" / l["imagen"],
                          Path(__file__).parent.parent / "activos" / "marca" / l["imagen"]]
            if not any(c.exists() for c in candidatos):
                F(n, f"imagen `{l['imagen']}` no existe en presentacion/imagenes/{deck.slug}/ ni en activos/")
        anterior = l

    for a in avisos: print(f"  ! {a}")
    for f in fallas: print(f"  ✗ {f}")
    print(f"\n  cuerpo mínimo para `{deck.medio}`: {minimo} px (lo aplica construir.py)")
    if fallas:
        print(f"  {len(fallas)} falla(s), {len(avisos)} aviso(s). No se construye.\n"); return 1
    print(f"  0 fallas, {len(avisos)} aviso(s). Listo para construir.\n"); return 0


if __name__ == "__main__":
    sys.exit(main())
