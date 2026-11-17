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
uv run --no-project --with numpy --with scipy python audio/synth.py    # -> public/asmr_mix.wav (-15 LUFS, -1.5 dBTP)
npm install
npm run studio                                                         # interactive preview in Remotion Studio
```

Final render (1080x1920, 30 fps, H.264 + AAC):

```bash
npx esbuild harness/entry.ts --bundle --format=iife --outfile=harness/bundle.js
node harness/render.mjs 0 900 2      # frames -> out/frames/*.jpg (resumable: existing frames are skipped)
./harness/encode.sh                  # -> out/cute-bear-asmr.mp4
```

The harness drives the same `Engine` as the Remotion composition. It reads each frame
straight off the WebGL canvas instead of taking a page screenshot. With no GPU (software
SwiftShader), that is about 5 s per frame on 4 CPU cores, so roughly 80 minutes for the
whole film. `npx remotion render BearASMR` works too but is slower here. `BearASMRDraft` is
a 540x960 composition for motion checks, and `stills.mjs <frames...>` renders key frames.

Fur shells use Lambert lighting plus an analytic ambient fill and a golden tip sheen. On a
software renderer this looks almost identical to PBR shells at about 2.3x the speed. Set
`globalThis.FUR_OPTS = { lambert: false }` before the engine is built to get full PBR fur.

## Honest limitations

- The look is stylized real-time 3D (three.js), not an offline path-traced film render.
  The fur is shell-based, not simulated strands.
- The bear's vocal reactions come from a small formant synthesizer, not a voice actor,
  so they sound like a cute cartoon creature rather than a recorded performance.
- The ASMR sounds are physically inspired synthesis, not field recordings.
