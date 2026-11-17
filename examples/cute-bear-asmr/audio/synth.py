#!/usr/bin/env python3
"""Procedural ASMR sound design for the bear short.

Every sound is synthesized here from noise, impulses, resonators and a small
formant voice -- no samples, no paid APIs. Event times come from
src/timeline.json (the same file that drives the animation), snapped to frame
boundaries, so each crunch starts on the exact frame the bite happens.

    uv run --with numpy --with scipy python audio/synth.py
"""
from __future__ import annotations

import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 48000
ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src" / "timeline.json").read_text())
DUR = TL["duration"]
N = int(DUR * SR)


# ---------------------------------------------------------------- helpers
def rng(seed):
    return np.random.default_rng(seed)


def tvec(dur):
    return np.arange(int(dur * SR)) / SR


def bp(x, lo, hi, order=2):
    hi = min(hi, SR / 2 * 0.95)
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    sos = signal.butter(order, min(f, SR / 2 * 0.95), btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f, btype="high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def reson(x, f, q):
    """2-pole resonator (peaking bandpass)."""
    b, a = signal.iirpeak(min(f, SR / 2 * 0.9), q, fs=SR)
    return signal.lfilter(b, a, x)


def env_ad(n, a, d, curve=3.0):
    """attack (s) then exponential-ish decay over the rest."""
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4))
    rel = np.clip((t - a) / max(d, 1e-4), 0, None)
    return e * np.exp(-curve * rel)


def bell(n, peak=0.5, width=0.25):
    x = np.linspace(0, 1, n)
    return np.exp(-((x - peak) / width) ** 2)


def fade(x, a=0.002, r=0.01):
    n = len(x)
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return x * e


def fit(x, n):
    """pad / trim the last axis to n samples"""
    if x.shape[-1] >= n:
        return x[..., :n]
    pad = [(0, 0)] * (x.ndim - 1) + [(0, n - x.shape[-1])]
    return np.pad(x, pad)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x / m * peak


def stereo(x, pan=0.0, width=0.0, seed=0):
    """equal-power pan; width adds a tiny decorrelated delay on one side."""
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    L, R = x * l * 1.4142, x * r * 1.4142
    if width > 0:
        d = int(0.00035 * SR * width)
        R = np.concatenate([np.zeros(d), R[: len(R) - d]]) if d else R
    return np.stack([L, R])


MASTER = np.zeros((2, N))
DUCK = np.zeros(N)  # music ducking key


def level_of(buf):
    """loudest 50 ms RMS of the sound (dBFS) -- loudness, not peak."""
    m = buf if buf.ndim == 1 else buf.mean(axis=0)
    w = int(0.05 * SR)
    if len(m) < w:
        m = np.pad(m, (0, w - len(m)))
    c = np.convolve(m * m, np.ones(w) / w, mode="valid")
    return 10 * np.log10(c.max() + 1e-12)


def place(buf, t, db=-20.0, pan=0.0, duck=0.0):
    """place a sound so its loudest 50 ms sits at `db` dBFS RMS."""
    if buf.ndim == 1:
        buf = stereo(buf, pan)
    lv = level_of(buf)
    # round off only the most extreme spikes (soft knee 11 dB above the sound's loudness)
    c = 10 ** ((lv + 11) / 20)
    buf = np.tanh(buf / c) * c
    gain = 10 ** ((db - level_of(buf)) / 20)
    i = int(round(t * SR))
    j = min(N, i + buf.shape[1])
    if i >= N:
        return
    MASTER[:, i:j] += buf[:, : j - i] * gain
    if duck:
        DUCK[i:j] = np.maximum(DUCK[i:j], duck * np.exp(-np.arange(j - i) / (0.4 * SR)))


# ------------------------------------------------------------ crunch family
def crackle(r, dur, count, bands, decay=6.0, alpha=1.6, pan_spread=0.35):
    """granular fracture noise: Pareto-distributed micro impulses filtered
    through a set of resonant bands; each impulse gets its own pan."""
    n = int(dur * SR)
    out = np.zeros((2, n))
    # impulse times concentrated at the start (fracture cascade)
    times = -np.log(1 - r.random(count) * (1 - np.exp(-decay))) / decay * dur
    amps = (r.pareto(alpha, count) + 1) ** -1.0
    amps = amps / amps.max()
    amps *= np.exp(-times / dur * 1.5)
    which = r.integers(0, len(bands), count)
    pans = (r.random(count) * 2 - 1) * pan_spread
    for bi, (fc, q) in enumerate(bands):
        sel = which == bi
        if not np.any(sel):
            continue
        for ch in (0, 1):
            imp = np.zeros(n)
            idx = (times[sel] * SR).astype(int).clip(0, n - 1)
            g = amps[sel] * (np.cos((pans[sel] + 1) * np.pi / 4) if ch == 0 else np.sin((pans[sel] + 1) * np.pi / 4))
            np.add.at(imp, idx, g * (r.random(sel.sum()) * 0.6 + 0.7) * np.sign(r.random(sel.sum()) - 0.5))
            # a couple of samples of noise per impulse instead of a perfect delta
            imp = np.convolve(imp, r.standard_normal(5) * np.hanning(5), mode="same")
            out[ch] += reson(imp, fc, q)
    return out


def cookie_bite(seed, gain=1.0):
    r = rng(seed)
    dur = 0.42
    n = int(dur * SR)
    bands = [(1100, 2.5), (1900, 3.0), (2900, 3.5), (4200, 4.0), (6000, 4.0), (8200, 4.5)]
    cr = crackle(r, dur, int(260 * gain), bands, decay=5.5, alpha=1.35)
    # first big snap: broadband + teeth "thock"
    snap = hp(r.standard_normal(int(0.006 * SR)), 900) * np.hanning(int(0.006 * SR))
    thock_t = tvec(0.04)
    thock = np.sin(2 * np.pi * 230 * thock_t) * np.exp(-thock_t * 90)
    body = lp(r.standard_normal(n), 1300) * env_ad(n, 0.003, 0.09, 3)
    mono = np.zeros(n)
    mono[: len(snap)] += norm(snap) * 0.9
    mono[: len(thock)] += thock * 0.35
    mono += norm(body) * 0.28
    out = norm(cr, 1.0) * 0.85 + stereo(mono, 0)
    return norm(out, 1.0)


def cookie_chew(seed, gain=1.0):
    r = rng(seed)
    dur = 0.24
    n = int(dur * SR)
    bands = [(900, 2.5), (1600, 3.0), (2500, 3.5), (3600, 3.5), (5200, 4.0)]
    cr = crackle(r, dur, int(110 * gain + 25), bands, decay=4.0, alpha=1.5, pan_spread=0.25)
    cr = np.stack([lp(cr[0], 6000), lp(cr[1], 6000)])  # mouth closed -> softer top end
    thump_t = tvec(0.06)
    thump = np.sin(2 * np.pi * 130 * thump_t) * np.exp(-thump_t * 60)
    mush = lp(r.standard_normal(n), 900) * env_ad(n, 0.01, 0.12, 3)
    mono = np.zeros(n)
    mono[: len(thump)] += thump * 0.4
    mono += norm(mush) * 0.25
    return norm(norm(cr) * 0.9 + stereo(mono), 1.0)


def crumbs(seed, count):
    r = rng(seed)
    dur = 0.45
    n = int(dur * SR)
    out = np.zeros((2, n))
    for k in range(count * 2):
        t0 = r.random() ** 0.7 * 0.38
        click = reson(np.r_[1.0, np.zeros(int(0.01 * SR))], 2500 + r.random() * 4500, 8) * (0.3 + r.random() * 0.7)
        i = int(t0 * SR)
        out[:, i : i + len(click)] += stereo(click[: n - i], (r.random() - 0.5) * 0.6)
    return norm(out)


# --------------------------------------------------------------- wet family
def bubbles(r, dur, count, fmin, fmax, tau=(0.002, 0.007), rise=0.15, decay=4.0):
    """van den Doel bubble model: rising-pitch damped sines."""
    n = int(dur * SR)
    out = np.zeros(n)
    times = -np.log(1 - r.random(count) * (1 - np.exp(-decay))) / decay * dur
    for t0 in times:
        f0 = fmin * (fmax / fmin) ** r.random()
        ta = tau[0] + (tau[1] - tau[0]) * r.random()
        m = int(ta * 6 * SR)
        tt = np.arange(m) / SR
        f = f0 * (1 + rise * tt / ta)
        ph = 2 * np.pi * np.cumsum(f) / SR
        b = np.sin(ph) * np.exp(-tt / ta) * (0.3 + 0.7 * r.random())
        i = int(t0 * SR)
        j = min(n, i + m)
        out[i:j] += b[: j - i]
    return out


def squelch(r, dur, cutoff=900, rate=60):
    n = int(dur * SR)
    noise = lp(r.standard_normal(n), cutoff)
    am = np.abs(lp(r.standard_normal(n), rate)) ** 1.5
    return noise * norm(am) * env_ad(n, 0.005, dur * 0.7, 2.5)


def lemon_bite(seed):
    r = rng(seed)
    dur = 0.5
    n = int(dur * SR)
    rind = crackle(r, 0.06, 18, [(2600, 4), (3800, 4), (5200, 5)], decay=8, alpha=1.4, pan_spread=0.2)
    spray = bp(r.standard_normal(n), 2800, 9000) * env_ad(n, 0.004, 0.07, 4)
    bub = fit(bubbles(r, 0.32, 70, 1300, 4800), n)
    sq = squelch(r, dur, 1100, 80)
    mono = norm(spray) * 0.35 + norm(bub) * 0.75 + norm(sq) * 0.5
    out = stereo(mono, 0, width=1)
    out[:, : rind.shape[1]] += norm(rind) * 0.7
    return norm(out)


def straw_bite(seed, gain=1.0):
    r = rng(seed)
    dur = 0.45
    n = int(dur * SR)
    crisp = crackle(r, 0.18, int(70 * gain), [(1500, 3), (2400, 3.5), (3500, 4)], decay=6, alpha=1.5, pan_spread=0.25)
    bub = fit(bubbles(r, 0.35, 55, 900, 3600, tau=(0.003, 0.009)), n)
    sq = squelch(r, dur, 1000, 70)
    mono = norm(bub) * 0.8 + norm(sq) * 0.6
    out = stereo(mono, 0, width=1)
    out[:, : crisp.shape[1]] += norm(crisp) * 0.6
    return norm(out)


def juicy_chew(seed, gain=1.0):
    r = rng(seed)
    dur = 0.26
    n = int(dur * SR)
    bub = fit(bubbles(r, dur, int(20 + 20 * gain), 700, 2600, tau=(0.003, 0.01)), n)
    sq = squelch(r, dur, 800, 50)
    thump_t = tvec(0.05)
    thump = np.sin(2 * np.pi * 120 * thump_t) * np.exp(-thump_t * 70)
    mono = norm(bub) * 0.6 + norm(sq) * 0.7
    mono[: len(thump)] += thump * 0.35
    return norm(lp(mono, 6500))


def drips(seed, count):
    r = rng(seed)
    dur = 0.6
    n = int(dur * SR)
    out = np.zeros((2, n))
    for k in range(count):
        t0 = 0.05 + r.random() * 0.45
        d = bubbles(r, 0.05, 1, 1200, 2600, tau=(0.004, 0.008), rise=0.4, decay=50)
        d[:30] += np.hanning(60)[:30] * 0.3
        i = int(t0 * SR)
        out[:, i : i + len(d)] += stereo(norm(d) * (0.4 + 0.6 * r.random()), (r.random() - 0.5) * 0.5)[:, : n - i]
    return norm(out)


# ------------------------------------------------------------- marshmallow
def squeeze(seed, dur, gain=1.0):
    """soft marshmallow squish: sparse foam crackle + rubbery squeak + a breath of air."""
    r = rng(seed)
    n = int((dur + 0.08) * SR)
    t = np.arange(n) / SR
    force = np.clip(t / dur, 0, 1) ** 1.3 * (1 - np.clip((t - dur) / 0.08, 0, 1))
    fizz_imp = (r.random(n) < 0.004 * force) * (r.random(n) * 2 - 1)
    fizz = bp(reson(fizz_imp, 2600, 1.2), 1200, 7000)
    f_slip = 60 + 110 * force + 8 * lp(r.standard_normal(n), 12) * 20
    ph = np.cumsum(np.maximum(f_slip, 20)) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float) * (0.5 + 0.5 * r.random(n))
    squeak = reson(reson(pulses, 900, 6), 1750, 4) * force
    air = bp(r.standard_normal(n), 300, 1500) * force
    mono = norm(fizz) * 0.45 + norm(squeak) * 0.5 + norm(air) * 0.12
    return stereo(fade(norm(mono)), 0, width=1)


def release(seed):
    r = rng(seed)
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    puff = lp(r.standard_normal(n), 900) * env_ad(n, 0.004, 0.08, 3)
    low = np.sin(2 * np.pi * 95 * t) * np.exp(-t * 35)
    jig = fit(bubbles(r, 0.12, 6, 500, 1100, tau=(0.006, 0.012)), n)
    return norm(norm(puff) * 0.6 + low * 0.4 + norm(jig) * 0.2)


def tear(seed, dur):
    r = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    rate = 0.002 + 0.03 * (t / dur) ** 2
    imp = (r.random(n) < rate) * (r.random(n) * 2 - 1)
    sticky = lp(reson(imp, 1800, 2), 4500)
    f_slip = 50 + 140 * (t / dur)
    ph = np.cumsum(f_slip) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float)
    stretch = reson(reson(pulses, 700, 6), 1300, 4) * (t / dur)
    return stereo(fade(norm(norm(sticky) * 0.7 + norm(stretch) * 0.3)), -0.15, width=1)


def pop(seed):
    r = rng(seed)
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    f = 520 - 260 * t / 0.06
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 70)
    s[:40] += r.standard_normal(40) * np.hanning(40) * 0.4
    return norm(s)


def pomf(seed):
    r = rng(seed)
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    s = lp(r.standard_normal(n), 450) * env_ad(n, 0.006, 0.06, 3)
    lip = reson(np.r_[1.0, np.zeros(400)], 1400, 4)
    s = norm(s)
    s[: len(lip)] += norm(lip) * 0.3
    return norm(s)


def soft_chew(seed, gain=1.0):
    r = rng(seed)
    dur = 0.25
    n = int(dur * SR)
    mush = lp(r.standard_normal(n), 1300) * bell(n, 0.4, 0.28)
    bub = fit(bubbles(r, dur, 8, 500, 1400, tau=(0.006, 0.012)), n)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * 110 * t) * np.exp(-t * 50)
    return norm(norm(mush) * 0.7 + norm(bub) * 0.25 + thump * 0.25)


# ------------------------------------------------------------ contact / foley
def step(seed, gain=1.0):
    r = rng(seed)
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = 95 - 35 * t / 0.16
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38)
    felt = lp(r.standard_normal(n), 650) * env_ad(n, 0.003, 0.05, 3)
    knock = sum(np.sin(2 * np.pi * fm * t) * np.exp(-t * dm) * am for fm, dm, am in [(310, 60, 0.3), (540, 80, 0.15), (890, 110, 0.06)])
    fluff = hp(r.standard_normal(n), 2500) * env_ad(n, 0.01, 0.06, 4)
    return norm(thump * 0.8 + norm(felt) * 0.35 + knock * 0.5 + norm(fluff) * 0.05)


def pat(seed):
    r = rng(seed)
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    puff = bp(r.standard_normal(n), 300, 2200) * env_ad(n, 0.002, 0.035, 3)
    thud = np.sin(2 * np.pi * 150 * t) * np.exp(-t * 55)
    return norm(norm(puff) * 0.6 + thud * 0.5)


def clap(seed):
    r = rng(seed)
    n = int(0.14 * SR)
    t = np.arange(n) / SR
    puff = bp(r.standard_normal(n), 600, 3200) * env_ad(n, 0.0015, 0.03, 3)
    thud = np.sin(2 * np.pi * 170 * t) * np.exp(-t * 60)
    return norm(norm(puff) * 0.75 + thud * 0.4)


def sniff(seed):
    r = rng(seed)
    n = int(0.11 * SR)
    x = bp(r.standard_normal(n), 1200, 6500)
    x = reson(x, 2600, 2.5) * 0.5 + x * 0.5
    e = np.linspace(0, 1, n) ** 1.6 * (1 - np.clip((np.arange(n) - 0.85 * n) / (0.15 * n), 0, 1))
    return norm(x * e)


def tick(seed, mat):
    r = rng(seed)
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    if mat in ("ceramic", "cookie_plate", "bowl"):
        modes = [(2150, 22, 1.0), (3480, 30, 0.6), (5230, 40, 0.35), (7340, 55, 0.2)] if mat != "bowl" else [(1520, 18, 1.0), (2710, 26, 0.6), (4120, 36, 0.3)]
        s = sum(np.sin(2 * np.pi * f * t + r.random() * 6) * np.exp(-t * d) * a for f, d, a in modes)
        s[:60] += r.standard_normal(60) * np.hanning(60) * 0.8
        s = norm(s) * 0.7
        if mat == "cookie_plate":
            s += crumbs(seed + 1, 4)[0][:n] * 0.25 if n <= int(0.45 * SR) else 0
            s += norm(lp(r.standard_normal(n), 2500) * env_ad(n, 0.002, 0.03, 4)) * 0.3
        return norm(s)
    if mat == "wet":
        s = squelch(r, 0.12, 900, 60)
        b = bubbles(r, 0.12, 4, 900, 2000)
        out = np.zeros(n)
        out[: len(s)] += norm(s) * 0.7
        out[: len(b)] += norm(b) * 0.4
        return norm(out)
    if mat == "soft":
        return norm(lp(r.standard_normal(int(0.1 * SR)), 900) * env_ad(int(0.1 * SR), 0.005, 0.05, 3))
    if mat == "leaf":
        s = reson(np.r_[1.0, np.zeros(2000)], 3200, 5) + reson(np.r_[1.0, np.zeros(2000)], 1500, 4) * 0.5
        return norm(s)
    raise ValueError(mat)


def swish(seed, direction):
    r = rng(seed)
    n = int(0.24 * SR)
    x = r.standard_normal(n)
    # sweep a bandpass across the gesture
    out = np.zeros(n)
    hop = 512
    for i in range(0, n, hop):
        u = i / n
        fc = 700 + 1800 * u
        seg = bp(x[max(0, i - 2048) : i + hop], fc * 0.6, fc * 1.6)[-hop:]
        m = min(len(seg), n - i)
        out[i : i + m] = seg[-m:] if m < len(seg) else seg
    out *= bell(n, 0.5, 0.22)
    L = out * (0.5 - 0.4 * direction * np.linspace(-1, 1, n))
    R = out * (0.5 + 0.4 * direction * np.linspace(-1, 1, n))
    return norm(np.stack([L, R]))


def shiver(seed, dur):
    r = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    rustle = bp(r.standard_normal(n), 900, 5000)
    am = 0.5 + 0.5 * np.sin(2 * np.pi * 16 * t)
    e = np.minimum(1, t / 0.05) * np.exp(-t / dur * 2.2)
    return stereo(norm(rustle * am * e), 0, width=1)


def twinkle(seed):
    r = rng(seed)
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, f in enumerate([1568.0, 2093.0, 2637.0, 3136.0]):
        i = int(k * 0.05 * SR)
        tt = t[: n - i]
        tone = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt * 6)
        out[i:] += tone * (0.9 - 0.12 * k)
    return norm(out)


def heart_pop(seed):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 480 + 520 * (t / 0.12) ** 0.6
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.clip(t / 0.12, 0, 1)) ** 1.5
    return norm(s)


def settle(seed):
    r = rng(seed)
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * np.cumsum(85 - 30 * t / 0.25) / SR) * np.exp(-t * 22)
    rust = bp(r.standard_normal(n), 800, 4500) * env_ad(n, 0.01, 0.12, 3)
    return norm(thump * 0.8 + norm(rust) * 0.12)


# ------------------------------------------------------------------ voice
VOWELS = {  # formants for a small cartoon creature (Hz, bandwidth-ish Q)
    "a": [(1050, 6), (1750, 8), (3300, 10)],
    "e": [(700, 6), (2500, 9), (3500, 10)],
    "i": [(420, 6), (3100, 10), (3900, 11)],
    "o": [(620, 6), (1050, 7), (3000, 10)],
    "u": [(450, 6), (950, 7), (2800, 10)],
    "m": [(300, 4), (1300, 5), (2600, 6)],
}


def glottal(f0, r, breath=0.12, tilt=1.25):
    n = len(f0)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    src = np.zeros(n)
    kmax = int(SR / 2 / f0.max())
    for k in range(1, min(kmax, 40)):
        # fade harmonics near Nyquist per-sample to stay band-limited
        ok = (k * f0 < SR * 0.45).astype(float)
        src += ok * np.sin(k * ph) / k**tilt
    asp = hp(r.standard_normal(n), 800) * breath
    return src + asp


def formant(x, vowel, shift=1.0):
    out = np.zeros_like(x)
    for i, (f, q) in enumerate(VOWELS[vowel]):
        out += reson(x, f * shift, q) * (1.0, 0.55, 0.3)[i]
    if vowel == "m":
        out = lp(out, 1400) + lp(x, 450) * 0.6
    return out


def contour(points, dur):
    """piecewise-linear f0 contour from [(u, hz), ...] with u in 0..1"""
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    xs, ys = zip(*points)
    return np.interp(u, xs, ys)


def syllable(r, dur, f0pts, vowels, amp_env=None, vib=(5.5, 0.018), breath=0.1, h_onset=0.0, shift=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f0 = contour(f0pts, dur)
    f0 = f0 * (1 + vib[1] * np.sin(2 * np.pi * vib[0] * t) + 0.006 * lp(r.standard_normal(n), 8) * 10)
    src = glottal(f0, r, breath)
    # vowel morph: list of (u, vowel); crossfade between rendered vowels
    rendered = {v: formant(src, v, shift) for _, v in vowels}
    out = np.zeros(n)
    us = np.linspace(0, 1, n)
    pts = vowels
    for i, (u0, v) in enumerate(pts):
        u1 = pts[i + 1][0] if i + 1 < len(pts) else 1.01
        w = np.clip((us - u0) / 0.15 + 1, 0, 1) * np.clip((u1 - us) / 0.15, 0, 1) if len(pts) > 1 else np.ones(n)
        if i == 0:
            w = np.clip((u1 - us) / 0.15, 0, 1) if len(pts) > 1 else np.ones(n)
        out += rendered[v] * w
    e = amp_env if amp_env is not None else np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.07)
    out = norm(out) * e
    if h_onset > 0:
        hn = int(h_onset * SR)
        h = bp(r.standard_normal(hn), 1200, 6000) * np.hanning(hn * 2)[:hn][::-1] * 0 + bp(r.standard_normal(hn), 1200, 6000) * np.linspace(0, 1, hn) ** 0.5 * np.linspace(1, 0, hn)
        out = np.concatenate([norm(h) * 0.25, out])
    return out


def voc(kind, seed, dur):
    r = rng(seed)
    S = []
    if kind == "curious":
        S = [syllable(r, dur, [(0, 420), (0.5, 380), (1, 560)], [(0, "m")], vib=(5, 0.012))]
    elif kind == "ooh":
        S = [syllable(r, dur, [(0, 560), (0.35, 720), (1, 600)], [(0, "u"), (0.25, "o"), (0.75, "u")], breath=0.08)]
    elif kind == "mmm":
        e = np.ones(int(dur * SR))
        tt = np.linspace(0, 1, len(e))
        e = (0.55 + 0.45 * np.abs(np.sin(np.pi * tt * 2))) * np.minimum(1, tt / 0.06) * np.minimum(1, (1 - tt) / 0.12)
        S = [syllable(r, dur, [(0, 470), (0.3, 530), (0.55, 450), (0.8, 500), (1, 470)], [(0, "m")], amp_env=e, vib=(5.5, 0.015))]
    elif kind == "mmhm":
        S = [
            syllable(r, dur * 0.42, [(0, 480), (1, 440)], [(0, "m")]),
            np.zeros(int(0.04 * SR)),
            syllable(r, dur * 0.5, [(0, 560), (1, 500)], [(0, "m")], h_onset=0.05),
        ]
    elif kind == "hm":
        S = [syllable(r, dur, [(0, 400), (0.6, 430), (1, 540)], [(0, "m")], h_onset=0.04)]
    elif kind == "eek":
        S = [syllable(r, dur, [(0, 900), (0.15, 1120), (0.7, 1000), (1, 780)], [(0, "i"), (0.7, "e")], vib=(9, 0.04), breath=0.18, shift=1.1)]
    elif kind == "huh":
        S = [syllable(r, dur, [(0, 430), (1, 620)], [(0, "a")], h_onset=0.07, breath=0.15)]
    elif kind == "hehe":
        S = [
            syllable(r, 0.13, [(0, 680), (1, 640)], [(0, "e")], h_onset=0.04, breath=0.2),
            np.zeros(int(0.05 * SR)),
            syllable(r, 0.13, [(0, 640), (1, 580)], [(0, "e")], h_onset=0.04, breath=0.2),
        ]
    elif kind == "bliss":
        tt = np.linspace(0, 1, int(dur * SR))
        e = np.minimum(1, tt / 0.08) * np.minimum(1, (1 - tt) / 0.25) * (0.8 + 0.2 * np.sin(np.pi * tt * 3) ** 2)
        S = [syllable(r, dur, [(0, 470), (0.35, 570), (0.7, 520), (1, 500)], [(0, "m")], amp_env=e, vib=(5, 0.02))]
    elif kind == "yum":
        S = [syllable(r, dur, [(0, 430), (0.7, 620), (1, 680)], [(0, "m"), (0.72, "a")], vib=(5.5, 0.02))]
    elif kind == "giggle":
        for k, f in enumerate([720, 670, 610]):
            S += [syllable(r, 0.1, [(0, f), (1, f - 40)], [(0, "i")], h_onset=0.035, breath=0.22), np.zeros(int(0.04 * SR))]
    elif kind == "yay":
        S = [
            syllable(r, 0.2, [(0, 620), (1, 760)], [(0, "e")], breath=0.1),
            np.zeros(int(0.03 * SR)),
            syllable(r, 0.28, [(0, 820), (0.4, 860), (1, 680)], [(0, "i"), (0.5, "e")], h_onset=0.04, breath=0.12),
        ]
    else:
        raise ValueError(kind)
    x = np.concatenate(S)
    return norm(hp(x, 120))


# ------------------------------------------------------------- music bed
def music_box():
    """very quiet original lullaby on a synthetic music box, 3/4 @ 96 bpm."""
    beat = 60 / 96
    notes_hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    # (beat, midi, length-in-beats)
    mel = [0, 4, 7, 12, 11, 7, 9, 7, 4, 5, 4, 2, 0, 4, 7, 12, 14, 12, 11, 9, 7, 9, 11, 12]
    out = np.zeros(N)
    t_note = 0.4
    i = 0
    while t_note < DUR - 0.5:
        m = 72 + mel[i % len(mel)]
        f = notes_hz(m)
        n = int(2.2 * SR)
        t = np.arange(n) / SR
        tone = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 3) + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 9)) * np.exp(-t * 1.6)
        tone[:30] *= np.linspace(0, 1, 30)
        s = int(t_note * SR)
        e = min(N, s + n)
        out[s:e] += tone[: e - s] * (0.8 if i % 3 == 0 else 0.55)
        if i % 3 == 0:  # soft bass note on the downbeat
            fb = notes_hz(48 + [0, 5, 7, 0][(i // 3) % 4])
            bass = np.sin(2 * np.pi * fb * t) * np.exp(-t * 1.2) * 0.35
            out[s:e] += bass[: e - s]
        t_note += beat
        i += 1
    return out


# --------------------------------------------------------------- render
def main():
    # Mix plan (loudest 50 ms RMS, dBFS, before mastering). The eating sounds
    # are the stars; voice, steps and contact sounds sit underneath them.
    LV = {
        "cookie_bite": -14, "cookie_chew": -18, "lemon_bite": -15, "straw_bite": -15, "juicy_chew": -19,
        "squeeze": -18, "release": -22, "tear": -19, "pop": -22, "pomf": -23, "soft_chew": -20,
        "crumbs": -29, "drips": -27, "voc": -23, "sniff": -27, "step": -27, "settle": -26, "pat": -25,
        "clap": -24, "tick": -25, "swish": -26, "shiver": -28, "twinkle": -33, "heart": -32,
    }
    db_of = lambda g: 20 * np.log10(max(g, 1e-3))
    seed = 1000
    for e in TL["events"]:
        seed += 7
        t, k = e["t"], e["type"]
        g = e.get("gain", 1.0)
        L = LV.get(k, -24) + db_of(g)
        if k == "step":
            place(step(seed, g), t, L, pan=-0.12 if e["side"] == "L" else 0.12)
        elif k == "settle":
            place(settle(seed), t, L)
        elif k == "pat":
            place(pat(seed), t, L, pan=(-0.2 if seed % 2 else 0.2))
        elif k == "voc":
            place(voc(e["kind"], seed, e["dur"]), t, L + (1.5 if e["kind"] in ("ooh", "yay", "eek") else 0))
        elif k == "sniff":
            place(sniff(seed), t, L)
        elif k == "twinkle":
            place(twinkle(seed), t, L)
        elif k == "clap":
            place(clap(seed), t, L)
        elif k == "tick":
            pan = {"ceramic": -0.35, "cookie_plate": -0.35, "wet": 0.35, "soft": 0.0, "bowl": 0.25, "leaf": 0.3}[e["mat"]]
            place(tick(seed, e["mat"]), t, L, pan=pan)
        elif k == "cookie_bite":
            place(cookie_bite(seed, g), t, L, duck=1)
        elif k == "cookie_chew":
            place(cookie_chew(seed, g), t, L, duck=0.6)
        elif k == "crumbs":
            place(crumbs(seed, e["n"]), t, L)
        elif k == "lemon_bite":
            place(lemon_bite(seed), t, L, duck=1)
        elif k == "drips":
            place(drips(seed, e["n"]), t, L)
        elif k == "shiver":
            place(shiver(seed, e["dur"]), t, L)
        elif k == "juicy_chew":
            place(juicy_chew(seed, g), t, L, duck=0.6)
        elif k == "swish":
            place(swish(seed, e["dir"]), t - 0.11, L)
        elif k == "squeeze":
            place(squeeze(seed, e["dur"], g), t, L, duck=0.8)
        elif k == "release":
            place(release(seed), t, L)
        elif k == "tear":
            place(tear(seed, e["dur"]), t, L, duck=0.8)
        elif k == "pop":
            place(pop(seed), t, L)
        elif k == "pomf":
            place(pomf(seed), t, L)
        elif k == "soft_chew":
            place(soft_chew(seed, g), t, L, duck=0.5)
        elif k == "straw_bite":
            place(straw_bite(seed, g), t, L, duck=1)
        elif k == "heart":
            place(heart_pop(seed), t, L)
        else:
            raise ValueError(k)

    # gentle small-room ambience on the foley (synthetic IR, low mix)
    r = rng(5)
    irn = int(0.35 * SR)
    ir = r.standard_normal(irn) * np.exp(-np.arange(irn) / SR / 0.07)
    ir = lp(ir, 5000)
    ir[0] = 0
    wet = np.stack([signal.fftconvolve(MASTER[0], ir)[:N], signal.fftconvolve(MASTER[1], r.permutation(ir))[:N]])
    mix = MASTER + norm(wet, np.max(np.abs(MASTER)) * 0.09)

    # music bed: far below the ASMR, ducked further under bites and chews
    mb = music_box()
    duck_env = lp(np.r_[DUCK], 6)
    mb = mb * (1 - 0.6 * np.clip(duck_env, 0, 1))
    mb_st = stereo(mb, 0, width=3)
    room = lp(rng(9).standard_normal((2, N)), 2500) * 10 ** (-66 / 20)
    mb_rms = np.sqrt(np.mean(mb_st**2)) + 1e-12
    mix = mix + mb_st / mb_rms * 10 ** (-44 / 20) + room
    # fades
    fi = int(0.05 * SR)
    mix[:, :fi] *= np.linspace(0, 1, fi)
    fo = int(0.35 * SR)
    mix[:, -fo:] *= np.linspace(1, 0, fo)

    out_dir = ROOT / "public"
    out_dir.mkdir(exist_ok=True)
    final = out_dir / "asmr_mix.wav"
    master(mix, final)
    print(f"wrote {final}")


def measure(x):
    tmp = ROOT / "public" / "_measure.wav"
    write_wav(tmp, x)
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(tmp), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    tmp.unlink()
    m = json.loads(p.stderr[p.stderr.rindex("{") : p.stderr.rindex("}") + 1])
    return float(m["input_i"]), float(m["input_tp"])


def limiter(x, ceiling_db=-1.6, look_ms=8.0):
    """transparent lookahead peak limiter: only the bite transients get touched."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    thr = 10 ** (ceiling_db / 20)
    # true-peak detection: 4x oversampled
    up = signal.resample_poly(x, 4, 1, axis=1)
    peak = np.max(np.abs(up), axis=0)[: x.shape[1] * 4].reshape(-1, 4).max(axis=1)
    g = np.minimum(1.0, thr / np.maximum(peak, 1e-9))
    L = int(look_ms / 1000 * SR)
    g = minimum_filter1d(g, 2 * L + 1)
    g = uniform_filter1d(g, L)
    return x * g, 20 * np.log10(g.min())


def master(mix, path, target=-16.0):
    """linear gain to target LUFS + lookahead limiter; no dynamic loudnorm pumping."""
    x0 = mix / (np.max(np.abs(mix)) + 1e-9) * 0.5
    i0, _ = measure(x0)
    g = target - i0
    for it in range(5):
        y, gr = limiter(x0 * 10 ** (g / 20))
        i1, tp = measure(y)
        print(f"master pass {it}: gain {g:+.2f} dB -> {i1:.2f} LUFS, TP {tp:.2f} dBTP, max GR {gr:.1f} dB", file=sys.stderr)
        if abs(i1 - target) < 0.1:
            break
        g += target - i1
    write_wav(path, y)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    pcm = (x.T * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def loudnorm(src, dst, target=-14.0, tp=-1.5):
    """two-pass EBU R128 normalisation with ffmpeg (YouTube/Reels friendly)."""
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(src), "-af", f"loudnorm=I={target}:TP={tp}:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    js = p.stderr[p.stderr.rindex("{") : p.stderr.rindex("}") + 1]
    m = json.loads(js)
    af = (
        f"loudnorm=I={target}:TP={tp}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
        f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le", str(dst)], check=True)
    print("measured input:", {k: m[k] for k in ("input_i", "input_tp", "input_lra")}, file=sys.stderr)


if __name__ == "__main__":
    main()
