import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Background, clamp } from "./components";
import { SceneCTA, SceneEveryone, SceneHook, ScenePatient, ScenePayoff, SceneRace, SceneWhy } from "./scenes";
import { C, cue, scene, timeline } from "./theme";

// ------------------------------------------------------------------ transitions

type Kind = "cut" | "whip" | "zoom" | "leak" | "collapse";
// One entry per boundary: scene i -> scene i+1. `frames` is how long the outgoing
// scene keeps rendering into the next one.
const BOUNDARIES: { kind: Kind; frames: number }[] = [
  { kind: "cut", frames: 0 }, // phone -> chat: same phone, match cut
  { kind: "cut", frames: 0 }, // chat -> grid: the scene itself pulls back
  { kind: "whip", frames: 10 },
  { kind: "zoom", frames: 12 },
  { kind: "leak", frames: 14 },
  { kind: "collapse", frames: 14 },
];

const ease = Easing.inOut(Easing.cubic);

const exitStyle = (kind: Kind, p: number): React.CSSProperties => {
  const e = ease(p);
  switch (kind) {
    case "whip":
      return { transform: `translateX(${-e * 1250}px) skewX(${e * 6}deg)`, filter: `blur(${p * 34}px)`, opacity: 1 - p * 0.3 };
    case "zoom":
      return { transform: `scale(${1 + e * 1.8})`, filter: `blur(${p * 22}px)`, opacity: 1 - e };
    case "leak":
      return { opacity: 1 - e, filter: `brightness(${1 + p * 0.8}) blur(${p * 6}px)` };
    case "collapse":
      return {
        transform: `scale(${1 - e * 0.97}) rotate(${e * 40}deg)`,
        filter: `brightness(${1 + p * 1.5}) blur(${p * 4}px)`,
        opacity: 1 - Math.pow(p, 3),
      };
    default:
      return {};
  }
};

const enterStyle = (kind: Kind, p: number): React.CSSProperties => {
  const e = Easing.out(Easing.cubic)(p);
  switch (kind) {
    case "whip":
      return { transform: `translateX(${(1 - e) * 1250}px) skewX(${(1 - e) * 6}deg)`, filter: `blur(${(1 - p) * 34}px)` };
    case "zoom":
      return { transform: `scale(${0.7 + 0.3 * e})`, filter: `blur(${(1 - p) * 16}px)`, opacity: e };
    case "leak":
      return { opacity: e, filter: `blur(${(1 - p) * 8}px)` };
    default:
      return {};
  }
};

const Shell: React.FC<{ dur: number; enter?: { kind: Kind; frames: number }; exit?: { kind: Kind; frames: number }; children: React.ReactNode }> = ({
  dur,
  enter,
  exit,
  children,
}) => {
  const f = useCurrentFrame();
  let style: React.CSSProperties = {};
  if (enter && enter.frames > 0 && f < enter.frames) style = enterStyle(enter.kind, f / enter.frames);
  if (exit && exit.frames > 0 && f >= dur) style = exitStyle(exit.kind, (f - dur) / exit.frames);
  return <AbsoluteFill style={{ ...style, transformOrigin: "50% 50%" }}>{children}</AbsoluteFill>;
};

/** Gold light-leak wash across a boundary. */
const LightLeak: React.FC<{ at: number; frames: number }> = ({ at, frames }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at - 8, at + frames + 8], [0, 1], clamp);
  if (p <= 0 || p >= 1) return null;
  const a = Math.sin(p * Math.PI);
  const x = -30 + p * 160;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        background: `radial-gradient(ellipse 60% 90% at ${x}% 45%, rgba(230,199,122,${0.85 * a}), transparent 60%),
                     radial-gradient(ellipse 40% 60% at ${x - 25}% 70%, rgba(255,214,150,${0.55 * a}), transparent 65%),
                     linear-gradient(100deg, transparent ${x - 40}%, rgba(255,240,205,${0.35 * a}) ${x}%, transparent ${x + 30}%)`,
      }}
    />
  );
};

// ------------------------------------------------------------------ audio

type Sfx = { at: number; file: string; volume: number; frames?: number };

const VO = timeline.scenes.map((s) => [s.voFrom, s.voFrom + Math.round(s.voSeconds * 30)] as const);
const END = timeline.durationInFrames;
const HIT = END - 60; // gen_audio.py lands the music's final hit 2.0s before the end
const LAST_VO_END = VO[VO.length - 1][1];

const musicVolume = (f: number) => {
  // Distance (frames) to the nearest narration; 0 while she speaks.
  let d = Infinity;
  for (const [a, b] of VO) {
    if (f >= a && f <= b) d = 0;
    else d = Math.min(d, f < a ? a - f : f - b);
  }
  const duck = interpolate(d, [0, 8], [0, 1], clamp);
  const build = interpolate(f, [scene("06_payoff").from, scene("07_cta").from + 60], [1, 1.3], clamp);
  const base = (0.14 + duck * 0.13) * build;
  const tail = interpolate(f, [LAST_VO_END, LAST_VO_END + 6], [0, 1], clamp);
  return base * (1 - tail) + 0.5 * tail;
};

const buildSfx = (): Sfx[] => {
  const at = (id: string, f: number) => scene(id).from + f;
  const s3 = "03_everyone";
  const sends = [cue(s3, "Aynı"), cue(s3, "anda"), cue(s3, "birkaç"), cue(s3, "kliniğe")];
  const s4 = "04_race";
  const replyAt = cue(s4, "birkaç") + 2;
  const s5 = "05_why";
  const s6 = "06_payoff";
  const boom = cue(s6, "kazanan");
  const s7 = "07_cta";
  const hook = scene("01_hook");
  return [
    // 1 hook
    { at: at("01_hook", 0), file: "whoosh", volume: 0.7 },
    { at: at("01_hook", 40), file: "coin", volume: 0.75 },
    { at: at("01_hook", 44), file: "sparkle", volume: 0.35 },
    { at: hook.from + hook.durationInFrames - 34, file: "riser", volume: 0.4 },
    // 2 patient
    { at: at("02_patient", 1), file: "tap", volume: 0.8 },
    { at: at("02_patient", 16), file: "typing", volume: 0.9, frames: 36 },
    { at: at("02_patient", 54), file: "pop", volume: 0.8 },
    { at: at("02_patient", 57), file: "vibrate", volume: 0.45, frames: 14 },
    // 3 everyone
    { at: at(s3, 0), file: "whoosh", volume: 0.45 },
    { at: at(s3, 20), file: "whoosh", volume: 0.55 },
    ...sends.map((f, i) => ({ at: at(s3, f + 9), file: i % 2 ? "pop_hi" : "pop", volume: 0.75 })),
    // 3 -> 4 whip
    { at: at(s4, -6), file: "whoosh", volume: 0.7 },
    // 4 race
    { at: at(s4, cue(s4, "Sen")), file: "ticks", volume: 0.6, frames: cue(s4, "dönüyorsun") + 14 - cue(s4, "Sen") },
    { at: at(s4, cue(s4, "dönüyorsun") + 10), file: "fail", volume: 0.6 },
    { at: at(s4, replyAt), file: "ding", volume: 0.7 },
    { at: at(s4, replyAt + 2), file: "vibrate", volume: 0.35, frames: 12 },
    { at: at(s4, replyAt + 16), file: "sparkle", volume: 0.4 },
    // 4 -> 5 zoom
    { at: at(s5, -9), file: "whoosh_long", volume: 0.6 },
    // 5 why
    { at: at(s5, cue(s5, "güven")), file: "hit", volume: 0.6 },
    { at: at(s5, cue(s5, "arıyor") + 12), file: "hit", volume: 0.6 },
    { at: at(s5, cue(s5, "Hızlı")), file: "hit_hi", volume: 0.6 },
    { at: at(s5, cue(s5, "burada") - 8), file: "whoosh", volume: 0.4 },
    { at: at(s5, cue(s5, "benimle")), file: "sparkle", volume: 0.45 },
    // 5 -> 6 leak, riser into the boom
    { at: at(s6, -8), file: "whoosh", volume: 0.5 },
    { at: at(s6, boom - 60), file: "riser_long", volume: 0.45, frames: 60 },
    { at: at(s6, boom), file: "boom", volume: 0.85 },
    // 6 -> 7 collapse
    { at: at(s7, -10), file: "whoosh_long", volume: 0.55 },
    { at: at(s7, 14), file: "sparkle", volume: 0.45 },
    { at: at(s7, cue(s7, "kaybetme")), file: "sparkle", volume: 0.4 },
    { at: HIT - 3, file: "shimmer", volume: 0.5 },
  ];
};

// ------------------------------------------------------------------ composition

const SCENES: [string, React.FC<any>][] = [
  ["01_hook", SceneHook],
  ["02_patient", ScenePatient],
  ["03_everyone", SceneEveryone],
  ["04_race", SceneRace],
  ["05_why", SceneWhy],
  ["06_payoff", ScenePayoff],
  ["07_cta", SceneCTA],
];

export const SpeedWins: React.FC = () => {
  const sfx = buildSfx();
  const cta = scene("07_cta");
  return (
    <AbsoluteFill style={{ backgroundColor: C.navyDeep }}>
      <Background />
      {SCENES.map(([id, Comp], i) => {
        const s = scene(id);
        const exit = BOUNDARIES[i];
        const enter = BOUNDARIES[i - 1];
        const length = s.durationInFrames + (exit ? exit.frames : 0);
        return (
          <Sequence key={id} from={s.from} durationInFrames={length} name={id}>
            <Shell dur={s.durationInFrames} enter={enter} exit={exit}>
              <Comp hitAt={HIT - cta.from} />
            </Shell>
          </Sequence>
        );
      })}
      {BOUNDARIES.map((b, i) =>
        b.kind === "leak" ? <LightLeak key={i} at={timeline.scenes[i + 1].from} frames={b.frames} /> : null
      )}

      {/* audio */}
      <Audio src={staticFile("audio/music/music.mp3")} volume={musicVolume} />
      {timeline.scenes.map((s) => (
        <Sequence key={`vo-${s.id}`} from={s.voFrom} name={`vo ${s.id}`}>
          <Audio src={staticFile(`audio/scenes/${s.id}.mp3`)} />
        </Sequence>
      ))}
      {sfx.map((x, i) => (
        <Sequence key={`sfx-${i}`} from={Math.max(0, x.at)} durationInFrames={x.frames ?? 90} name={`sfx ${x.file}`}>
          <Audio src={staticFile(`audio/sfx/${x.file}.wav`)} volume={x.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
