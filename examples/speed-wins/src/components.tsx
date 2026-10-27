import React from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { C, fontFamily, goldGlow, goldGradient, H, W } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const pop = (frame: number, at: number, fps: number, damping = 13, mass = 0.7) =>
  spring({ frame: frame - at, fps, config: { damping, mass, stiffness: 140 } });

// ------------------------------------------------------------------ background

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 120% 80% at ${50 + drift / 20}% 38%, ${C.navyLift} 0%, ${C.navy} 42%, ${C.navyDeep} 100%)`,
      }}
    >
      {/* Slow gold haze, top-right and bottom-left */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${78 + drift / 30}% 12%, rgba(201,162,75,0.13), transparent 38%),
                       radial-gradient(circle at ${18 - drift / 30}% 92%, rgba(201,162,75,0.10), transparent 40%)`,
        }}
      />
      <Particles count={46} seed="bg" />
      {/* Fine grid, very faint: gives the parallax something to read against */}
      <AbsoluteFill
        style={{
          opacity: 0.05,
          backgroundImage: `linear-gradient(${C.gold} 1px, transparent 1px), linear-gradient(90deg, ${C.gold} 1px, transparent 1px)`,
          backgroundSize: "90px 90px",
          backgroundPosition: `0 ${-frame * 0.4}px`,
          maskImage: "radial-gradient(ellipse at 50% 50%, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 50%, black 20%, transparent 75%)",
        }}
      />
      <Vignette />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "radial-gradient(ellipse 85% 70% at 50% 50%, transparent 55%, rgba(3,10,22,0.75) 100%)",
      pointerEvents: "none",
    }}
  />
);

export const Particles: React.FC<{ count: number; seed: string; boost?: number }> = ({
  count,
  seed,
  boost = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        const depth = 0.3 + random(`${seed}d${i}`) * 0.9;
        const x = random(`${seed}x${i}`) * W;
        const y0 = random(`${seed}y${i}`) * (H + 200);
        const y = ((y0 - frame * 0.9 * depth) % (H + 200) + H + 200) % (H + 200) - 100;
        const size = 2 + depth * 5;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / (14 + i % 9) + i));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.sin(frame / 50 + i) * 12 * depth,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: C.goldHi,
              opacity: Math.min(1, 0.22 * depth * tw * boost),
              filter: `blur(${(1.2 - depth) * 3}px)`,
              boxShadow: `0 0 ${size * 3}px ${C.gold}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ kinetic type

export type Token = { t: string; gold?: boolean; danger?: boolean };

/**
 * Centered headline. Each word pops in (scale + blur-to-sharp) at its own frame;
 * gold words get an underline that sweeps in after the word lands.
 */
export const Headline: React.FC<{
  lines: Token[][];
  at: number[]; // one start frame per word, flattened across lines
  top: number;
  size?: number;
  exitAt?: number;
  weight?: number;
  underline?: boolean;
}> = ({ lines, at, top, size = 86, exitAt, weight = 800, underline = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let k = 0;
  const exit = exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 10], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 70,
        right: 70,
        textAlign: "center",
        fontFamily,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.12,
        letterSpacing: -1,
        color: C.cream,
        opacity: 1 - exit,
        transform: `translateY(${-exit * 30}px)`,
        filter: exit > 0 ? `blur(${exit * 10}px)` : undefined,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: `0 ${size * 0.26}px` }}>
          {line.map((tok, wi) => {
            const start = at[k++] ?? 0;
            const p = pop(frame, start, fps, 12, 0.6);
            const o = interpolate(frame - start, [0, 6], [0, 1], clamp);
            const ul = interpolate(frame - start, [7, 19], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            const color = tok.danger ? C.danger : tok.gold ? C.goldHi : C.cream;
            return (
              <span
                key={wi}
                style={{
                  position: "relative",
                  display: "inline-block",
                  opacity: o,
                  transform: `scale(${0.72 + 0.28 * p}) translateY(${(1 - p) * 18}px)`,
                  filter: `blur(${(1 - Math.min(1, p)) * 14}px)`,
                  color,
                  textShadow: tok.gold
                    ? "0 0 24px rgba(230,199,122,0.45)"
                    : tok.danger
                      ? "0 0 22px rgba(226,85,58,0.45)"
                      : "0 4px 24px rgba(0,0,0,0.35)",
                }}
              >
                {tok.t}
                {tok.gold && underline ? (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      bottom: -size * 0.08,
                      height: Math.max(5, size * 0.07),
                      width: `${ul * 100}%`,
                      borderRadius: 4,
                      background: goldGradient,
                      boxShadow: `0 0 16px ${C.gold}`,
                    }}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Spread n words evenly from `start`, `gap` frames apart. */
export const stagger = (n: number, start: number, gap = 4) =>
  new Array(n).fill(0).map((_, i) => start + i * gap);

// ------------------------------------------------------------------ phone

export const PHONE_W = 500;
export const PHONE_H = 1000;

export const Phone: React.FC<{
  children?: React.ReactNode;
  glow?: number;
  dim?: number;
  style?: React.CSSProperties;
}> = ({ children, glow = 1, dim = 0, style }) => (
  <div
    style={{
      position: "relative",
      width: PHONE_W,
      height: PHONE_H,
      borderRadius: 74,
      padding: 14,
      background: "linear-gradient(160deg, rgba(230,199,122,0.9), rgba(201,162,75,0.55) 40%, rgba(169,130,47,0.85))",
      boxShadow: `0 0 ${50 * glow}px rgba(201,162,75,${0.35 * glow}), 0 40px 90px rgba(0,0,0,0.55)`,
      ...style,
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: 62,
        overflow: "hidden",
        background: `linear-gradient(180deg, #0E2748 0%, ${C.navyDeep} 100%)`,
      }}
    >
      {children}
      {/* notch */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: "50%",
          width: 120,
          height: 32,
          marginLeft: -60,
          borderRadius: 20,
          background: "#030A16",
        }}
      />
      {/* glass reflection */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(115deg, rgba(255,255,255,0.08) 0%, transparent 35%, transparent 70%, rgba(255,255,255,0.04) 100%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: `rgba(3,8,18,${dim})`, pointerEvents: "none" }} />
    </div>
  </div>
);

/** A diagonal band of light that crosses its parent once, between two frames. */
export const LightSweep: React.FC<{ from: number; dur?: number; width?: number; opacity?: number }> = ({
  from,
  dur = 22,
  width = 220,
  opacity = 0.5,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [from, from + dur], [-0.4, 1.4], { ...clamp, easing: Easing.inOut(Easing.quad) });
  if (frame < from || frame > from + dur) return null;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", borderRadius: "inherit" }}>
      <div
        style={{
          position: "absolute",
          top: "-50%",
          height: "200%",
          left: `${p * 100}%`,
          width,
          transform: "rotate(18deg)",
          background: `linear-gradient(90deg, transparent, rgba(255,240,205,${opacity}), transparent)`,
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
};

// ------------------------------------------------------------------ chat bits

export const Bubble: React.FC<{
  side: "in" | "out";
  children: React.ReactNode;
  style?: React.CSSProperties;
  size?: number;
}> = ({ side, children, style, size = 30 }) => (
  <div
    style={{
      alignSelf: side === "in" ? "flex-start" : "flex-end",
      maxWidth: "82%",
      padding: `${size * 0.55}px ${size * 0.7}px`,
      borderRadius: size * 0.9,
      borderBottomLeftRadius: side === "in" ? 8 : size * 0.9,
      borderBottomRightRadius: side === "out" ? 8 : size * 0.9,
      // The patient's own messages are cream; replies from a clinic are gold.
      background: side === "out" ? C.cream : goldGradient,
      color: C.navy,
      fontFamily,
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1.28,
      boxShadow: "0 10px 26px rgba(0,0,0,0.3)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const ChatHeader: React.FC<{ name: string; status: string; size?: number }> = ({ name, status, size = 1 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 18 * size,
      padding: `${70 * size}px ${28 * size}px ${22 * size}px`,
      background: "rgba(6,19,37,0.85)",
      borderBottom: "1px solid rgba(201,162,75,0.35)",
    }}
  >
    <Avatar size={66 * size} />
    <div style={{ fontFamily, color: C.cream }}>
      <div style={{ fontWeight: 700, fontSize: 30 * size }}>{name}</div>
      <div style={{ fontWeight: 500, fontSize: 22 * size, color: C.goldHi }}>{status}</div>
    </div>
  </div>
);

export const Avatar: React.FC<{ size: number; smile?: number; ring?: boolean }> = ({ size, smile = 0, ring = true }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <defs>
      <linearGradient id="av" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#F7EFDF" />
        <stop offset="1" stopColor="#E3D3B2" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#av)" stroke={ring ? C.gold : "none"} strokeWidth="3" />
    <circle cx="50" cy="40" r="17" fill={C.navy} />
    <path d="M18 86 C24 64, 76 64, 82 86" fill={C.navy} />
    {smile > 0 ? (
      <g opacity={smile}>
        <circle cx="44" cy="38" r="2.2" fill={C.cream} />
        <circle cx="56" cy="38" r="2.2" fill={C.cream} />
        <path d="M43 45 Q50 51 57 45" stroke={C.goldHi} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </g>
    ) : null}
  </svg>
);

// ------------------------------------------------------------------ icons (stroke, gold)

type IconProps = { size: number; color?: string; stroke?: number; progress?: number };

const Stroke: React.FC<IconProps & { d: string; len?: number; fill?: string }> = ({
  size,
  color = C.goldHi,
  stroke = 6,
  progress = 1,
  d,
  len = 400,
  fill,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible" }}>
    <path
      d={d}
      fill={fill ?? "none"}
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={len}
      strokeDashoffset={len * (1 - progress)}
    />
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} d="M50 8 L84 20 V48 C84 70 68 84 50 92 C32 84 16 70 16 48 V20 Z M34 50 L46 62 L68 38" len={420} />
);
export const HeartIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} d="M50 86 C22 66 10 50 10 34 C10 20 21 12 32 12 C41 12 47 18 50 25 C53 18 59 12 68 12 C79 12 90 20 90 34 C90 50 78 66 50 86 Z" len={300} />
);
export const BoltIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} d="M58 6 L22 56 H48 L40 94 L78 40 H52 Z" len={300} />
);
export const CheckIcon: React.FC<IconProps> = (p) => <Stroke {...p} d="M18 52 L40 74 L84 26" len={120} />;
export const DoubleCheck: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size * 1.4} height={size} viewBox="0 0 140 100">
    <path d="M10 55 L32 77 L76 30" stroke={color} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M52 70 L60 77 L104 30" stroke={color} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const EnvelopeIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} d="M12 26 H88 V76 H12 Z M12 28 L50 56 L88 28" len={330} />
);
export const ToothIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} d="M30 14 C18 14 12 24 14 38 C16 52 22 58 24 74 C26 88 34 90 37 78 C40 66 43 60 50 60 C57 60 60 66 63 78 C66 90 74 88 76 74 C78 58 84 52 86 38 C88 24 82 14 70 14 C62 14 57 19 50 19 C43 19 38 14 30 14 Z" len={360} />
);
export const CrossIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} d="M38 12 H62 V38 H88 V62 H62 V88 H38 V62 H12 V38 H38 Z" len={400} />
);
export const EyeIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} d="M6 50 C22 24 78 24 94 50 C78 76 22 76 6 50 Z M50 36 A14 14 0 1 1 49.9 36 Z" len={330} />
);
export const HairIcon: React.FC<IconProps> = (p) => (
  <Stroke {...p} d="M30 70 C24 46 30 22 50 18 C70 22 76 46 70 70 M40 62 C38 46 42 34 50 30 M60 62 C62 46 58 34 50 30 M22 86 H78" len={360} />
);

export const Coin: React.FC<{ size: number; spin: number }> = ({ size, spin }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 35% 30%, #FFF1C4 0%, ${C.goldHi} 30%, ${C.gold} 65%, #8E6A24 100%)`,
      boxShadow: `0 0 30px rgba(230,199,122,0.75), inset 0 -6px 12px rgba(0,0,0,0.25)`,
      transform: `rotateY(${spin}deg)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily,
      fontWeight: 800,
      fontSize: size * 0.5,
      color: "#7A5A1C",
    }}
  >
    ₺
  </div>
);

/** A circular gold badge holding an icon. */
export const IconBadge: React.FC<{ size: number; children: React.ReactNode; glow?: number }> = ({
  size,
  children,
  glow = 1,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: `3px solid rgba(230,199,122,0.85)`,
      background: "radial-gradient(circle at 50% 35%, rgba(201,162,75,0.22), rgba(6,19,37,0.9) 70%)",
      boxShadow: `0 0 ${40 * glow}px rgba(201,162,75,${0.45 * glow}), inset 0 0 30px rgba(201,162,75,0.15)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </div>
);

export const Label: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({
  children,
  size = 34,
  color = C.cream,
  style,
}) => (
  <div style={{ fontFamily, fontWeight: 700, fontSize: size, color, textAlign: "center", ...style }}>{children}</div>
);

export const Center: React.FC<{ x: number; y: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  x,
  y,
  children,
  style,
}) => (
  <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", ...style }}>{children}</div>
);

export { goldGlow };
