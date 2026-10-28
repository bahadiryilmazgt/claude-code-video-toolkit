import React from 'react';
import {Img, random, staticFile} from 'remotion';
import {Beams, C, FONT, Flare, GOLD_GRAD, LightSweep, bf, easeInOut, easeOut, mix, pop, ramp} from './lib';
import {BRAND} from './brand';

// Scene 8 (beats 80–93): everything is pulled into a spinning ring of liquid gold
// that slows and opens like a portal onto the logo; dust settles in light beams.

const CX = 540;
const CY = 1130;

export const SceneEnding: React.FC<{f: number}> = ({f}) => {
  const B = bf;
  const form = pop(f, 0, {damping: 14, stiffness: 70});
  const t = Math.max(0, f) / 30;
  const spin = 1100 * (1 - Math.exp(-t / 0.9)) + f * 0.4;
  const open = ramp(f, B(3.2), B(5), easeInOut);
  const logoP = f >= B(3.8) ? pop(f, B(3.8), {damping: 13, stiffness: 90}) : 0;
  const dia = mix(560, 1900, open);
  const thick = mix(46, 6, open);
  const settle = ramp(f, B(3.5), B(8));

  return (
    <div style={{position: 'absolute', inset: 0}}>
      {/* portal interior: deeper navy with beams and falling dust */}
      <div
        style={{
          position: 'absolute',
          left: CX - dia / 2,
          top: CY - dia / 2,
          width: dia,
          height: dia,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'radial-gradient(circle, #0d2545 0%, #071a33 55%, #061325 100%)',
          opacity: ramp(f, 0, B(1)) * (1 - ramp(f, B(5), B(6.5)) * 0.6),
        }}
      />
      <div style={{position: 'absolute', inset: 0, opacity: open}}>
        <Beams f={f} opacity={1} angle={8} />
      </div>
      {/* swirl of particles being pulled into the ring */}
      {f < B(3.5) &&
        new Array(60).fill(0).map((_, i) => {
          const a0 = random(`sa${i}`) * Math.PI * 2;
          const r0 = 380 + random(`sr${i}`) * 700;
          const pull = ramp(f, random(`sd${i}`) * B(1), B(1.5) + random(`sd${i}`) * B(1.5), easeInOut);
          const r = mix(r0, 280, pull);
          const a = a0 + pull * 3.2;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: CX + Math.cos(a) * r,
                top: CY + Math.sin(a) * r,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#FFF1C8',
                boxShadow: '0 0 12px rgba(230,199,122,0.9)',
                opacity: pull < 1 ? 0.9 : 0,
              }}
            />
          );
        })}
      {/* liquid gold ring */}
      <div
        style={{
          position: 'absolute',
          left: CX - dia / 2,
          top: CY - dia / 2,
          width: dia,
          height: dia,
          borderRadius: '50%',
          transform: `scale(${0.2 + 0.8 * form}) rotate(${spin}deg)`,
          background:
            'conic-gradient(from 0deg, #7d5f22, #F6E3A8 10%, #C9A24B 22%, #FFF6DA 30%, #8a6a25 45%, #E6C77A 60%, #F6E3A8 72%, #7d5f22 85%, #C9A24B 100%)',
          WebkitMask: `radial-gradient(circle, transparent ${dia / 2 - thick}px, #000 ${dia / 2 - thick + 2}px, #000 ${dia / 2 - 2}px, transparent ${dia / 2}px)`,
          filter: `drop-shadow(0 0 30px rgba(230,199,122,0.8))`,
          opacity: 1 - ramp(open, 0.7, 1),
        }}
      />
      {/* falling dust */}
      {new Array(50).fill(0).map((_, i) => {
        const x = random(`fx${i}`) * 1080;
        const speed = 0.6 + random(`fs${i}`) * 1.4;
        const y = ((random(`fy${i}`) * 1900 + f * speed * 2) % 1900) + 0;
        const s = 3 + random(`fz${i}`) * 6;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.sin(f / 30 + i) * 12,
              top: y,
              width: s,
              height: s,
              borderRadius: '50%',
              background: '#F6E3A8',
              boxShadow: '0 0 10px rgba(230,199,122,0.8)',
              opacity: open * (0.3 + 0.5 * random(`fo${i}`)) * (1 - settle * 0.3),
              filter: s > 7 ? 'blur(2px)' : undefined,
            }}
          />
        );
      })}
      {/* thin halo ring that stays around the logo */}
      <div
        style={{
          position: 'absolute',
          left: CX - 230,
          top: CY - 10 - 230,
          width: 460,
          height: 460,
          borderRadius: '50%',
          transform: `scale(${0.9 + 0.1 * logoP}) rotate(${f * 0.6}deg)`,
          background: 'conic-gradient(from 0deg, rgba(230,199,122,0), rgba(246,227,168,0.95) 25%, rgba(230,199,122,0) 50%, rgba(246,227,168,0.6) 75%, rgba(230,199,122,0))',
          WebkitMask: 'radial-gradient(circle, transparent 227px, #000 228px, #000 230px, transparent 231px)',
          opacity: Math.min(1, logoP),
        }}
      />
      {/* logo */}
      {logoP > 0 && (
        <div
          style={{
            position: 'absolute',
            left: CX - 300,
            top: CY - 170,
            width: 600,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: `scale(${0.85 + 0.15 * logoP})`,
            opacity: Math.min(1, logoP * 1.4),
          }}
        >
          <div style={{position: 'relative', width: 320, height: 320, borderRadius: '50%', overflow: 'hidden', boxShadow: '0 0 80px rgba(230,199,122,0.45)'}}>
            {BRAND.logoFile ? (
              <Img src={staticFile(BRAND.logoFile)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
            ) : (
              <>
                <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from ${f}deg, #7d5f22, #F6E3A8, #C9A24B, #8a6a25, #F1D894, #7d5f22)`}} />
                <div style={{position: 'absolute', inset: 10, borderRadius: '50%', background: 'radial-gradient(circle at 40% 30%, #1d3a63, #0B1F3A 60%, #061325)'}} />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONT,
                    fontWeight: 800,
                    fontSize: 70,
                    letterSpacing: 4,
                    backgroundImage: GOLD_GRAD,
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {BRAND.monogram}
                </div>
              </>
            )}
            <LightSweep p={ramp(f, B(6), B(7.6))} width={120} strength={0.7} />
          </div>
          <div style={{position: 'relative', marginTop: 40, fontFamily: FONT, fontWeight: 700, fontSize: 52, color: C.cream, letterSpacing: 1, overflow: 'hidden', padding: '0 10px'}}>
            {BRAND.handle}
            <LightSweep p={ramp(f, B(6.4), B(8))} width={90} strength={0.6} />
          </div>
        </div>
      )}
      <Flare x={CX} y={CY - 280} intensity={ramp(f, B(3.6), B(4)) * (1 - ramp(f, B(4), B(6))) * 0.9 + ramp(f, B(6), B(6.6)) * (1 - ramp(f, B(6.6), B(8))) * 0.5} size={1} />
    </div>
  );
};
