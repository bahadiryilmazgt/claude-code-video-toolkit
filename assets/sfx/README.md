# Motion-graphics SFX pack

Free, local sound effects synthesised with ffmpeg by `tools/sfx_pack.py`. There are no samples
and no third-party licence: the sounds are generated from fixed noise seeds, so they're identical
on every machine. Regenerate them with `uv run tools/sfx_pack.py`.

| File | Length | Suggested gain | Use for |
|------|--------|----------------|---------|
| `whoosh-soft.wav` | 1.0s | -10 dB | scene change, card sliding in, gentle camera move |
| `whoosh-fast.wav` | 0.45s | -9 dB | quick cut, text snapping in, fast slide/swipe |
| `pop-subtle.wav` | 0.14s | -12 dB | icon, bullet, chart bar or badge appearing |
| `click.wav` | 0.05s | -12 dB | button press, cursor click, toggle |
| `tick.wav` | 0.06s | -14 dB | counter ticking up, list item, timer, metric step |
| `impact-soft.wav` | 1.4s | -8 dB | title or key number landing, logo settle |
| `impact-strong.wav` | 2.2s | -6 dB | big reveal, headline stat, logo slam, final CTA hit |
| `riser.wav` | 3.0s | -12 dB | build-up into a reveal (start it 3s before the hit) |
| `transition-sweep.wav` | 1.3s | -11 dB | section transition, wipe, chart-to-chart change |

All files are 48 kHz stereo, peak-normalised to -3 dBFS. The suggested gains are for a mix with
voiceover. `tools/mix_audio.py` applies them automatically when you cue a sound by name:

```bash
uv run tools/mix_audio.py --video out/video.mp4 --music track.mp3 \
    --sfx whoosh-soft@0.4 --sfx riser@9.0 --sfx impact-strong@12.0 --sfx tick@14.1:-16 \
    --output out/video-final.mp4
```

Tips:
- Place a whoosh 2-4 frames *before* the motion it accompanies, so the sound leads the eye.
- A metric counting up sounds better with a few ticks (every 3-5 frames) than with one per frame.
- Use one or two impacts per video. More than that and nothing feels important.
