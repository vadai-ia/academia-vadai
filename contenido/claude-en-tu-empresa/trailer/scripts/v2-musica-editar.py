# v2 · edita la canción n5 (Lyria 3 Pro, 99.8 BPM) a la voz de Camila por compases completos:
#   compases 0–18 · 22–33 (se quitan 19–21: la potencia entra justo en «método») · 30–33 otra vez
#   (el clímax sostiene el llamado) · 34–35 (el acorde final). Cortes en tiempo fuerte con fundido de 25 ms.
# El retraso de 0.46 s va al principio del archivo, así el compás 23 cae en «método» (48.56 s).
#   python scripts/v2-musica-editar.py → assets/v2/musica/n5-editada.wav
import json, subprocess, sys, pathlib
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
raiz = pathlib.Path(__file__).resolve().parent.parent
an = json.loads((raiz / "assets/v2/musica/n5.analisis.json").read_text(encoding="utf-8"))
SR = 48000
x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(raiz / "assets/v2/musica/n5.mp3"), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout, dtype=np.float32).reshape(-1, 2)
compas = 4 * an["pulso"]
t0 = an["fase"]
inicio = lambda c: int(round((t0 + c * compas) * SR))
METODO, RETRASO = 48.56, None
tramos = [(0, 19), (22, 34), (30, 34), (34, None)]
piezas = []
for a, b in tramos:
    ia = 0 if a == 0 else inicio(a)
    ib = len(x) if b is None else inicio(b)
    piezas.append(x[ia:ib].copy())
F = int(0.025 * SR)
for k, p in enumerate(piezas):
    r = np.linspace(0, 1, F, dtype=np.float32)[:, None]
    if k: p[:F] *= r
    if k < len(piezas) - 1: p[-F:] *= r[::-1]
y = np.concatenate(piezas)
# dónde quedó el compás 23 (el golpe) en la pista editada → retraso para que caiga en «método»
golpe = (inicio(19) - 0) / SR + 0 + (inicio(23) - inicio(22)) / SR
RETRASO = round(METODO - golpe, 3)
y = np.concatenate([np.zeros((int(RETRASO * SR), 2), dtype=np.float32), y]) if RETRASO > 0 else y[int(-RETRASO * SR):]
sal = raiz / "assets/v2/musica/n5-editada.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(sal)], input=y.tobytes(), check=True)
print(f"golpe (compás 23) en {golpe:.3f} s del montaje · retraso {RETRASO:+.3f} s → cae en {METODO} s · duración {len(y) / SR:.2f} s")
