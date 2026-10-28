import React from 'react';
import {random} from 'remotion';
import {BgWord, C, Caption, Check, FONT, Flare, GOLD_GRAD, bf, easeInOut, easeOut, mix, pop, ramp} from './lib';
import {Avatar, ChatScreen, Phone} from './components';

// Scene 5 (beats 48–56): the patient's connection to the competitor thickens
// and an appointment assembles; every other connection, yours included, turns to dust.

const AV = {x: 540, y: 1190};
const PHONES = [
  {id: 'rakip', label: 'Rakibin', x: 235, y: 1000},
  {id: 'a', label: 'Klinik A', x: 860, y: 940},
  {id: 'c', label: 'Klinik C', x: 860, y: 1470},
  {id: 'sen', label: 'Sen', x: 225, y: 1480},
];
const CAL = {x: 540, y: 790, w: 200, h: 200};

export const SceneChoice: React.FC<{f: number}> = ({f}) => {
  const B = bf;
  const enter = ramp(f, -12, 16, easeOut);
  const out = ramp(f, B(7.4), B(8) + 12, easeInOut);
  const thick = ramp(f, B(0.8), B(3), easeInOut);
  const dissolve = ramp(f, B(1.5), B(4.5), easeOut);
  const fall = ramp(f, B(1.5), B(6), easeInOut);
  const gather = ramp(f, B(0.6), B(2), easeInOut);
  const calP = f >= B(2) ? pop(f, B(2), {damping: 10, stiffness: 150}) : 0;
  const checkP = ramp(f, B(2.2), B(2.9), easeOut);

  const phonePos = (p: (typeof PHONES)[number]) =>
    p.id === 'sen' ? {x: p.x - 20 * fall, y: p.y + 90 * fall, s: mix(0.3, 0.2, fall)} : {x: p.x, y: p.y, s: 0.3};

  const lines = PHONES.map((p) => {
    const pos = phonePos(p);
    if (p.id === 'rakip') {
      const w = 3 + 10 * thick;
      const pulses = [0, 1, 2].map((k) => ((f / 26 + k / 3) % 1));
      return (
        <g key={p.id}>
          <line x1={AV.x} y1={AV.y} x2={pos.x} y2={pos.y} stroke="rgba(230,199,122,0.35)" strokeWidth={w * 3} filter="url(#cglow2)" />
          <line x1={AV.x} y1={AV.y} x2={pos.x} y2={pos.y} stroke="url(#thickg)" strokeWidth={w} strokeLinecap="round" />
          {thick > 0.2 &&
            pulses.map((t, k) => (
              <circle key={k} cx={mix(AV.x, pos.x, t)} cy={mix(AV.y, pos.y, t)} r={6 + 6 * thick} fill="#FFF6DA" filter="url(#cglow2)" />
            ))}
          {/* link to the appointment */}
          <path
            d={`M${pos.x} ${pos.y - 100} Q ${pos.x + 40} ${CAL.y} ${CAL.x - CAL.w / 2} ${CAL.y}`}
            stroke={C.goldHi}
            strokeWidth={3}
            fill="none"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - ramp(f, B(2), B(3), easeOut)}
            filter="url(#cglow2)"
          />
        </g>
      );
    }
    // dissolving connection: dots that drift off as dust
    const n = 26;
    return (
      <g key={p.id}>
        {new Array(n).fill(0).map((_, i) => {
          const t = (i + 0.5) / n;
          const dx = (random(`${p.id}x${i}`) - 0.5) * 140 * dissolve;
          const dy = (random(`${p.id}y${i}`) - 0.2) * 160 * dissolve + 60 * dissolve * dissolve;
          const local = ramp(dissolve, t * 0.4, 0.5 + t * 0.5);
          return (
            <circle
              key={i}
              cx={mix(AV.x, pos.x, t) + dx}
              cy={mix(AV.y, pos.y, t) + dy}
              r={2.6 * (1 - local * 0.5)}
              fill={p.id === 'sen' ? '#9aa2b0' : C.goldHi}
              opacity={(1 - local) * 0.85}
            />
          );
        })}
      </g>
    );
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: enter * (1 - out),
        transform: `scale(${mix(0.7, 1, enter) + out * 0.5})`,
        filter: enter < 0.99 || out > 0.01 ? `blur(${((1 - enter) * 10 + out * 12).toFixed(1)}px)` : undefined,
      }}
    >
      <BgWord text="SEÇİM" f={f} y={1520} size={360} opacity={0.045} speed={0.7} x0={40} />
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id="thickg" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#FFF6DA" />
            <stop offset="0.5" stopColor="#E6C77A" />
            <stop offset="1" stopColor="#C9A24B" />
          </linearGradient>
          <filter id="cglow2" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        {lines}
      </svg>

      {PHONES.map((p) => {
        const pos = phonePos(p);
        const isSen = p.id === 'sen';
        const isRk = p.id === 'rakip';
        const g = isSen ? fall : p.id === 'rakip' ? 0 : dissolve * 0.6;
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              perspective: 1200,
              opacity: isSen ? 1 - 0.55 * fall : 1 - 0.45 * dissolve,
              filter: isSen && fall > 0.02 ? `blur(${(fall * 6).toFixed(1)}px)` : undefined,
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: 470,
                height: 960,
                transform: `translate(-50%, -50%) scale(${pos.s}) rotateY(${isRk ? 18 : -14}deg) rotateX(${isSen ? 25 * fall : 0}deg)`,
                transformStyle: 'preserve-3d',
              }}
            >
              <Phone grey={g}>
                <ChatScreen
                  f={f}
                  bubbleP={1}
                  grey={g}
                  reply={isRk ? {text: 'Merhaba! Hemen yardımcı olalım.', p: 1} : undefined}
                />
              </Phone>
            </div>
            <div
              style={{
                position: 'absolute',
                top: 960 * pos.s * 0.5 + 22,
                transform: 'translateX(-50%)',
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 30,
                letterSpacing: 4,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                color: isRk ? C.goldHi : g > 0.5 ? '#7d8698' : 'rgba(243,234,216,0.7)',
                textShadow: isRk ? '0 0 22px rgba(230,199,122,0.7)' : undefined,
              }}
            >
              {p.label}
            </div>
          </div>
        );
      })}

      <div style={{position: 'absolute', left: AV.x - 115, top: AV.y - 115}}>
        <Avatar f={f} size={230} glow={1 + thick * 0.4} />
      </div>

      {/* calendar assembling from particles */}
      {gather < 1 &&
        new Array(48).fill(0).map((_, i) => {
          const tx = CAL.x - CAL.w / 2 + (i % 8) * (CAL.w / 7);
          const ty = CAL.y - CAL.h / 2 + Math.floor(i / 8) * (CAL.h / 5);
          const sx = tx + (random(`cx${i}`) - 0.5) * 900;
          const sy = ty + (random(`cy${i}`) - 0.5) * 900;
          const e = ramp(gather, random(`cd${i}`) * 0.3, 0.7 + random(`cd${i}`) * 0.3, easeInOut);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: mix(sx, tx, e) - 4,
                top: mix(sy, ty, e) - 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#FFF1C8',
                boxShadow: '0 0 14px rgba(230,199,122,0.9)',
                opacity: gather > 0 ? 1 - ramp(f, B(2), B(2) + 6) : 0,
              }}
            />
          );
        })}
      {calP > 0 && (
        <div
          style={{
            position: 'absolute',
            left: CAL.x - CAL.w / 2,
            top: CAL.y - CAL.h / 2,
            width: CAL.w,
            height: CAL.h,
            transform: `scale(${calP}) rotateY(${(1 - calP) * 40}deg)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 30,
              overflow: 'hidden',
              background: 'linear-gradient(160deg, rgba(243,234,216,0.95), rgba(233,220,194,0.9))',
              boxShadow: '0 30px 70px rgba(0,0,0,0.5), 0 0 60px rgba(230,199,122,0.55)',
            }}
          >
            <div style={{height: 54, background: GOLD_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Caption color={C.navy} style={{fontSize: 18, letterSpacing: 4}}>
                Randevu
              </Caption>
            </div>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: CAL.h - 54}}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: C.navy,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 ${30 * checkP}px rgba(201,162,75,0.9)`,
                }}
              >
                <Check size={60} p={checkP} stroke={3.6} />
              </div>
            </div>
          </div>
          {[-58, 58].map((dx) => (
            <div key={dx} style={{position: 'absolute', top: -14, left: CAL.w / 2 + dx - 7, width: 14, height: 34, borderRadius: 7, background: GOLD_GRAD}} />
          ))}
          <div
            style={{
              position: 'absolute',
              top: CAL.h + 18,
              width: CAL.w,
              textAlign: 'center',
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 34,
              color: C.goldHi,
              opacity: checkP,
            }}
          >
            Randevu{' '}
            <span style={{display: 'inline-block', verticalAlign: '-4px'}}>
              <Check size={34} p={checkP} />
            </span>
          </div>
        </div>
      )}
      <Flare x={CAL.x} y={CAL.y} intensity={ramp(f, B(2), B(2) + 3) * (1 - ramp(f, B(2) + 3, B(3.5)))} size={0.8} />
    </div>
  );
};
