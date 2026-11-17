import * as THREE from 'three';
import TL from '../timeline.json';
import type { ArmPose, Bear, BearPose, V3 } from './bear';
import { muzzleZ } from './bear';
import { COOKIE_BITES, COOKIE_T, LEMON_R, MARSH_H, MARSH_R, STRAW_L } from './foods';
import {
  BEAR_Z,
  BOWL_TOP,
  COOKIE_PLATE,
  LEMON_PLATE,
  MARSH_BOWL,
  PLATE_TOP,
  STRAW_BOWL,
  TABLE_Y,
} from './layout';
import { bump, clamp, ease, Ease, K, lerp, noise1, ring, sstep, track, window as win } from './util';

// ======================================================================
// The 30-second performance. Pure functions of time t (seconds).
// ======================================================================

const M = TL.marks as Record<string, number>;
const CH = TL.chews as Record<string, number[]>;
const TAU = Math.PI * 2;

// ---------------- generic helpers ----------------
const maxOf = (...v: number[]) => Math.max(0, ...v);
/** jaw opening between chew closures. seq[0] = bite moment */
function chewJaw(t: number, seq: number[], amp = 1) {
  if (t < seq[0] || t > seq[seq.length - 1]) return 0;
  for (let i = 0; i + 1 < seq.length; i++) {
    if (t >= seq[i] && t < seq[i + 1]) {
      const u = (t - seq[i]) / (seq[i + 1] - seq[i]);
      return Math.pow(Math.sin(Math.PI * u), 1.3) * amp;
    }
  }
  return 0;
}
const CHEWS: [number[], number][] = [
  [[M.cookieBite1, ...CH.cookie1], 1],
  [[M.cookieBite2, ...CH.cookie2], 1],
  [[13.86, ...CH.lemon], 0.55],
  [[M.pieceIn, ...CH.marsh], 0.8],
  [[M.strawBite1, ...CH.straw1], 0.9],
  [[M.strawBite2, ...CH.straw2], 0.9],
];
export function jawAt(t: number) {
  let j = 0;
  for (const [s, a] of CHEWS) j = Math.max(j, chewJaw(t, s, a));
  return j;
}
const blinkTimes = [...(TL.blinks as number[]), M.blink1, M.blink2];
function blinkAt(t: number) {
  let c = 0;
  for (const b of blinkTimes) {
    if (t >= b && t < b + 0.07) c = Math.max(c, ease('io', (t - b) / 0.07));
    else if (t >= b + 0.07 && t < b + 0.11) c = 1;
    else if (t >= b + 0.11 && t < b + 0.22) c = Math.max(c, 1 - ease('io', (t - b - 0.11) / 0.11));
  }
  return c;
}
const pulses = (t: number, t0: number, n: number, period: number) =>
  t < t0 || t > t0 + n * period ? 0 : Math.pow(Math.sin(((t - t0) / period) * Math.PI), 2);

// walk
const WALK_P = TL.walkPeriod as number;
const walkPhase = (t: number) => (TAU * t) / WALK_P - Math.PI / 2;
const walkAmp = (t: number) => 1 - sstep(2.3, 2.62, t);
const WALK_FROM = [-0.62, -1.85];
const walkS = track([
  [0, 0],
  [2.1, 0.9, 'lin'],
  [2.6, 1, 'out'],
]);
const rootYawT = track([
  [0, Math.atan2(-WALK_FROM[0], BEAR_Z - WALK_FROM[1])],
  [2.2, Math.atan2(-WALK_FROM[0], BEAR_Z - WALK_FROM[1])],
  [2.75, 0],
]);

// ---------------- head channels ----------------
const headYawK = track([
  [0, 0],
  [2.75, 0],
  [3.05, -0.32],
  [3.3, -0.3],
  [3.6, 0.3],
  [3.85, 0.28],
  [4.05, 0],
  [5.05, 0],
  [5.45, -0.25],
  [5.75, -0.2],
  [6.15, -0.03],
  [10.4, 0],
  [10.7, -0.2],
  [10.95, -0.15],
  [11.3, 0.3],
  [12.0, 0.24],
  [12.4, 0.05],
  [12.8, 0],
  [17.0, 0],
  [17.25, -0.12],
  [17.8, -0.03],
  [19.8, 0],
  [20.0, -0.15],
  [20.45, -0.12],
  [20.75, -0.03],
  [22.35, 0],
  [22.6, -0.1],
  [22.95, 0.05],
  [23.25, 0.15],
  [23.7, 0.04],
  [27.6, 0.0],
  [28.0, -0.06],
]);
const headPitchK = track([
  [0, 0.12],
  [2.55, 0.14],
  [2.75, 0.22],
  [3.05, 0.38],
  [3.85, 0.36],
  [4.05, 0.05],
  [4.45, 0.05],
  [4.6, -0.06],
  [5.0, 0.02],
  [5.4, 0.38],
  [5.8, 0.3],
  [6.2, 0.15],
  [6.6, 0.12],
  [10.4, 0.1],
  [10.75, 0.35],
  [11.1, 0.3],
  [11.4, 0.36],
  [12.1, 0.38],
  [12.45, 0.14],
  [13.0, 0.1],
  [13.1, -0.12, 'out'],
  [14.5, -0.08],
  [15.45, -0.02],
  [15.6, 0.0],
  [16.6, 0.02],
  [16.9, 0.18],
  [17.25, 0.42],
  [17.7, 0.3],
  [18.05, 0.3],
  [19.75, 0.28],
  [20.1, 0.24],
  [20.6, 0.12],
  [21.0, 0.08],
  [22.3, 0.1],
  [22.6, 0.38],
  [23.0, 0.36],
  [23.3, 0.4],
  [23.8, 0.16],
  [24.4, 0.1],
  [26.3, 0.08],
  [27.6, 0.04],
  [28.0, -0.04],
]);
const headRollK = track([
  [0, 0],
  [2.75, 0],
  [3.05, 0.12],
  [3.3, 0.1],
  [3.6, -0.1],
  [3.85, -0.08],
  [4.05, 0],
  [4.5, 0.09],
  [5.0, 0.04],
  [6.2, 0.04],
  [6.35, 0.15],
  [6.55, 0.03],
  [10.4, 0],
  [11.2, -0.2],
  [12.1, -0.12],
  [12.5, -0.04],
  [13.0, 0],
  [15.45, 0],
  [15.8, 0.1],
  [16.6, 0.12],
  [17.0, 0],
  [18.05, 0.08],
  [19.75, 0.06],
  [20.0, -0.04],
  [20.9, 0],
  [21.3, 0.16],
  [22.2, 0.12],
  [22.45, 0],
  [27.7, 0],
  [28.05, 0.14],
]);

function headYaw(t: number) {
  let y = headYawK(t);
  // head shake after the lemon (zero crossings land on the swish sounds)
  if (t > 14.5 && t < 15.5) {
    const a = 0.46 * (1 - sstep(14.6, 15.45, t)) * sstep(14.47, 14.56, t);
    y += a * Math.sin(TAU * 2 * (t - 14.56));
  }
  y += 0.012 * noise1(t * 0.7, 3);
  return y;
}
function headRoll(t: number) {
  let r = headRollK(t);
  const wp = walkPhase(t);
  r += 0.045 * Math.sin(wp) * walkAmp(t);
  // happy chewing sway
  const sway = maxOf(win(t, 7.15, 8.5, 0.3, 0.3), win(t, 9.15, 10.35, 0.3, 0.3));
  r += sway * 0.07 * Math.sin(TAU * 1.35 * (t - 7.15));
  // bliss sway (marshmallow) and cheek-holding sway
  r += win(t, 21.1, 22.2, 0.3, 0.3) * 0.05 * Math.sin(TAU * 0.9 * (t - 21.1));
  r += win(t, 26.3, 27.65, 0.25, 0.25) * 0.16 * Math.sin(TAU * 1.15 * (t - 26.35));
  r += win(t, 28.0, 30.5, 0.4, 0.1) * 0.04 * Math.sin(TAU * 1.1 * (t - 28.0));
  // sour shiver
  r += win(t, 13.2, 13.95, 0.04, 0.3) * 0.035 * Math.sin(TAU * 15 * t);
  return r;
}

// ---------------- face channel helpers ----------------
function happyAt(t: number) {
  return maxOf(
    0.85 * win(t, 3.92, 4.4, 0.08, 0.06),
    win(t, 7.08, 8.5, 0.14, 0.12),
    win(t, 9.08, 10.42, 0.14, 0.12),
    0.85 * win(t, 18.95, 19.28, 0.06, 0.08),
    win(t, 20.95, 22.25, 0.15, 0.15),
    0.75 * win(t, 24.48, 25.12, 0.12, 0.1),
    win(t, 25.38, 27.8, 0.12, 0.1),
  );
}
const squeezeAt = (t: number) => win(t, 13.04, 15.42, 0.09, 0.08);
function sparkleAt(t: number) {
  return maxOf(win(t, 4.45, 5.2, 0.08, 0.3), win(t, 6.15, 6.6, 0.1, 0.2), 0.8 * win(t, 17.6, 19.8, 0.2, 0.3), win(t, 27.9, 30.5, 0.2, 0.1), 0.6 * win(t, 15.45, 16.5, 0.05, 0.3));
}

// ======================================================================
export function bodyPose(t: number): BearPose {
  const wp = walkPhase(t);
  const wa = walkAmp(t);
  const jaw = jawAt(t);
  const happy = happyAt(t);
  const squeeze = squeezeAt(t);
  const blink = blinkAt(t) * (1 - Math.max(happy, squeeze));

  // --- body ---
  const reach = maxOf(
    win(t, 5.0, 5.9, 0.4, 0.35),
    win(t, 10.45, 11.0, 0.25, 0.2),
    win(t, 11.55, 12.25, 0.35, 0.3),
    win(t, 16.45, 17.0, 0.25, 0.25),
    win(t, 17.0, 17.75, 0.35, 0.3),
    win(t, 22.3, 22.95, 0.25, 0.25),
    win(t, 23.0, 23.75, 0.35, 0.3),
  );
  let lean = 0.05 + reach * 0.14 + wa * 0.06;
  lean += 0.04 * win(t, 6.55, 7.05, 0.2, 0.05) + 0.04 * win(t, 8.62, 9.05, 0.2, 0.05);
  lean -= 0.06 * win(t, 13.05, 14.4, 0.08, 0.4); // recoil from sour
  let twist = 0.06 * Math.cos(wp) * wa;
  twist += -0.12 * maxOf(win(t, 5.0, 5.9, 0.4, 0.35), win(t, 10.45, 11.0, 0.25, 0.2));
  twist += 0.11 * maxOf(win(t, 11.55, 12.25, 0.35, 0.3), win(t, 16.45, 17.0, 0.25, 0.25));
  twist += 0.08 * win(t, 23.0, 23.75, 0.35, 0.3);
  twist += win(t, 13.2, 13.95, 0.04, 0.3) * 0.02 * Math.sin(TAU * 12.5 * t + 1);
  let roll = -0.07 * Math.sin(wp) * wa;
  roll += maxOf(win(t, 7.15, 8.5, 0.3, 0.3), win(t, 9.15, 10.35, 0.3, 0.3)) * 0.035 * Math.sin(TAU * 1.35 * (t - 7.15));
  roll += win(t, 13.2, 13.95, 0.04, 0.3) * 0.03 * Math.sin(TAU * 16 * t);
  roll += win(t, 26.3, 27.65, 0.25, 0.25) * 0.05 * Math.sin(TAU * 1.15 * (t - 26.35) - 0.4);
  let bob = 0.016 * Math.abs(Math.sin(wp)) * wa;
  bob += 0.032 * bump(t, 4.62, 0.13); // excited hop
  bob += 0.008 * pulses(t, 18.92, 2, 0.17) + 0.008 * pulses(t, 27.25, 2, 0.2) + 0.01 * pulses(t, 28.25, 2, 0.24);
  bob += 0.003 * Math.sin(TAU * 0.33 * t); // breathing
  let squash = 1 + 0.012 * Math.sin(TAU * 0.33 * t);
  squash += -0.07 * bump(t, 2.63, 0.08) + 0.03 * bump(t, 2.75, 0.08);
  squash += -0.06 * bump(t, 4.78, 0.07) + 0.025 * bump(t, 4.9, 0.07);
  squash += -0.03 * bump(t, 13.08, 0.08);

  // --- head ---
  const headSquash = 1 - 0.1 * win(t, 13.05, 15.4, 0.08, 0.2) - 0.03 * jaw;
  const headFwd = 0.016 * maxOf(win(t, 6.6, 7.08, 0.25, 0.06), win(t, 8.7, 9.08, 0.2, 0.06), win(t, 24.15, 24.45, 0.15, 0.06), win(t, 25.1, 25.35, 0.12, 0.06), win(t, 20.6, 20.9, 0.15, 0.06));
  const headPitch = headPitchK(t) + 0.035 * jaw - 0.04 * bump(t, M.cookieBite1 + 0.05, 0.1) - 0.04 * bump(t, M.cookieBite2 + 0.05, 0.1);

  // --- eyes ---
  let eyeUpper = 1.08;
  eyeUpper = lerp(eyeUpper, 1.3, maxOf(win(t, 4.45, 5.05, 0.06, 0.3), win(t, 6.15, 6.6, 0.1, 0.2), win(t, 15.45, 16.6, 0.05, 0.3), 0.6 * win(t, 17.5, 18.9, 0.2, 0.2), 0.7 * win(t, 27.9, 30.5, 0.2, 0.1)));
  eyeUpper = lerp(eyeUpper, 0.95, win(t, 11.0, 12.6, 0.2, 0.2)); // a little wary of the lemon
  let eyeLower = -0.92;
  eyeLower = lerp(eyeLower, -0.6, maxOf(win(t, 27.9, 30.5, 0.2, 0.1), 0.6 * win(t, 11.0, 12.6, 0.2, 0.2)));
  const eyeWide = 1 + 0.1 * maxOf(win(t, 4.45, 5.05, 0.05, 0.3), win(t, 15.45, 16.4, 0.04, 0.4)) + 0.05 * win(t, 6.15, 6.6, 0.1, 0.2) + 0.04 * win(t, 17.6, 19.8, 0.2, 0.3);

  // gaze: default at camera. Down at the table / food in hand.
  const gp = track([
    [0, -0.12],
    [2.6, -0.12],
    [2.8, -0.28],
    [3.9, -0.28],
    [4.05, 0],
    [5.0, 0],
    [5.3, -0.3],
    [6.1, -0.2],
    [6.3, -0.24],
    [10.4, -0.24],
    [10.6, -0.3],
    [12.5, -0.15],
    [12.9, -0.25],
    [13.05, 0],
    [17.0, 0],
    [17.2, -0.28],
    [19.9, -0.2],
    [20.5, -0.15],
    [20.9, 0],
    [22.3, 0],
    [22.5, -0.28],
    [24.3, -0.25],
    [24.45, 0],
    [27.8, 0],
  ])(t);
  const gy = track([
    [0, 0],
    [2.8, 0],
    [3.0, -0.28],
    [3.3, -0.25],
    [3.55, 0.28],
    [3.85, 0.25],
    [4.0, 0],
    [5.1, 0],
    [5.35, -0.25],
    [5.9, -0.05],
    [6.3, 0],
    [10.5, 0],
    [10.7, -0.2],
    [11.1, 0.28],
    [12.2, 0.2],
    [12.5, 0],
    [17.0, 0],
    [17.2, -0.15],
    [17.8, 0],
    [19.85, 0],
    [20.0, -0.25],
    [20.5, -0.1],
    [20.8, 0],
    [22.4, 0],
    [22.6, -0.15],
    [23.0, 0.05],
    [23.2, 0.22],
    [23.7, 0],
  ])(t);

  // --- brows ---
  const browRaise =
    0.15 +
    0.35 * win(t, 2.8, 3.95, 0.2, 0.2) +
    0.85 * win(t, 4.45, 5.1, 0.05, 0.35) +
    0.5 * win(t, 6.15, 6.6, 0.1, 0.2) +
    0.55 * win(t, 11.0, 12.6, 0.2, 0.2) -
    0.9 * win(t, 13.05, 15.42, 0.08, 0.15) +
    0.95 * win(t, 15.45, 16.6, 0.05, 0.4) +
    0.45 * win(t, 17.4, 19.8, 0.2, 0.3) +
    0.4 * win(t, 27.9, 30.5, 0.2, 0.1);
  const browTilt =
    0.15 +
    0.3 * win(t, 2.8, 3.95, 0.2, 0.2) +
    0.45 * win(t, 11.0, 12.6, 0.2, 0.2) -
    1.25 * win(t, 13.05, 15.42, 0.08, 0.15) +
    0.25 * win(t, 15.45, 16.6, 0.05, 0.4) +
    0.25 * maxOf(win(t, 7.1, 8.5, 0.2, 0.2), win(t, 9.1, 10.4, 0.2, 0.2), win(t, 21.0, 22.2, 0.2, 0.2), win(t, 25.4, 27.7, 0.2, 0.2));

  // --- mouth ---
  const giggleOpen = 0.32 * pulses(t, 18.92, 2, 0.17) + 0.3 * pulses(t, 27.25, 2, 0.2);
  const mouthOpen = Math.min(
    1,
    maxOf(
      0.5 * win(t, 4.5, 4.92, 0.06, 0.12),
      0.95 * win(t, M.cookieOpen1, M.cookieBite1 + 0.02, 0.22, 0.04),
      0.95 * win(t, M.cookieOpen2, M.cookieBite2 + 0.02, 0.2, 0.04),
      0.5 * win(t, M.lemonOpen, M.lemonBite + 0.02, 0.15, 0.04),
      0.2 * win(t, 13.15, 13.77, 0.05, 0.1),
      0.38 * win(t, 15.72, 16.02, 0.05, 0.1),
      0.7 * win(t, 20.55, M.pieceIn + 0.02, 0.12, 0.04),
      0.75 * win(t, 24.1, M.strawBite1 + 0.02, 0.15, 0.04),
      0.8 * win(t, 25.1, M.strawBite2 + 0.02, 0.12, 0.04),
      0.42 * win(t, 27.95, 30.5, 0.2, 0.1) + 0.22 * win(t, 28.25, 28.85, 0.08, 0.2),
      0.22 * win(t, 6.25, 6.5, 0.06, 0.1),
      giggleOpen,
    ) + 0.13 * jaw,
  );
  const mouthWide =
    1 -
    0.36 * maxOf(win(t, 4.5, 4.92, 0.05, 0.12), win(t, 15.72, 16.02, 0.05, 0.1)) +
    0.25 * win(t, 13.15, 13.77, 0.05, 0.1) +
    0.12 * win(t, 27.95, 30.5, 0.2, 0.1);
  let smile = 0.45;
  smile = lerp(smile, 0.95, maxOf(happy, win(t, 6.15, 6.6, 0.1, 0.2), win(t, 17.5, 19.8, 0.2, 0.2), win(t, 27.9, 30.5, 0.2, 0.1)));
  smile = lerp(smile, -0.7, win(t, 13.05, 15.42, 0.08, 0.15));
  smile = lerp(smile, 0.05, win(t, 15.45, 16.6, 0.05, 0.3));

  // --- cheeks / blush ---
  const chewing = maxOf(
    win(t, M.cookieBite1, 8.5, 0.12, 0.15),
    win(t, M.cookieBite2, 10.4, 0.12, 0.15),
    0.5 * win(t, M.pieceIn, 22.2, 0.15, 0.15),
    0.7 * win(t, M.strawBite1, 25.1, 0.12, 0.12),
    0.8 * win(t, M.strawBite2, 26.35, 0.12, 0.15),
  );
  const cheekPuff = clamp(chewing * (0.8 + 0.25 * jaw) + 0.35 * win(t, 13.05, 14.4, 0.08, 0.3) + 0.3 * win(t, 26.35, 27.7, 0.2, 0.2));
  const blush = clamp(0.3 + 0.45 * chewing + 0.7 * maxOf(win(t, 20.9, 22.3, 0.2, 0.2), win(t, 25.4, 30.5, 0.3, 0.1)) - 0.15 * win(t, 13.05, 15.4, 0.1, 0.2));

  // --- nose ---
  let noseWiggle = 0;
  for (const s of [3.95, 4.12, 4.29, 12.52]) noseWiggle += Math.sin(TAU * 10 * (t - s)) * bump(t, s + 0.05, 0.08);
  noseWiggle += 0.4 * Math.sin(TAU * 7 * t) * win(t, 3.9, 4.4, 0.05, 0.05);

  // --- ears (perk / flatten + lag behind head motion) ---
  const dYaw = (headYaw(t) - headYaw(t - 0.07)) / 0.07;
  const dRoll = (headRoll(t) - headRoll(t - 0.07)) / 0.07;
  const earFlat = 0.9 * win(t, 13.05, 15.42, 0.06, 0.15) - 0.25 * maxOf(win(t, 4.45, 5.1, 0.05, 0.3), win(t, 15.45, 16.5, 0.05, 0.3));
  const earBase = 0.04 * Math.sin(TAU * 0.4 * t);
  const earR = earBase - 0.06 * dYaw - 0.1 * dRoll + 0.05 * Math.sin(TAU * 6 * t) * win(t, 4.45, 4.9, 0.03, 0.2);
  const earL = -earBase - 0.06 * dYaw + 0.1 * dRoll + 0.05 * Math.sin(TAU * 6 * t + 1) * win(t, 4.45, 4.9, 0.03, 0.2);

  const zero: ArmPose = { target: [0, 0, 0], palm: [0, 0, 1], finger: [0, 1, 0] };
  return {
    rootPos: [lerp(WALK_FROM[0], 0, walkS(t)), 0, lerp(WALK_FROM[1], BEAR_Z, walkS(t))],
    rootYaw: rootYawT(t),
    bob,
    lean,
    roll,
    twist,
    squash,
    walkPhase: wp,
    walkAmp: wa,
    headYaw: headYaw(t),
    headPitch,
    headRoll: headRoll(t),
    headSquash,
    headFwd,
    eyeUpper,
    eyeLower,
    eyeWide,
    gazeYaw: gy,
    gazePitch: gp,
    happy,
    blink,
    squeeze,
    sparkle: sparkleAt(t),
    browRaise,
    browTilt,
    mouthOpen,
    mouthWide,
    smile,
    tongue: 0.7,
    jaw,
    cheekPuff,
    blush,
    noseWiggle,
    earL,
    earR,
    earFlat,
    armR: zero,
    armL: zero,
  };
}

// ======================================================================
// Hands and food. Foods follow anchor paths; paws grip the foods.
// ======================================================================
export interface Xf {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
}
type Anchor<T> = (t: number) => T;
type Seg<T> = [number, number, Anchor<T>, Ease?];

function path<T>(t: number, segs: Seg<T>[], blend: (a: T, b: T, s: number) => T): T {
  let i = 0;
  while (i + 1 < segs.length && segs[i + 1][0] <= t) i++;
  const [t0, t1, A, e] = segs[i];
  if (i === 0 || t >= t1) return A(t);
  return blend(segs[i - 1][2](t), A(t), ease(e ?? 'io', (t - t0) / (t1 - t0)));
}
const blendXf = (a: Xf, b: Xf, s: number): Xf => ({
  pos: a.pos.clone().lerp(b.pos, s),
  quat: a.quat.clone().slerp(b.quat, s),
});
const blendArm = (a: ArmPose, b: ArmPose, s: number): ArmPose => {
  const L = (x: V3, y: V3): V3 => [lerp(x[0], y[0], s), lerp(x[1], y[1], s), lerp(x[2], y[2], s)];
  return { target: L(a.target, b.target), palm: L(a.palm, b.palm), finger: L(a.finger, b.finger) };
};
const q = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const arr = (p: THREE.Vector3): V3 => [p.x, p.y, p.z];
const arm = (p: THREE.Vector3, palm: THREE.Vector3 | V3, finger: THREE.Vector3 | V3): ArmPose => ({
  target: arr(p),
  palm: Array.isArray(palm) ? palm : arr(palm),
  finger: Array.isArray(finger) ? finger : arr(finger),
});

export interface Scene3 {
  cookie: Xf & { bites: number };
  lemon: Xf & { bitten: boolean };
  marsh: Xf & { squish: number; dent: number; piece: THREE.Vector3 | null; strand: [THREE.Vector3, THREE.Vector3] | null };
  straw: Xf & { cut: number };
  armR: ArmPose;
  armL: ArmPose;
}

// marshmallow squeeze amount (0..1, with jiggle on release)
export function squishAt(t: number) {
  let s = 0;
  for (const [a, b, c] of TL.squeezes as number[][]) {
    if (t >= a && t < b) s = Math.max(s, ease('io', (t - a) / (b - a)));
    else if (t >= b && t < c + 0.6) s += Math.exp(-(t - b) * 7) * Math.cos((t - b) * TAU * 3.2);
  }
  // spring back after the tear
  if (t >= M.tearB && t < M.tearB + 0.8) s += 0.25 * Math.exp(-(t - M.tearB) * 6) * Math.cos((t - M.tearB) * TAU * 3.5);
  return s;
}

export function handsAndFoods(t: number, bear: Bear): Scene3 {
  const mouthIn = bear.muzzle.localToWorld(v(0, -0.1, muzzleZ(0, -0.1) - 0.012));
  const headQ = new THREE.Quaternion();
  bear.face.getWorldQuaternion(headQ);
  const hips = (x: number, y: number, z: number) => bear.hips.localToWorld(v(x, y, z));
  const face = (x: number, y: number, z: number) => bear.face.localToWorld(v(x, y, z));
  const hd = (x: number, y: number, z: number) => v(x, y, z).applyQuaternion(headQ);

  // paw rest on the table edge
  const restR = (): ArmPose => arm(v(-0.13, TABLE_Y + 0.045, -0.088), [0, -1, 0.05], [0.1, 0, 1]);
  const restL = (): ArmPose => arm(v(0.13, TABLE_Y + 0.045, -0.088), [0, -1, 0.05], [-0.1, 0, 1]);
  // hanging/swinging during the walk
  const walkArm = (s: number) => (tt: number): ArmPose => {
    const ph = walkPhase(tt) + (s < 0 ? Math.PI : 0);
    const sw = Math.cos(ph) * 0.06 * walkAmp(tt);
    return arm(hips(s * 0.2, 0.15, 0.05 + sw), [-s, 0, 0.2], [0, -1, 0.3]);
  };
  const clapArm = (s: number) => (tt: number): ArmPose => {
    const c = Math.max(bump(tt, 4.68, 0.09), bump(tt, 4.88, 0.09));
    const gap = lerp(0.095, 0.047, c);
    return arm(hips(s * gap, 0.37, 0.27), [-s, 0.1, 0.2], [0, 1, 0.3]);
  };

  // ---------------- cookie ----------------
  const cookieRoll = track([
    [0, 0],
    [7.75, 0],
    [8.4, (72 * Math.PI) / 180],
  ]);
  const cookieUp = (roll: number, tilt = 0.18) => q(tilt, 0, roll);
  const cookieBiteXf = (k: number) => (tt: number): Xf => {
    const qq = cookieUp(cookieRoll(tt), -0.55);
    const c = COOKIE_BITES[k].c;
    const local = v(c[0], c[1], COOKIE_T / 2).applyQuaternion(qq);
    return { pos: mouthIn.clone().sub(local), quat: qq };
  };
  const cookiePlate = (): Xf => ({ pos: COOKIE_PLATE.clone().add(v(0, PLATE_TOP + 0.0036, 0)), quat: q(-Math.PI / 2, 0, 0.3) });
  const cookiePlate2 = (): Xf => ({ pos: COOKIE_PLATE.clone().add(v(0.005, PLATE_TOP + 0.0036, 0.004)), quat: q(-Math.PI / 2, 0, 0.3 + (72 * Math.PI) / 180) });
  const cookieAdmire = (tt: number): Xf => ({
    pos: mouthIn.clone().add(v(0, -0.045, 0.14)),
    quat: cookieUp(0.06 * Math.sin(TAU * 1.2 * (tt - 6.2)), 0.2),
  });
  const cookieHold = (tt: number): Xf => ({
    pos: mouthIn.clone().add(v(0, -0.085, 0.11)),
    quat: cookieUp(cookieRoll(tt), 0.22),
  });
  const preBite = (k: number) => (tt: number): Xf => {
    const b = cookieBiteXf(k)(tt);
    return { pos: b.pos.add(v(0, -0.025, 0.035)), quat: b.quat };
  };
  const cookie = path<Xf>(
    t,
    [
      [0, 0, cookiePlate],
      [M.cookieGrab, 6.25, cookieAdmire],
      [M.cookieOpen1 + 0.05, 6.86, preBite(0)],
      [6.86, M.cookieBite1, cookieBiteXf(0), 'in'],
      [M.cookieBite1, 7.35, cookieHold, 'out'],
      [M.cookieOpen2 + 0.06, 8.88, preBite(1)],
      [8.88, M.cookieBite2, cookieBiteXf(1), 'in'],
      [M.cookieBite2, 9.35, cookieHold, 'out'],
      [M.cookieMS + 0.02, M.cookieDown, cookiePlate2],
    ],
    blendXf,
  );
  const cookieBites = t >= M.cookieBite2 ? 2 : t >= M.cookieBite1 ? 1 : 0;
  const lifted = (t0: number, t1: number) => sstep(t0, t1, t);
  // grips on the cookie (world offsets; plate grip -> two-handed hold)
  const cookieGrip = (s: number) => (tt: number): ArmPose => {
    const c = path<Xf>(tt, [[0, 0, () => cookie]], blendXf);
    const held = sstep(M.cookieGrab, M.cookieGrab + 0.3, tt) * (1 - sstep(M.cookieDown - 0.25, M.cookieDown, tt));
    const plateOff = v(s * 0.06, 0.036, -0.01);
    const heldOff = v(s * 0.07, -0.02, 0.006);
    const off = plateOff.lerp(heldOff, held);
    const palm = v(-s * 0.6, -0.8, 0.0).lerp(v(-s, 0.05, 0.25), held).normalize();
    const fing = v(0, 0.1, 1).lerp(v(0, 1, 0.15), held).normalize();
    return arm(c.pos.clone().add(off), palm, fing);
  };

  // ---------------- lemon ----------------
  const lemonPlate = (): Xf => ({ pos: LEMON_PLATE.clone().add(v(0, PLATE_TOP + 0.0065, 0)), quat: q(-Math.PI / 2, 0, -0.4) });
  const lemonNose = (): Xf => ({ pos: bear.faceToWorld([0, -0.06, 0.32]), quat: q(0.15, -0.1, 0.1) });
  const lemonBiteXf = (): Xf => {
    const qq = q(-0.6, 0, 0);
    const local = v(0, LEMON_R * 0.92, 0).applyQuaternion(qq);
    return { pos: mouthIn.clone().sub(local), quat: qq };
  };
  const lemonPre = (): Xf => {
    const b = lemonBiteXf();
    return { pos: b.pos.add(v(0, -0.03, 0.04)), quat: b.quat };
  };
  const lemonAway = (tt: number): Xf => ({
    pos: hips(0.2, 0.38, 0.24).add(v(0, 0.01 * Math.sin(TAU * 14 * tt) * win(tt, 13.2, 13.95, 0.04, 0.3), 0)),
    quat: q(0.25, -0.35, -0.2),
  });
  const lemon = path<Xf>(
    t,
    [
      [0, 0, lemonPlate],
      [M.lemonGrab, 12.48, lemonNose],
      [M.lemonOpen - 0.06, 12.9, lemonPre],
      [12.9, M.lemonBite, lemonBiteXf, 'in'],
      [M.lemonBite + 0.04, 13.38, lemonAway, 'out'],
      [M.lemonDownStart, M.lemonDown, lemonPlate],
    ],
    blendXf,
  );
  const lemonGrip = (tt: number): ArmPose => {
    const held = sstep(M.lemonGrab, M.lemonGrab + 0.3, tt) * (1 - sstep(M.lemonDown - 0.25, M.lemonDown, tt));
    const off = v(0.052, 0.034, -0.005).lerp(v(0.052, -0.016, 0.004), held);
    const palm = v(-0.6, -0.8, 0).lerp(v(-1, 0.05, 0.25), held).normalize();
    const fing = v(0, 0.1, 1).lerp(v(0, 1, 0.15), held).normalize();
    return arm(lemon.pos.clone().add(off), palm, fing);
  };

  // ---------------- marshmallow ----------------
  const squish = squishAt(t);
  const marshBowl = (): Xf => ({ pos: MARSH_BOWL.clone().add(v(0, BOWL_TOP + 0.014 + MARSH_H / 2, 0)), quat: q(0, 0.3, 0) });
  const marshChest = (tt: number): Xf => ({
    pos: hips(0, 0.3, 0.3).add(v(0, 0.004 * Math.sin(TAU * 0.8 * tt), 0)),
    quat: q(0.08, 0.3 + 0.2 * sstep(19.9, 20.45, tt) * (1 - sstep(20.45, 21.0, tt)), 0.18 * sstep(20.05, 20.45, tt) * (1 - sstep(20.45, 20.75, tt))),
  });
  const marsh = path<Xf>(
    t,
    [
      [0, 0, marshBowl],
      [M.marshGrab, 18.0, marshChest],
      [M.marshMS + 0.02, M.marshDown, marshBowl],
    ],
    blendXf,
  );
  const halfW = MARSH_R * (1 - 0.32 * squish);
  const marshGrip = (s: number) => (tt: number): ArmPose => {
    const held = sstep(M.marshGrab - 0.05, M.marshGrab + 0.3, tt) * (1 - sstep(M.marshDown - 0.2, M.marshDown, tt));
    const side = v(s * (halfW + 0.043), -0.004, 0.004).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.0, 0)));
    const above = v(s * 0.05, 0.035, 0.0);
    const off = above.lerp(side, held);
    const palm = v(-s, -0.4 * (1 - held), 0.15).normalize();
    const fing = v(0, 1, 0.35).normalize();
    return arm(marsh.pos.clone().add(off), palm, fing);
  };
  // tear: the marshmallow is local-rotated; tear point in world
  const tearWorld = (): THREE.Vector3 => {
    const tp = v(-MARSH_R * 0.62, MARSH_H / 2 - 0.004, MARSH_R * 0.55);
    return tp.multiply(v(1 - 0.32 * squish, 1 + 0.2 * squish, 1 + 0.2 * squish)).applyQuaternion(marsh.quat).add(marsh.pos);
  };
  const pinch = (): ArmPose => arm(tearWorld().add(v(-0.032, 0.018, 0.024)), [0.7, -0.5, -0.2], [0.4, 0.4, 0.8]);
  const pull = (): ArmPose => arm(tearWorld().add(v(-0.1, 0.03, 0.07)), [0.7, -0.3, -0.2], [0.4, 0.6, 0.6]);
  const pieceToMouth = (): ArmPose => arm(mouthIn.clone().add(v(-0.05, -0.035, 0.035)), [0.7, 0.2, -0.5], [0.5, 0.75, 0.3]);
  const fingertip = (a: ArmPose) => {
    const p = v(...a.target);
    const f = v(...a.finger).normalize();
    const pl = v(...a.palm).normalize();
    return p.addScaledVector(f, 0.044).addScaledVector(pl, 0.016);
  };

  // ---------------- strawberry ----------------
  const strawBowl = (): Xf => {
    const qq = q(0.2, 0.4, Math.PI / 2 + 0.25);
    return { pos: STRAW_BOWL.clone().add(v(0.0, BOWL_TOP + 0.036, 0.008)).sub(v(0, 0.027, 0).applyQuaternion(qq)), quat: qq };
  };
  const strawAxis = (tilt: number) => new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), v(0.05, -0.75, tilt).normalize());
  const strawBiteXf = (yLocal: number) => (): Xf => {
    const qq = strawAxis(0.62);
    const local = v(0, yLocal, 0).applyQuaternion(qq);
    return { pos: mouthIn.clone().sub(local), quat: qq };
  };
  const strawPre = (): Xf => {
    const b = strawBiteXf(0.01)();
    return { pos: b.pos.add(v(0.005, -0.04, 0.045)), quat: b.quat };
  };
  const strawHold = (): Xf => {
    const b = strawBiteXf(0.03)();
    return { pos: b.pos.add(v(0.012, -0.05, 0.05)), quat: b.quat };
  };
  const dropPt = (): Xf => ({ pos: v(0.16, TABLE_Y + 0.12, -0.03), quat: strawAxis(0.4) });
  const landed = (): Xf => ({ pos: v(0.15, TABLE_Y + 0.004, -0.02), quat: q(0.1, 0.5, Math.PI / 2) });
  const straw = path<Xf>(
    t,
    [
      [0, 0, strawBowl],
      [M.strawGrab, 24.05, strawPre],
      [24.3, M.strawBite1, strawBiteXf(0.012), 'in'],
      [M.strawBite1 + 0.02, 24.68, strawHold, 'out'],
      [25.12, 25.26, strawPre],
      [25.26, M.strawBite2, strawBiteXf(0.042), 'in'],
      [M.strawBite2 + 0.02, 25.65, dropPt, 'out'],
      [25.65, 25.95, landed, 'in'],
    ],
    blendXf,
  );
  const cut = t >= M.strawBite2 ? STRAW_L : t >= M.strawBite1 ? 0.027 : 0;
  const strawGrip = (tt: number): ArmPose => {
    const held = sstep(M.strawGrab - 0.05, M.strawGrab + 0.3, tt);
    const calyx = v(0, STRAW_L + 0.004, 0).applyQuaternion(straw.quat).add(straw.pos);
    const off = v(0.02, 0.04, 0).lerp(v(0.012, -0.038, 0.012), held);
    const palm = v(-0.3, -0.9, 0).lerp(v(-0.2, 0.7, -0.4), held).normalize();
    const fing = v(0, 0.1, 1).lerp(v(-0.3, 0.3, 0.9), held).normalize();
    return arm(calyx.add(off), palm, fing);
  };
  const afterDrop = (): ArmPose => arm(v(0.17, TABLE_Y + 0.16, -0.04), [0, -1, 0.2], [0, 0.2, 1]);

  // ---------------- cheeks / wave ----------------
  const cheekPaw = (s: number) => (): ArmPose =>
    arm(face(s * 0.19, -0.09, 0.135), hd(-s, 0.1, -0.35).normalize(), hd(s * 0.15, 1, 0.2).normalize());
  const wave = (tt: number): ArmPose => {
    const w = 0.45 * Math.sin(TAU * 2.1 * (tt - 28.05)) * sstep(27.95, 28.2, tt);
    const p = v(-0.33 + 0.012 * Math.sin(TAU * 2.1 * (tt - 28.05)), 0.7, -0.1);
    return arm(p, [0.05, 0, 1], [Math.sin(w), Math.cos(w), 0]);
  };

  // ---------------- arm paths ----------------
  const R: Seg<ArmPose>[] = [
    [0, 0, walkArm(-1)],
    [2.45, 2.82, restR],
    [4.5, 4.62, clapArm(-1)],
    [4.98, 5.15, restR],
    [5.15, M.cookieGrab, cookieGrip(-1)],
    [M.cookieDown + 0.02, 11.15, restR],
    [17.05, M.marshGrab, marshGrip(-1)],
    [19.88, 20.05, pinch],
    [20.05, M.tearB, pull],
    [M.tearB + 0.03, M.pieceIn, pieceToMouth],
    [M.pieceIn + 0.03, 21.35, marshGrip(-1)],
    [M.marshDown + 0.02, 23.0, restR],
    [25.9, M.cheeks, cheekPaw(-1)],
    [27.62, 27.98, wave],
  ];
  const L: Seg<ArmPose>[] = [
    [0, 0, walkArm(1)],
    [2.5, 2.9, restL],
    [4.5, 4.62, clapArm(1)],
    [4.98, 5.15, restL],
    [5.95, 6.2, cookieGrip(1)],
    [M.cookieMS, 10.75, restL],
    [M.lemonReach, M.lemonGrab, lemonGrip],
    [M.lemonDown + 0.02, 17.05, restL],
    [17.07, M.marshGrab, marshGrip(1)],
    [M.marshDown + 0.02, 22.95, restL],
    [M.strawReach, M.strawGrab, strawGrip],
    [25.65, 25.85, afterDrop],
    [25.9, M.cheeks, cheekPaw(1)],
    [27.62, 28.0, restL],
  ];
  const armR = path(t, R, blendArm);
  const armL = path(t, L, blendArm);

  // marsh piece & strand
  let piece: THREE.Vector3 | null = null;
  let strand: [THREE.Vector3, THREE.Vector3] | null = null;
  if (t >= 20.02 && t < M.pieceIn) {
    piece = fingertip(armR);
    if (t < 20.05) piece = tearWorld();
    if (t < M.tearB) strand = [tearWorld(), piece.clone()];
  }
  const dent = sstep(20.0, M.tearB, t);

  return {
    cookie: { ...cookie, bites: cookieBites },
    lemon: { ...lemon, bitten: t >= M.lemonBite },
    marsh: { ...marsh, squish, dent, piece, strand },
    straw: { ...straw, cut },
    armR,
    armL,
  };
}

// ======================================================================
// Camera
// ======================================================================
interface CamKey {
  t: number;
  p: V3;
  l: V3;
  fov?: number;
}
export interface Shot {
  keys: CamKey[];
  focus: 'head' | 'marsh' | 'mouth';
  ap: number;
}
const shot = (focus: Shot['focus'], ap: number, ...keys: CamKey[]): Shot => ({ keys, focus, ap });
const MSP: V3 = [0, 0.98, 1.82];
const MSL: V3 = [0, 0.46, -0.12];
export const SHOTS: Shot[] = [
  // establishing crane: high over the table watching Honey waddle in, then settle into the medium shot
  shot('head', 0.8,
    { t: 0, p: [0.12, 1.06, 2.5], l: [-0.3, 0.26, -1.3] },
    { t: 2.7, p: [0.04, 1.02, 2.05], l: [-0.04, 0.44, -0.4] },
    { t: 6.1, p: [0.0, 0.97, 1.8], l: [0, 0.47, -0.12] }),
  // cookie close-up
  shot('mouth', 1.4, { t: 6.1, p: [-0.05, 0.8, 1.42], l: [-0.03, 0.52, -0.25] }, { t: 10.4, p: [-0.02, 0.79, 1.28], l: [-0.02, 0.53, -0.25] }),
  shot('head', 1.0, { t: 10.4, p: [0.08, MSP[1], 1.82], l: [0.03, MSL[1], -0.15] }, { t: 12.6, p: [0.11, 0.96, 1.72], l: [0.05, MSL[1], -0.15] }),
  // lemon close-up, then a comedic push-in on the stunned face
  shot('mouth', 1.4, { t: 12.6, p: [0.06, 0.8, 1.42], l: [0.04, 0.53, -0.25] }, { t: 15.45, p: [0.03, 0.79, 1.3], l: [0.02, 0.54, -0.25] }),
  shot('head', 1.5, { t: 15.45, p: [0.03, 0.79, 1.3], l: [0.02, 0.54, -0.25] }, { t: 16.25, p: [0.0, 0.74, 1.08], l: [0.0, 0.6, -0.28] }, { t: 17.0, p: [0.0, 0.74, 1.05], l: [0.0, 0.6, -0.28] }),
  shot('head', 1.0, { t: 17.0, p: [-0.05, MSP[1], 1.82], l: [-0.03, MSL[1], -0.15] }, { t: 18.05, p: [-0.05, 0.96, 1.72], l: [-0.03, MSL[1], -0.15] }),
  // marshmallow texture close-up
  shot('marsh', 1.6, { t: 18.05, p: [0.03, 0.64, 0.95], l: [0.0, 0.5, -0.04] }, { t: 19.75, p: [0.02, 0.63, 0.84], l: [0.0, 0.5, -0.04] }),
  shot('mouth', 1.4, { t: 19.75, p: [-0.07, 0.8, 1.42], l: [-0.04, 0.52, -0.25] }, { t: 22.3, p: [-0.04, 0.79, 1.3], l: [-0.03, 0.53, -0.25] }),
  shot('head', 1.0, { t: 22.3, p: [0.07, MSP[1], 1.82], l: [0.04, MSL[1], -0.15] }, { t: 24.0, p: [0.08, 0.96, 1.72], l: [0.05, MSL[1], -0.15] }),
  // strawberry close-up, easing back as the hearts float up
  shot('mouth', 1.4, { t: 24.0, p: [0.05, 0.8, 1.36], l: [0.03, 0.53, -0.25] }, { t: 25.9, p: [0.04, 0.8, 1.42], l: [0.02, 0.54, -0.25] }, { t: 27.75, p: [0.02, 0.82, 1.72], l: [0.0, 0.56, -0.25] }),
  shot('head', 1.2, { t: 27.75, p: [-0.04, 0.76, 1.85], l: [-0.05, 0.52, -0.2] }, { t: 30.0, p: [-0.03, 0.75, 1.68], l: [-0.04, 0.53, -0.2] }),
];

export function cameraAt(t: number) {
  const s = SHOTS.find((x) => t >= x.keys[0].t && t < x.keys[x.keys.length - 1].t) ?? SHOTS[SHOTS.length - 1];
  const ks = s.keys;
  let i = 0;
  while (i + 2 < ks.length && t >= ks[i + 1].t) i++;
  const a = ks[i];
  const b = ks[i + 1];
  const u = ease('sine', (t - a.t) / (b.t - a.t));
  const L = (x: V3, y: V3) => v(lerp(x[0], y[0], u), lerp(x[1], y[1], u), lerp(x[2], y[2], u));
  const pos = L(a.p, b.p);
  const look = L(a.l, b.l);
  // a whisper of handheld float
  pos.x += 0.004 * noise1(t * 0.6, 11);
  pos.y += 0.003 * noise1(t * 0.5, 12);
  look.x += 0.002 * noise1(t * 0.4, 13);
  return { pos, look, fov: lerp(a.fov ?? 30, b.fov ?? 30, u), focus: s.focus, ap: s.ap };
}
