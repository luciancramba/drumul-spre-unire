#!/usr/bin/env python3
"""Compune coloana sonoră a short-ului (27,5 s, re minor care se deschide în re major) fără fișiere audio externe.
Straturi: pad de corzi, bas, linie de vioară, timpane, clopot, vânt. Scrie out/music.wav (stereo, 44,1 kHz).
Rulare: python3 tools/short/music.py"""
import os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import wave

SR = 44100
DUR = 27.5
N = int(SR * (DUR + 3))  # coadă pentru reverb, tăiată la final
rng = np.random.default_rng(1918)
t = np.arange(N) / SR
BAR = 60 / 72 * 4  # 3,33 s

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
D, F, A, Bb, G, Cs, E, Fs = 62, 65, 69, 70, 67, 61, 64, 66  # note MIDI (D4=62)

def env(n, a, r, hold=None):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 2
    e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e

def saw_voice(f, dur, harm=14, detune=(0.0, 0.07, -0.06), vib=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for d in detune:
        ff = f * 2 ** (d / 12)
        ph = 2 * np.pi * ff * tt
        if vib:
            ph = ph + vib * 0.5 * np.sin(2 * np.pi * 5.4 * tt)
        for h in range(1, harm + 1):
            out += np.sin(h * ph + rng.uniform(0, 6.28)) / h ** 1.15
    return out / len(detune)

def place(buf, sig, start):
    i = int(start * SR)
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]

# progresii: Dm | Bb | Gm | A | Dm | Bb | A | D
chords = [
    (50, [D - 12, F - 12, A - 12]),   # Dm
    (46, [Bb - 12, D, F - 12 + 12]),  # Bb
    (43, [G - 12, Bb - 12, D]),       # Gm
    (45, [A - 12, Cs, E - 12 + 12]),  # A
    (50, [D - 12, F - 12, A - 12]),
    (46, [Bb - 12, D, F - 12 + 12]),
    (45, [A - 12, Cs, E - 12 + 12]),
    (50, [D - 12, Fs - 12, A - 12]),  # re major final
]
pad = np.zeros(N)
bass = np.zeros(N)
for i, (root, notes) in enumerate(chords):
    start = i * BAR
    dur = BAR + 1.6 if i < 7 else DUR - start + 2.5
    for m in notes + [m + 12 for m in notes]:
        s = saw_voice(hz(m), dur, harm=10)
        place(pad, s * env(len(s), 1.3, 1.6) * 0.07, start)
    b = np.sin(2 * np.pi * hz(root - 12 + 12) * np.arange(int(dur * SR)) / SR)
    b += 0.4 * np.sin(2 * np.pi * 2 * hz(root - 12 + 12) * np.arange(int(dur * SR)) / SR)
    place(bass, b * env(len(b), 0.6, 1.4) * 0.28, start)
# cutoff care se deschide: două versiuni filtrate, amestec în timp
lo = sosfilt(butter(2, 600, 'low', fs=SR, output='sos'), pad)
hi = sosfilt(butter(2, 3200, 'low', fs=SR, output='sos'), pad)
mix = np.clip((t - 6) / 18, 0, 1)
pad = lo * (1 - mix) + hi * mix

# linie de vioară (începe la bara 2, urcă spre final)
melody = [(1, F + 12, 1.0), (2, D + 12, 1.0), (3, Cs + 12, 1.0), (4, D + 12, 0.5), (4.5, A, 0.5),
          (5, D + 12, 1.0), (6, E + 12, 0.5), (6.5, Cs + 12, 0.5), (7, Fs + 12, 1.0)]
vio = np.zeros(N)
for bar, m, ln in melody:
    start = bar * BAR
    dur = ln * BAR + 0.5
    s = saw_voice(hz(m), dur, harm=8, detune=(0.0, 0.1), vib=1.0)
    vio_note = s * env(len(s), 0.45, 0.9) * (0.05 + 0.04 * min(1, bar / 7))
    place(vio, vio_note, start)
vio = sosfilt(butter(2, 2600, 'low', fs=SR, output='sos'), vio)

# timpane: ușoare din bara 4, puternice din bara 6, rulou spre titlu
def timpani(vel):
    n = int(1.8 * SR)
    tt = np.arange(n) / SR
    f = 52 + 38 * np.exp(-tt * 14)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.6)
    k = rng.normal(0, 1, n) * np.exp(-tt * 40) * 0.35
    return (s + k) * vel
tim = np.zeros(N)
for bar_t, vel in [(3 * BAR, .35), (4 * BAR, .5), (5 * BAR, .6), (5 * BAR + 2 * BAR / 4, .4),
                   (6 * BAR, .8), (6 * BAR + 2 * BAR / 4, .5), (7 * BAR, 1.0), (7 * BAR + BAR / 4 * 2, .6)]:
    place(tim, timpani(vel) * 0.55, bar_t)
roll_start = 6.6 * BAR
for k in range(10):
    place(tim, timpani(0.12 + 0.05 * k) * 0.4, roll_start + k * 0.18)

# clopot (cel din ziua Unirii): părți inarmonice, cădere lungă
def bell(f0, vel):
    n = int(5.0 * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for r, a, dec in [(1, 1, 1.1), (2.0, .6, 1.5), (2.76, .5, 2.0), (4.1, .35, 3.0), (5.4, .25, 3.5), (8.9, .12, 5.0)]:
        s += a * np.sin(2 * np.pi * f0 * r * tt + rng.uniform(0, 6)) * np.exp(-tt * dec * 0.9)
    return s * vel * (1 - np.exp(-tt * 300))
bells = np.zeros(N)
for bt, v in [(7 * BAR, .5), (7 * BAR + 1.9, .38), (7 * BAR + 3.7, .3)]:
    place(bells, bell(hz(50), v) * 0.4, bt)

# vânt
w = rng.normal(0, 1, N)
w = sosfilt(butter(2, [250, 1100], 'band', fs=SR, output='sos'), w)
wind = w * (0.035 + 0.02 * np.sin(2 * np.pi * 0.11 * t)) * np.clip(1 - (t - 20) / 6, 0.15, 1)

dry = pad + bass + vio + tim + bells + wind
# reverb sintetic (sală mare, ~2,4 s)
ir_n = int(2.4 * SR)
ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / SR * 2.4)
ir = sosfilt(butter(2, 4500, 'low', fs=SR, output='sos'), ir)
wet = fftconvolve(dry, ir)[:N] * 0.045
sig = dry * 0.75 + wet
# stereo: reverb ușor decorelat + lărgire a padului
L = sig + 0.15 * np.roll(pad, 441)
R = sig + 0.15 * np.roll(pad, -441)
stereo = np.stack([L, R], 1)[: int(SR * DUR)]
# crescendo: de la 60% la 100% până la clopot
stereo *= (0.6 + 0.4 * np.clip(np.arange(len(stereo)) / SR / 23.3, 0, 1) ** 1.3)[:, None]
# fade in/out
nf = int(1.0 * SR)
stereo[:nf] *= np.linspace(0, 1, nf)[:, None]
no = int(2.2 * SR)
stereo[-no:] *= (np.linspace(1, 0, no) ** 1.6)[:, None]
stereo /= np.max(np.abs(stereo))
stereo *= 0.85
pcm = (stereo * 32767).astype('<i2')
os.makedirs(os.path.join(os.path.dirname(__file__), 'out'), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), 'out', 'music.wav')
with wave.open(path, 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
print('wrote', path, round(len(pcm) / SR, 1), 's')
