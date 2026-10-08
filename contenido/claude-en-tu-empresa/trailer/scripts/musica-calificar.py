# Califica pistas candidatas contra el arco que pide la voz (v2 plática, voz de Camila):
# energía cada 0.5 s vs. un perfil objetivo (correlación), dónde cae el golpe (mayor salto entre
# 42 y 54 s) y cuánto contraste hay entre la primera y la segunda mitad.
#   python scripts/musica-calificar.py assets/v2/musica/n*.mp3
import subprocess, sys
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
METODO = 48.56
# (desde, hasta, dB objetivo): bajo al arranque, tensión en el bucle, caída en el dato, presión en el
# escritorio, casi silencio en «sé honesto», golpe y potencia desde «método»
PERFIL = [(0, 6, -30), (6, 17, -18), (17, 22, -30), (22, 28, -26), (28, 40, -19), (40, 46, -40), (46, 48.5, -26), (48.5, 85, -9), (85, 89, -20)]
for f in sys.argv[1:]:
    x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "22050", "-f", "f32le", "-"], capture_output=True).stdout, dtype=np.float32)
    h = 11025
    db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + h] ** 2)) + 1e-9) for i in range(0, len(x) - h, h)])
    t = np.arange(len(db)) * 0.5
    obj = np.array([next((v for a, b, v in PERFIL if a <= ti < b), -20) for ti in t])
    r = np.corrcoef(db, obj)[0, 1]
    zona = (t >= 42) & (t <= 54)
    saltos = np.diff(db, prepend=db[0])
    k = np.argmax(np.where(zona, saltos, -99))
    antes, despues = db[(t < 46)].mean(), db[(t > 49) & (t < 84)].mean()
    print(f"{f.split('/')[-1]:8s} {len(x) / 22050:5.1f} s · correlación {r:5.2f} · golpe {t[k]:4.1f} s (+{saltos[k]:.0f} dB) · 1.ª mitad {antes:5.1f} dB / 2.ª {despues:5.1f} dB · silencio 40–46 {db[(t >= 40) & (t < 46)].mean():5.1f} dB")
