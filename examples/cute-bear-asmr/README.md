# Cute Bear ASMR (9:16, 30 s)

A 30-second vertical food-tasting ASMR short for kids: an original plush bear ("Honey")
waddles up to a tea-party table and tastes a crunchy star cookie, a sour lemon slice,
a squishy pink marshmallow and a juicy strawberry, then holds its cheeks and waves.
No speech, no on-screen text, no logo.

Everything is generated locally with free, open-source tools. No paid APIs, no cloud
GPU and no stock assets:

| Part | How |
|------|-----|
| 3D animation | three.js scene rendered frame by frame inside Remotion (software WebGL) |
| Fur | shell-texture fur: 12-22 offset shells per body part, strand mask from rest-pose coordinates |
| Character | procedural rig: big glossy eyes with drawn ^ ^ / > < closed-eye shapes, brows, puffable cheeks, chewing jaw, ears with lag, IK tube arms, paw beans |
| Food | star cookie with icing and sprinkles (real bite cut-outs), lemon slice, deformable marshmallow (squish, tear), strawberry (clip-plane bite + cross-section) |
| Camera | 11 shots: crane-down establishing shot, close-ups at every bite, texture close-up on the marshmallow, comedic push-in |
| Look | soft shadows, studio env reflections, bokeh depth of field, bloom, pastel grade |
| Sound | 100% synthesized in Python (`audio/synth.py`): granular crunches, bubble-model juicy bites, stick-slip marshmallow squeaks, paw foley, a tiny formant voice for "hmm", "mmm", "ooh", "iiih" and giggles, and a very quiet music-box bed |

## Sync

`timeline.py` writes `src/timeline.json`, the only source of timing. It holds the beat
marks the animation reads and every sound event the synth reads, all snapped to frame
boundaries. A crunch therefore starts on the exact frame (33 ms resolution at 30 fps) the
cookie loses its tip.

## Build

```bash
python3 timeline.py                                                    # timing source of truth
uv run --no-project --with numpy --with scipy python audio/synth.py    # -> public/asmr_mix.wav
npm install
npm run studio                                                         # preview
npx remotion render BearASMR out/bear-asmr.mp4 --concurrency=2 --timeout=300000 --crf=16 --audio-bitrate=256k
```

`BearASMRDraft` is a 540x960 composition for quick motion checks. `stills.mjs <frames...>`
renders key frames with one browser.

Rendering uses SwiftShader (no GPU needed): about 3 s per 1080x1920 frame, so roughly
an hour for the full film on 4 CPU cores.

## Honest limitations

- The look is stylized real-time 3D (three.js), not an offline path-traced film render.
  The fur is shell-based, not simulated strands.
- The bear's vocal reactions come from a small formant synthesizer, not a voice actor,
  so they sound like a cute cartoon creature rather than a recorded performance.
- The ASMR sounds are physically inspired synthesis, not field recordings.
