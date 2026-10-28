import React from 'react';
import {random} from 'remotion';
import {BgWord, C, FONT, Flare, GOLD_GRAD, bf, easeInOut, easeOut, mix, pop, ramp} from './lib';
import {ReplyCard} from './components';

// Scene 4 (beats 32–48): a gold race track in depth. The competitor's reply
// shoots to "2 dk"; yours greys out and only arrives at "3 saat".
// All beat numbers below are relative to the scene start.

const PW = 900;
const PH = 1800;
const START_Y = 1600;
const LANES = {rakip: 235, sen: 665};
const MARKS: [string, number, number][] = [
  // label, minutes, plane y
  ['1 dk', 1, 1390],
  ['5 dk', 5, 1150],
  ['30 dk', 30, 900],
  ['1 saat', 60, 640],
  ['3 saat', 180, 330],
];
const STOPS: [number, number][] = [[0, START_Y], [1, 1390], [2, 1310], [5, 1150], [30, 900], [60, 640], [180, 330]];

const yForMinutes = (m: number) => {
  for (let i = 1; i < STOPS.length; i++) {
    const [m0, y0] = STOPS[i - 1];
    const [m1, y1] = STOPS[i];
    if (m <= m1) {
      const t = m0 === 0 ? m / m1 : Math.log(m / m0) / Math.log(m1 / m0);
      return mix(y0, y1, Math.max(0, t));
    }
  }
  return STOPS[STOPS.length - 1][1];
};

/** simulated minutes since the patient's message */
const minutesAt = (f: number) => {
  const b = f / bf(1);
  if (b < 1) return 0;
  if (b < 5) return 2 * ((b - 1) / 4);
  if (b < 11) return 2 * Math.pow(90, easeIn2((b - 5) / 6));
  return 180;
};
const easeIn2 = (t: number) => t * t * (0.6 + 0.4 * t);

const fmtMin = (m: number) => {
  const mm = Math.round(m);
  if (mm < 60) return `${mm} dk`;
  const h = Math.floor(mm / 60);
  const r = mm % 60;
  return r ? `${h} saat ${r} dk` : `${h} saat`;
};

const Clock: React.FC<{f: number; minutes: number; opacity: number}> = ({f, minutes, opacity}) => {
  const r = 115;
  const minAng = minutes * 6;
  const hourAng = minutes * 0.5 + 0;
  const sweep = f * 9 + minutes * 40;
  return (
    <div style={{position: 'absolute', left: 540 - r - 20, top: 610 - r - 20, opacity}}>
      <svg width={2 * r + 40} height={2 * r + 40} viewBox={`${-r - 20} ${-r - 20} ${2 * r + 40} ${2 * r + 40}`}>
        <defs>
          <radialGradient id="clockglass">
            <stop offset="0" stopColor="#F3EAD8" stopOpacity="0.12" />
            <stop offset="0.8" stopColor="#F3EAD8" stopOpacity="0.05" />
            <stop offset="1" stopColor="#E6C77A" stopOpacity="0.2" />
          </radialGradient>
          <linearGradient id="clockrim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F6E3A8" />
            <stop offset="0.5" stopColor="#8a6a25" />
            <stop offset="1" stopColor="#E6C77A" />
          </linearGradient>
          <filter id="cglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle r={r} fill="url(#clockglass)" stroke="url(#clockrim)" strokeWidth={5} />
        <circle r={r - 14} fill="none" stroke="rgba(230,199,122,0.25)" strokeWidth={1} />
        {new Array(60).fill(0).map((_, i) => {
          const a = (i * 6 * Math.PI) / 180;
          const big = i % 5 === 0;
          const r0 = r - (big ? 30 : 22);
          return (
            <line
              key={i}
              x1={Math.sin(a) * r0}
              y1={-Math.cos(a) * r0}
              x2={Math.sin(a) * (r - 16)}
              y2={-Math.cos(a) * (r - 16)}
              stroke={big ? C.goldHi : 'rgba(243,234,216,0.35)'}
              strokeWidth={big ? 3 : 1.5}
            />
          );
        })}
        {/* sweep glow */}
        <path
          d={`M0 0 L${Math.sin((sweep * Math.PI) / 180) * (r - 18)} ${-Math.cos((sweep * Math.PI) / 180) * (r - 18)}`}
          stroke="rgba(230,199,122,0.35)"
          strokeWidth={2}
        />
        <line x1={0} y1={0} x2={Math.sin((hourAng * Math.PI) / 180) * 60} y2={-Math.cos((hourAng * Math.PI) / 180) * 60} stroke={C.cream} strokeWidth={8} strokeLinecap="round" />
        <line x1={0} y1={0} x2={Math.sin((minAng * Math.PI) / 180) * 98} y2={-Math.cos((minAng * Math.PI) / 180) * 98} stroke={C.goldHi} strokeWidth={5} strokeLinecap="round" filter="url(#cglow)" />
        <circle r={9} fill={C.goldHi} />
      </svg>
    </div>
  );
};

/** card that stands upright on the tilted plane */
const Standing: React.FC<{x: number; y: number; pitch: number; children: React.ReactNode; w: number; h: number}> = ({
  x,
  y,
  pitch,
  children,
  w,
  h,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x - w / 2,
      top: y - h,
      width: w,
      height: h,
      transformOrigin: '50% 100%',
      transform: `rotateX(${-pitch}deg)`,
      transformStyle: 'preserve-3d',
    }}
  >
    {children}
  </div>
);

export const SceneRace: React.FC<{f: number}> = ({f}) => {
  const B = (b: number) => bf(b);
  const minutes = minutesAt(f);
  const build = ramp(f, -4, 18, easeOut);
  const rise = ramp(f, B(11.6), B(14.6), easeInOut);
  const pitch = mix(58, 36, rise);
  const camX = Math.sin(f / 40) * 50 * (1 - rise) + mix(-40, 0, ramp(f, 0, B(11)));
  const camZ = mix(0, -260, rise) + (1 - build) * 500;
  const camY = mix(0, 40, rise);
  const roll = mix(-3, 0, ramp(f, 0, B(6))) * (1 - rise);
  const out = ramp(f, B(15.6), B(16) + 12, easeInOut);

  // competitor
  const rkGo = f >= B(4.5) ? pop(f, B(4.5), {damping: 13, stiffness: 110}) : 0;
  const rkY = mix(START_Y, 1310, rkGo);
  const rkCheck = ramp(f, B(5), B(5) + 10);
  const burst = ramp(f, B(5), B(5) + 22, easeOut);

  // you
  const grey = ramp(f, B(5.5), B(9.5));
  const senGo = ramp(f, B(9.6), B(11), easeInOut);
  const senY = mix(START_Y, 330, senGo);
  const lateP = f >= B(11) ? pop(f, B(11), {damping: 9, stiffness: 170}) : 0;

  const cursorY = yForMinutes(minutes);
  const cursorOn = ramp(f, B(1), B(1.5)) * (1 - ramp(f, B(11), B(12)));

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 1 - out,
        transform: `scale(${1 + out * 0.6})`,
        filter: out > 0.01 ? `blur(${out * 14}px)` : undefined,
      }}
    >
      <BgWord text="ZAMAN" f={f} y={300} size={360} opacity={0.04} speed={1.2} x0={120} />
      <div style={{position: 'absolute', inset: 0, perspective: 1100, perspectiveOrigin: '540px 700px'}}>
        <div
          style={{
            position: 'absolute',
            left: (1080 - PW) / 2,
            top: 1900 - PH,
            width: PW,
            height: PH,
            transformOrigin: '50% 100%',
            transformStyle: 'preserve-3d',
            transform: `translate3d(${camX}px, ${camY}px, ${camZ}px) rotateX(${pitch}deg) rotateZ(${roll}deg)`,
          }}
        >
          {/* track surface */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 40,
              background:
                'linear-gradient(0deg, rgba(243,234,216,0.07) 0%, rgba(243,234,216,0.02) 60%, rgba(243,234,216,0) 100%)',
              opacity: build,
            }}
          />
          {/* lane lines */}
          {[0, 450, 900].map((x, i) => (
            <div
              key={x}
              style={{
                position: 'absolute',
                left: x - (i === 1 ? 2 : 3),
                bottom: 0,
                width: i === 1 ? 4 : 6,
                height: PH * build,
                background: `linear-gradient(0deg, ${C.goldHi} 0%, rgba(201,162,75,0.7) 60%, rgba(201,162,75,0) 100%)`,
                boxShadow: '0 0 24px rgba(230,199,122,0.7)',
                opacity: i === 1 ? 0.45 : 1,
              }}
            />
          ))}
          {/* start line */}
          <div style={{position: 'absolute', left: 0, width: PW, top: START_Y, height: 6, background: GOLD_GRAD, opacity: build, boxShadow: '0 0 30px rgba(230,199,122,0.8)'}} />
          {/* lane names */}
          {(
            [
              ['RAKİBİN', LANES.rakip, C.goldHi],
              ['SEN', LANES.sen, C.cream],
            ] as const
          ).map(([t, x, col]) => (
            <div
              key={t}
              style={{
                position: 'absolute',
                left: x - 200,
                width: 400,
                top: START_Y + 40,
                textAlign: 'center',
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: 64,
                letterSpacing: 8,
                color: col,
                opacity: build,
              }}
            >
              {t}
            </div>
          ))}
          {/* markers */}
          {MARKS.map(([label, , y], i) => {
            const on = ramp(f, 4 + i * 3, 16 + i * 3, easeOut);
            const passed = cursorY <= y + 2 && f > B(1);
            return (
              <React.Fragment key={label}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: PW * on,
                    top: y - 1,
                    height: 3,
                    background: passed
                      ? 'linear-gradient(90deg, rgba(230,199,122,0.9), rgba(230,199,122,0.5))'
                      : 'linear-gradient(90deg, rgba(243,234,216,0.35), rgba(243,234,216,0.12))',
                  }}
                />
                <Standing x={PW + 40} y={y + 30} pitch={pitch} w={200} h={80}>
                  <div
                    style={{
                      width: 200,
                      height: 72,
                      borderRadius: 36,
                      background: passed ? 'rgba(230,199,122,0.2)' : 'rgba(243,234,216,0.08)',
                      border: `2px solid ${passed ? C.goldHi : 'rgba(243,234,216,0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: FONT,
                      fontWeight: 800,
                      fontSize: 34,
                      color: passed ? C.goldHi : C.cream,
                      opacity: on,
                      boxShadow: passed ? '0 0 30px rgba(230,199,122,0.5)' : undefined,
                    }}
                  >
                    {label}
                  </div>
                </Standing>
              </React.Fragment>
            );
          })}
          {/* time cursor */}
          <div
            style={{
              position: 'absolute',
              left: -20,
              width: PW + 40,
              top: cursorY - 4,
              height: 8,
              borderRadius: 4,
              background: 'linear-gradient(90deg, rgba(255,246,218,0), #FFF6DA 20%, #FFF6DA 80%, rgba(255,246,218,0))',
              boxShadow: '0 0 40px 10px rgba(230,199,122,0.55)',
              opacity: cursorOn,
            }}
          />
          {/* competitor trail */}
          {rkGo > 0 && (
            <div
              style={{
                position: 'absolute',
                left: LANES.rakip - 70,
                width: 140,
                top: rkY,
                height: Math.max(0, START_Y - rkY),
                background: 'linear-gradient(180deg, rgba(255,246,218,0.9) 0%, rgba(230,199,122,0.45) 30%, rgba(201,162,75,0) 100%)',
                filter: 'blur(8px)',
                opacity: 1 - ramp(f, B(6), B(9)) * 0.6,
              }}
            />
          )}
          {/* competitor card */}
          <Standing x={LANES.rakip} y={rkY} pitch={pitch} w={380} h={250}>
            <div style={{position: 'absolute', bottom: 20, left: 0, opacity: build}}>
              <ReplyCard label="Rakibin" text="Merhaba! Hemen yardımcı olalım." checkP={rkCheck} w={380} />
            </div>
            {burst > 0 &&
              burst < 1 &&
              new Array(22).fill(0).map((_, i) => {
                const a = random(`b${i}`) * Math.PI * 2;
                const d = (120 + random(`d${i}`) * 220) * burst;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: 190 + Math.cos(a) * d,
                      top: 110 + Math.sin(a) * d * 0.7 + burst * burst * 60,
                      width: 10 + random(`s${i}`) * 10,
                      height: 10 + random(`s${i}`) * 10,
                      borderRadius: i % 3 ? '50%' : 2,
                      transform: `rotate(${i * 40 + burst * 200}deg)`,
                      background: i % 2 ? C.goldHi : '#FFF6DA',
                      boxShadow: '0 0 12px rgba(230,199,122,0.9)',
                      opacity: 1 - burst,
                    }}
                  />
                );
              })}
          </Standing>
          {/* your card */}
          <Standing x={LANES.sen} y={senY} pitch={pitch} w={380} h={320}>
            <div style={{position: 'absolute', inset: 0, transformOrigin: '50% 100%', transform: `scale(${1 + 1.1 * senGo})`}}>
            <div style={{position: 'absolute', bottom: 20, left: 0, opacity: build * (1 - grey * 0.35)}}>
              <ReplyCard label="Sen" text={senGo > 0.98 ? 'Merhaba, size nasıl yardımcı olabiliriz?' : '…'} checkP={0} grey={grey} w={380} />
              {/* settling dust */}
              {grey > 0 &&
                new Array(16).fill(0).map((_, i) => {
                  const fall = ramp(f, B(5.5) + i * 4, B(5.5) + i * 4 + 40, easeOut);
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: 20 + random(`dx${i}`) * 340,
                        top: -140 + fall * 138,
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: 'rgba(180,186,198,0.8)',
                        opacity: fall > 0 ? 0.8 : 0,
                      }}
                    />
                  );
                })}
            </div>
            {lateP > 0 && (
              <div
                style={{
                  position: 'absolute',
                  right: -30,
                  top: -10,
                  padding: '12px 26px',
                  borderRadius: 30,
                  background: C.red,
                  color: C.cream,
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: 34,
                  transform: `scale(${lateP * 1.3}) rotate(-4deg)`,
                  boxShadow: '0 0 30px rgba(192,86,75,0.6)',
                  whiteSpace: 'nowrap',
                }}
              >
                Geç kaldın
              </div>
            )}
            </div>
          </Standing>
        </div>
      </div>
      <Clock f={f} minutes={minutes} opacity={build * (1 - rise * 0.85)} />
      <div
        style={{
          position: 'absolute',
          top: 745,
          width: 1080,
          textAlign: 'center',
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 36,
          letterSpacing: 2,
          color: minutes >= 179 ? C.red : C.goldHi,
          opacity: cursorOn * (1 - rise),
          textShadow: '0 0 20px rgba(0,0,0,0.6)',
        }}
      >
        +{fmtMin(minutes)}
      </div>
      <Flare x={420} y={1500} intensity={ramp(f, B(5), B(5) + 4) * (1 - ramp(f, B(5) + 4, B(6.5)))} size={0.9} />
    </div>
  );
};
