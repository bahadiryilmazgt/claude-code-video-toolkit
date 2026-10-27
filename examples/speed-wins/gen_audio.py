#!/usr/bin/env python3
"""Audio + timeline builder for the "Speed Wins" reel.

Run from the toolkit root:

    uv run --with edge-tts examples/speed-wins/gen_audio.py          # SFX + music + timeline
    uv run --with edge-tts examples/speed-wins/gen_audio.py --vo     # also regenerate the voiceover

Three stages, all deterministic except the TTS call:

1. Voiceover (--vo, or when a scene MP3 is missing). Each `## name` block of
   VOICEOVER-SCRIPT.md goes through Microsoft's tr-TR-EmelNeural voice via edge-tts
   (free, no key). Edge pads ~0.2s before and ~0.95s after every clip, so the
   silence is trimmed and the clip normalised to -16 LUFS. Word boundaries are kept
   (shifted by the trim) in `scenes/<name>.words.json`, so SFX can land on words.
2. Timeline. Scene starts are anchored to the real audio durations and written to
   src/timeline.json, which the Remotion composition reads. Nothing is estimated.
3. SFX and music, synthesised with numpy. No samples, no licences. The music is
   written to the timeline's length, so it ends on a hit at the final frame.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SCENES = HERE / "public" / "audio" / "scenes"
SFX = HERE / "public" / "audio" / "sfx"
MUSIC = HERE / "public" / "audio" / "music" / "music.mp3"
TIMELINE = HERE / "src" / "timeline.json"

VOICE = "tr-TR-EmelNeural"
RATE = "+6%"
SR = 44100
FPS = 30

# Seconds of picture before the first word (the phone drops in), between a scene's
# last word and the next scene, and after the last word (logo + music hit).
PRE_ROLL = 0.55
GAP = 0.45
LEAD = 0.2
OUTRO = 2.1


# ---------------------------------------------------------------- voiceover


def parse_script() -> list[tuple[str, str]]:
    text = (HERE / "VOICEOVER-SCRIPT.md").read_text(encoding="utf-8")
    blocks = re.findall(r"^## (\S+)\n(.+?)(?=^## |\Z)", text, re.S | re.M)
    return [(name, body.strip()) for name, body in blocks]


async def _tts(text: str, mp3: Path) -> list[dict]:
    import edge_tts

    words: list[dict] = []
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    with mp3.open("wb") as fh:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append(
                    {
                        "word": chunk["text"],
                        "start": chunk["offset"] / 1e7,
                        "end": (chunk["offset"] + chunk["duration"]) / 1e7,
                    }
                )
    return words


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out.strip())


def leading_silence(path: Path) -> float:
    log = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(path), "-af", "silencedetect=n=-45dB:d=0.05", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    m = re.search(r"silence_start: 0(?:\.0+)?\s.*?silence_end: ([\d.]+)", log, re.S)
    return float(m.group(1)) if m else 0.0


def make_vo(name: str, text: str) -> None:
    out = SCENES / f"{name}.mp3"
    (SCENES / f"{name}.txt").write_text(text + "\n", encoding="utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "raw.mp3"
        words = asyncio.run(_tts(text, raw))
        lead = max(0.0, leading_silence(raw) - 0.04)
        # Trim the head, trim the tail (reverse trick), keep 0.12s of air, normalise.
        af = (
            f"atrim=start={lead:.3f},asetpts=PTS-STARTPTS,"
            "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,"
            "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100"
        )
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", af, "-ac", "1", "-b:a", "160k", str(out)],
            check=True,
        )
    for w in words:
        w["start"] = round(max(0.0, w["start"] - lead), 3)
        w["end"] = round(max(0.0, w["end"] - lead), 3)
    (SCENES / f"{name}.words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  vo  {name:12s} {probe_duration(out):5.2f}s  {len(words)} words")


# ---------------------------------------------------------------- timeline


def build_timeline(script: list[tuple[str, str]]) -> dict:
    scenes = []
    cursor = 0.0
    for i, (name, _) in enumerate(script):
        dur = probe_duration(SCENES / f"{name}.mp3")
        words = json.loads((SCENES / f"{name}.words.json").read_text(encoding="utf-8"))
        lead = PRE_ROLL if i == 0 else LEAD
        tail = OUTRO if i == len(script) - 1 else GAP
        length = lead + dur + tail
        start_f = round(cursor * FPS)
        scenes.append(
            {
                "id": name,
                "from": start_f,
                "durationInFrames": round((cursor + length) * FPS) - start_f,
                "voFrom": round((cursor + lead) * FPS),
                "voSeconds": round(dur, 3),
                # Word cue frames, relative to the scene start.
                "words": [
                    {"w": w["word"], "f": round((lead + w["start"]) * FPS)} for w in words
                ],
            }
        )
        cursor += length
    total = round(cursor * FPS)
    return {"fps": FPS, "durationInFrames": total, "scenes": scenes}


# ---------------------------------------------------------------- synthesis helpers

rng = np.random.default_rng(7)


def t_axis(sec: float) -> np.ndarray:
    return np.arange(int(sec * SR)) / SR


def env_exp(sec: float, decay: float, attack: float = 0.002) -> np.ndarray:
    t = t_axis(sec)
    e = np.exp(-t / decay)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return e * a


def band(x: np.ndarray, lo: float = 0.0, hi: float = 20000.0, soft: float = 0.25) -> np.ndarray:
    """Zero-phase band filter in the frequency domain with soft (log-scale) edges."""
    n = len(x)
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR) + 1e-6
    g = np.ones_like(f)
    if lo > 0:
        g *= 1 / (1 + (lo / f) ** (2 / soft))
    if hi < SR / 2:
        g *= 1 / (1 + (f / hi) ** (2 / soft))
    return np.fft.irfft(spec * g, n)


def sweep(f0: float, f1: float, sec: float, curve: str = "exp") -> np.ndarray:
    t = t_axis(sec)
    if curve == "exp":
        f = f0 * (f1 / f0) ** (t / sec)
    else:
        f = f0 + (f1 - f0) * (t / sec)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise(sec: float) -> np.ndarray:
    return rng.standard_normal(int(sec * SR))


def norm(x: np.ndarray, peak: float = 0.89) -> np.ndarray:
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def place(buf: np.ndarray, x: np.ndarray, at: float, gain: float = 1.0) -> None:
    i = int(at * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i] * gain


def write_wav(path: Path, x: np.ndarray) -> None:
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    data = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def to_mp3(x: np.ndarray, path: Path, bitrate: str = "192k") -> None:
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "x.wav"
        write_wav(wav, x)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", bitrate, str(path)], check=True
        )


def stereo_widen(x: np.ndarray, ms: float = 11.0) -> np.ndarray:
    d = int(ms / 1000 * SR)
    r = np.concatenate([np.zeros(d), x])[: len(x)]
    return np.stack([x, r], axis=1)


# ---------------------------------------------------------------- SFX


def sfx_whoosh(sec: float = 0.55) -> np.ndarray:
    n = noise(sec)
    t = t_axis(sec)
    shape = np.sin(np.pi * np.clip(t / sec, 0, 1)) ** 2.2
    lo = band(n, 300, 1400) * 0.6
    hi = band(n, 1400, 6000) * shape ** 2
    return norm((lo + hi) * shape, 0.75)


def sfx_coin() -> np.ndarray:
    sec = 0.9
    out = np.zeros(int(sec * SR))
    for k, (f, d, g) in enumerate([(2793, 0.35, 1.0), (4186, 0.25, 0.6), (5587, 0.18, 0.4), (7040, 0.12, 0.25)]):
        t = t_axis(sec)
        out += g * np.sin(2 * np.pi * f * t) * env_exp(sec, d)
    second = np.zeros_like(out)
    place(second, out[: int(0.6 * SR)] * 0.7, 0.07)
    click = band(noise(0.01), 3000, 12000) * 0.5
    out = out + second
    place(out, click, 0)
    return norm(out, 0.6)


def sfx_riser(sec: float = 1.2) -> np.ndarray:
    t = t_axis(sec)
    ramp = (t / sec) ** 2
    tone = sweep(220, 1760, sec) * 0.35 + sweep(330, 2640, sec) * 0.15
    air = band(noise(sec), 2000, 9000) * 0.5
    x = (tone + air) * ramp
    x[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    return norm(x, 0.6)


def sfx_tap() -> np.ndarray:
    x = band(noise(0.04), 800, 5000) * env_exp(0.04, 0.006)
    x += np.sin(2 * np.pi * 180 * t_axis(0.04)) * env_exp(0.04, 0.01) * 0.6
    return norm(x, 0.55)


def sfx_typing(sec: float = 1.6, cps: float = 11.0) -> np.ndarray:
    out = np.zeros(int(sec * SR))
    at = 0.0
    while at < sec - 0.05:
        k = band(noise(0.025), 1500 + rng.random() * 2500, 9000) * env_exp(0.025, 0.004)
        place(out, k, at, 0.4 + 0.4 * rng.random())
        at += 1 / cps * (0.6 + 0.8 * rng.random())
    return norm(out, 0.35)


def sfx_pop(pitch: float = 1.0) -> np.ndarray:
    sec = 0.18
    x = sweep(1100 * pitch, 520 * pitch, sec) * env_exp(sec, 0.045, 0.003)
    x += np.sin(2 * np.pi * 2200 * pitch * t_axis(sec)) * env_exp(sec, 0.012) * 0.25
    return norm(x, 0.6)


def sfx_ding() -> np.ndarray:
    sec = 1.1
    out = np.zeros(int(sec * SR))

    def bell(f: float) -> np.ndarray:
        t = t_axis(0.9)
        return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) + 0.15 * np.sin(2 * np.pi * f * 5.4 * t)) * env_exp(0.9, 0.28)

    place(out, bell(1318.5), 0.0, 0.8)   # E6
    place(out, bell(1975.5), 0.11, 0.8)  # B6
    return norm(out, 0.6)


def sfx_vibrate(sec: float = 0.7) -> np.ndarray:
    t = t_axis(sec)
    buzz = np.sign(np.sin(2 * np.pi * 155 * t)) * 0.5 + np.sin(2 * np.pi * 155 * t)
    gate = ((t % 0.35) < 0.24).astype(float)
    gate = band(gate, 0, 60)
    return norm(band(buzz, 60, 1500) * gate, 0.4)


def sfx_ticks(sec: float = 4.0, rate: float = 4.0) -> np.ndarray:
    out = np.zeros(int(sec * SR))
    k = 0
    at = 0.0
    while at < sec:
        f = 3200 if k % 2 == 0 else 2600
        tick = np.sin(2 * np.pi * f * t_axis(0.03)) * env_exp(0.03, 0.004) + band(noise(0.03), 2000, 8000) * env_exp(0.03, 0.002) * 0.6
        place(out, tick, at, 0.7)
        at += 1 / rate
        k += 1
    return norm(out, 0.4)


def sfx_fail() -> np.ndarray:
    sec = 0.9
    t = t_axis(sec)
    a = sweep(220, 150, sec) + 0.5 * sweep(233, 158, sec)
    x = band(a, 0, 1200) * env_exp(sec, 0.35, 0.02)
    return norm(x, 0.5)


def sfx_hit(f: float = 70.0) -> np.ndarray:
    sec = 0.7
    body = sweep(f * 2.2, f, sec) * env_exp(sec, 0.16, 0.002)
    click = band(noise(0.03), 1500, 7000) * env_exp(0.03, 0.006) * 0.4
    x = body
    place(x, click, 0)
    return norm(x, 0.6)


def sfx_boom() -> np.ndarray:
    sec = 2.4
    sub = sweep(120, 34, sec) * env_exp(sec, 0.7, 0.003)
    crack = band(noise(sec), 200, 4000) * env_exp(sec, 0.12, 0.001) * 0.5
    tail = band(noise(sec), 80, 600) * env_exp(sec, 0.6, 0.01) * 0.35
    return norm(np.tanh((sub + crack + tail) * 1.6), 0.9)


def sfx_sparkle(sec: float = 1.0, density: int = 10) -> np.ndarray:
    out = np.zeros(int(sec * SR))
    for _ in range(density):
        f = 3000 + rng.random() * 5000
        at = rng.random() * sec * 0.8
        place(out, np.sin(2 * np.pi * f * t_axis(0.3)) * env_exp(0.3, 0.07), at, 0.3 + 0.7 * rng.random())
    return norm(out, 0.35)


def sfx_shimmer() -> np.ndarray:
    sec = 2.6
    x = sfx_sparkle(sec, 30)
    t = t_axis(sec)
    chord = sum(np.sin(2 * np.pi * f * t) for f in (1174.7, 1480.0, 1760.0, 2349.3)) * env_exp(sec, 0.9, 0.3) * 0.12
    return norm(x + chord, 0.45)


# ---------------------------------------------------------------- music

BPM = 116.0
BEAT = 60.0 / BPM
# D major-ish loop: Bm - G - D - A (one bar each).
CHORDS = [
    (47, [59, 62, 66]),  # Bm
    (43, [59, 62, 67]),  # G
    (38, [57, 62, 66]),  # D
    (45, [57, 61, 64]),  # A
]


def mtof(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def saw(f: float, sec: float, detune: float = 0.0) -> np.ndarray:
    t = t_axis(sec)
    ph = (f * (1 + detune) * t) % 1.0
    return 2 * ph - 1


def kick() -> np.ndarray:
    sec = 0.4
    x = sweep(150, 45, 0.4) * env_exp(sec, 0.12, 0.001)
    return np.tanh(x * 1.5)


def hat(open_: bool = False) -> np.ndarray:
    sec = 0.25 if open_ else 0.06
    return band(noise(sec), 7000, 16000) * env_exp(sec, 0.08 if open_ else 0.014)


def clap() -> np.ndarray:
    sec = 0.3
    n = band(noise(sec), 900, 5000)
    e = np.zeros(int(sec * SR))
    for d in (0.0, 0.012, 0.024):
        place(e, env_exp(sec - d, 0.05 if d else 0.01), d)
    return n * e


def make_music(total: float, vo_spans: list[tuple[float, float]], hits: dict) -> np.ndarray:
    n = int((total + 0.2) * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    bar = 4 * BEAT
    end_hit = hits["end"]
    build_from = hits["build"]
    # Pad: detuned saws, filtered, one chord per bar; filter opens toward the end.
    t0 = 0.0
    bi = 0
    while t0 < end_hit:
        root, notes = CHORDS[bi % 4]
        prog = min(1.0, t0 / end_hit)
        sec = min(bar + 0.6, end_hit - t0 + 0.05)
        padL = sum(saw(mtof(m), sec, -0.004) for m in notes)
        padR = sum(saw(mtof(m), sec, 0.004) for m in notes)
        cutoff = 900 + 1700 * prog ** 1.5
        e = np.minimum(1, t_axis(sec) / 0.25) * np.minimum(1, (sec - t_axis(sec)) / 0.4)
        place(L, band(padL, 120, cutoff) * e, t0, 0.06)
        place(R, band(padR, 120, cutoff) * e, t0, 0.06)
        # Bass on 8ths after the intro bar.
        if t0 >= bar * 1 - 0.01:
            for k in range(8):
                at = t0 + k * BEAT / 2
                if at >= end_hit:
                    break
                b = band(saw(mtof(root), 0.22), 0, 600) * env_exp(0.22, 0.09, 0.004)
                place(L, b, at, 0.16)
                place(R, b, at, 0.16)
        # Pluck arpeggio, enters bar 2.
        if t0 >= bar * 2 - 0.01:
            arp = notes + [notes[0] + 12, notes[1] + 12, notes[2] + 12]
            for k in range(8):
                at = t0 + k * BEAT / 2
                if at >= end_hit:
                    break
                m = arp[(k * 2 + bi) % len(arp)] + 12
                p = band(saw(mtof(m), 0.3) + 0.5 * np.sin(2 * np.pi * mtof(m) * t_axis(0.3)), 0, 3500) * env_exp(0.3, 0.08, 0.002)
                pan = 0.35 if k % 2 else -0.35
                place(L, p, at, 0.05 * (1 - pan))
                place(R, p, at + 0.009, 0.05 * (1 + pan))
        t0 += bar
        bi += 1

    # Drums.
    beat_t = 0.0
    k = 0
    while beat_t < end_hit - 0.01:
        in_groove = beat_t >= bar - 0.01
        building = beat_t >= build_from
        if in_groove:
            place(L, kick(), beat_t, 0.5)
            place(R, kick(), beat_t, 0.5)
            if k % 2 == 1:
                c = clap()
                place(L, c, beat_t, 0.12)
                place(R, c, beat_t + 0.004, 0.12)
        hs = [0.5] if not building else [0.25, 0.5, 0.75]
        for off in hs:
            h = hat(open_=(off == 0.5 and k % 4 == 3))
            at = beat_t + off * BEAT
            if at < end_hit:
                place(L, h, at, 0.05 if off == 0.5 else 0.03)
                place(R, h, at + 0.006, 0.05 if off == 0.5 else 0.03)
        beat_t += BEAT
        k += 1

    # Riser into the final hit, then the hit: chord stab + kick + crash-ish noise.
    rs = sfx_riser(1.6) * 0.18
    place(L, rs, end_hit - 1.6)
    place(R, rs, end_hit - 1.6)
    stab_sec = 2.2
    root, notes = CHORDS[2]  # land on D
    stab = sum(saw(mtof(m), stab_sec) for m in notes + [root + 24, notes[0] + 12])
    stab = band(stab, 80, 5000) * env_exp(stab_sec, 0.55, 0.004)
    crash = band(noise(stab_sec), 4000, 15000) * env_exp(stab_sec, 0.6, 0.002)
    sub = sweep(90, 40, stab_sec) * env_exp(stab_sec, 0.45, 0.002)
    for ch, d in ((L, 0.0), (R, 0.007)):
        place(ch, stab, end_hit + d, 0.09)
        place(ch, crash, end_hit + d, 0.07)
        place(ch, sub, end_hit, 0.35)

    mix = np.stack([L, R], axis=1)
    mix = np.tanh(mix * 1.1)
    # Fade in.
    fi = int(0.4 * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    return norm(mix, 0.85)


# ---------------------------------------------------------------- main


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vo", action="store_true", help="regenerate the voiceover with edge-tts")
    args = ap.parse_args()

    SCENES.mkdir(parents=True, exist_ok=True)
    SFX.mkdir(parents=True, exist_ok=True)

    script = parse_script()
    print("voiceover")
    for name, text in script:
        if args.vo or not (SCENES / f"{name}.mp3").exists() or not (SCENES / f"{name}.words.json").exists():
            make_vo(name, text)
        else:
            print(f"  ok  {name}")

    tl = build_timeline(script)
    TIMELINE.write_text(json.dumps(tl, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    total = tl["durationInFrames"] / FPS
    print(f"timeline  {total:.2f}s  ({tl['durationInFrames']} frames)")

    print("sfx")
    bank = {
        "whoosh": sfx_whoosh(),
        "whoosh_long": sfx_whoosh(0.9),
        "coin": sfx_coin(),
        "riser": sfx_riser(1.2),
        "riser_long": sfx_riser(2.0),
        "tap": sfx_tap(),
        "typing": sfx_typing(),
        "pop": sfx_pop(1.0),
        "pop_hi": sfx_pop(1.26),
        "ding": sfx_ding(),
        "vibrate": sfx_vibrate(),
        "ticks": sfx_ticks(),
        "fail": sfx_fail(),
        "hit": sfx_hit(70),
        "hit_hi": sfx_hit(95),
        "boom": sfx_boom(),
        "sparkle": sfx_sparkle(),
        "shimmer": sfx_shimmer(),
    }
    for name, x in bank.items():
        write_wav(SFX / f"{name}.wav", stereo_widen(x) if name in ("whoosh", "whoosh_long", "shimmer", "sparkle") else x)
    print(f"  {len(bank)} files")

    print("music")
    spans = [((s["voFrom"]) / FPS, s["voFrom"] / FPS + s["voSeconds"]) for s in tl["scenes"]]
    last = tl["scenes"][-1]
    end_hit = (last["from"] + last["durationInFrames"]) / FPS - 2.0
    build = tl["scenes"][-2]["from"] / FPS  # the build starts with the payoff scene
    to_mp3(make_music(total, spans, {"end": end_hit, "build": build}), MUSIC)
    print(f"  {MUSIC.relative_to(HERE)}  end hit at {end_hit:.2f}s")


if __name__ == "__main__":
    sys.exit(main())
