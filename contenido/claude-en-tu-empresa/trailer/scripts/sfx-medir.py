# Mide cada efecto: inicio audible (envolvente > pico − 24 dB), instante del pico y nivel RMS del
# cuerpo. Escribe assets/sfx/medidas.json, que usa la mezcla para alinear el PICO de cada efecto con
# su evento visual (un whoosh pega en el corte, no 1.2 s después).
#   python scripts/sfx-medir.py
import json, subprocess, sys, pathlib
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
raiz = pathlib.Path(__file__).resolve().parent.parent
SR = 48000
out = {}
for f in sorted((raiz / "assets/sfx").glob("*/*")):
    if f.suffix not in (".mp3", ".wav"):
        continue
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(pcm, dtype=np.float32)
    v = 480  # 10 ms
    n = len(x) // v
    rms = np.sqrt(np.mean(x[: n * v].reshape(n, v) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    pico = int(np.argmax(db))
    inicio = int(np.argmax(db > db[pico] - 24))
    fin = n - 1 - int(np.argmax(db[::-1] > db[pico] - 30))
    cuerpo = db[inicio : fin + 1]
    clave = f"{f.parent.name}/{f.name}"
    out[clave] = {"dur": round(len(x) / SR, 3), "inicio": round(inicio * v / SR, 3), "pico": round(pico * v / SR, 3),
                  "fin": round(fin * v / SR, 3), "rms_db": round(float(20 * np.log10(np.sqrt(np.mean(10 ** (cuerpo / 10))))), 1)}
    print(f"{clave:28s} dur {out[clave]['dur']:5.2f}  inicio {out[clave]['inicio']:5.2f}  pico {out[clave]['pico']:5.2f}  fin {out[clave]['fin']:5.2f}  rms {out[clave]['rms_db']:6.1f} dB")
(raiz / "assets/sfx/medidas.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
