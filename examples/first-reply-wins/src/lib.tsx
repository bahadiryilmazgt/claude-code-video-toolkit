import React from 'react';
import {Easing, interpolate, random, spring, staticFile} from 'remotion';
import timeline from './timeline.json';

// ---------------------------------------------------------------------------
// Timing: everything is authored in beats (105 BPM) so cuts land on the music.
// ---------------------------------------------------------------------------
export const FPS = timeline.fps;
export const W = timeline.width;
export const H = timeline.height;
export const FRAMES_PER_BEAT = (FPS * 60) / timeline.bpm;
export const bf = (beats: number) => Math.round(beats * FRAMES_PER_BEAT);
export const TOTAL_FRAMES = bf(timeline.totalBeats);

export const C = {
  navy: '#0B1F3A',
  navyDeep: '#061325',
  cream: '#F3EAD8',
  gold: '#C9A24B',
  goldHi: '#E6C77A',
  steel: '#5B6577',
  red: '#C0564B',
};

export const FONT = 'Montserrat, sans-serif';

export const GOLD_GRAD =
  'linear-gradient(115deg, #7d5f22 0%, #C9A24B 22%, #F6E3A8 38%, #E6C77A 48%, #b48c3a 62%, #F1D894 78%, #8a6a25 100%)';
export const BRUSHED_GOLD =
  'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(0,0,0,0.05) 2px, rgba(255,255,255,0.03) 3px), ' +
  GOLD_GRAD;

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0→1 between two frames with an easing curve. */
export const ramp = (
  f: number,
  a: number,
  b: number,
  ease: (t: number) => number = Easing.bezier(0.45, 0, 0.15, 1),
) => interpolate(f, [a, b], [0, 1], {...clamp, easing: ease});

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Physics spring with overshoot-and-settle, starting at frame `start`. */
export const pop = (f: number, start: number, cfg: {damping?: number; mass?: number; stiffness?: number} = {}) =>
  spring({frame: f - start, fps: FPS, config: {damping: 11, mass: 0.9, stiffness: 120, ...cfg}});

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Fonts (Montserrat latin + latin-ext so ş ğ ı İ render natively)
// ---------------------------------------------------------------------------
const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

export const loadFonts = () =>
  Promise.all(
    [500, 700, 800].flatMap((w) =>
      (
        [
          ['latin', LATIN],
          ['latin-ext', LATIN_EXT],
        ] as const
      ).map(([s, range]) => {
        const face = new FontFace(
          'Montserrat',
          `url(${staticFile(`fonts/montserrat-${s}-${w}-normal.woff2`)}) format('woff2')`,
          {weight: String(w), unicodeRange: range},
        );
        document.fonts.add(face);
        return face.load();
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Atmosphere
// ---------------------------------------------------------------------------

/** Deep navy velvet space with slow nebula haze. */
export const Space: React.FC<{f: number; warm?: number}> = ({f, warm = 0.5}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(120% 80% at 50% 42%, ${C.navy} 0%, #0a1b33 40%, ${C.navyDeep} 100%)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        width: 1400,
        height: 1400,
        left: -160 + Math.sin(f / 90) * 60,
        top: 180 + Math.cos(f / 110) * 50,
        background: `radial-gradient(circle, rgba(201,162,75,${0.12 * warm}) 0%, rgba(201,162,75,0) 60%)`,
        filter: 'blur(40px)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        width: 1200,
        height: 1200,
        left: 200 + Math.cos(f / 130) * 70,
        top: 900 + Math.sin(f / 100) * 60,
        background: 'radial-gradient(circle, rgba(60,96,150,0.22) 0%, rgba(60,96,150,0) 62%)',
        filter: 'blur(50px)',
      }}
    />
  </div>
);

/** Volumetric light beams raking down from top-left, with dust in them. */
export const Beams: React.FC<{f: number; opacity?: number; angle?: number}> = ({f, opacity = 1, angle = 24}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden', opacity, mixBlendMode: 'screen'}}>
    {[0, 1, 2].map((i) => {
      const sway = Math.sin(f / (70 + i * 23) + i * 2) * 3;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 80 + i * 260,
            top: -400,
            width: 120 + i * 70,
            height: 2800,
            transformOrigin: '50% 0%',
            transform: `rotate(${angle + sway + i * 4}deg)`,
            background:
              'linear-gradient(180deg, rgba(230,199,122,0.0) 0%, rgba(230,199,122,0.16) 18%, rgba(230,199,122,0.05) 60%, rgba(230,199,122,0) 100%)',
            filter: 'blur(28px)',
            opacity: 0.55 + 0.25 * Math.sin(f / 40 + i * 1.7),
          }}
        />
      );
    })}
  </div>
);

type ParticleOpts = {
  f: number;
  count?: number;
  seed?: string;
  camX?: number;
  camY?: number;
  focus?: number; // depth (0..1) that is in focus
  opacity?: number;
  speed?: number;
  zoom?: number; // radial scale outwards (fly-through feel)
};

/** Floating gold particles with depth-of-field bokeh and parallax. */
export const Particles: React.FC<ParticleOpts> = ({
  f,
  count = 70,
  seed = 'p',
  camX = 0,
  camY = 0,
  focus = 0.5,
  opacity = 1,
  speed = 1,
  zoom = 1,
}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden', opacity}}>
    {new Array(count).fill(0).map((_, i) => {
      const z = random(`${seed}z${i}`);
      const size = 3 + z * z * 26;
      const drift = f * speed * (0.15 + z * 0.6);
      let x = random(`${seed}x${i}`) * (W + 400) - 200 + Math.sin(f / 60 + i) * 14 + camX * (0.2 + z * 1.4);
      let y = ((random(`${seed}y${i}`) * (H + 400) - drift * 0.8 + 100000) % (H + 400)) - 200 + camY * (0.2 + z * 1.4);
      x = W / 2 + (x - W / 2) * zoom ** (0.3 + z);
      y = H / 2 + (y - H / 2) * zoom ** (0.3 + z);
      const blur = Math.abs(z - focus) * 14;
      const tw = 0.55 + 0.45 * Math.sin(f / (12 + random(`${seed}t${i}`) * 20) + i);
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: size,
            height: size,
            borderRadius: '50%',
            background:
              z > 0.75
                ? 'radial-gradient(circle, rgba(246,227,168,0.55) 0%, rgba(201,162,75,0.25) 55%, rgba(201,162,75,0) 72%)'
                : 'radial-gradient(circle, #FFF4D2 0%, #E6C77A 35%, rgba(201,162,75,0) 70%)',
            filter: `blur(${blur.toFixed(1)}px)`,
            opacity: tw * (z > 0.75 ? 0.6 : 0.9),
          }}
        />
      );
    })}
  </div>
);

/** Film grain + vignette, on top of everything. */
export const Grain: React.FC<{f: number}> = ({f}) => (
  <>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 55%, rgba(2,8,18,0.6) 100%)',
        pointerEvents: 'none',
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${staticFile('grain.png')})`,
        backgroundPosition: `${Math.floor(random(`gx${f}`) * 512)}px ${Math.floor(random(`gy${f}`) * 512)}px`,
        opacity: 0.075,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  </>
);

/** Anamorphic lens flare: core glow + horizontal streak + ghosts. */
export const Flare: React.FC<{x: number; y: number; intensity: number; size?: number}> = ({
  x,
  y,
  intensity,
  size = 1,
}) => {
  if (intensity <= 0.001) return null;
  const ghosts = [0.35, 0.62, 1.25];
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', opacity: intensity}}>
      <div
        style={{
          position: 'absolute',
          left: x - 220 * size,
          top: y - 220 * size,
          width: 440 * size,
          height: 440 * size,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,250,230,1) 0%, rgba(246,227,168,0.55) 12%, rgba(201,162,75,0.18) 35%, rgba(201,162,75,0) 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - 700 * size,
          top: y - 5 * size,
          width: 1400 * size,
          height: 10 * size,
          background:
            'linear-gradient(90deg, rgba(230,199,122,0) 0%, rgba(255,240,200,0.75) 50%, rgba(230,199,122,0) 100%)',
          filter: 'blur(3px)',
        }}
      />
      {ghosts.map((g, i) => {
        const gx = W / 2 + (W / 2 - x) * g;
        const gy = H / 2 + (H / 2 - y) * g;
        const r = (40 + i * 34) * size;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: gx - r,
              top: gy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: '50%',
              border: '1px solid rgba(230,199,122,0.18)',
              background: 'radial-gradient(circle, rgba(230,199,122,0.08) 0%, rgba(230,199,122,0) 70%)',
            }}
          />
        );
      })}
    </div>
  );
};

/** A diagonal band of light that sweeps across its parent once over [0..1]. */
export const LightSweep: React.FC<{p: number; width?: number; strength?: number; angle?: number}> = ({
  p,
  width = 260,
  strength = 0.55,
  angle = 18,
}) => {
  if (p <= 0 || p >= 1) return null;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 'inherit'}}>
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          height: '200%',
          width,
          left: `${-30 + p * 160}%`,
          transform: `rotate(${angle}deg)`,
          background: `linear-gradient(90deg, rgba(255,248,225,0) 0%, rgba(255,248,225,${strength}) 50%, rgba(255,248,225,0) 100%)`,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
};

/**
 * Frosted glass panel with a gold rim light that travels around the edge.
 * `rim` is the angle (deg) of the travelling highlight; `rimStrength` 0..1.
 */
export const Glass: React.FC<{
  w: number;
  h: number;
  r?: number;
  rim?: number;
  rimStrength?: number;
  tint?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({w, h, r = 40, rim = 0, rimStrength = 0.8, tint = 1, style, children}) => (
  <div
    style={{
      position: 'absolute',
      width: w,
      height: h,
      borderRadius: r,
      background: `linear-gradient(160deg, rgba(243,234,216,${0.16 * tint}) 0%, rgba(243,234,216,${0.06 * tint}) 45%, rgba(243,234,216,${0.1 * tint}) 100%)`,
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 0 60px rgba(243,234,216,0.05), 0 40px 90px rgba(0,0,0,0.45)',
      overflow: 'hidden',
      ...style,
    }}
  >
    {/* frosted texture */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${staticFile('grain.png')})`,
        opacity: 0.05,
        mixBlendMode: 'overlay',
      }}
    />
    {/* soft top-left specular */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(90% 60% at 15% 0%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 60%)',
      }}
    />
    {children}
    {/* rim: conic gradient masked to a 2px border */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: r,
        padding: 2,
        background: `conic-gradient(from ${rim}deg, rgba(230,199,122,${0.15 * rimStrength}) 0deg, rgba(255,240,200,${rimStrength}) 40deg, rgba(230,199,122,${0.15 * rimStrength}) 90deg, rgba(201,162,75,${0.25 * rimStrength}) 200deg, rgba(230,199,122,${0.15 * rimStrength}) 360deg)`,
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    />
  </div>
);

/** Text filled with animated gold foil. */
export const goldText = (shift = 0): React.CSSProperties => ({
  backgroundImage: GOLD_GRAD,
  backgroundSize: '250% 100%',
  backgroundPosition: `${(shift * 100) % 250}% 50%`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

/** Big faint outlined background word drifting slowly (layered typography). */
export const BgWord: React.FC<{
  text: string;
  f: number;
  y: number;
  size?: number;
  opacity?: number;
  speed?: number;
  x0?: number;
}> = ({text, f, y, size = 380, opacity = 0.07, speed = 0.6, x0 = 0}) => (
  <div
    style={{
      position: 'absolute',
      top: y,
      left: x0 - f * speed,
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: -size * 0.02,
      whiteSpace: 'nowrap',
      color: 'transparent',
      WebkitTextStroke: `2px rgba(243,234,216,${opacity * 3})`,
      opacity: 1,
      lineHeight: 1,
    }}
  >
    <span style={{color: `rgba(243,234,216,${opacity})`}}>{text}</span>
  </div>
);

/** Small spaced-out uppercase caption. */
export const Caption: React.FC<{children: React.ReactNode; style?: React.CSSProperties; color?: string}> = ({
  children,
  style,
  color = 'rgba(243,234,216,0.7)',
}) => (
  <div
    style={{
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: 6,
      textTransform: 'uppercase',
      color,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Check mark glyph (Montserrat has no ✓). */
export const Check: React.FC<{size: number; color?: string; p?: number; stroke?: number}> = ({
  size,
  color = C.goldHi,
  p = 1,
  stroke = 4,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{overflow: 'visible'}}>
    <path
      d="M4 12.5 L9.5 18 L20 6.5"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - p}
    />
  </svg>
);

/** Arrow glyph for the payoff line. */
export const Arrow: React.FC<{dir: 'up' | 'down'; size: number; color: string}> = ({dir, size, color}) => (
  <svg
    width={size * 0.62}
    height={size * 0.8}
    viewBox="0 0 20 26"
    style={{transform: dir === 'down' ? 'rotate(180deg)' : undefined, display: 'inline-block', verticalAlign: '-0.08em'}}
  >
    <path d="M10 24 V3 M2.5 10.5 L10 3 L17.5 10.5" fill="none" stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
