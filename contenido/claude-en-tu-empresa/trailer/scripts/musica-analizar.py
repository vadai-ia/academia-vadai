# Análisis de una pista para editarla a la imagen: tempo (BPM), fase del pulso, compases
# con su energía y un mapa ASCII de secciones. Solo numpy + ffmpeg.
#   python -I scripts/musica-analizar.py assets/musica/x.mp3 [--json salida.json]
import json, subprocess, sys
import numpy as np
sys.stdout.reconfigure(encoding="utf-8")

ruta = sys.argv[1]
sr = 22050
crudo = subprocess.run(["ffmpeg", "-v", "error", "-i", ruta, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(crudo, dtype=np.float32)
dur = len(x) / sr

# envolvente de ataque: flujo espectral positivo
hop, win = 512, 2048
n = 1 + (len(x) - win) // hop
ventana = np.hanning(win).astype(np.float32)
marcos = np.lib.stride_tricks.as_strided(x, shape=(n, win), strides=(x.strides[0] * hop, x.strides[0]))
esp = np.abs(np.fft.rfft(marcos * ventana, axis=1))
esp = np.log1p(esp * 10)
flujo = np.maximum(0, np.diff(esp, axis=0)).sum(axis=1)
flujo = np.concatenate([[0], flujo])
flujo = (flujo - flujo.mean()) / (flujo.std() + 1e-9)
fps = sr / hop

# tempo por autocorrelación en 70–160 BPM, con preferencia suave alrededor de 100
ac = np.correlate(flujo, flujo, mode="full")[len(flujo) - 1:]
lags = np.arange(len(ac))
bpm_l = 60 * fps / np.maximum(lags, 1)
mask = (bpm_l >= 70) & (bpm_l <= 160)
peso = np.exp(-0.5 * (np.log2(bpm_l / 100) / 0.6) ** 2)
puntaje = np.where(mask, ac * peso, -np.inf)
lag = int(np.argmax(puntaje))
# refinar con interpolación parabólica
if 1 <= lag < len(ac) - 1:
    a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
    lagf = lag + 0.5 * (a - c) / (a - 2 * b + c + 1e-9)
else:
    lagf = lag
bpm = 60 * fps / lagf
periodo = 60 / bpm

# fase: la que maximiza el flujo sumado en la rejilla
t_m = np.arange(len(flujo)) / fps
mejor, fase = -1e9, 0
for f in np.linspace(0, periodo, 64, endpoint=False):
    idx = np.round((np.arange(f, dur, periodo)) * fps).astype(int)
    idx = idx[idx < len(flujo)]
    s = flujo[idx].sum()
    if s > mejor:
        mejor, fase = s, f
pulsos = np.arange(fase, dur, periodo)

# compás de 4: el tiempo fuerte es la fase de pulso cuyo flujo medio es mayor
fuerza = [flujo[np.round(pulsos[k::4] * fps).astype(int).clip(0, len(flujo) - 1)].mean() for k in range(4)]
k0 = int(np.argmax(fuerza))
compases = pulsos[k0::4]

# energía RMS por compás (dB)
def rms(a, b):
    seg = x[int(a * sr):int(b * sr)]
    return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) if len(seg) else -120
filas = []
for i, a in enumerate(compases):
    b = compases[i + 1] if i + 1 < len(compases) else dur
    filas.append({"compas": i, "inicio": round(float(a), 3), "fin": round(float(b), 3), "db": round(float(rms(a, b)), 1)})

print(f"{ruta}: {dur:.2f} s · {bpm:.2f} BPM · pulso {periodo:.4f} s · fase {fase:.3f} s · primer tiempo fuerte {compases[0]:.3f} s")
for r in filas:
    barra = "█" * max(0, int((r["db"] + 40) / 1.5))
    print(f"  c{r['compas']:>3} {r['inicio']:7.2f}–{r['fin']:7.2f}  {r['db']:6.1f} dB  {barra}")
if "--json" in sys.argv:
    json.dump({"archivo": ruta, "duracion": dur, "bpm": bpm, "pulso": periodo, "fase": fase, "pulsos": [round(float(p), 3) for p in pulsos], "compases": filas}, open(sys.argv[sys.argv.index("--json") + 1], "w", encoding="utf-8"), indent=1)
