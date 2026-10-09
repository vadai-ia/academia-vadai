# v3 · análisis de los videos de referencia (Kurzgesagt): cortes, duración de planos, hojas de contacto
# y transcripción limpia, para estudiar cómo cuentan (no para copiar su estilo).
#   python scripts/v3-referencias.py renders/v3/referencias
# Salidas por video en renders/v3/referencias/<id>/: cortes.json, transcripcion.txt, inicio-*.jpg (1 fps,
# primeros 120 s), cortes-*.jpg (un cuadro en cada corte, primeros 240 s)
import json, re, subprocess, sys, pathlib
from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8")
base = pathlib.Path(sys.argv[1])

def cortes(video):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(video), "-vf", "scale=320:-2,select='gt(scene,0.28)',showinfo", "-an", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="ignore")
    return [float(m) for m in re.findall(r"pts_time:([\d.]+)", r.stderr)]

def transcripcion(vtt):
    lineas, ult = [], ""
    for bloque in vtt.read_text(encoding="utf-8").split("\n\n"):
        m = re.search(r"(\d\d):(\d\d):(\d\d)\.\d+ -->", bloque)
        if not m: continue
        texto = " ".join(l for l in bloque.split("\n")[1:] if "-->" not in l)
        texto = re.sub(r"<[^>]+>", "", texto).strip()
        if texto and texto != ult and not ult.endswith(texto):
            t = int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3])
            lineas.append(f"[{t // 60:02d}:{t % 60:02d}] {texto}"); ult = texto
    return "\n".join(lineas)

def hoja(video, tiempos, salida, cols=8, w=320):
    ims = []
    for t in tiempos:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1", "-vf", f"scale={w}:-2", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
        if raw:
            import io
            im = Image.open(io.BytesIO(raw)).convert("RGB"); d = ImageDraw.Draw(im)
            d.rectangle([0, 0, 64, 16], fill=(0, 0, 0)); d.text((3, 2), f"{int(t // 60)}:{t % 60:04.1f}", fill=(255, 255, 255))
            ims.append(im)
    for k in range(0, len(ims), cols * 6):
        g = ims[k:k + cols * 6]; h = g[0].height
        s = Image.new("RGB", (cols * w, ((len(g) + cols - 1) // cols) * h), (20, 20, 20))
        for i, im in enumerate(g): s.paste(im, ((i % cols) * w, (i // cols) * h))
        s.save(f"{salida}-{k // (cols * 6) + 1}.jpg", quality=85)

for v in sorted(base.glob("*.mp4")):
    d = base / v.stem; d.mkdir(exist_ok=True)
    cs = cortes(v)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(v)], capture_output=True, text=True).stdout)
    planos = [b - a for a, b in zip([0] + cs, cs + [dur])]
    planos.sort()
    med = planos[len(planos) // 2] if planos else 0
    resumen = {"video": v.stem, "duracion": round(dur, 1), "cortes": len(cs), "plano_promedio": round(dur / (len(cs) + 1), 2), "plano_mediana": round(med, 2),
               "planos_menores_2s": sum(p < 2 for p in planos), "planos_mayores_8s": sum(p > 8 for p in planos), "tiempos": [round(c, 2) for c in cs]}
    (d / "cortes.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=1), encoding="utf-8")
    vtt = base / f"{v.stem}.en.vtt"
    if vtt.exists(): (d / "transcripcion.txt").write_text(transcripcion(vtt), encoding="utf-8")
    hoja(v, [i for i in range(0, 120)], str(d / "inicio"))
    hoja(v, [c + 0.4 for c in cs if c < 240], str(d / "cortes"))
    print(v.stem, {k: resumen[k] for k in ("duracion", "cortes", "plano_promedio", "plano_mediana", "planos_menores_2s", "planos_mayores_8s")})
