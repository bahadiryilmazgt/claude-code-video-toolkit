#!/usr/bin/env python3
"""ElevenLabs soundtrack for "First Reply Wins": narration, sound design and music.

Revision of make_audio.py (which synthesizes everything with numpy). This one uses:
  - narration: the repo's house voice (Atakan on eleven_v4, via tools/voiceover.py)
  - sound effects: ElevenLabs Sound Effects (tools/sfx.py)
  - music: ElevenLabs Music with a composition plan whose sections match the scenes

Every ElevenLabs file is cached in audio/el/ and reused, so re-running only re-mixes
and spends no credits. Delete a file there to regenerate it. Placement comes from
src/timeline.json (`voiceover` cues and `sfx` events, in beats), like the visuals.

Run from the toolkit root:
    uv run examples/first-reply-wins/audio/make_audio_el.py
Writes examples/first-reply-wins/public/audio/soundtrack.wav (-14 LUFS).
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
TOOLKIT = PROJECT.parent.parent
CACHE = HERE / "el"
TL = json.load(open(PROJECT / "src" / "timeline.json", encoding="utf-8"))

SR = 44100
BEAT = 60.0 / TL["bpm"]
TOTAL = TL["totalBeats"] * BEAT

# name -> (prompt, seconds)
SFX = {
    "pop": ("Soft glassy bubble pop, crystal clear, premium UI notification, rounded and gentle, no harshness", 0.6),
    "whoosh_short": ("Soft airy whoosh, smooth cinematic camera move, gentle and premium, no harsh noise", 0.9),
    "whoosh_long": ("Slow airy cinematic whoosh that swells and fades, soft wind, elegant camera fly-through", 2.0),
    "rise": ("Soft rising airy shimmer swell, gentle elegant riser, not aggressive", 1.6),
    "chime": ("Delicate crystal chime, a single soft high bell tone with a gentle shimmering tail, luxurious and golden", 2.5),
    "chime_warm": ("Warm satisfying success chime, soft glass bells, gentle and elegant resolution", 2.5),
    "tick": ("Single soft subtle clock tick, delicate, quiet and crisp", 0.5),
    "clockticks": ("Soft clock ticking that gradually speeds up, subtle building tension, no alarm, no bell", 6.0),
    "muted": ("Gentle muted low tone, soft cushioned disappointed thud, subtle and sad", 1.5),
    "liquid": ("Liquid gold pouring, soft viscous fluid with a delicate sparkle, elegant", 1.5),
    "shimmer": ("Faint magical sparkle shimmer, tiny glittering particles, soft and airy", 2.0),
    "typing": ("Soft smartphone screen typing taps, gentle and quiet, close-up", 1.2),
}

# Music sections follow the scene arc (ms); the last one rings past the end and is faded.
MUSIC_PLAN = {
    "positive_global_styles": [
        "modern cinematic elegant electronic", "soft piano", "plucked synths", "warm pads",
        "105 BPM", "premium health brand commercial", "instrumental", "polished studio mix",
    ],
    "negative_global_styles": ["vocals", "singing", "spoken word", "aggressive drums", "dubstep", "harsh distortion", "loud risers"],
    "sections": [
        {"section_name": "Mysterious intro", "duration_ms": 18286, "lines": [],
         "positive_local_styles": ["calm", "mysterious", "sparse piano notes", "airy pads", "soft pulse"],
         "negative_local_styles": ["heavy drums"]},
        {"section_name": "Race tension", "duration_ms": 9143, "lines": [],
         "positive_local_styles": ["building tension", "ticking rhythmic plucks", "driving pulse", "rising energy"],
         "negative_local_styles": ["chaotic", "harsh"]},
        {"section_name": "Bright resolution", "duration_ms": 18286, "lines": [],
         "positive_local_styles": ["bright", "satisfying", "uplifting", "full warm groove", "piano melody"],
         "negative_local_styles": ["dark"]},
        {"section_name": "Warm ending", "duration_ms": 8800, "lines": [],
         "positive_local_styles": ["warm", "resolving", "final sustained chord", "gentle fade"],
         "negative_local_styles": ["abrupt stop"]},
    ],
}


def run(cmd):
    env = {**os.environ, "ELEVENLABS_API_KEY": os.environ.get("ELEVENLABS_API_KEY") or "proxy-injected"}
    subprocess.run(cmd, check=True, cwd=TOOLKIT, env=env)


def ensure_voiceover():
    vo_dir = CACHE / "vo"
    vo_dir.mkdir(parents=True, exist_ok=True)
    missing = False
    for cue in TL["voiceover"]:
        txt = vo_dir / f"{cue['id']}.txt"
        if not txt.exists() or txt.read_text(encoding="utf-8").strip() != cue["text"]:
            txt.write_text(cue["text"] + "\n", encoding="utf-8")
            (vo_dir / f"{cue['id']}.mp3").unlink(missing_ok=True)
        missing |= not (vo_dir / f"{cue['id']}.mp3").exists()
    if missing:
        # house voice: Atakan on eleven_v4 with its own settings (toolkit-registry config)
        run(["uv", "run", "tools/voiceover.py", "--scene-dir", str(vo_dir), "--json"])


def ensure_sfx():
    for name, (prompt, dur) in SFX.items():
        out = CACHE / "sfx" / f"{name}.mp3"
        if out.exists():
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        run(["uv", "run", "tools/sfx.py", "--prompt", prompt, "--duration", str(dur), "--output", str(out)])


def ensure_music():
    out = CACHE / "music.mp3"
    if out.exists():
        return
    from elevenlabs.client import ElevenLabs

    client = ElevenLabs(api_key=os.environ.get("ELEVENLABS_API_KEY") or "proxy-injected")
    audio = client.music.compose(
        composition_plan=MUSIC_PLAN,
        respect_sections_durations=True,
        output_format="mp3_44100_192",
    )
    with open(out, "wb") as f:
        for chunk in audio:
            f.write(chunk)


def load(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def place(bus, sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    n = min(len(sig), len(bus) - i)
    if n <= 0:
        return
    gl = gain * np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
    gr = gain * np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    bus[i : i + n, 0] += sig[:n, 0] * gl
    bus[i : i + n, 1] += sig[:n, 1] * gr


def peak_norm(x, peak=1.0):
    return x * (peak / (np.max(np.abs(x)) + 1e-9))


def mix():
    n = int((TOTAL + 0.05) * SR)
    vo = np.zeros((n, 2), np.float32)
    sfx = np.zeros((n, 2), np.float32)

    # narration, with a timing report so overlaps are caught before rendering
    cues = TL["voiceover"]
    for k, cue in enumerate(cues):
        clip = load(CACHE / "vo" / f"{cue['id']}.mp3")
        t0 = cue["b"] * BEAT
        t1 = t0 + len(clip) / SR
        nxt = cues[k + 1]["b"] * BEAT if k + 1 < len(cues) else TOTAL
        flag = "  <-- OVERLAPS NEXT" if t1 > nxt - 0.1 else ""
        print(f"  VO {cue['id']:<11} {t0:6.2f}s -> {t1:6.2f}s (next {nxt:6.2f}s){flag}")
        place(vo, peak_norm(clip, 0.9), t0)

    rng = np.random.default_rng(7)
    cache = {}

    def get(name):
        if name not in cache:
            cache[name] = peak_norm(load(CACHE / "sfx" / f"{name}.mp3"))
        return cache[name]

    for e in TL["sfx"]:
        t = e["b"] * BEAT
        g = e["g"] * 0.42
        kind = e["t"]
        pan = float(rng.uniform(-0.25, 0.25))
        if kind == "whoosh":
            name = "whoosh_short" if e.get("d", 1.2) <= 1.4 else "whoosh_long"
            place(sfx, get(name), t - 0.35 * len(get(name)) / SR, g, pan)
        elif kind == "rise":
            place(sfx, get("rise"), t - 0.75 * len(get("rise")) / SR, g, pan)
        elif kind == "chime":
            place(sfx, get("chime" if e.get("f", 1760) >= 1700 else "chime_warm"), t, g * 0.8, pan)
        elif kind == "counts":
            for k in range(8):
                place(sfx, get("tick"), t + e["d"] * BEAT * (1 - (1 - k / 8) ** 2), g * 0.5, pan)
        elif kind == "clockticks":
            place(sfx, get("clockticks"), t, g * 0.9, 0.15)
        elif kind in ("pop", "tick", "liquid", "shimmer", "muted", "typing"):
            place(sfx, get(kind), t, g, pan)

    music = peak_norm(load(CACHE / "music.mp3"))[:n]
    music = np.pad(music, ((0, n - len(music)), (0, 0)))
    # duck the music under the narration (smoothed envelope, ~150 ms attack / 500 ms release)
    active = (np.abs(vo).max(axis=1) > 0.02).astype(np.float32)
    win = int(0.25 * SR)
    active = np.convolve(active, np.ones(win) / win, mode="same") > 0.05
    target = np.where(active, 0.32, 0.62).astype(np.float32)
    env = np.empty_like(target)
    a_att, a_rel = 1 / (0.15 * SR), 1 / (0.5 * SR)
    level = target[0]
    for i in range(0, n, 64):  # block-wise one-pole smoothing (fast enough in numpy)
        tgt = target[i]
        level += (tgt - level) * min(1.0, 64 * (a_att if tgt < level else a_rel))
        env[i : i + 64] = level
    music *= env[:, None]
    # final fade over the last 1.5 s
    fade = int(1.5 * SR)
    music[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5

    out = vo * 1.0 + sfx + music
    out = np.tanh(peak_norm(out, 0.95) * 1.2) / np.tanh(1.2)
    raw = PROJECT / "public" / "audio" / "soundtrack_raw.wav"
    raw.parent.mkdir(parents=True, exist_ok=True)
    pcm = (out * 32767 * 0.9).astype("<i2").tobytes()
    import wave

    with wave.open(str(raw), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)
    final = PROJECT / "public" / "audio" / "soundtrack.wav"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), str(final)],
        check=True,
    )
    raw.unlink()
    print("wrote", final)


if __name__ == "__main__":
    ensure_voiceover()
    ensure_sfx()
    ensure_music()
    if "--generate-only" not in sys.argv:
        mix()
