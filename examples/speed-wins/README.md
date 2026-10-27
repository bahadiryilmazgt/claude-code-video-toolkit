# speed-wins: health-tourism Instagram Reel

A 37-second 9:16 Reel (1080x1920, 30fps) for health-tourism clinics. Its message is that the clinic that
answers WhatsApp first wins the patient. It has Turkish narration, and the palette is navy, cream and gold.
Every frame is motion graphics built in Remotion, with no stock footage or screen recordings. All audio is
committed and needs no API key, so you can re-render it straight away:

```bash
cd examples/speed-wins
npm install
npm run studio                       # preview
npm run render                       # out/speed-wins.mp4 (the committed speed-wins.mp4 is this render, loudness-normalised)
cd ../.. && uv run tools/qc.py --render examples/speed-wins/out/speed-wins.mp4 --fix   # -14 LUFS for Instagram
```

## Scenes

| # | Scene | On-screen text | What moves |
|---|-------|----------------|------------|
| 1 | Hook | Reklama para harcıyorsun… | A gold phone drops in, a clinic ad slides onto it, and a ₺ coin arcs into the ad |
| 2 | Patient writes | Hasta yazdı ✉ | Tap on "Mesaj Gönder". The ad morphs into a chat, the message types itself and sends, and the phone buzzes |
| 3 | Writes to everyone | Aynı anda 4 kliniğe birden | The camera pulls back and the phone splits into 4 clinic chats on gold lines. The message flies to each one |
| 4 | The race | Sen: 3 saat sonra… / Rakibin: 2 dakikada ✓ | A split screen. Your clock spins through 3 hours and dims with a red "Cevap yok". The rival replies in 2 minutes and gets a heart |
| 5 | Why it matters | Güven • İlgi • Hız | Shield, heart and lightning-bolt badges draw in, then a testimonial card flips over: "Burada benimle ilgileniyorlar." |
| 6 | Payoff | Hızlı dönen kazanır | A chart where the gold "Yanıt süresi" line falls and the cream "Randevu" bars rise. A light sweep, then a boom on "kazanan" |
| 7 | CTA | Reklam bütçen boşa gitmesin. / Mesajlara hızlı dön. | Everything collapses into a gold ring, the logo slot appears, and an @handle pill fades in. Ends on the music's final hit |

Transitions between scenes, in order: match cut, match cut, whip pan, zoom-through, gold light-leak wash,
and a collapse into the ring. They are configured in `BOUNDARIES` in `src/SpeedWins.tsx`.

## Brand placeholders

Scene 7 has a **LOGO / BURAYA** circle and an **@kullanıcıadı** pill (`SceneCTA` in `src/scenes.tsx`).
To brand the video, put your logo in `public/` and replace the placeholder `<div>` with
`<Img src={staticFile('logo.png')} />`. Then change the handle text.

## Audio: audio-anchored, all generated

`gen_audio.py` builds every sound in the video and writes `src/timeline.json`, which drives all of the timing:

- **Voiceover:** Microsoft `tr-TR-EmelNeural` through [edge-tts](https://github.com/rany2/edge-tts), which is
  free and needs no key. It runs at `+6%` rate for a warm, energetic female voice. Edge pads every clip with
  about 1.2s of silence, so the script trims that and normalises each clip to -16 LUFS. It also saves the
  word boundaries to `public/audio/scenes/*.words.json`.
- **Timeline:** the scene lengths come from the real clip durations plus fixed padding. The motion and the
  SFX cue off *words*: for example `cue("06_payoff", "kazanan")` puts the boom on that word. If the voice
  changes, everything stays in sync after one re-run.
- **SFX:** 18 sounds synthesised with numpy: whoosh, coin, riser, tap, typing, message pop, ding, vibration,
  clock ticks, fail tone, impact hits, boom, sparkle and shimmer. No samples are used, so there are no
  licences to track.
- **Music:** a 116 BPM light-electronic loop (Bm–G–D–A) synthesised with numpy. Its filter opens over the
  video, and hats and a riser build from scene 6. It ends on a chord-stab hit placed exactly 2.0s before the
  last frame. `musicVolume()` in `SpeedWins.tsx` ducks it under the voice and lifts it for the ending.

```bash
uv run examples/speed-wins/gen_audio.py                       # SFX + music + timeline (keeps the VO)
uv run --with edge-tts examples/speed-wins/gen_audio.py --vo  # also regenerate the Turkish VO
```

To use a different voice, edit `VOICEOVER-SCRIPT.md` and run `--vo`. To swap in ElevenLabs or Qwen3,
generate `public/audio/scenes/<id>.mp3` with `tools/voiceover.py` and drop in the matching
`<id>.words.json` files. Then run the script without `--vo`.

## Layout rules this follows

- Headlines and labels stay between y=230 (12%) and y=1536 (80%), clear of Instagram's top bar and its
  caption and buttons area.
- Colours are only `#0B1F3A`/`#061325` navy, `#F3EAD8` cream and `#C9A24B`/`#E6C77A` gold. Red `#E2553A`
  appears only on "geç" and on the "3 saat" / "Cevap yok" moment.
- Montserrat 500–800 is self-hosted from `public/fonts/` (SIL OFL), so the Turkish ı ğ ş İ characters render
  without a network call.
- The chat UI is generic, with no WhatsApp, Meta or clinic logos.
