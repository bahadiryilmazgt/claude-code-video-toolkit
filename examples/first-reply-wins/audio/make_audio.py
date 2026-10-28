#!/usr/bin/env python3
"""Synthesize the score + sound design for "First Reply Wins" (numpy only).

Everything is placed on the same beat grid as the visuals (src/timeline.json),
so cuts, text reveals and hits land on the music without manual syncing.

Arc: mysterious calm intro -> tension in the race -> bright resolution -> warm end.
Writes public/audio/soundtrack.wav (44.1 kHz stereo). Run from the project dir:
    python3 audio/make_audio.py
then loudness-normalise with ffmpeg (see README).
"""
import json
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TL = json.load(open(os.path.join(ROOT, "src", "timeline.json")))

SR = 44100
BEAT = 60.0 / TL["bpm"]
TOTAL = TL["totalBeats"] * BEAT + 0.0
N = int((TOTAL + 0.05) * SR)
rng = np.random.default_rng(105)


def bt(b):
    return b * BEAT


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


class Bus:
    def __init__(self):
        self.l = np.zeros(N + SR * 6)
        self.r = np.zeros(N + SR * 6)

    def add(self, sig, t, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i < 0:
            sig = sig[-i:]
            i = 0
        n = min(len(sig), len(self.l) - i)
        if n <= 0:
            return
        gl = gain * np.cos((pan + 1) * np.pi / 4)
        gr = gain * np.sin((pan + 1) * np.pi / 4)
        self.l[i : i + n] += sig[:n] * gl
        self.r[i : i + n] += sig[:n] * gr


def env_adsr(n, a, d, s, r, sustain_len=None):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    body = n - a - d - r
    if body < 0:
        body = 0
    e = np.concatenate(
        [np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(body, s), np.linspace(s, 0, max(r, 1))]
    )
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def lowpass(x, cutoff):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (fr / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def highpass(x, cutoff):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 - 1 / np.sqrt(1 + (fr / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def bandpass(x, lo, hi):
    return lowpass(highpass(x, lo), hi)


# --------------------------------------------------------------------------
# instruments
# --------------------------------------------------------------------------
def pad_note(f, dur, bright=0.3):
    n = int((dur + 1.6) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for det in (-0.12, 0.0, 0.11):
        ff = f * 2 ** (det / 12)
        ph = rng.random() * 6.28
        sig += np.sin(2 * np.pi * ff * t + ph)
        sig += bright * 0.35 * np.sin(2 * np.pi * 2 * ff * t + ph)
        sig += bright * 0.12 * np.sin(2 * np.pi * 3 * ff * t + ph)
    sig *= 1 + 0.12 * np.sin(2 * np.pi * 0.25 * t)
    return sig * env_adsr(n, 0.9, 0.5, 0.8, 1.6) / 3


def piano(f, vel=1.0, length=3.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k in range(1, 9):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > 16000:
            break
        sig += (1 / k**1.4) * np.exp(-t * (0.9 + 0.7 * k) * (0.6 + f / 900)) * np.sin(2 * np.pi * fk * t)
    att = np.minimum(1, t / 0.004)
    return sig * att * vel * 0.5


def pluck(f, vel=1.0, length=0.9):
    n = int(length * SR)
    t = np.arange(n) / SR
    sig = (
        np.sin(2 * np.pi * f * t)
        + 0.45 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 9)
        + 0.2 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 14)
    )
    return sig * np.exp(-t * 5.5) * np.minimum(1, t / 0.002) * vel * 0.45


def bass(f, dur):
    n = int((dur + 0.2) * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return sig * env_adsr(n, 0.01, 0.2, 0.75, 0.18) * 0.6


def kick(vel=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    fr = 45 + 85 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    return np.sin(ph) * np.exp(-t * 7.5) * vel


def hat(vel=1.0, length=0.05):
    n = int(length * SR) + 200
    x = highpass(rng.standard_normal(n), 7000)
    t = np.arange(n) / SR
    return x * np.exp(-t / (length / 3)) * vel * 0.25


def snap(vel=1.0):
    n = int(0.25 * SR)
    x = bandpass(rng.standard_normal(n), 900, 5000)
    t = np.arange(n) / SR
    return x * np.exp(-t * 22) * vel * 0.5


# --------------------------------------------------------------------------
# sound design
# --------------------------------------------------------------------------
def sfx_pop(f0=1200):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    fr = f0 * (1 + 0.6 * np.exp(-t * 60))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    s = np.sin(ph) * np.exp(-t * 26) + 0.35 * np.sin(2 * ph) * np.exp(-t * 40)
    s += 0.15 * np.sin(2 * np.pi * f0 * 2.76 * t) * np.exp(-t * 30)
    return s * np.minimum(1, t / 0.0015) * 0.6


def sfx_chime(f0=1760, length=3.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in ((1, 1, 1.4), (2.0, 0.35, 2.2), (2.76, 0.4, 3.0), (5.4, 0.18, 5.0), (8.93, 0.08, 7.0)):
        s += amp * np.sin(2 * np.pi * f0 * ratio * t + rng.random()) * np.exp(-t * dec)
    return s * np.minimum(1, t / 0.002) * 0.35


def sfx_tick(f0=3200, g=1.0):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f0 * t) * np.exp(-t * 160) + 0.3 * np.sin(2 * np.pi * f0 * 1.5 * t) * np.exp(-t * 220)) * g * 0.4


def sfx_whoosh(dur=1.2, rise=False):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    lo = lowpass(x, 900)
    hi = bandpass(x, 1500, 7000)
    peak = 0.75 if rise else 0.45
    e = np.exp(-(((t / dur) - peak) ** 2) / (2 * 0.17**2))
    # sweep: low band leads, high band follows (gives "air moving past")
    e_hi = np.exp(-(((t / dur) - peak - 0.08) ** 2) / (2 * 0.12**2))
    return (lo * e * 0.55 + hi * e_hi * 0.22) * 0.5


def sfx_shimmer(dur=1.5, density=40):
    n = int((dur + 1.0) * SR)
    s = np.zeros(n)
    for _ in range(int(density * dur)):
        f = rng.uniform(2800, 8000)
        ln = int(rng.uniform(0.08, 0.35) * SR)
        t = np.arange(ln) / SR
        g = np.sin(2 * np.pi * f * t) * np.exp(-t * rng.uniform(10, 25)) * np.minimum(1, t / 0.004)
        i = int(rng.uniform(0, dur) * SR)
        s[i : i + ln] += g * rng.uniform(0.2, 1.0)
    return s * 0.08


def sfx_liquid():
    s = sfx_shimmer(0.8, 30) * 0.8
    for k in range(7):
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        f0 = rng.uniform(500, 1100)
        ph = 2 * np.pi * np.cumsum(f0 * (1 + 1.4 * t / 0.12)) / SR
        blip = np.sin(ph) * np.sin(np.pi * t / 0.12) * 0.12
        i = int(rng.uniform(0, 0.6) * SR)
        s[i : i + n] += blip
    return s


def sfx_muted():
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    fr = 196 * (1 - 0.05 * t / 1.6)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    s = np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    s *= np.minimum(1, t / 0.03) * np.exp(-t * 2.2)
    return lowpass(s, 900) * 0.55


def sfx_typing(dur):
    n = int((dur + 0.2) * SR)
    s = np.zeros(n)
    tt = 0.0
    while tt < dur:
        tk = sfx_tick(rng.uniform(1800, 2600), rng.uniform(0.3, 0.6))
        i = int(tt * SR)
        s[i : i + len(tk)] += tk[: n - i]
        tt += rng.uniform(0.07, 0.14)
    return s


# --------------------------------------------------------------------------
# score
# --------------------------------------------------------------------------
NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
# (start beat, root, chord tones as midi numbers around octave 4)
CHORDS = [
    (0, "B", [59, 62, 66, 73]),  # Bm(add9)
    (4, "G", [55, 59, 62, 66]),  # Gmaj7
    (8, "D", [57, 62, 66, 69]),  # D
    (12, "A", [57, 61, 64, 69]),  # A
    (16, "B", [59, 62, 66, 73]),
    (20, "G", [55, 59, 62, 66]),
    (24, "D", [57, 62, 66, 69]),
    (28, "A", [57, 62, 64, 69]),  # Asus4
    (32, "B", [59, 62, 66, 71]),  # race: Bm pedal
    (36, "B", [57, 62, 66, 71]),  # Bm/A
    (40, "G", [55, 59, 61, 66]),  # Gmaj7#11
    (44, "F#", [54, 59, 61, 66]),  # F#sus4
    (46, "F#", [54, 58, 61, 66]),  # F#
    (48, "D", [57, 62, 66, 69]),  # resolution
    (52, "A", [57, 61, 64, 69]),
    (56, "B", [59, 62, 66, 69]),
    (60, "G", [55, 59, 62, 67]),
    (64, "D", [57, 62, 66, 69]),
    (68, "D", [57, 62, 66, 69]),
    (70, "A", [57, 61, 64, 69]),
    (72, "B", [59, 62, 66, 69]),
    (74, "G", [55, 59, 62, 67]),
    (76, "E", [55, 59, 62, 64]),  # Em7
    (80, "G", [55, 59, 62, 66]),  # Gmaj7
    (84, "A", [57, 62, 64, 69]),  # Asus4 -> A
    (86, "A", [57, 61, 64, 69]),
    (88, "D", [54, 57, 62, 64, 69]),  # Dadd9 — final warm chord
    (999, "D", []),
]


def chord_at(b):
    for i in range(len(CHORDS) - 1):
        if CHORDS[i][0] <= b < CHORDS[i + 1][0]:
            return CHORDS[i]
    return CHORDS[-2]


def section(b):
    if b < 20:
        return "intro"
    if b < 32:
        return "build"
    if b < 48:
        return "race"
    if b < 68:
        return "bright"
    if b < 80:
        return "full"
    return "end"


def main():
    music = Bus()
    sfx = Bus()

    # pads
    for i in range(len(CHORDS) - 1):
        b0, root, tones = CHORDS[i]
        b1 = CHORDS[i + 1][0]
        if b0 >= 999:
            break
        dur = bt(min(b1, TL["totalBeats"]) - b0)
        if b0 == 88:
            dur = bt(TL["totalBeats"] - 88) + 1.5
        sec = section(b0)
        bright = {"intro": 0.15, "build": 0.25, "race": 0.4, "bright": 0.5, "full": 0.6, "end": 0.35}[sec]
        g = {"intro": 0.16, "build": 0.17, "race": 0.15, "bright": 0.17, "full": 0.17, "end": 0.19}[sec]
        for k, m in enumerate(tones):
            music.add(pad_note(midi(m - 12 if sec in ("intro",) and k == 0 else m), dur, bright), bt(b0), g, pan=(k - 1.5) * 0.35)
        # bass root
        rm = 36 + NOTE[root] + (12 if NOTE[root] < 2 else 0)
        if sec in ("build", "bright", "full", "end", "race"):
            if sec == "race":
                for q in np.arange(b0, min(b1, 48), 0.5):
                    music.add(bass(midi(rm), bt(0.45)), bt(q), 0.22 + 0.1 * ((q - 32) / 16), 0)
            else:
                music.add(bass(midi(rm), dur - 0.1), bt(b0), 0.3 if sec != "build" else 0.2, 0)

    # intro piano motif: sparse, mysterious
    motif = [(0.5, 78), (1.5, 76), (2.5, 74), (4.5, 74), (5.5, 73), (6.5, 71), (8.5, 76), (10, 74), (12.5, 73), (13.5, 69),
             (16.5, 78), (17.5, 76), (18.5, 74), (20.5, 74), (21.5, 76), (22.5, 78), (24.5, 81), (26, 78), (28.5, 76), (30, 73)]
    for b, m in motif:
        music.add(piano(midi(m), 0.55), bt(b), 0.5, pan=0.2)

    # plucked arpeggios
    for b in np.arange(20, 88, 0.5):
        sec = section(b)
        if sec == "race":
            continue
        _, _, tones = chord_at(b)
        seq = tones + [tones[1] + 12]
        idx = int(round(b * 2)) % len(seq)
        vel = {"build": 0.35, "bright": 0.6, "full": 0.75, "end": 0.45, "intro": 0}[sec]
        if sec == "end" and b >= 88:
            continue
        music.add(pluck(midi(seq[idx] + 12), vel), bt(b), 0.4, pan=0.5 if idx % 2 else -0.5)

    # race: 16th-note arps that brighten (low-passed copy crossfaded with the open one)
    race_bus = np.zeros(int(bt(17) * SR) + SR)
    for b in np.arange(32, 48, 0.25):
        if b >= 46:  # breath before the drop
            continue
        _, _, tones = chord_at(b)
        seq = [tones[0], tones[2], tones[3], tones[1] + 12]
        m = seq[int(round(b * 4)) % 4] + 12
        p = pluck(midi(m), 0.5 + 0.4 * (b - 32) / 14, 0.5)
        i = int((bt(b) - bt(32)) * SR)
        race_bus[i : i + len(p)] += p[: len(race_bus) - i]
    dark = lowpass(race_bus, 900)
    tt = np.arange(len(race_bus)) / SR
    w = np.clip(tt / bt(14), 0, 1) ** 1.5
    race_mix = dark * (1 - w) + race_bus * w
    music.add(race_mix, bt(32), 0.45, pan=0.15)

    # drums
    for b in np.arange(0, TL["totalBeats"], 0.25):
        sec = section(b)
        on_beat = abs(b - round(b)) < 1e-6
        if sec == "build" and on_beat and int(b) % 2 == 0:
            music.add(kick(0.6), bt(b), 0.5)
        if sec == "race":
            if on_beat and b < 46:
                music.add(kick(0.75), bt(b), 0.55)
            music.add(hat(0.5 + 0.5 * ((b * 4) % 2 == 1)), bt(b), 0.25 + 0.15 * (b - 32) / 16, pan=0.3)
        if sec in ("bright", "full"):
            if on_beat:
                music.add(kick(0.8), bt(b), 0.55)
                if int(b) % 2 == 1:
                    music.add(snap(0.6), bt(b), 0.35, pan=-0.1)
            if abs((b % 1) - 0.5) < 1e-6:
                music.add(hat(0.7), bt(b), 0.3, pan=0.35)
        if sec == "end" and on_beat and b < 84 and int(b) % 2 == 0:
            music.add(kick(0.5), bt(b), 0.4)
        if sec == "intro" and b >= 12 and abs((b % 1) - 0.5) < 1e-6:
            music.add(hat(0.3), bt(b), 0.15, pan=0.4)

    # bright melody in the resolution
    mel = [(48, 81), (49.5, 78), (50.5, 76), (52, 76), (53.5, 73), (54.5, 74), (56, 78), (58, 76), (60, 79), (61.5, 78), (62.5, 76),
           (64, 74), (66, 76), (68, 81), (69, 83), (70, 81), (71.5, 78), (72, 78), (73.5, 81), (74.5, 83), (76, 79), (78, 78),
           (80, 74), (82, 76), (84, 76), (86, 73), (88, 74)]
    for b, m in mel:
        music.add(piano(midi(m), 0.75, 4.0 if b >= 88 else 3.0), bt(b), 0.5, pan=-0.15)
    # final chord: piano voicing
    for m in (50, 57, 62, 66, 69, 74):
        music.add(piano(midi(m), 0.5, 6.0), bt(88), 0.35)

    # sound design from the timeline
    for e in TL["sfx"]:
        t = bt(e["b"])
        g = e["g"]
        kind = e["t"]
        pan = rng.uniform(-0.3, 0.3)
        if kind == "whoosh":
            sfx.add(sfx_whoosh(e.get("d", 1.2)), t - e.get("d", 1.2) * 0.4, g, pan)
        elif kind == "rise":
            sfx.add(sfx_whoosh(e.get("d", 1.5), rise=True), t - e.get("d", 1.5) * 0.7, g, pan)
        elif kind == "pop":
            sfx.add(sfx_pop(e.get("f", 1200)), t, g, pan)
        elif kind == "chime":
            sfx.add(sfx_chime(e.get("f", 1760)), t, g, pan)
        elif kind == "tick":
            sfx.add(sfx_tick(), t, g, pan)
        elif kind == "counts":
            for k in range(14):
                sfx.add(sfx_tick(2600 + 60 * k, 0.6), t + e["d"] * BEAT * (1 - (1 - k / 14) ** 2), g, pan)
        elif kind == "typing":
            sfx.add(sfx_typing(e["d"] * BEAT), t, g, pan)
        elif kind == "liquid":
            sfx.add(sfx_liquid(), t, g, pan)
        elif kind == "shimmer":
            sfx.add(sfx_shimmer(e.get("d", 1.5)), t, g, pan)
        elif kind == "muted":
            sfx.add(sfx_muted(), t, g, 0)
        elif kind == "clockticks":
            # accelerating clock ticks across the race
            tt = 0.0
            span = e["d"] * BEAT
            while tt < span:
                prog = tt / span
                sfx.add(sfx_tick(2900 if int(tt / 0.01) % 2 else 2400, 0.7), t + tt, g * (0.6 + 0.4 * prog), 0.2)
                tt += BEAT * (0.5 - 0.375 * prog**1.3)

    # reverb: stereo exponentially decaying noise IR
    def reverb(x, seed, length=2.6, decay=0.75):
        r = np.random.default_rng(seed)
        n = int(length * SR)
        t = np.arange(n) / SR
        ir = r.standard_normal(n) * np.exp(-t / decay)
        ir = lowpass(ir, 5000)
        ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        ir /= np.sqrt(np.sum(ir**2))
        size = 1 << int(np.ceil(np.log2(len(x) + n)))
        y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
        return y

    ml = music.l + 0.35 * reverb(music.l + sfx.l * 0.8, 1)
    mr = music.r + 0.35 * reverb(music.r + sfx.r * 0.8, 2)
    L = ml + sfx.l * 0.9
    R = mr + sfx.r * 0.9

    out_n = int((TOTAL + 0.0) * SR)
    L, R = L[:out_n], R[:out_n]
    # final fade (the last chord rings to the end)
    fade = int(1.2 * SR)
    L[-fade:] *= np.linspace(1, 0, fade) ** 1.5
    R[-fade:] *= np.linspace(1, 0, fade) ** 1.5
    # gentle glue + peak normalise; loudnorm happens in ffmpeg afterwards
    st = np.stack([L, R], 1)
    st /= np.max(np.abs(st)) + 1e-9
    st = np.tanh(st * 1.4) / np.tanh(1.4)
    st *= 0.89
    os.makedirs(os.path.join(ROOT, "public", "audio"), exist_ok=True)
    path = os.path.join(ROOT, "public", "audio", "soundtrack_raw.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())
    print(path, f"{len(L) / SR:.2f}s")


if __name__ == "__main__":
    main()
