#!/usr/bin/env python3
"""Single source of truth for timing.

Writes src/timeline.json: named beat marks (read by the animation) and the full
list of sound events (read by audio/synth.py). Because both sides read the same
numbers, every crunch lands on the exact frame the bite happens.
"""
import json
from pathlib import Path

FPS = 30
DUR = 30.0


def f(t):  # snap to a frame boundary so audio onsets == visual frames
    return round(round(t * FPS) / FPS, 4)


M = {}  # marks
E = []  # sound events


def mark(name, t):
    M[name] = f(t)
    return M[name]


def ev(etype, t, **kw):
    E.append({"type": etype, "t": f(t), **kw})


# ---------------- 0-5s intro: waddle in, inspect, sniff, excited ----------------
WALK_PERIOD = 0.6
mark("walkEnd", 2.55)
for i, t in enumerate([0.15, 0.45, 0.75, 1.05, 1.35, 1.65, 1.95, 2.25, 2.55]):
    dist = 1.0 - (2.55 - t) / 2.55  # closer -> louder
    ev("step", t, side="L" if i % 2 == 0 else "R", gain=round(0.45 + 0.55 * dist, 3) * (0.6 if i == 8 else 1.0))
mark("arrive", 2.6)
ev("settle", 2.6)
ev("pat", 2.82, gain=0.45)
ev("pat", 2.9, gain=0.4)
mark("lookL", 2.8)
mark("lookR", 3.35)
ev("voc", 2.95, kind="curious", dur=0.5)
for t in (3.95, 4.12, 4.29):
    ev("sniff", t)
mark("sniff", 3.92)
mark("excite", 4.45)
ev("twinkle", 4.47, gain=0.5)
ev("voc", 4.5, kind="ooh", dur=0.42)
for t in (4.68, 4.88):
    ev("clap", t)

# ---------------- 5-11s crunchy star cookie ----------------
mark("cookieReach", 5.0)
mark("cookieGrab", 5.62)
ev("tick", 5.62, mat="ceramic", gain=0.55)
mark("cookieCut", 6.1)
ev("twinkle", 6.3, gain=0.35)
mark("cookieOpen1", 6.55)
mark("cookieBite1", 7.0)
ev("cookie_bite", 7.0, gain=1.0)
ev("crumbs", 7.32, n=9)
chews1 = [7.36, 7.70, 8.04, 8.38]
for i, t in enumerate(chews1):
    ev("cookie_chew", t, gain=round(0.85 - 0.13 * i, 3))
ev("voc", 7.55, kind="mmm", dur=0.9)
mark("cookieOpen2", 8.62)
mark("cookieBite2", 9.0)
ev("cookie_bite", 9.0, gain=0.92)
ev("crumbs", 9.3, n=8)
chews2 = [9.34, 9.66, 9.98, 10.30]
for i, t in enumerate(chews2):
    ev("cookie_chew", t, gain=round(0.8 - 0.13 * i, 3))
ev("voc", 9.75, kind="mmhm", dur=0.55)
mark("cookieMS", 10.4)
mark("cookieDown", 10.85)
ev("tick", 10.85, mat="cookie_plate", gain=0.6)

# ---------------- 11-17s sour lemon ----------------
mark("lemonLook", 11.0)
ev("voc", 11.2, kind="hm", dur=0.4)
mark("lemonReach", 11.55)
mark("lemonGrab", 12.1)
ev("tick", 12.1, mat="wet", gain=0.5)
ev("sniff", 12.52)
mark("lemonCut", 12.6)
mark("lemonOpen", 12.7)
mark("lemonBite", 13.0)
ev("lemon_bite", 13.0)
ev("drips", 13.3, n=5)
mark("sour", 13.05)
ev("voc", 13.15, kind="eek", dur=0.62)
ev("shiver", 13.2, dur=0.7)
for t in (14.05, 14.35):
    ev("juicy_chew", t, gain=0.45)
mark("shake", 14.5)
for i, t in enumerate((14.56, 14.81, 15.06, 15.30)):
    ev("swish", t, dir=1 if i % 2 == 0 else -1, gain=round(0.8 - 0.14 * i, 3))
mark("stunned", 15.45)
ev("voc", 15.72, kind="huh", dur=0.32)
mark("blink1", 15.95)
mark("blink2", 16.3)
mark("lemonDownStart", 16.45)
mark("lemonDown", 16.9)
ev("tick", 16.9, mat="wet", gain=0.4)

# ---------------- 17-23s squishy marshmallow ----------------
mark("marshCut", 17.0)
mark("marshGrab", 17.55)
ev("tick", 17.55, mat="soft", gain=0.6)
mark("marshECU", 18.05)
sq = [(18.2, 18.5, 18.85), (19.0, 19.35, 19.7)]
for i, (a, b, c) in enumerate(sq):
    mark(f"sq{i}a", a)
    mark(f"sq{i}b", b)
    mark(f"sq{i}c", c)
    ev("squeeze", a, dur=round(b - a + 0.05, 3), gain=1.0 - 0.1 * i)
    ev("release", b, gain=0.8)
ev("voc", 18.92, kind="hehe", dur=0.42)
mark("marshCU", 19.75)
mark("tearA", 19.9)
mark("tearB", 20.45)
ev("tear", 19.9, dur=0.55)
ev("pop", 20.45)
mark("pieceIn", 20.85)
ev("pomf", 20.85)
chews3 = [21.12, 21.46, 21.80, 22.14]
for i, t in enumerate(chews3):
    ev("soft_chew", t, gain=round(0.8 - 0.1 * i, 3))
ev("voc", 21.05, kind="bliss", dur=1.15)
mark("marshMS", 22.3)
mark("marshDown", 22.78)
ev("tick", 22.78, mat="soft", gain=0.5)

# ---------------- 23-30s strawberry + happy finale ----------------
mark("strawReach", 23.0)
mark("strawGrab", 23.55)
ev("tick", 23.55, mat="bowl", gain=0.4)
mark("strawCut", 24.0)
mark("strawBite1", 24.4)
ev("straw_bite", 24.4, gain=1.0)
ev("drips", 24.62, n=3)
chews4 = [24.72, 25.0]
mark("strawBite2", 25.3)
ev("straw_bite", 25.3, gain=0.8)
chews5 = [25.62, 25.92, 26.22]
for t in chews4 + chews5:
    ev("juicy_chew", t, gain=0.7)
mark("calyxDrop", 25.6)
ev("tick", 25.95, mat="leaf", gain=0.35)
mark("cheeks", 26.35)
ev("pat", 26.35)
ev("voc", 26.45, kind="yum", dur=0.75)
for t in (26.5, 26.8, 27.1, 27.4):
    ev("heart", t)
ev("voc", 27.25, kind="giggle", dur=0.5)
mark("waveCut", 27.75)
mark("wave", 28.0)
ev("voc", 28.25, kind="yay", dur=0.55)
ev("twinkle", 28.1, gain=0.4)

blinks = [1.2, 3.5, 5.3, 10.6, 11.9, 17.3, 23.2, 29.1]
data = {
    "fps": FPS,
    "duration": DUR,
    "walkPeriod": WALK_PERIOD,
    "marks": M,
    "chews": {
        "cookie1": [f(t) for t in chews1],
        "cookie2": [f(t) for t in chews2],
        "marsh": [f(t) for t in chews3],
        "straw1": [f(t) for t in chews4],
        "straw2": [f(t) for t in chews5],
        "lemon": [f(14.05), f(14.35)],
    },
    "squeezes": [[f(a), f(b), f(c)] for a, b, c in sq],
    "blinks": [f(t) for t in blinks],
    "hearts": [f(t) for t in (26.5, 26.8, 27.1, 27.4)],
    "events": sorted(E, key=lambda e: e["t"]),
}
out = Path(__file__).parent / "src" / "timeline.json"
out.write_text(json.dumps(data, indent=1))
print(f"wrote {out} with {len(M)} marks, {len(E)} sound events")
