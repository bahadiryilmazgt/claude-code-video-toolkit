# First Reply Wins

A silent 9:16 motion-design showcase for Instagram Reels, about 53 seconds long. A patient sees a clinic ad and
messages several clinics at once, and the clinic that replies first wins the appointment. The message:
in health tourism, reply speed = trust = patients.

Everything is code. The glass, liquid gold, light beams, bokeh, grain and camera moves are built with
React/CSS 3D in Remotion. The score and sound design are synthesized with numpy. There is no stock footage and
nothing is AI-generated, so all the Turkish copy renders exactly as written (Montserrat latin + latin-ext).

```bash
npm install
npm run studio                 # preview
python3 audio/make_audio.py    # regenerate the soundtrack (numpy only)
ffmpeg -y -i public/audio/soundtrack_raw.wav -af loudnorm=I=-14:TP=-1.5 public/audio/soundtrack.wav
npm run render                 # out/first-reply-wins.mp4 (1080x1920, 30fps)
```

## How it is put together

| File | What it does |
|------|--------------|
| `src/timeline.json` | **Source of truth.** 105 BPM beat grid: scene windows, every main message (text, beat in/out, position) and every SFX hit. Visuals and audio both read it, so cuts land on the beat. |
| `src/Messages.tsx` | Overlay layer for the main messages. Markup: `*gold*`, `~red~`, `{up}`/`{down}` arrows. It sits above all scenes, so the camera never makes a message unreadable. |
| `src/lib.tsx` | Palette, beat→frame helpers, springs, and shared FX: space, beams, bokeh particles, grain, lens flare, light sweep, glass panel with travelling gold rim. |
| `src/components.tsx` | Phone (true 3D brushed-gold body), chat UI (generic, no messenger branding), avatar, reply card. |
| `src/Scene*.tsx` | Ad → message (one continuous card→phone morph), orbit, race, choice, why, payoff, ending. |
| `src/brand.ts` | End card. Set `logoFile` (a file in `public/`) and `handle` to replace the placeholder. |
| `audio/make_audio.py` | Pads, piano, plucks, bass, soft drums, plus glassy pops, whooshes, crystal chimes, ticks, the muted "late" tone and shimmer, all from the timeline. |
| `contact-sheet.sh` | `./contact-sheet.sh out/sheet.png 100 400 700` renders those frames side by side for review. |

## Readability rules (from the brief)

- Each main message is fully legible for at least 2 s (the beat timings in `timeline.json` were checked against
  the entry and exit animation lengths).
- Messages are centred between y=280 and y=530, inside the Instagram safe zone (top 12% = 230 px, bottom 20% = 384 px).
- Soft red `#C0564B` is used only for the "too late" moment (`3 saat` / `Geç kaldın`).
