#!/usr/bin/env python3
"""Free, local soundtrack mixer: voiceover + background music + sound effects.

Give it any royalty-free music file and it fits it to the video:

  * loops it (with a crossfade at each seam) or trims it to the exact duration,
    with an optional start offset into the track and fade-in / fade-out
  * sets its level by measured loudness (LUFS), so any track lands at the same
    bed level without hand-tuning
  * ducks it under the voice: speech is detected on the voice bus and the music
    drops by --duck-db while anyone speaks, with smooth attack/release ramps
  * places sound effects at timestamps (by pack name, e.g. whoosh-soft, or by path)
  * masters the result to YouTube loudness (-14 LUFS, -1 dBTP, two-pass loudnorm)

The voice bus is either the audio already in a rendered video (--video: e.g. a
Remotion render with the narration in it) or voiceover files placed on the
timeline (--voiceover FILE@SECONDS, or sequentially with --voiceover-dir).
Output is an audio file (.wav/.mp3/.m4a) or, when --output is a video, the
video with its audio replaced by the mix (video stream copied, not re-encoded).

Usage:
    # Rendered video (narration inside) + music + sfx -> finished MP4
    uv run tools/mix_audio.py --video out/video.mp4 --music public/audio/music/track.mp3 \\
        --sfx whoosh-soft@0.5 --sfx impact-strong@12.2 --sfx riser@9.2:-14 \\
        --output out/video-final.mp4

    # Build a soundtrack stem from scene VO files placed one after another
    uv run tools/mix_audio.py --voiceover-dir public/audio/scenes --gap 0.6 --lead-in 0.5 \\
        --music track.mp3 --output public/audio/soundtrack.wav

    # Everything from a plan file (paths relative to the plan); see --help-plan
    uv run tools/mix_audio.py --plan mix.json --output out/video-final.mp4 --json

    uv run tools/mix_audio.py --plan mix.json --dry-run       # show the timeline only
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

sys.path.insert(0, str(Path(__file__).parent))
from qc import YOUTUBE_LUFS, YOUTUBE_TRUE_PEAK, measure_loudness, normalize_loudness  # noqa: E402
from sfx_pack import DEFAULT_DIR as SFX_DIR, SOUNDS as SFX_SOUNDS  # noqa: E402
from win_encoding import ensure_utf8_output  # noqa: E402

SR = 48000
VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".m4v"}

PLAN_HELP = """Plan file (JSON). Every key is optional; CLI flags override it.
Relative paths resolve against the plan file's folder.

{
  "video": "out/video.mp4",              // narration in its audio = voice bus
  "duration": 45.0,                      // default: video length, else last cue + tail
  "voiceover": [                         // or {"dir": "public/audio/scenes", "gap": 0.6, "lead_in": 0.5}
    {"file": "public/audio/scenes/01.mp3", "at": 0.5},
    {"file": "public/audio/scenes/02.mp3"}           // no "at": follows the previous + gap
  ],
  "music": {
    "file": "public/audio/music/track.mp3",
    "lufs": -24,            // bed loudness between lines (default -24 with voice, -16 without)
    "duck_db": 9,           // extra drop under speech (0 = no ducking)
    "offset": 0,            // start this many seconds into the track
    "fade_in": 1.0, "fade_out": 2.5,
    "loop": true,           // false = play once, then silence
    "loop_crossfade": 1.5
  },
  "sfx": [
    {"file": "whoosh-soft", "at": 0.4},             // pack name or path
    {"file": "impact-strong", "at": 12.2, "gain_db": -6}
  ],
  "master": {"lufs": -14, "true_peak": -1}           // or false for no mastering
}"""


# ─── helpers ────────────────────────────────────────────────

def run(cmd: list[str], timeout: int = 1800) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def probe(path: Path) -> dict:
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
             "-of", "json", str(path)], timeout=60)
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        return {"duration": None, "audio": False, "video": False}
    types = {s.get("codec_type") for s in data.get("streams", [])}
    dur = data.get("format", {}).get("duration")
    return {"duration": float(dur) if dur else None, "audio": "audio" in types, "video": "video" in types}


def parse_cue(spec: str) -> tuple[str, float | None, float | None]:
    """'whoosh-soft@1.5:-10' -> ('whoosh-soft', 1.5, -10.0). Time and gain optional."""
    m = re.match(r"^(.*?)(?:@(-?[\d.]+))?(?::(-?[\d.]+))?$", spec)
    if not m or not m.group(1):
        raise ValueError(f"can't parse cue '{spec}' (expected FILE[@SECONDS][:GAIN_DB])")
    return m.group(1), (float(m.group(2)) if m.group(2) else None), (float(m.group(3)) if m.group(3) else None)


def resolve_sfx(name: str, base: Path) -> tuple[Path, float]:
    """Pack name (whoosh-soft) or a path. Returns (path, default gain dB)."""
    if name in SFX_SOUNDS:
        for ext in ("wav", "mp3"):
            p = SFX_DIR / f"{name}.{ext}"
            if p.exists():
                return p, float(SFX_SOUNDS[name]["gain_db"])
        raise FileNotFoundError(f"SFX '{name}' not built yet: run `uv run tools/sfx_pack.py`")
    p = Path(name)
    p = p if p.is_absolute() else base / p
    if not p.exists():
        raise FileNotFoundError(f"SFX file not found: {p}")
    return p, -10.0


def gain_to_lufs(path: Path, target: float) -> float:
    """dB of gain that brings `path` to `target` LUFS (0 if it can't be measured)."""
    m = measure_loudness(path)
    if not m or m.get("lufs") is None:
        return 0.0
    return round(target - m["lufs"], 2)


def speech_intervals(path: Path, duration: float, noise_db: float = -38.0,
                     min_silence: float = 0.35, merge_gap: float = 0.8) -> list[tuple[float, float]]:
    """Where the voice bus is speaking, via silencedetect. Short gaps are merged so the music doesn't pump."""
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af",
             f"silencedetect=noise={noise_db}dB:d={min_silence}", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: (-?[\d.]+)", r.stderr)]
    silences = list(zip(starts, ends + [duration] * (len(starts) - len(ends))))
    speech, cursor = [], 0.0
    for s, e in silences:
        if s > cursor + 0.05:
            speech.append((max(0.0, cursor), s))
        cursor = e
    if cursor < duration - 0.05:
        speech.append((cursor, duration))
    merged: list[list[float]] = []
    for s, e in speech:
        if merged and s - merged[-1][1] < merge_gap:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return [(round(s, 3), round(e, 3)) for s, e in merged]


def duck_expr(intervals: list[tuple[float, float]], duck_db: float,
              attack: float = 0.25, release: float = 0.6) -> str:
    """volume= expression: 1 between lines, 10^(-duck/20) under speech, linear ramps.

    Ramps start `attack` seconds before speech (so the first word is clear) and
    recover over `release` after it. Intervals closer than attack+release were
    merged upstream, so the trapezoids never overlap and can simply be summed.
    """
    if not intervals or duck_db <= 0:
        return "1"
    depth = 1 - 10 ** (-duck_db / 20)
    terms = [
        f"clip((t-{s - attack:.3f})/{attack},0,1)*clip(({e + release:.3f}-t)/{release},0,1)"
        for s, e in intervals
    ]
    return f"1-{depth:.4f}*min(1,{'+'.join(terms)})"


# ─── plan ───────────────────────────────────────────────────

def build_plan(args) -> tuple[dict, Path]:
    plan: dict = {}
    base = Path.cwd()
    if args.plan:
        plan_path = Path(args.plan)
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        base = plan_path.resolve().parent

    def path_of(p: str | None) -> Path | None:
        if not p:
            return None
        q = Path(p)
        return q if q.is_absolute() else (base / q)

    # CLI overrides (CLI paths are relative to cwd, not the plan)
    if args.video:
        plan["video"] = str(Path(args.video).resolve())
    if args.duration:
        plan["duration"] = args.duration
    if args.voiceover or args.voiceover_dir:
        plan["voiceover"] = []
        if args.voiceover_dir:
            plan["voiceover"] = {"dir": str(Path(args.voiceover_dir).resolve()),
                                 "gap": args.gap, "lead_in": args.lead_in}
        else:
            for spec in args.voiceover:
                f, at, _ = parse_cue(spec)
                plan["voiceover"].append({"file": str(Path(f).resolve()), **({"at": at} if at is not None else {})})
    music = dict(plan.get("music") or {})
    if args.music:
        music["file"] = str(Path(args.music).resolve())
    for key, val in (("lufs", args.music_lufs), ("duck_db", args.duck_db), ("offset", args.music_offset),
                     ("fade_in", args.fade_in), ("fade_out", args.fade_out),
                     ("loop_crossfade", args.loop_crossfade)):
        if val is not None:
            music[key] = val
    if args.no_loop:
        music["loop"] = False
    plan["music"] = music or None
    if args.sfx:
        plan["sfx"] = list(plan.get("sfx") or [])
        for spec in args.sfx:
            f, at, gain = parse_cue(spec)
            if at is None:
                raise ValueError(f"--sfx '{spec}' needs a time: NAME@SECONDS")
            plan["sfx"].append({"file": f if f in SFX_SOUNDS else str(Path(f).resolve()),
                                "at": at, **({"gain_db": gain} if gain is not None else {})})
    if args.no_master:
        plan["master"] = False
    elif args.target_lufs is not None:
        plan["master"] = {"lufs": args.target_lufs, "true_peak": YOUTUBE_TRUE_PEAK}

    # Normalise into a resolved timeline
    tl: dict = {"video": None, "voice_from_video": False, "voiceover": [], "sfx": [], "music": None}
    if plan.get("video"):
        v = path_of(plan["video"])
        info = probe(v)
        if not info["video"] and not info["audio"]:
            raise FileNotFoundError(f"video not found or unreadable: {v}")
        tl["video"] = {"path": v, **info}
        tl["voice_from_video"] = info["audio"] and not args.ignore_video_audio

    vo = plan.get("voiceover") or []
    if isinstance(vo, dict):  # {"dir": ..., "gap": ..., "lead_in": ...}
        d = path_of(vo["dir"])
        files = sorted([*d.glob("*.mp3"), *d.glob("*.wav")])
        if not files:
            raise FileNotFoundError(f"no .mp3/.wav voiceover files in {d}")
        vo = [{"file": str(f)} for f in files]
        gap, cursor = float(plan["voiceover"].get("gap", 0.6)), float(plan["voiceover"].get("lead_in", 0.5))
    else:
        gap, cursor = args.gap, args.lead_in
    for item in vo:
        f = path_of(item["file"])
        info = probe(f)
        if not info["duration"]:
            raise FileNotFoundError(f"voiceover file not found or unreadable: {f}")
        at = float(item["at"]) if item.get("at") is not None else cursor
        tl["voiceover"].append({"path": f, "at": at, "duration": info["duration"]})
        cursor = at + info["duration"] + gap

    for item in plan.get("sfx") or []:
        p, default_gain = resolve_sfx(item["file"], base)
        tl["sfx"].append({"path": p, "name": item["file"], "at": float(item["at"]),
                          "gain_db": float(item.get("gain_db", default_gain)),
                          "duration": probe(p)["duration"] or 0.0})

    has_voice = tl["voice_from_video"] or bool(tl["voiceover"])
    if plan.get("music") and plan["music"].get("file"):
        m = plan["music"]
        f = path_of(m["file"])
        info = probe(f)
        if not info["duration"]:
            raise FileNotFoundError(f"music file not found or unreadable: {f}")
        tl["music"] = {
            "path": f, "duration": info["duration"],
            "lufs": float(m.get("lufs", -24.0 if has_voice else -16.0)),
            "duck_db": float(m.get("duck_db", 9.0)) if has_voice else 0.0,
            "offset": float(m.get("offset", 0.0)),
            "fade_in": float(m.get("fade_in", 1.0)),
            "fade_out": float(m.get("fade_out", 2.5)),
            "loop": bool(m.get("loop", True)),
            "loop_crossfade": float(m.get("loop_crossfade", 1.5)),
        }

    if plan.get("duration"):
        duration = float(plan["duration"])
    elif tl["video"] and tl["video"]["duration"]:
        duration = tl["video"]["duration"]
    else:
        ends = [c["at"] + c["duration"] for c in tl["voiceover"] + tl["sfx"]]
        if not ends:
            raise ValueError("can't infer the duration: pass --duration, --video, voiceover or sfx")
        duration = max(ends) + args.tail
    tl["duration"] = round(duration, 3)

    master = plan.get("master", {"lufs": YOUTUBE_LUFS, "true_peak": YOUTUBE_TRUE_PEAK})
    tl["master"] = master if master is not False else None
    return tl, base


# ─── mixing ─────────────────────────────────────────────────

def render_voice_bus(tl: dict, tmp: Path, vo_lufs: float) -> Path | None:
    """Voice-only stem on the full timeline (video audio or placed VO files)."""
    D = tl["duration"]
    out = tmp / "voice.wav"
    if tl["voice_from_video"]:
        r = run(["ffmpeg", "-y", "-v", "error", "-i", str(tl["video"]["path"]), "-vn",
                 "-af", f"aresample={SR},apad,atrim=0:{D}", "-ac", "2", str(out)])
    elif tl["voiceover"]:
        inputs, chains = [], []
        for i, c in enumerate(tl["voiceover"]):
            inputs += ["-i", str(c["path"])]
            g = gain_to_lufs(c["path"], vo_lufs) if c["duration"] >= 3 else 0.0
            ms = int(round(c["at"] * 1000))
            chains.append(f"[{i}:a]aresample={SR},aformat=channel_layouts=stereo,"
                          f"volume={g}dB,adelay={ms}|{ms}[v{i}]")
        n = len(tl["voiceover"])
        graph = ";".join(chains) + ";" + "".join(f"[v{i}]" for i in range(n)) + \
            f"amix=inputs={n}:normalize=0:duration=longest,apad,atrim=0:{D}[out]"
        r = run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", graph, "-map", "[out]", str(out)])
    else:
        return None
    if r.returncode != 0:
        raise RuntimeError(f"voice bus failed: {r.stderr.strip()[-500:]}")
    return out


def render_music(tl: dict, tmp: Path, intervals: list[tuple[float, float]]) -> tuple[Path, dict]:
    m, D = tl["music"], tl["duration"]
    usable = m["duration"] - m["offset"]
    if usable <= 0.5:
        raise ValueError(f"music offset {m['offset']}s is past the end of the track ({m['duration']:.1f}s)")
    xf = min(m["loop_crossfade"], usable / 3) if m["loop"] else 0.0
    copies = 1
    if m["loop"] and usable < D:
        copies = 1 + int((D - usable) // (usable - xf)) + 1
    gain = gain_to_lufs(m["path"], m["lufs"])

    pre = f"[0:a]aresample={SR},aformat=channel_layouts=stereo,atrim=start={m['offset']},asetpts=PTS-STARTPTS"
    if copies == 1:
        graph = pre + "[loop];"
    else:
        graph = pre + f",asplit={copies}" + "".join(f"[c{i}]" for i in range(copies)) + ";"
        prev = "c0"
        for i in range(1, copies):
            label = "loop" if i == copies - 1 else f"x{i}"
            graph += f"[{prev}][c{i}]acrossfade=d={xf}:c1=tri:c2=tri[{label}];"
            prev = label
    fade_out_start = max(0.0, D - m["fade_out"])
    graph += (
        f"[loop]apad,atrim=0:{D},volume={gain}dB,"
        f"volume='{duck_expr(intervals, m['duck_db'])}':eval=frame,"
        f"afade=t=in:d={m['fade_in']},afade=t=out:st={fade_out_start}:d={m['fade_out']}[out]"
    )
    script = tmp / "music_graph.txt"
    script.write_text(graph, encoding="utf-8")
    out = tmp / "music.wav"
    r = run(["ffmpeg", "-y", "-v", "error", "-i", str(m["path"]),
             "-filter_complex_script", str(script), "-map", "[out]", str(out)])
    if r.returncode != 0:
        raise RuntimeError(f"music bed failed: {r.stderr.strip()[-500:]}")
    return out, {"gain_db": gain, "copies": copies, "crossfade": xf if copies > 1 else 0,
                 "looped": copies > 1, "trimmed": usable > D}


def mix(tl: dict, output: Path, vo_lufs: float) -> dict:
    D = tl["duration"]
    with tempfile.TemporaryDirectory(prefix="mix_") as t:
        tmp = Path(t)
        voice = render_voice_bus(tl, tmp, vo_lufs)
        intervals = speech_intervals(voice, D) if voice else []
        stems, report = [], {"duration_seconds": D, "speech_intervals": len(intervals)}
        if voice:
            stems.append((voice, 0.0, 0.0))
        if tl["music"]:
            music, info = render_music(tl, tmp, intervals)
            stems.append((music, 0.0, 0.0))
            report["music"] = {**info, "file": str(tl["music"]["path"]),
                               "bed_lufs": tl["music"]["lufs"], "duck_db": tl["music"]["duck_db"]}
        for c in tl["sfx"]:
            stems.append((c["path"], c["at"], c["gain_db"]))
        if not stems:
            raise ValueError("nothing to mix: no voice, music or sfx")

        inputs, chains = [], []
        for i, (p, at, g) in enumerate(stems):
            inputs += ["-i", str(p)]
            ms = int(round(at * 1000))
            chains.append(f"[{i}:a]aresample={SR},aformat=channel_layouts=stereo,volume={g}dB,"
                          f"adelay={ms}|{ms}[s{i}]")
        n = len(stems)
        graph = ";".join(chains) + ";" + "".join(f"[s{i}]" for i in range(n)) + \
            f"amix=inputs={n}:normalize=0:duration=longest,apad,atrim=0:{D}[out]"
        script = tmp / "mix_graph.txt"
        script.write_text(graph, encoding="utf-8")
        premaster = tmp / "premaster.wav"
        r = run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex_script", str(script),
                 "-map", "[out]", "-c:a", "pcm_s24le", str(premaster)])
        if r.returncode != 0:
            raise RuntimeError(f"mix failed: {r.stderr.strip()[-500:]}")

        mixed = premaster
        if tl["master"]:
            measured = measure_loudness(premaster)
            if measured and measured.get("lufs") is not None:
                mixed = tmp / "master.wav"
                err = normalize_loudness(premaster, mixed, tl["master"]["lufs"],
                                         tl["master"]["true_peak"], measured)
                if err:
                    raise RuntimeError(f"mastering failed: {err}")
                report["premaster_lufs"] = measured["lufs"]

        output.parent.mkdir(parents=True, exist_ok=True)
        if output.suffix.lower() in VIDEO_EXTS:
            if not tl["video"] or not tl["video"]["video"]:
                raise ValueError("a video --output needs a --video input to take the picture from")
            cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(tl["video"]["path"]), "-i", str(mixed),
                   "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                   "-t", str(D), "-movflags", "+faststart", str(output)]
        else:
            codec = {".mp3": ["-c:a", "libmp3lame", "-b:a", "192k"],
                     ".m4a": ["-c:a", "aac", "-b:a", "192k"]}.get(output.suffix.lower(), ["-c:a", "pcm_s16le"])
            cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(mixed), "-ar", str(SR), *codec, str(output)]
        r = run(cmd)
        if r.returncode != 0:
            raise RuntimeError(f"writing output failed: {r.stderr.strip()[-500:]}")

    final = measure_loudness(output)
    report.update({"success": True, "output": str(output),
                   "lufs": final and final.get("lufs"), "true_peak": final and final.get("true_peak")})
    return report


def describe(tl: dict) -> dict:
    return {
        "duration_seconds": tl["duration"],
        "video": str(tl["video"]["path"]) if tl["video"] else None,
        "voice_from_video": tl["voice_from_video"],
        "voiceover": [{"file": str(c["path"]), "at": c["at"], "duration": round(c["duration"], 2)} for c in tl["voiceover"]],
        "music": {k: (str(v) if isinstance(v, Path) else v) for k, v in tl["music"].items()} if tl["music"] else None,
        "sfx": [{"name": c["name"], "at": c["at"], "gain_db": c["gain_db"]} for c in tl["sfx"]],
        "master": tl["master"],
    }


def main() -> int:
    ensure_utf8_output()
    ap = argparse.ArgumentParser(description="Mix voiceover + royalty-free music + SFX, locally with ffmpeg.",
                                 formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog=__doc__.split("Usage:", 1)[1])
    ap.add_argument("--plan", help="Plan JSON (see --help-plan)")
    ap.add_argument("--help-plan", action="store_true", help="Show the plan file format and exit")
    ap.add_argument("--output", "-o", help="Output: .wav/.mp3/.m4a, or .mp4/.mov (needs --video)")
    ap.add_argument("--video", help="Rendered video; its audio is the voice bus unless --ignore-video-audio")
    ap.add_argument("--ignore-video-audio", action="store_true", help="Discard the video's own audio")
    ap.add_argument("--duration", type=float, help="Mix length in seconds (default: video length / last cue + tail)")
    ap.add_argument("--tail", type=float, default=1.5, help="Seconds after the last cue when inferring duration (default 1.5)")
    ap.add_argument("--voiceover", action="append", metavar="FILE[@SEC]", help="Voiceover file, optionally at a time (repeatable)")
    ap.add_argument("--voiceover-dir", help="Place every .mp3/.wav in this folder one after another (sorted)")
    ap.add_argument("--gap", type=float, default=0.6, help="Silence between sequential voiceover files (default 0.6)")
    ap.add_argument("--lead-in", type=float, default=0.5, help="Start time of the first sequential voiceover (default 0.5)")
    ap.add_argument("--vo-lufs", type=float, default=-16.0, help="Normalise placed voiceover files to this (default -16)")
    ap.add_argument("--music", help="Royalty-free music file (mp3/wav/m4a/ogg/flac)")
    ap.add_argument("--music-lufs", type=float, help="Music bed loudness (default -24 with voice, -16 without)")
    ap.add_argument("--duck-db", type=float, help="How far the music drops under speech (default 9; 0 = off)")
    ap.add_argument("--music-offset", type=float, help="Start this many seconds into the track")
    ap.add_argument("--fade-in", type=float, help="Music fade-in seconds (default 1.0)")
    ap.add_argument("--fade-out", type=float, help="Music fade-out seconds (default 2.5)")
    ap.add_argument("--loop-crossfade", type=float, help="Crossfade at each loop seam (default 1.5)")
    ap.add_argument("--no-loop", action="store_true", help="Play the track once, then silence")
    ap.add_argument("--sfx", action="append", metavar="NAME|FILE@SEC[:DB]", help="Sound effect cue (repeatable)")
    ap.add_argument("--target-lufs", type=float, help=f"Master loudness (default {YOUTUBE_LUFS})")
    ap.add_argument("--no-master", action="store_true", help="Skip the final loudness normalisation")
    ap.add_argument("--dry-run", action="store_true", help="Print the resolved timeline and exit")
    ap.add_argument("--json", action="store_true", help="JSON output")
    args = ap.parse_args()

    if args.help_plan:
        print(PLAN_HELP)
        return 0
    if not shutil.which("ffmpeg"):
        print("Error: ffmpeg not found on PATH", file=sys.stderr)
        return 1
    try:
        tl, _ = build_plan(args)
    except (ValueError, FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    if args.dry_run:
        print(json.dumps(describe(tl), indent=2, ensure_ascii=False))
        return 0
    if not args.output:
        print("Error: --output is required", file=sys.stderr)
        return 1
    try:
        report = mix(tl, Path(args.output), args.vo_lufs)
    except (ValueError, RuntimeError, FileNotFoundError) as e:
        report = {"success": False, "error": str(e)}

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    elif report.get("success"):
        mus = report.get("music")
        note = ""
        if mus:
            note = f", music {'looped x' + str(mus['copies']) if mus['looped'] else 'trimmed' if mus['trimmed'] else 'as is'}"
        print(f"Mixed {report['duration_seconds']}s -> {report['output']} "
              f"({report.get('lufs')} LUFS, TP {report.get('true_peak')}{note}, "
              f"{report['speech_intervals']} speech spans ducked)", file=sys.stderr)
    else:
        print(f"Error: {report['error']}", file=sys.stderr)
    return 0 if report.get("success") else 1


if __name__ == "__main__":
    sys.exit(main())
