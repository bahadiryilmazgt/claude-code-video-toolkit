# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = [
#     "chatterbox-tts==0.1.7",
#     "setuptools<81",
# ]
# ///
"""Chatterbox Multilingual worker: runs in its own uv-managed environment.

Chatterbox pins torch==2.6 / transformers==5.2, which conflict with the
toolkit's main environment (openai-whisper pulls a newer torch), so this file
carries its own PEP 723 dependency block and is launched as

    uv run --script tools/chatterbox_worker.py < job.json

by tools/chatterbox_tts.py. Don't call it directly; use chatterbox_tts.py or
`voiceover.py --provider chatterbox`. The pinned versions are locked in
chatterbox_worker.py.lock (`uv lock --script tools/chatterbox_worker.py`).

Job (JSON on stdin):
    {
      "items": [{"text": "...", "output": "/abs/path.wav"}, ...],
      "language": "tr",
      "ref_audio": "/abs/ref.wav" | null,
      "exaggeration": 0.5, "cfg_weight": 0.5, "temperature": 0.8,
      "seed": 0 | null, "device": "auto" | "cpu" | "cuda" | "mps",
      "pause_ms": 250
    }

Writes one WAV per item and prints one JSON line per item on stdout:
    {"index": 0, "success": true, "output": "...", "chunks": 2}
Progress goes to stderr.
"""
from __future__ import annotations

import json
import re
import sys
import time

MAX_CHUNK_CHARS = 250
PAUSE_RE = re.compile(r"\[pause\s+([0-9.]+)\s*s?\]", re.IGNORECASE)


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def pick_device(requested: str) -> str:
    import torch

    if requested != "auto":
        return requested
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def split_sentences(text: str, limit: int = MAX_CHUNK_CHARS) -> list[str]:
    """Group sentences into chunks of at most `limit` chars.

    Chatterbox degrades (rushes, repeats, truncates) on long inputs, so long
    narration is generated a few sentences at a time and joined.
    """
    text = " ".join(text.split())
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?…])\s+", text)
    units: list[str] = []
    for s in sentences:
        while len(s) > limit:  # an over-long sentence: break at a comma, else a space
            cut = max(s.rfind(", ", 0, limit), s.rfind("; ", 0, limit))
            cut = cut + 1 if cut > 0 else s.rfind(" ", 0, limit)
            if cut <= 0:
                cut = limit
            units.append(s[:cut].strip())
            s = s[cut:].strip()
        if s:
            units.append(s)
    chunks: list[str] = []
    for u in units:
        if chunks and len(chunks[-1]) + 1 + len(u) <= limit:
            chunks[-1] += " " + u
        else:
            chunks.append(u)
    return chunks


def segments(text: str) -> list[tuple[str, float]]:
    """Split text on [pause N s] markers into (speech chunk | "", silence seconds)."""
    out: list[tuple[str, float]] = []
    pos = 0
    for m in PAUSE_RE.finditer(text):
        for c in split_sentences(text[pos:m.start()]):
            out.append((c, 0.0))
        out.append(("", float(m.group(1))))
        pos = m.end()
    for c in split_sentences(text[pos:]):
        out.append((c, 0.0))
    return out


def trim_silence(wav, sr: int, floor_db: float = -42.0, keep_start: float = 0.05, keep_end: float = 0.12):
    """Cut the silence Chatterbox leaves around each chunk (often ~1s at the end),
    so sentence gaps and [pause] markers come out at exactly the length asked for."""
    import torch

    env = wav.abs().max(dim=0).values
    peak = float(env.max())
    if peak <= 0:
        return wav
    loud = torch.nonzero(env > peak * 10 ** (floor_db / 20)).flatten()
    if loud.numel() == 0:
        return wav
    start = max(0, int(loud[0]) - int(keep_start * sr))
    end = min(wav.shape[-1], int(loud[-1]) + int(keep_end * sr))
    return wav[:, start:end]


def main() -> int:
    job = json.load(sys.stdin)

    import torch
    import torchaudio as ta
    from chatterbox.mtl_tts import SUPPORTED_LANGUAGES, ChatterboxMultilingualTTS

    language = job.get("language", "tr")
    if language not in SUPPORTED_LANGUAGES:
        print(json.dumps({"fatal": f"unsupported language '{language}'",
                          "supported": sorted(SUPPORTED_LANGUAGES)}), flush=True)
        return 2

    device = pick_device(job.get("device", "auto"))
    t0 = time.time()
    log(f"Loading Chatterbox Multilingual on {device} (first run downloads ~3 GB of weights)...")
    if device != "cuda":
        # The checkpoints were saved on CUDA; map them onto CPU/MPS while loading.
        _orig_load = torch.load
        torch.load = lambda *a, **k: _orig_load(*a, **{**k, "map_location": torch.device(device)})
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    log(f"Model ready in {time.time() - t0:.0f}s")

    ref = job.get("ref_audio")
    if ref:
        model.prepare_conditionals(ref, exaggeration=job.get("exaggeration", 0.5))

    gen_kwargs = {
        "language_id": language,
        "exaggeration": job.get("exaggeration", 0.5),
        "cfg_weight": job.get("cfg_weight", 0.5),
        "temperature": job.get("temperature", 0.8),
    }
    pause_ms = job.get("pause_ms", 250)
    seed = job.get("seed")

    for i, item in enumerate(job["items"]):
        try:
            if seed is not None:
                torch.manual_seed(seed + i)
            pieces = []
            segs = segments(item["text"])
            n_speech = sum(1 for t, _ in segs if t)
            done = 0
            after_pause = False
            for text, silence in segs:
                if not text:  # an explicit [pause] replaces the usual sentence gap
                    pieces.append(torch.zeros(1, int(model.sr * silence)))
                    after_pause = True
                    continue
                done += 1
                t1 = time.time()
                wav = trim_silence(model.generate(text, **gen_kwargs).cpu(), model.sr)
                log(f"  [{i + 1}/{len(job['items'])}] chunk {done}/{n_speech}: "
                    f"{wav.shape[-1] / model.sr:.1f}s audio in {time.time() - t1:.0f}s")
                if pieces and pause_ms and not after_pause:
                    pieces.append(torch.zeros(1, int(model.sr * pause_ms / 1000)))
                pieces.append(wav)
                after_pause = False
            if not n_speech:
                raise ValueError("no speakable text")
            ta.save(item["output"], torch.cat(pieces, dim=-1), model.sr)
            print(json.dumps({"index": i, "success": True, "output": item["output"],
                              "chunks": n_speech}), flush=True)
        except Exception as e:  # report per item, keep going
            print(json.dumps({"index": i, "success": False, "output": item.get("output"),
                              "error": f"{type(e).__name__}: {e}"}), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
