"""A warm, license-free music bed made from scratch: electric piano, pad and bass in D major, 80 BPM.
Usage: python3 video/tools/warm-bed.py <seconds> <out.wav>"""
import sys, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
dur = float(sys.argv[1]); out = sys.argv[2]
N = int(dur * SR); L = np.zeros(N); R = np.zeros(N)
beat = 60 / 80
def hz(m): return 440 * 2 ** ((m - 69) / 12)

def add(sig, start, pan=0.0):
    i = int(start * SR); j = min(N, i + len(sig))
    if i >= N: return
    s = sig[: j - i]
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)); R[i:j] += s * np.sqrt(0.5 * (1 + pan))

def epiano(m, length, vel):
    t = np.arange(int(length * SR)) / SR; f = hz(m)
    mod = 1.6 * np.exp(-t * 6) * np.sin(2 * np.pi * f * t)          # soft FM "tine"
    tone = np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3)
    env = np.exp(-t * 1.3) * np.minimum(1, t / 0.006)
    env *= np.minimum(1, (length - t) / 0.25)
    return vel * tone * env * (1 + 0.15 * np.sin(2 * np.pi * 4.5 * t))  # gentle tremolo

def pad(ms, length):
    t = np.arange(int(length * SR)) / SR; s = np.zeros_like(t)
    for m in ms:
        for d in (-0.07, 0.0, 0.07):
            ph = 2 * np.pi * hz(m) * (1 + d / 100) * t
            s += sum(np.sin(k * ph) / k for k in range(1, 6))
    s = sosfilt(butter(2, 900, fs=SR, output='sos'), s)
    env = np.minimum(1, t / 1.2) * np.minimum(1, (length - t) / 1.2)
    return 0.018 * s * env

def bass(m, length):
    t = np.arange(int(length * SR)) / SR
    s = np.sin(2 * np.pi * hz(m) * t) + 0.2 * np.sin(4 * np.pi * hz(m) * t)
    return 0.22 * s * np.minimum(1, t / 0.02) * np.exp(-t * 0.6) * np.minimum(1, (length - t) / 0.1)

# Dmaj9 - Bm9 - Gmaj9 - A(add9)/sus, two bars each
chords = [(50, [62, 66, 69, 73, 76]), (47, [62, 66, 69, 71, 73]), (43, [62, 66, 67, 71, 74]), (45, [61, 64, 67, 69, 71])]
bar = 4 * beat; rng = np.random.default_rng(7)
t0 = 0.0; k = 0
while t0 < dur:
    root, notes = chords[k % 4]; length = 2 * bar
    add(pad(notes[:4], length + 1.0), t0)
    add(bass(root, bar * 0.95), t0); add(bass(root, bar * 0.95), t0 + bar)
    for b in range(8):  # a lazy, slightly swung arpeggio
        n = notes[[0, 2, 1, 3, 4, 2, 3, 1][b]]
        sw = 0.04 if b % 2 else 0.0
        add(epiano(n, 2.2, 0.10 + 0.03 * rng.random()), t0 + b * beat + sw, pan=(-0.35 if b % 2 else 0.35))
    for n in notes[:3]:
        add(epiano(n - 12, 3.0, 0.07), t0)
    t0 += length; k += 1

mix = np.stack([L, R], 1)
mix = sosfilt(butter(1, 5000, fs=SR, output='sos'), mix, axis=0)   # warm top end
# small room: a few short echoes
for d, g in ((0.031, 0.25), (0.047, 0.2), (0.089, 0.15), (0.143, 0.1)):
    n = int(d * SR); mix[n:] += g * mix[:-n][:, ::-1]
fade_in, fade_out = int(2 * SR), int(5 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]; mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
mix /= np.max(np.abs(mix)) / 0.8
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print(out, dur)
