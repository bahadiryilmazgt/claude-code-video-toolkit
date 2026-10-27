#!/usr/bin/env python3
"""Free, local motion-graphics sound-effects pack, synthesised with ffmpeg.

No API, no download, no model: every sound is built from ffmpeg's own
generators (anoisesrc, aevalsrc) and filters, with fixed noise seeds, so the
pack is identical on every machine and can be regenerated at any time.

Sounds (48 kHz stereo WAV, peak-normalised to -3 dBFS):

    whoosh-soft       1.0s  airy band-swept noise, gentle left-to-right pan
    whoosh-fast       0.45s bright, quick swipe for snappy cuts and slide-ins
    pop-subtle        0.14s soft pitched pop for an element appearing
    click             0.05s crisp UI click (buttons, cursor, toggles)
    tick              0.06s short wooden tick (counters, list items, timers)
    impact-soft       1.4s  low, rounded thud for a title or number landing
    impact-strong     2.2s  deep boom with crack and tail for a big reveal
    riser             3.0s  rising noise + tone build into a reveal or drop
    transition-sweep  1.3s  tonal + noise sweep across the stereo field

Usage:
    uv run tools/sfx_pack.py                         # (re)build into assets/sfx/
    uv run tools/sfx_pack.py --list                  # names, lengths, suggested use
    uv run tools/sfx_pack.py --only riser,click      # just some of them
    uv run tools/sfx_pack.py --output-dir projects/my-video/public/audio/sfx
    uv run tools/sfx_pack.py --format mp3 --json

Mixing: tools/mix_audio.py takes these by name (--sfx whoosh-soft@2.5), or
reference the WAVs from Remotion with <Audio src={staticFile('audio/sfx/...')}>.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TOOLKIT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DIR = TOOLKIT_ROOT / "assets" / "sfx"
SR = 48000
PEAK_DBFS = -3.0

# Spectral band-pass whose centre moves over time: afftfilt sees each FFT bin
# (b) and the frame time (pts), so a Gaussian gain around fc(pts) sweeps the
# band without any per-sample filter state. Commas must be escaped inside the
# filtergraph, which is why expressions are written through _esc().
_BIN_HZ = "(b*sr/(2*nb))"


def _esc(expr: str) -> str:
    return expr.replace(",", r"\,")


def sweep(fc: str, bw: str) -> str:
    gain = f"exp(-pow(({_BIN_HZ}-({fc}))/({bw}),2))"
    return f"afftfilt=real='{_esc('re*' + gain)}':imag='{_esc('im*' + gain)}':win_size=1024"


def env(expr: str) -> str:
    """Per-sample amplitude envelope (t in seconds)."""
    return f"volume='{_esc(expr)}':eval=frame"


def pan(l_expr: str, r_expr: str) -> str:
    return f"aeval='{_esc(f'val(0)*({l_expr})')}|{_esc(f'val(1)*({r_expr})')}':c=stereo"


def noise(color: str, d: float, seed: int, amp: float = 0.8) -> str:
    return f"anoisesrc=d={d}:c={color}:r={SR}:a={amp}:seed={seed}"


def tone(expr: str, d: float) -> str:
    return f"aevalsrc='{_esc(expr)}':d={d}:s={SR}"


# Each recipe: duration, filtergraph (complex, output label [out]), description,
# suggested mix gain in dB for a marketing video with voiceover.
SOUNDS: dict[str, dict] = {
    "whoosh-soft": {
        "d": 1.0,
        "use": "scene change, card sliding in, gentle camera move",
        "gain_db": -10,
        "graph": lambda d: (
            f"{noise('pink', d, 11)},aformat=channel_layouts=stereo,"
            f"{sweep('350+1500*pow(sin(PI*pts/1.0),2)', '450')},"
            f"{env(f'pow(sin(PI*min(t/{d},1)),2.2)')},"
            f"{pan('1-0.4*t/1.0', '0.6+0.4*t/1.0')},"
            f"lowpass=f=5000[out]"
        ),
    },
    "whoosh-fast": {
        "d": 0.45,
        "use": "quick cut, text snapping in, fast slide/swipe",
        "gain_db": -9,
        "graph": lambda d: (
            f"{noise('white', d, 23)},aformat=channel_layouts=stereo,"
            f"{sweep('600+4200*pow(min(pts/0.32,1),1.5)', '700+900*pts/0.45')},"
            f"{env(f'if(lt(t,0.3),pow(t/0.3,2),pow(max(0,1-(t-0.3)/0.15),1.5))')},"
            f"{pan('1.1-t/0.45', '0.1+t/0.45')},"
            f"highpass=f=250[out]"
        ),
    },
    "pop-subtle": {
        "d": 0.14,
        "use": "icon, bullet, chart bar or badge appearing",
        "gain_db": -12,
        "graph": lambda d: (
            f"{tone('0.9*sin(2*PI*(260*t+700*(1-exp(-45*t))/45))*(1-exp(-t*900))*exp(-t*38)', d)},"
            f"lowpass=f=3500,aformat=channel_layouts=stereo[out]"
        ),
    },
    "click": {
        "d": 0.05,
        "use": "button press, cursor click, toggle",
        "gain_db": -12,
        "graph": lambda d: (
            f"{noise('white', d, 37, 1.0)},highpass=f=2500,{env('exp(-t*450)')}[n];"
            f"{tone('0.6*sin(2*PI*2200*t)*exp(-t*260)+0.35*sin(2*PI*4100*t)*exp(-t*500)', d)}[s];"
            f"[n][s]amix=inputs=2:normalize=0,aformat=channel_layouts=stereo[out]"
        ),
    },
    "tick": {
        "d": 0.06,
        "use": "counter ticking up, list item, timer, metric step",
        "gain_db": -14,
        "graph": lambda d: (
            f"{tone('0.7*sin(2*PI*1650*t)*exp(-t*130)+0.3*sin(2*PI*3900*t)*exp(-t*240)+0.2*sin(2*PI*820*t)*exp(-t*90)', d)}[s];"
            f"{noise('white', d, 41, 0.6)},bandpass=f=3000:w=1500,{env('exp(-t*600)')}[n];"
            f"[s][n]amix=inputs=2:normalize=0,aformat=channel_layouts=stereo[out]"
        ),
    },
    "impact-soft": {
        "d": 1.4,
        "use": "title or key number landing, logo settle",
        "gain_db": -8,
        "graph": lambda d: (
            f"{tone('0.9*sin(2*PI*(52*t+70*(1-exp(-14*t))/14))*(1-exp(-t*300))*exp(-t*4.2)', d)}[sub];"
            f"{noise('pink', d, 53)},lowpass=f=900,{env('exp(-t*22)')}[thud];"
            f"[sub][thud]amix=inputs=2:weights='1 0.5':normalize=0,"
            f"aformat=channel_layouts=stereo,aecho=0.6:0.4:60|85:0.25|0.2,lowpass=f=2500[out]"
        ),
    },
    "impact-strong": {
        "d": 2.2,
        "use": "big reveal, headline stat, logo slam, final CTA hit",
        "gain_db": -6,
        "graph": lambda d: (
            f"{tone('sin(2*PI*(42*t+120*(1-exp(-10*t))/10))*(1-exp(-t*400))*exp(-t*2.4)', d)}[sub];"
            f"{noise('white', d, 67, 1.0)},lowpass=f=6000,highpass=f=120,{env('exp(-t*16)')}[crack];"
            f"{noise('brown', d, 71, 1.0)},lowpass=f=400,{env('exp(-t*5)')}[rumble];"
            f"[sub][crack][rumble]amix=inputs=3:weights='1 0.55 0.6':normalize=0,"
            f"asoftclip=type=tanh,aformat=channel_layouts=stereo,"
            f"aecho=0.7:0.5:90|130:0.3|0.25,lowpass=f=7000[out]"
        ),
    },
    "riser": {
        "d": 3.0,
        "use": "build-up into a reveal, intro to a key metric, pre-CTA",
        "gain_db": -12,
        "graph": lambda d: (
            f"{noise('white', d, 83, 0.7)},aformat=channel_layouts=stereo,"
            f"{sweep('250*pow(28,pts/3.0)', '300+1500*pts/3.0')}[n];"
            f"{tone('0.22*(sin(2*PI*(180*t+220*t*t/3))+0.5*sin(4*PI*(180*t+220*t*t/3))+0.33*sin(6*PI*(180*t+220*t*t/3)))', d)},"
            f"aformat=channel_layouts=stereo,"
            f"aeval='val(0)*(1+0.25*sin(2*PI*(4+6*t/3)*t))|val(1)*(1+0.25*sin(2*PI*(4+6*t/3)*t+1.2))':c=stereo[s];"
            f"[n][s]amix=inputs=2:weights='0.9 1':normalize=0,"
            f"{env(f'pow(min(t/{d},1),2.2)*if(gt(t,{d}-0.02),max(0,({d}-t)/0.02),1)')}[out]"
        ),
    },
    "transition-sweep": {
        "d": 1.3,
        "use": "section transition, wipe, chart-to-chart change",
        "gain_db": -11,
        "graph": lambda d: (
            f"{tone('0.5*sin(2*PI*(320*t+1500*t*t/1.3))+0.2*sin(4*PI*(320*t+1500*t*t/1.3))', d)},"
            f"aformat=channel_layouts=stereo[s];"
            f"{noise('pink', d, 97)},aformat=channel_layouts=stereo,"
            f"{sweep('400+3800*pts/1.3', '600')}[n];"
            f"[s][n]amix=inputs=2:weights='0.6 1':normalize=0,"
            f"{env(f'pow(sin(PI*min(t/{d},1)),1.6)')},"
            f"{pan('1-0.8*t/1.3', '0.2+0.8*t/1.3')},"
            f"aecho=0.5:0.4:45:0.25[out]"
        ),
    },
}


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def peak_db(path: Path) -> float | None:
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"])
    m = re.search(r"max_volume:\s*(-?[\d.]+) dB", r.stderr)
    return float(m.group(1)) if m else None


def duration(path: Path) -> float | None:
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def build(name: str, out_dir: Path, fmt: str) -> dict:
    spec = SOUNDS[name]
    d = spec["d"]
    out = out_dir / f"{name}.{fmt}"
    with tempfile.TemporaryDirectory(prefix="sfx_") as tmp:
        raw = Path(tmp) / "raw.wav"
        # atrim + short fade-out guarantee an exact length and no end click.
        graph = spec["graph"](d) .replace("[out]", "[pre]") + (
            f";[pre]atrim=0:{d},asetpts=N/SR/TB,afade=t=out:st={max(0, d - 0.01)}:d=0.01,"
            f"aresample={SR}[out]"
        )
        r = run(["ffmpeg", "-y", "-hide_banner", "-v", "error", "-filter_complex", graph,
                 "-map", "[out]", "-ac", "2", "-c:a", "pcm_s16le", str(raw)])
        if r.returncode != 0:
            return {"name": name, "success": False, "error": r.stderr.strip()[-600:]}
        peak = peak_db(raw)
        if peak is None or peak < -90:
            return {"name": name, "success": False, "error": "generated silence"}
        gain = PEAK_DBFS - peak
        codec = ["-c:a", "pcm_s16le"] if fmt == "wav" else ["-c:a", "libmp3lame", "-b:a", "192k"]
        r = run(["ffmpeg", "-y", "-hide_banner", "-v", "error", "-i", str(raw),
                 "-af", f"volume={gain:.2f}dB", "-ar", str(SR), *codec, str(out)])
        if r.returncode != 0:
            return {"name": name, "success": False, "error": r.stderr.strip()[-600:]}
    return {
        "name": name,
        "success": True,
        "output": str(out),
        "duration_seconds": round(duration(out) or d, 3),
        "suggested_gain_db": spec["gain_db"],
        "use": spec["use"],
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Build the free, local motion-graphics SFX pack with ffmpeg.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage:", 1)[1] if "Usage:" in __doc__ else None,
    )
    ap.add_argument("--output-dir", default=str(DEFAULT_DIR), help=f"Where to write the pack (default: {DEFAULT_DIR.relative_to(TOOLKIT_ROOT)})")
    ap.add_argument("--only", help="Comma-separated subset of sound names")
    ap.add_argument("--format", choices=["wav", "mp3"], default="wav", help="Output format (default: wav)")
    ap.add_argument("--list", action="store_true", help="List the sounds and exit")
    ap.add_argument("--json", action="store_true", help="Machine-readable output")
    args = ap.parse_args()

    if args.list:
        rows = [{"name": n, "duration_seconds": s["d"], "suggested_gain_db": s["gain_db"], "use": s["use"]}
                for n, s in SOUNDS.items()]
        if args.json:
            print(json.dumps(rows, indent=2))
        else:
            for r in rows:
                print(f"  {r['name']:<17} {r['duration_seconds']:>4}s  {r['suggested_gain_db']:>4} dB  {r['use']}")
        return 0

    if not shutil.which("ffmpeg"):
        print("Error: ffmpeg not found on PATH", file=sys.stderr)
        return 1

    names = list(SOUNDS)
    if args.only:
        names = [n.strip() for n in args.only.split(",") if n.strip()]
        unknown = [n for n in names if n not in SOUNDS]
        if unknown:
            print(f"Error: unknown sound(s): {', '.join(unknown)}. Known: {', '.join(SOUNDS)}", file=sys.stderr)
            return 1

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for n in names:
        r = build(n, out_dir, args.format)
        results.append(r)
        if not args.json:
            if r["success"]:
                print(f"  {n:<17} {r['duration_seconds']:.2f}s  -> {r['output']}", file=sys.stderr)
            else:
                print(f"  {n:<17} FAILED: {r['error']}", file=sys.stderr)
    ok = all(r["success"] for r in results)
    if args.json:
        print(json.dumps({"success": ok, "output_dir": str(out_dir), "sounds": results}, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
