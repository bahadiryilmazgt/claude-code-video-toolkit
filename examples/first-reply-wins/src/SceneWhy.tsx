import React from 'react';
import {random} from 'remotion';
import {C, FONT, Flare, LightSweep, bf, easeInOut, easeOut, mix, pop, ramp} from './lib';

// Scene 6 (beats 56–68): fly through a corridor of glass panels; three icons are
// poured from liquid gold on pedestals of light, then fuse into one emblem.

export const ICONS = {
  shield: 'M50 6 L86 20 V48 C86 72 70 88 50 96 C30 88 14 72 14 48 V20 Z',
  heart:
    'M50 90 C20 68 7 52 7 33 C7 18 18 8 32 8 C40 8 46 12 50 20 C54 12 60 8 68 8 C82 8 93 18 93 33 C93 52 80 68 50 90 Z',
  bolt: 'M60 4 L18 56 H46 L36 96 L84 40 H55 Z',
};

const ITEMS = [
  {key: 'shield', label: 'Güven', cap: 'Hasta güven arar', x: 200},
  {key: 'heart', label: 'İlgi', cap: 'İlgi hissetmek ister', x: 540},
  {key: 'bolt', label: 'Doğru an', cap: 'Merak en yüksekken cevap ver', x: 880},
] as const;

const ICON_Y = 1060;

export const GoldDefs: React.FC<{id: string}> = ({id}) => (
  <defs>
    <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#FFF1C8" />
      <stop offset="0.25" stopColor="#E6C77A" />
      <stop offset="0.55" stopColor="#B08A3A" />
      <stop offset="0.8" stopColor="#F1D894" />
      <stop offset="1" stopColor="#7d5f22" />
    </linearGradient>
    <radialGradient id={`${id}spec`} cx="0.35" cy="0.25" r="0.5">
      <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
      <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
    </radialGradient>
    <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b" />
      <feMerge>
        <feMergeNode in="b" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

/** Icon sculpted from liquid gold: outline draws, then gold rises inside with a wavy surface. */
const LiquidIcon: React.FC<{d: string; p: number; f: number; size: number; id: string}> = ({d, p, f, size, id}) => {
  const outline = ramp(p, 0, 0.35);
  const fill = ramp(p, 0.15, 1, easeInOut);
  const L = 104 - 108 * fill;
  const amp = 5 * (1 - fill) + 0.5;
  const ph = f / 4;
  const wave = `M-10 ${L} C 15 ${L - amp * Math.sin(ph)} 35 ${L + amp * Math.sin(ph)} 50 ${L} S 85 ${L - amp * Math.cos(ph)} 110 ${L} V110 H-10 Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow: 'visible'}}>
      <GoldDefs id={id} />
      <clipPath id={`${id}clip`}>
        <path d={wave} />
      </clipPath>
      <path d={d} fill="rgba(230,199,122,0.08)" stroke="#E6C77A" strokeWidth={1.6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outline} filter={`url(#${id}glow)`} />
      <g clipPath={`url(#${id}clip)`}>
        <path d={d} fill={`url(#${id}g)`} />
        <path d={d} fill={`url(#${id}spec)`} />
      </g>
    </svg>
  );
};

export const Emblem: React.FC<{f: number; p: number}> = ({f, p}) => {
  const s = 340;
  return (
    <div style={{position: 'absolute', left: 540 - s / 2, top: ICON_Y - s / 2, width: s, height: s, transform: `scale(${p})`}}>
      {/* rays */}
      <div
        style={{
          position: 'absolute',
          inset: -220,
          borderRadius: '50%',
          background: `repeating-conic-gradient(from ${f * 0.8}deg, rgba(230,199,122,0.12) 0deg 4deg, rgba(230,199,122,0) 4deg 18deg)`,
          WebkitMaskImage: 'radial-gradient(circle, #000 25%, transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `conic-gradient(from ${f * 2}deg, #7d5f22, #F6E3A8, #C9A24B, #8a6a25, #F1D894, #7d5f22)`,
          boxShadow: '0 0 90px rgba(230,199,122,0.6), 0 30px 60px rgba(0,0,0,0.5)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 22,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 30%, #1d3a63, #0B1F3A 60%, #061325)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)',
        }}
      />
      <svg width={s} height={s} viewBox="0 0 100 100" style={{position: 'absolute', inset: 0}}>
        <GoldDefs id="emb" />
        <g transform="translate(22 20) scale(0.56)">
          <path d={ICONS.shield} fill="none" stroke="url(#embg)" strokeWidth={5} />
          <g transform="translate(22 24) scale(0.56)">
            <path d={ICONS.heart} fill="url(#embg)" />
            <g transform="translate(26 22) scale(0.5)">
              <path d={ICONS.bolt} fill="#0B1F3A" />
            </g>
          </g>
        </g>
      </svg>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden'}}>
        <LightSweep p={ramp(f, bf(7), bf(8.2))} width={140} strength={0.5} />
      </div>
    </div>
  );
};

export const SceneWhy: React.FC<{f: number}> = ({f}) => {
  const B = bf;
  const fly = ramp(f, -14, B(2.2), easeOut);
  const travel = 4200 * fly + f * 3;
  const enter = ramp(f, -14, 6);
  const merge = ramp(f, B(5.5), B(6.4), easeInOut);
  const embP = f >= B(6.1) ? pop(f, B(6.1), {damping: 10, stiffness: 120}) : 0;
  const out = ramp(f, B(12), B(12) + 3);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: enter * (1 - out)}}>
      {/* corridor of glass panels */}
      <div style={{position: 'absolute', inset: 0, perspective: 900, perspectiveOrigin: '540px 760px', opacity: 1 - ramp(f, B(1.6), B(3.2)) * 0.85}}>
        {new Array(14).fill(0).map((_, k) => {
          const left = k % 2 === 0;
          const z = -k * 520 + travel - 4600;
          if (z > 850 || z < -6000) return null;
          const fadeNear = 1 - ramp(z, 300, 850);
          const words = ['GÜVEN', 'İLGİ', 'HIZ', 'ZAMAN', 'CEVAP', 'HASTA', 'RANDEVU'];
          return (
            <div
              key={k}
              style={{
                position: 'absolute',
                left: left ? -60 : 860,
                top: 640 + random(`py${k}`) * 260,
                width: 280,
                height: 560,
                borderRadius: 30,
                transform: `translateZ(${z}px) rotateY(${left ? 62 : -62}deg)`,
                background: 'linear-gradient(160deg, rgba(243,234,216,0.16), rgba(243,234,216,0.04))',
                border: '1.5px solid rgba(230,199,122,0.5)',
                boxShadow: '0 0 40px rgba(230,199,122,0.15)',
                opacity: fadeNear * ramp(z, -6000, -3500),
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 60,
                  left: 24,
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: 64,
                  color: 'transparent',
                  WebkitTextStroke: '1.5px rgba(230,199,122,0.55)',
                  writingMode: 'vertical-rl',
                }}
              >
                {words[k % words.length]}
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{position: 'absolute', left: 140, top: 80 + i * 46, height: 6, width: 40 + random(`w${k}${i}`) * 80, borderRadius: 3, background: 'rgba(243,234,216,0.25)'}} />
              ))}
            </div>
          );
        })}
      </div>

      {/* pedestals + icons */}
      {ITEMS.map((it, i) => {
        const t0 = B(0.7 + 1.5 * i);
        const p = ramp(f, t0, t0 + B(0.8));
        const appear = ramp(f, t0 - 10, t0 + 4, easeOut);
        const ix = mix(it.x, 540, merge);
        const iy = mix(ICON_Y, ICON_Y, merge);
        const sc = mix(1, 0.35, merge);
        const iconOpacity = 1 - ramp(merge, 0.6, 1);
        const labelOpacity = ramp(f, t0 + 6, t0 + 18) * (1 - ramp(f, B(5.1), B(5.7)));
        const bob = Math.sin(f / 18 + i) * 8 * (1 - merge);
        return (
          <React.Fragment key={it.key}>
            {/* pedestal of light */}
            <div style={{position: 'absolute', left: it.x - 130, top: ICON_Y + 90, width: 260, height: 70, opacity: appear * (1 - merge)}}>
              <div style={{position: 'absolute', left: 30, right: 30, bottom: 30, height: 520, background: 'linear-gradient(0deg, rgba(230,199,122,0.35), rgba(230,199,122,0))', filter: 'blur(14px)'}} />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(255,241,200,0.7) 0%, rgba(230,199,122,0.3) 45%, rgba(230,199,122,0) 70%)',
                  border: '2px solid rgba(230,199,122,0.6)',
                  boxShadow: '0 0 40px rgba(230,199,122,0.5)',
                }}
              />
            </div>
            <div
              style={{
                position: 'absolute',
                left: ix - 90,
                top: iy - 90 + bob,
                transform: `scale(${sc * (0.7 + 0.3 * appear)})`,
                opacity: appear * iconOpacity,
                filter: `drop-shadow(0 0 ${20 + 30 * Math.exp(-(((f - t0 - B(0.8)) / 8) ** 2))}px rgba(230,199,122,0.55))`,
              }}
            >
              <LiquidIcon d={ICONS[it.key]} p={p} f={f + i * 20} size={180} id={`ic${it.key}`} />
            </div>
            <div style={{position: 'absolute', left: it.x - 170, width: 340, top: ICON_Y + 170, textAlign: 'center', opacity: labelOpacity, fontFamily: FONT}}>
              <div style={{fontWeight: 800, fontSize: 46, color: C.cream}}>{it.label}</div>
              <div style={{marginTop: 10, fontWeight: 500, fontSize: 24, lineHeight: 1.3, color: 'rgba(243,234,216,0.7)', padding: '0 24px'}}>{it.cap}</div>
            </div>
          </React.Fragment>
        );
      })}

      {embP > 0 && <Emblem f={f} p={embP} />}
      <Flare x={540} y={ICON_Y} intensity={ramp(f, B(6), B(6.2)) * (1 - ramp(f, B(6.2), B(7.5)))} size={1.1} />
    </div>
  );
};
