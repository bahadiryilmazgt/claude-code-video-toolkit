import React from 'react';
import {random} from 'remotion';
import {Arrow, C, Caption, FONT, Flare, GOLD_GRAD, LightSweep, bf, easeInOut, easeOut, mix, ramp} from './lib';
import {Emblem} from './SceneWhy';

// Scene 7 (beats 68–80): the emblem bursts into a 3D chart — response time dives,
// appointments climb — on a glossy navy floor while the camera orbits.

const PLOT = {w: 860, h: 520};
const N = 6;
const RANDEVU = [14, 19, 27, 38, 52, 71];
const YANIT = [180, 90, 35, 12, 5, 2]; // minutes
const slotX = (i: number) => 70 + i * ((PLOT.w - 140) / (N - 1));
const barH = (v: number) => (v / 80) * (PLOT.h - 70);
const curveY = (m: number) => 40 + (1 - Math.log(m + 1) / Math.log(201)) * (PLOT.h - 120);

const smoothPath = (pts: {x: number; y: number}[]) => {
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = {x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6};
    const c2 = {x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6};
    d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
};

export const ScenePayoff: React.FC<{f: number}> = ({f}) => {
  const B = bf;
  const burst = ramp(f, B(0.3), B(1.6), easeOut);
  const embScale = 1 + 0.25 * ramp(f, 0, B(0.3), easeInOut);
  const embOpacity = 1 - ramp(f, B(0.3), B(0.7));
  const build = ramp(f, B(0.5), B(1.6), easeOut);
  const orbit = mix(-24, 16, ramp(f, B(0.5), B(12), easeInOut));
  const curveP = ramp(f, B(1.2), B(4.5), easeInOut);
  const out = ramp(f, B(12) - 4, B(12) + 24, easeInOut);

  const pts = YANIT.map((m, i) => ({x: slotX(i), y: curveY(m)}));
  const head = Math.min(N - 1, curveP * (N - 1));
  const hi = Math.floor(head);
  const hp = {x: mix(pts[hi].x, pts[Math.min(N - 1, hi + 1)].x, head - hi), y: mix(pts[hi].y, pts[Math.min(N - 1, hi + 1)].y, head - hi)};

  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* emblem → burst */}
      {embOpacity > 0 && (
        <div style={{position: 'absolute', inset: 0, opacity: embOpacity, transform: `scale(${embScale})`, transformOrigin: '540px 1060px'}}>
          <Emblem f={f + bf(12)} p={1} />
        </div>
      )}
      {burst > 0 &&
        burst < 1 &&
        new Array(46).fill(0).map((_, i) => {
          const a = random(`pa${i}`) * Math.PI * 2;
          const d = (200 + random(`pd${i}`) * 700) * burst;
          const s = 6 + random(`ps${i}`) * 14;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 540 + Math.cos(a) * d - s / 2,
                top: 1060 + Math.sin(a) * d - s / 2,
                width: s,
                height: s,
                borderRadius: '50%',
                background: i % 3 ? '#FFF1C8' : C.goldHi,
                boxShadow: '0 0 16px rgba(230,199,122,0.9)',
                opacity: 1 - burst,
              }}
            />
          );
        })}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: 1700,
          perspectiveOrigin: '540px 1150px',
          opacity: build * (1 - out),
          transform: `scale(${1 - out * 0.7}) rotate(${out * 140}deg)`,
          transformOrigin: '540px 1120px',
          filter: out > 0.01 ? `blur(${out * 6}px)` : undefined,
        }}
      >
        {/* glossy floor */}
        <div
          style={{
            position: 'absolute',
            left: -300,
            width: 1680,
            top: 1380,
            height: 900,
            transformOrigin: '50% 0%',
            transform: `rotateX(78deg) rotateZ(${orbit * 0.6}deg)`,
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(230,199,122,0.22) 0%, rgba(11,31,58,0.0) 70%), repeating-linear-gradient(90deg, rgba(230,199,122,0.12) 0 2px, transparent 2px 120px), repeating-linear-gradient(0deg, rgba(230,199,122,0.12) 0 2px, transparent 2px 120px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: (1080 - PLOT.w) / 2,
            top: 800,
            width: PLOT.w,
            height: PLOT.h + 110,
            transformStyle: 'preserve-3d',
            transform: `rotateY(${orbit}deg) rotateX(4deg) scale(${0.85 + 0.15 * build})`,
          }}
        >
          {/* legend */}
          <div style={{display: 'flex', gap: 34, justifyContent: 'center', alignItems: 'center', height: 50}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div style={{width: 46, height: 6, borderRadius: 3, background: GOLD_GRAD, boxShadow: '0 0 12px rgba(230,199,122,0.8)'}} />
              <Caption color={C.goldHi} style={{fontSize: 20, letterSpacing: 3}}>
                Yanıt süresi
              </Caption>
              <Arrow dir="down" size={26} color={C.goldHi} />
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div style={{width: 22, height: 22, borderRadius: 5, background: 'rgba(243,234,216,0.8)'}} />
              <Caption color={C.cream} style={{fontSize: 20, letterSpacing: 3}}>
                Randevu
              </Caption>
              <Arrow dir="up" size={26} color={C.cream} />
            </div>
          </div>
          {/* plot */}
          <div
            style={{
              position: 'relative',
              marginTop: 20,
              width: PLOT.w,
              height: PLOT.h,
              borderRadius: 30,
              background: 'linear-gradient(170deg, rgba(243,234,216,0.09), rgba(243,234,216,0.02))',
              border: '1px solid rgba(243,234,216,0.15)',
              WebkitBoxReflect: 'below 8px linear-gradient(transparent 62%, rgba(255,255,255,0.22))',
              overflow: 'hidden',
            }}
          >
            {[1, 2, 3, 4].map((g) => (
              <div key={g} style={{position: 'absolute', left: 30, right: 30, top: (PLOT.h - 30) * (g / 5), height: 1, background: 'rgba(243,234,216,0.08)'}} />
            ))}
            {RANDEVU.map((v, i) => {
              const g = ramp(f, B(1.4 + i * 0.35), B(2.6 + i * 0.35), easeOut);
              const h = barH(v) * g;
              return (
                <React.Fragment key={i}>
                  <div
                    style={{
                      position: 'absolute',
                      left: slotX(i) - 38,
                      bottom: 50,
                      width: 76,
                      height: h,
                      borderRadius: '14px 14px 4px 4px',
                      background: 'linear-gradient(90deg, rgba(243,234,216,0.55), rgba(243,234,216,0.85) 40%, rgba(243,234,216,0.45))',
                      boxShadow: '0 0 30px rgba(243,234,216,0.15), inset 0 2px 0 rgba(255,255,255,0.8)',
                    }}
                  >
                    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 8, borderRadius: '14px 14px 0 0', background: GOLD_GRAD}} />
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      left: slotX(i) - 50,
                      width: 100,
                      bottom: 60 + h,
                      textAlign: 'center',
                      fontFamily: FONT,
                      fontWeight: 800,
                      fontSize: 28,
                      color: C.cream,
                      opacity: g,
                    }}
                  >
                    {Math.round(v * g)}
                  </div>
                  <div style={{position: 'absolute', left: slotX(i) - 50, width: 100, bottom: 14, textAlign: 'center', fontFamily: FONT, fontWeight: 600, fontSize: 19, color: 'rgba(243,234,216,0.5)'}}>
                    {i + 1}. ay
                  </div>
                </React.Fragment>
              );
            })}
            <svg width={PLOT.w} height={PLOT.h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
              <defs>
                <filter id="pglow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="7" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="pcurve" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#8a93a3" />
                  <stop offset="0.35" stopColor="#C9A24B" />
                  <stop offset="1" stopColor="#FFF1C8" />
                </linearGradient>
              </defs>
              <path d={smoothPath(pts)} fill="none" stroke="url(#pcurve)" strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - curveP} filter="url(#pglow)" />
              {curveP > 0 && curveP < 1 && <circle cx={hp.x} cy={hp.y} r={14} fill="#FFF6DA" filter="url(#pglow)" />}
            </svg>
            {/* curve end labels */}
            <div style={{position: 'absolute', left: slotX(0) - 20, top: curveY(180) - 62, fontFamily: FONT, fontWeight: 800, fontSize: 26, color: '#8a93a3', opacity: ramp(curveP, 0, 0.1)}}>
              3 saat
            </div>
            <div
              style={{
                position: 'absolute',
                left: slotX(N - 1) - 70,
                top: curveY(2) - 70,
                padding: '6px 16px',
                borderRadius: 20,
                background: GOLD_GRAD,
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 26,
                color: C.navy,
                opacity: ramp(curveP, 0.9, 1),
                transform: `scale(${0.6 + 0.4 * ramp(curveP, 0.9, 1)})`,
                boxShadow: '0 0 30px rgba(230,199,122,0.7)',
              }}
            >
              2 dk
            </div>
            <LightSweep p={ramp(f, B(5.4), B(7))} width={220} strength={0.4} />
          </div>
        </div>
      </div>
      <Flare x={540} y={1060} intensity={ramp(f, B(0.25), B(0.45)) * (1 - ramp(f, B(0.45), B(2)))} size={1.2} />
    </div>
  );
};
