#!/usr/bin/env python3
"""
Free, local multilingual TTS with Chatterbox Multilingual (Resemble AI, MIT).

Runs on your own machine (CPU, CUDA or Apple MPS): no API key, no account, no
cloud GPU. 23 languages including Turkish, zero-shot voice cloning from a short
reference clip. The counterpart of qwen3_tts.py / sixtydb_tts.py; voiceover.py
uses it via `--provider chatterbox`.

Chatterbox pins torch 2.6 / transformers 5.2, which clash with the toolkit's
main environment, so the model runs in tools/chatterbox_worker.py, a PEP 723
script that uv builds into its own cached, locked environment the first time.
This file only orchestrates it, so it needs nothing beyond the main `uv sync`.

Speed: on a 4-core CPU expect ~10x slower than real time (a 5s line takes
~1 min) plus ~1.5 min to load the model per call, so voiceover.py batches every
scene into one call. A CUDA GPU is roughly real time.

Usage:
    # One-time: build the environment and download the weights (~3 GB)
    uv run tools/chatterbox_tts.py --setup

    # Turkish line with the built-in voice
    uv run tools/chatterbox_tts.py --text "Merhaba dünya" --output hello.mp3

    # Clone a voice from a 10-20s clean reference clip in the same language
    uv run tools/chatterbox_tts.py --script line.txt --ref-audio voice_tr.wav --output line.mp3

    # More expressive / calmer delivery
    uv run tools/chatterbox_tts.py --text "..." --exaggeration 0.7 --cfg-weight 0.3 --output x.mp3

    # Per-scene, through voiceover.py (one model load for all scenes)
    uv run tools/voiceover.py --provider chatterbox --language tr --scene-dir public/audio/scenes --json

    uv run tools/chatterbox_tts.py --list-languages

Script tips: write numbers, units and abbreviations as words ("yüzde kırk",
"üç bin iki yüz"), since TTS reads digits unreliably. Use `[pause 0.8s]` for a
deliberate pause. Every output carries Resemble's imperceptible Perth
watermark, which the model applies itself.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from win_encoding import ensure_utf8_output

WORKER = Path(__file__).resolve().parent / "chatterbox_worker.py"

# Mirrors chatterbox.mtl_tts.SUPPORTED_LANGUAGES (0.1.7); the worker re-checks.
SUPPORTED_LANGUAGES = {
    "ar": "Arabic", "da": "Danish", "de": "German", "el": "Greek", "en": "English",
    "es": "Spanish", "fi": "Finnish", "fr": "French", "he": "Hebrew", "hi": "Hindi",
    "it": "Italian", "ja": "Japanese", "ko": "Korean", "ms": "Malay", "nl": "Dutch",
    "no": "Norwegian", "pl": "Polish", "pt": "Portuguese", "ru": "Russian",
    "sv": "Swedish", "sw": "Swahili", "tr": "Turkish", "zh": "Chinese",
}
_NAME_TO_CODE = {v.lower(): k for k, v in SUPPORTED_LANGUAGES.items()}

DEFAULTS = {"exaggeration": 0.5, "cfg_weight": 0.5, "temperature": 0.8}
VO_LUFS = -16.0  # same scene-VO target qc.py uses: headroom for music + sfx


def resolve_language(language: str | None) -> str:
    """'tr', 'TR', 'Turkish' -> 'tr'. Raises ValueError for anything unsupported."""
    lang = (language or "tr").strip().lower()
    if lang in SUPPORTED_LANGUAGES:
        return lang
    if lang in _NAME_TO_CODE:
        return _NAME_TO_CODE[lang]
    raise ValueError(
        f"Chatterbox doesn't support language '{language}'. "
        f"Use one of: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
    )


def _duration(path: str) -> float | None:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=30,
        )
        return float(r.stdout.strip())
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None


def _finish(wav: Path, output: Path, normalize: bool) -> str | None:
    """Encode the worker's WAV to the requested format, loudness-normalised. Returns an error or None."""
    from qc import MIN_LOUDNESS_SECONDS, measure_loudness, normalize_loudness

    output.parent.mkdir(parents=True, exist_ok=True)
    if normalize and (_duration(str(wav)) or 0) >= MIN_LOUDNESS_SECONDS:
        measured = measure_loudness(wav)
        if measured and measured.get("lufs") is not None:
            return normalize_loudness(wav, output, VO_LUFS, -1.0, measured)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-ar", "48000"]
    if output.suffix.lower() == ".mp3":
        cmd += ["-b:a", "192k"]
    r = subprocess.run(cmd + [str(output)], capture_output=True, text=True)
    return r.stderr.strip()[-300:] if r.returncode != 0 else None


def run_worker(job: dict, verbose: bool = True, timeout: int | None = None) -> tuple[list[dict], str | None]:
    """Run chatterbox_worker.py in its own uv environment. Returns (per-item results, fatal error)."""
    uv = shutil.which("uv")
    if not uv:
        return [], "uv not found on PATH (install: https://docs.astral.sh/uv/)"
    proc = subprocess.Popen(
        [uv, "run", "--quiet", "--script", str(WORKER)],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=None if verbose else subprocess.DEVNULL,
    )
    try:
        out, _ = proc.communicate(json.dumps(job, ensure_ascii=False).encode("utf-8"), timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        return [], f"Chatterbox timed out after {timeout}s"
    results, fatal = [], None
    for line in out.decode("utf-8", "replace").splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        msg = json.loads(line)
        if "fatal" in msg:
            fatal = msg["fatal"]
        else:
            results.append(msg)
    if proc.returncode != 0 and not fatal:
        fatal = f"Chatterbox worker exited with code {proc.returncode}"
    return results, fatal


def generate_audio(
    text: str | list[str],
    output_path: str | list[str],
    language: str = "tr",
    ref_audio: str | None = None,
    exaggeration: float = DEFAULTS["exaggeration"],
    cfg_weight: float = DEFAULTS["cfg_weight"],
    temperature: float = DEFAULTS["temperature"],
    seed: int | None = 0,
    device: str = "auto",
    pause_ms: int = 250,
    normalize: bool = True,
    max_wpm: float | None = None,
    verbose: bool = True,
    timeout: int | None = None,
) -> dict:
    """Generate speech locally with Chatterbox Multilingual.

    A single text returns {success, output, duration_seconds, duration_frames_30fps,
    wpm, pacing, ...}. A list of texts (one model load for all) returns
    {success, outputs: [per-item result, ...]} in input order.
    """
    from pacing import clamp_pace, pace_label

    batch = isinstance(text, list)
    texts = text if batch else [text]
    outputs = [Path(p) for p in (output_path if batch else [output_path])]
    if len(texts) != len(outputs):
        return {"success": False, "error": "text and output_path lists differ in length"}
    try:
        lang = resolve_language(language)
    except ValueError as e:
        return {"success": False, "error": str(e)}
    if ref_audio and not Path(ref_audio).is_file():
        return {"success": False, "error": f"reference audio not found: {ref_audio}"}

    with tempfile.TemporaryDirectory(prefix="chatterbox_") as tmp:
        wavs = [Path(tmp) / f"item_{i:03d}.wav" for i in range(len(texts))]
        job = {
            "items": [{"text": t, "output": str(w)} for t, w in zip(texts, wavs)],
            "language": lang,
            "ref_audio": str(Path(ref_audio).resolve()) if ref_audio else None,
            "exaggeration": exaggeration,
            "cfg_weight": cfg_weight,
            "temperature": temperature,
            "seed": seed,
            "device": device,
            "pause_ms": pause_ms,
        }
        raw, fatal = run_worker(job, verbose=verbose, timeout=timeout)
        if fatal and not raw:
            return {"success": False, "error": fatal}

        by_index = {r["index"]: r for r in raw}
        items = []
        for i, (t, wav, out) in enumerate(zip(texts, wavs, outputs)):
            r = by_index.get(i)
            if not r or not r.get("success") or not wav.exists():
                items.append({"success": False, "output": str(out),
                              "error": (r or {}).get("error") or fatal or "no audio produced"})
                continue
            err = _finish(wav, out, normalize)
            if err:
                items.append({"success": False, "output": str(out), "error": err})
                continue
            item = {"success": True, "output": str(out), "script_chars": len(t),
                    "chunks": r.get("chunks"), "language": lang}
            dur = _duration(str(out))
            if max_wpm:
                clamp = clamp_pace(str(out), t, max_wpm, verbose=False)
                if clamp.get("applied"):
                    dur = clamp["duration_seconds"]
                    item["pace_adjusted"] = {k: clamp[k] for k in ("original_wpm", "atempo", "floored") if k in clamp}
            if dur:
                item["duration_seconds"] = round(dur, 2)
                item["duration_frames_30fps"] = int(dur * 30)
            item["wpm"], item["pacing"] = pace_label(t, dur)
            items.append(item)

    if batch:
        return {"success": all(it["success"] for it in items), "outputs": items}
    return items[0]


def main() -> int:
    ensure_utf8_output()
    ap = argparse.ArgumentParser(
        description="Free, local multilingual TTS (Chatterbox Multilingual) — Turkish by default.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage:", 1)[1],
    )
    ap.add_argument("--text", "-t", help="Text to speak")
    ap.add_argument("--script", "-s", help="UTF-8 text file to speak (instead of --text)")
    ap.add_argument("--output", "-o", help="Output file (.mp3 or .wav)")
    ap.add_argument("--language", "-l", default="tr", help="Language code or name (default: tr)")
    ap.add_argument("--ref-audio", help="Reference clip to clone (10-20s, clean, same language as --language)")
    ap.add_argument("--exaggeration", type=float, default=DEFAULTS["exaggeration"],
                    help="Emotion intensity 0.25-2 (default 0.5; 0.6-0.8 = livelier ad read)")
    ap.add_argument("--cfg-weight", type=float, default=DEFAULTS["cfg_weight"],
                    help="Pace/adherence 0-1 (default 0.5; ~0.3 = slower, more deliberate)")
    ap.add_argument("--temperature", type=float, default=DEFAULTS["temperature"],
                    help="Sampling temperature (default 0.8; lower = more consistent)")
    ap.add_argument("--seed", type=int, default=0, help="Random seed for repeatable takes (default 0; -1 = random)")
    ap.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda", "mps"])
    ap.add_argument("--pause-ms", type=int, default=250, help="Silence between sentence chunks (default 250)")
    ap.add_argument("--no-normalize", action="store_true", help=f"Skip loudness normalisation to {VO_LUFS} LUFS")
    ap.add_argument("--max-wpm", type=float, help="Pitch-preserving pace clamp (see voiceover.py)")
    ap.add_argument("--setup", action="store_true", help="Build the Chatterbox environment and download weights, then exit")
    ap.add_argument("--list-languages", action="store_true")
    ap.add_argument("--json", action="store_true", help="JSON output")
    args = ap.parse_args()

    if args.list_languages:
        for code, name in sorted(SUPPORTED_LANGUAGES.items()):
            print(f"  {code}  {name}")
        return 0

    if args.setup:
        print("Building Chatterbox environment and downloading weights (one-time, ~3 GB)...", file=sys.stderr)
        _, fatal = run_worker({"items": [], "language": resolve_language(args.language), "device": args.device})
        if fatal:
            print(f"Error: {fatal}", file=sys.stderr)
            return 1
        print("Chatterbox is ready.", file=sys.stderr)
        return 0

    if args.script:
        text = Path(args.script).read_text(encoding="utf-8").strip()
    else:
        text = (args.text or "").strip()
    if not text or not args.output:
        ap.error("--text/--script and --output are required")

    result = generate_audio(
        text=text, output_path=args.output, language=args.language, ref_audio=args.ref_audio,
        exaggeration=args.exaggeration, cfg_weight=args.cfg_weight, temperature=args.temperature,
        seed=None if args.seed == -1 else args.seed, device=args.device, pause_ms=args.pause_ms,
        normalize=not args.no_normalize, max_wpm=args.max_wpm, verbose=not args.json,
    )
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif result.get("success"):
        print(f"Saved {result['output']} ({result.get('duration_seconds')}s, {result.get('wpm')} wpm)", file=sys.stderr)
    else:
        print(f"Error: {result.get('error')}", file=sys.stderr)
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    sys.exit(main())
