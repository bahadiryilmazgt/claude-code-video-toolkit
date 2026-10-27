import { continueRender, delayRender, staticFile } from "remotion";
import timelineJson from "./timeline.json";

// Montserrat (variable, 500-800; SIL OFL, see public/fonts/OFL.txt) is self-hosted so
// renders never depend on reaching Google Fonts. latin-ext carries the Turkish ğ ş İ.
export const fontFamily = "Montserrat";
const FONT_FILES: [string, string][] = [
  ["montserrat-latin.woff2", "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"],
  ["montserrat-latin-ext.woff2", "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"],
];
if (typeof document !== "undefined") {
  const handle = delayRender("Loading Montserrat");
  Promise.all(
    FONT_FILES.map(([file, unicodeRange]) => {
      const face = new FontFace(fontFamily, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
        weight: "500 800",
        unicodeRange,
      });
      document.fonts.add(face);
      return face.load();
    })
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
}

export const C = {
  navy: "#0B1F3A",
  navyDeep: "#061325",
  navyLift: "#13305A",
  cream: "#F3EAD8",
  creamDim: "rgba(243,234,216,0.62)",
  gold: "#C9A24B",
  goldHi: "#E6C77A",
  danger: "#E2553A",
  ok: "#7BD39A",
};

export const W = 1080;
export const H = 1920;
export const FPS = 30;

// Safe area for Instagram UI: no text in the top 12% or the bottom 20%.
export const SAFE_TOP = Math.round(H * 0.12);
export const SAFE_BOTTOM = Math.round(H * 0.8);

export type Word = { w: string; f: number };
export type SceneTiming = {
  id: string;
  from: number;
  durationInFrames: number;
  voFrom: number;
  voSeconds: number;
  words: Word[];
};
export const timeline = timelineJson as {
  fps: number;
  durationInFrames: number;
  scenes: SceneTiming[];
};

export const scene = (id: string): SceneTiming => {
  const s = timeline.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`scene ${id} missing from timeline.json`);
  return s;
};

/** Frame (relative to the scene start) at which the n-th occurrence of a word starts. */
export const cue = (id: string, word: string, nth = 0): number => {
  const hits = scene(id).words.filter(
    (x) => x.w.toLocaleLowerCase("tr") === word.toLocaleLowerCase("tr")
  );
  if (!hits[nth]) throw new Error(`word "${word}" not in ${id}`);
  return hits[nth].f;
};

/** Frames of overlap between a scene's exit and the next scene's entrance. */
export const TRANSITION = 12;

export const goldGradient = `linear-gradient(135deg, ${C.goldHi} 0%, ${C.gold} 55%, #A9822F 100%)`;
export const goldGlow = (r = 18, a = 0.55) =>
  `drop-shadow(0 0 ${r}px rgba(201,162,75,${a}))`;
