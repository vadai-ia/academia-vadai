# Mide qué tan expresiva es una voz (para elegir entre audiciones sin depender de oído):
# rango melódico (F0 por autocorrelación, semitonos p10–p90 y desviación), contraste de energía
# (dB p90–p10 en tramos con voz) y ritmo (palabras por segundo de voz).
#   python scripts/voz-expresion.py a.mp3 b.mp3 …   (usa el .json de whisper junto a cada mp3)
import json, subprocess, sys, pathlib
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
SR = 16000
for ruta in sys.argv[1:]:
    p = pathlib.Path(ruta)
    x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout, dtype=np.float32)
    win, hop = 640, 160
    f0s, dbs = [], []
    for i in range(0, len(x) - win, hop):
        fr = x[i:i + win] * np.hanning(win)
        e = np.sqrt(np.mean(fr ** 2)) + 1e-9
        db = 20 * np.log10(e)
        if db < -38:
            continue
        dbs.append(db)
        ac = np.correlate(fr, fr, "full")[win - 1:]
        lo, hi = SR // 400, SR // 120          # 120–400 Hz
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] / (ac[0] + 1e-9) > 0.45:       # cuadro con tono claro
            f0s.append(SR / k)
    f0 = np.array(f0s)
    st = 12 * np.log2(f0 / np.median(f0))
    dbs = np.array(dbs)
    pal = len(json.loads(p.with_suffix(".json").read_text(encoding="utf-8"))) if p.with_suffix(".json").exists() else 0
    voz = len(dbs) * hop / SR
    print(f"{p.stem:10s} F0 mediana {np.median(f0):5.0f} Hz · rango p10–p90 {np.percentile(st, 90) - np.percentile(st, 10):4.1f} st · desv {st.std():4.2f} st · energía p90–p10 {np.percentile(dbs, 90) - np.percentile(dbs, 10):4.1f} dB · {pal / voz:4.2f} pal/s")
