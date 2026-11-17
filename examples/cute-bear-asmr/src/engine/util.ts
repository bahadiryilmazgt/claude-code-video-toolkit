// Small deterministic math / animation helpers. Everything in the film is a pure
// function of time, because Remotion renders frames out of order across tabs.

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
export const smoother = (t: number) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const sstep = (a: number, b: number, x: number) => smooth((x - a) / (b - a));

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Ease = 'lin' | 'io' | 'in' | 'out' | 'back' | 'outBack' | 'hold' | 'sine';

export function ease(kind: Ease | undefined, s: number): number {
  s = clamp(s);
  switch (kind) {
    case 'lin':
      return s;
    case 'in':
      return s * s * s;
    case 'out':
      return 1 - Math.pow(1 - s, 3);
    case 'sine':
      return 0.5 - 0.5 * Math.cos(Math.PI * s);
    case 'back': {
      const c = 1.4;
      return s * s * ((c + 1) * s - c);
    }
    case 'outBack': {
      const c = 1.9;
      const u = s - 1;
      return 1 + (c + 1) * u * u * u + c * u * u;
    }
    case 'hold':
      return s < 1 ? 0 : 1;
    case 'io':
    default:
      return smoother(s);
  }
}

/** keyframe = [time, value, easeIntoThisKey?] */
export type K = [number, number, Ease?];
export type KV = [number, number[], Ease?];

export function track(keys: K[]) {
  return (t: number): number => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t < t1) {
        const [t0, v0] = keys[i - 1];
        return lerp(v0, v1, ease(e, (t - t0) / (t1 - t0)));
      }
    }
    return keys[keys.length - 1][1];
  };
}

export function trackV(keys: KV[]) {
  return (t: number): number[] => {
    if (t <= keys[0][0]) return keys[0][1].slice();
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t < t1) {
        const [t0, v0] = keys[i - 1];
        const s = ease(e, (t - t0) / (t1 - t0));
        return v0.map((a, j) => lerp(a, v1[j], s));
      }
    }
    return keys[keys.length - 1][1].slice();
  };
}

/** Smooth 1-D value noise in [-1, 1]. */
export function noise1(x: number, seed = 0): number {
  const h = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

/** 0..1..0 bump of a given half-width (smooth). */
export const bump = (t: number, c: number, w: number) => {
  const x = Math.abs(t - c) / w;
  return x >= 1 ? 0 : smooth(1 - x);
};

/** Envelope that rises over [a,a+ri], holds, falls over [b-fo,b]. */
export const window = (t: number, a: number, b: number, ri = 0.15, fo = 0.15) =>
  Math.min(sstep(a, a + ri, t), 1 - sstep(b - fo, b, t));

/** Damped oscillation starting at t0. */
export const ring = (t: number, t0: number, freq: number, decay: number) =>
  t < t0 ? 0 : Math.sin((t - t0) * freq * Math.PI * 2) * Math.exp(-(t - t0) * decay);
