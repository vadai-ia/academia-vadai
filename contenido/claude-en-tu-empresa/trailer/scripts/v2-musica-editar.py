# v2 · edita la canción n5 (Lyria 3 Pro, 99.8 BPM) a la voz de Camila por compases completos:
#   compases 0–15 · 18–33 (se quitan el 16 y el 17, los más quietos: con la toma G caían en «diariamente…
#   y aun así» y dejaban un hueco) · 29–33 otra vez
#   (el clímax sostiene el llamado) · 34–35 (el acorde final). Cortes en tiempo fuerte con fundido de 25 ms.
# El desfase va al principio: el compás 23 cae en «método» (10-oct, toma G de Camila: 51.95 s). Si el
# desfase sale negativo se recorta la entrada, que es casi silencio (compás 0 a −34 dB).
#   python scripts/v2-musica-editar.py [platica|curso] → assets/v2/musica/n5-editada-<versión>.wav
# Curso (11-oct, toma C, «método» en 47.25 s): también se quitan el 19 y el 20 (crescendo dentro del silencio de
# tráiler) y el clímax repite 26–33 para que el acorde final caiga con «a mano».
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
VERSION = sys.argv[1] if len(sys.argv) > 1 else "platica"
METODO, tramos = {
    "platica": (51.949, [(0, 16), (18, 34), (29, 34), (34, None)]),
    "curso": (47.25, [(0, 16), (18, 19), (21, 34), (26, 34), (34, None)]),
}[VERSION]
RETRASO = None
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
k23 = next(k for k, (a, b) in enumerate(tramos) if a <= 23 and (b is None or 23 < b))
golpe = sum(len(p) for p in piezas[:k23]) / SR + (inicio(23) - inicio(tramos[k23][0])) / SR
RETRASO = round(METODO - golpe, 3)
y = np.concatenate([np.zeros((int(RETRASO * SR), 2), dtype=np.float32), y]) if RETRASO > 0 else y[int(-RETRASO * SR):]
sal = raiz / f"assets/v2/musica/n5-editada-{VERSION}.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(sal)], input=y.tobytes(), check=True)
print(f"golpe (compás 23) en {golpe:.3f} s del montaje · retraso {RETRASO:+.3f} s → cae en {METODO} s · duración {len(y) / SR:.2f} s")
