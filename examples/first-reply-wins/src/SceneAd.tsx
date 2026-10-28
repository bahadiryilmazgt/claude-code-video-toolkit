import React from 'react';
import {
  BgWord,
  C,
  Caption,
  Flare,
  FONT,
  GOLD_GRAD,
  Glass,
  LightSweep,
  bf,
  easeInOut,
  easeOut,
  mix,
  pop,
  ramp,
} from './lib';
import {Badge, ChatScreen, Phone} from './components';

// Scenes 1 + 2 (beats 0–20): the ad card rotates in, the CTA is tapped, a
// liquid-gold ripple morphs the card into a phone, camera pushes in on the chat.

const T_TAP = bf(9.5);
const T0 = bf(10); // morph start
const CARD = {w: 620, h: 860, r: 44};
const PHONE = {w: 470, h: 960, r: 72};
const CX = 540;
const CY = 1090;
const BTN = {x: 310, y: 738}; // button centre in card coords

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

const Spark: React.FC<{p: number}> = ({p}) => {
  const pts = [8, 14, 11, 22, 19, 31, 28, 44, 40, 58];
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * 24} ${64 - v}`).join(' ');
  return (
    <svg width={220} height={70} style={{overflow: 'visible'}}>
      <path d={d} fill="none" stroke={C.goldHi} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p}
        style={{filter: 'drop-shadow(0 0 6px rgba(230,199,122,0.8))'}} />
      <path d={`${d} L216 70 L0 70 Z`} fill="url(#sparkfill)" opacity={p} />
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.gold} stopOpacity="0.35" />
          <stop offset="1" stopColor={C.gold} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const Holo: React.FC<{
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  f: number;
  rim: number;
  out: number;
  children: React.ReactNode;
}> = ({x, y, z, w, h, f, rim, out, children}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y + Math.sin(f / 26 + x) * 10,
      width: w,
      height: h,
      transform: `translateZ(${z + out * 400}px)`,
      opacity: 1 - out,
    }}
  >
    <Glass w={w} h={h} r={24} rim={rim} rimStrength={0.6} tint={0.8}>
      <div style={{position: 'absolute', inset: 0, padding: '18px 22px'}}>{children}</div>
    </Glass>
  </div>
);

const AdContent: React.FC<{f: number}> = ({f}) => {
  const pulse = 0.5 + 0.5 * Math.sin((f / (60 * 30 / 105)) * Math.PI * 2 * 0.5);
  const tap = f >= T_TAP ? pop(f, T_TAP, {damping: 9, stiffness: 220}) : 0;
  const tapRing = ramp(f, T_TAP, T_TAP + 16, easeOut);
  return (
    <div style={{position: 'absolute', inset: 0, padding: 50, fontFamily: FONT}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <Caption color={C.goldHi}>Sağlık Turizmi</Caption>
        <div style={{fontSize: 18, fontWeight: 600, color: 'rgba(243,234,216,0.45)', letterSpacing: 1}}>Sponsorlu</div>
      </div>
      {/* emblem */}
      <div
        style={{
          marginTop: 40,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #1d3a63, #0B1F3A)',
          boxShadow: '0 0 40px rgba(230,199,122,0.35)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            padding: 4,
            background: `conic-gradient(from ${f * 2}deg, #8a6a25, #F6E3A8, #C9A24B, #8a6a25)`,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
          }}
        />
        <svg width={120} height={120} viewBox="0 0 120 120" style={{position: 'absolute', inset: 0}}>
          <defs>
            <linearGradient id="crossg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F6E3A8" />
              <stop offset="0.5" stopColor="#C9A24B" />
              <stop offset="1" stopColor="#8a6a25" />
            </linearGradient>
          </defs>
          <path
            d="M50 30 h20 a4 4 0 0 1 4 4 v16 h16 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-16 v16 a4 4 0 0 1 -4 4 h-20 a4 4 0 0 1 -4 -4 v-16 h-16 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 4 -4 h16 v-16 a4 4 0 0 1 4 -4z"
            fill="url(#crossg)"
          />
        </svg>
      </div>
      <div style={{marginTop: 34, color: C.cream, fontWeight: 800, fontSize: 62, lineHeight: 1.05, letterSpacing: -1}}>
        Estetik &amp;
        <br />
        <span style={{backgroundImage: GOLD_GRAD, WebkitBackgroundClip: 'text', color: 'transparent'}}>Diş Tedavisi</span>
      </div>
      <div style={{marginTop: 18, color: 'rgba(243,234,216,0.72)', fontWeight: 500, fontSize: 25}}>
        İstanbul · Kişiye özel tedavi planı
      </div>
      <div style={{marginTop: 34, display: 'flex', gap: 16}}>
        {[
          ['4,9/5', 'Puan'],
          ['12+', 'Yıl'],
          ['7/24', 'Destek'],
        ].map(([a, b]) => (
          <div
            key={b}
            style={{
              flex: 1,
              padding: '16px 0',
              borderRadius: 20,
              background: 'rgba(243,234,216,0.07)',
              border: '1px solid rgba(243,234,216,0.12)',
              textAlign: 'center',
            }}
          >
            <div style={{color: C.cream, fontWeight: 800, fontSize: 32}}>{a}</div>
            <div style={{color: 'rgba(243,234,216,0.55)', fontWeight: 600, fontSize: 17, letterSpacing: 2, textTransform: 'uppercase'}}>{b}</div>
          </div>
        ))}
      </div>
      {/* CTA button */}
      <div
        style={{
          position: 'absolute',
          left: 50,
          right: 50,
          top: BTN.y - 48,
          height: 96,
          borderRadius: 48,
          background: GOLD_GRAD,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.navy,
          fontWeight: 800,
          fontSize: 31,
          letterSpacing: 0.5,
          transform: `scale(${1 + 0.025 * pulse - 0.06 * Math.sin(Math.min(tap, 1) * Math.PI)})`,
          boxShadow: `0 0 ${30 + 30 * pulse}px rgba(230,199,122,${0.35 + 0.3 * pulse}), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(90,64,20,0.35)`,
          overflow: 'hidden',
        }}
      >
        Ücretsiz Danışmanlık
        <LightSweep p={((f % 60) / 60) * 1.2} width={120} strength={0.7} />
      </div>
      {tapRing > 0 && tapRing < 1 && (
        <div
          style={{
            position: 'absolute',
            left: BTN.x - 160 * tapRing,
            top: BTN.y - 160 * tapRing,
            width: 320 * tapRing,
            height: 320 * tapRing,
            borderRadius: '50%',
            border: `3px solid rgba(255,248,225,${1 - tapRing})`,
          }}
        />
      )}
    </div>
  );
};

export const SceneAd: React.FC<{f: number}> = ({f}) => {
  // --- camera ---
  const enter = pop(f, 2, {damping: 15, stiffness: 55, mass: 1.3});
  const m = ramp(f, T0 + 4, T0 + 32, easeInOut); // card → phone morph
  const push = ramp(f, bf(11), bf(12.8), easeInOut); // macro push-in on chat
  const creep = ramp(f, bf(12.8), bf(20), (t) => t);
  const zoom = 1 + 0.5 * push + 0.06 * creep;
  const camRy = Math.sin(f / 55) * 5 * (1 - push);
  const camRx = 4 + Math.cos(f / 70) * 2;

  // --- card / phone ---
  const cardRy = 62 * (1 - enter) - 24 * Math.sin(m * Math.PI);
  const cardScale = 0.45 + 0.55 * enter;
  const w = mix(CARD.w, PHONE.w, m);
  const h = mix(CARD.h, PHONE.h, m);
  const r = mix(CARD.r, PHONE.r, m);
  const cy = mix(CY, 1120, m);

  const adOpacity = 1 - ramp(f, T0, T0 + 14);
  const chatOpacity = ramp(f, T0 + 12, T0 + 30);
  const typing = f >= bf(11.75) && f < bf(13);
  const bubbleP = f >= bf(13) ? pop(f, bf(13), {damping: 11, stiffness: 140}) : 0;
  const badgeP = f >= bf(13.5) ? pop(f, bf(13.5), {damping: 8, stiffness: 180}) : 0;

  // liquid gold ripple from the button
  const rip = ramp(f, T0 - 3, T0 + 26, easeOut);
  const ripFade = 1 - ramp(f, T0 + 10, T0 + 30);

  // holo chips
  const count = ramp(f, bf(2), bf(5), easeOut);
  const holoIn = ramp(f, bf(1), bf(2.5), easeOut);
  const holoOut = ramp(f, T_TAP - 6, T0 + 8, easeInOut);
  const rim = f * 4;

  const flareI = ramp(f, 16, 34) * (1 - ramp(f, 40, 70)) * 0.9 + ramp(f, T0 + 2, T0 + 8) * (1 - ramp(f, T0 + 8, T0 + 26)) * 0.8;

  const out = 1 - ramp(f, bf(20) - 2, bf(20) + 12);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: out}}>
      <BgWord text="REKLAM" f={f} y={560} size={420} opacity={0.04 * (1 - m)} speed={0.9} x0={80} />
      <BgWord text="MESAJ" f={f - T0} y={1480} size={420} opacity={0.05 * m} speed={-0.7} x0={-420} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: 1800,
          perspectiveOrigin: '540px 1050px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1080,
            height: 1920,
            transformStyle: 'preserve-3d',
            transformOrigin: `540px 1120px`,
            transform: `translateY(${260 * push}px) scale(${zoom}) rotateX(${camRx}deg) rotateY(${camRy}deg)`,
          }}
        >
          {/* holographic analytics chips */}
          <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', opacity: holoIn}}>
            <Holo x={60} y={600} z={160} w={310} h={168} f={f} rim={rim + 120} out={holoOut}>
              <Caption style={{fontSize: 16, letterSpacing: 3}}>Görüntülenme</Caption>
              <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 40, color: C.cream, marginTop: 4}}>{fmt(12480 * count)}</div>
              <div style={{position: 'absolute', left: 22, bottom: 10}}>
                <Spark p={count} />
              </div>
            </Holo>
            <Holo x={720} y={1390} z={220} w={300} h={170} f={f + 40} rim={rim + 240} out={holoOut}>
              <Caption style={{fontSize: 16, letterSpacing: 3}}>Tıklama</Caption>
              <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 40, color: C.cream, marginTop: 4}}>{fmt(1236 * count)}</div>
              <div style={{display: 'flex', gap: 8, alignItems: 'flex-end', height: 50, marginTop: 6}}>
                {[0.3, 0.45, 0.4, 0.62, 0.7, 0.86, 1].map((v, i) => (
                  <div
                    key={i}
                    style={{
                      width: 22,
                      height: 50 * v * ramp(count, i * 0.08, 0.5 + i * 0.07),
                      borderRadius: 4,
                      background: i === 6 ? GOLD_GRAD : 'rgba(243,234,216,0.35)',
                    }}
                  />
                ))}
              </div>
            </Holo>
            <Holo x={800} y={820} z={90} w={230} h={110} f={f + 80} rim={rim} out={holoOut}>
              <Caption style={{fontSize: 14, letterSpacing: 2}}>Tıklama oranı</Caption>
              <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 36, color: C.goldHi, marginTop: 2}}>
                %{(9.9 * count).toFixed(1).replace('.', ',')}
              </div>
            </Holo>
          </div>

          {/* the card that becomes the phone */}
          <div
            style={{
              position: 'absolute',
              left: CX - w / 2,
              top: cy - h / 2,
              width: w,
              height: h,
              transformStyle: 'preserve-3d',
              transform: `scale(${cardScale}) rotateY(${cardRy}deg) rotateX(${Math.sin(f / 45) * 3 * (1 - m)}deg)`,
            }}
          >
            <Phone w={w} h={h} r={r} frame={m}>
              <Glass w={w} h={h} r={r} rim={rim} rimStrength={0.9 * (1 - m)} style={{left: 0, top: 0, boxShadow: 'none'}}>
                <div style={{position: 'absolute', inset: 0, opacity: adOpacity}}>
                  <AdContent f={f} />
                </div>
              </Glass>
              {/* liquid gold ripple */}
              {rip > 0 && ripFade > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: ripFade,
                    background: `radial-gradient(circle at ${BTN.x}px ${BTN.y}px, rgba(230,199,122,0) ${rip * 1100 - 260}px, rgba(201,162,75,0.85) ${rip * 1100 - 120}px, rgba(255,240,200,0.95) ${rip * 1100 - 40}px, rgba(201,162,75,0.6) ${rip * 1100}px, rgba(201,162,75,0) ${rip * 1100 + 60}px)`,
                    mixBlendMode: 'screen',
                  }}
                />
              )}
              <div style={{position: 'absolute', inset: 0, opacity: chatOpacity}}>
                <ChatScreen f={f} typing={typing} bubbleP={bubbleP} />
                <div style={{position: 'absolute', left: 330, top: 262}}>
                  <Badge p={badgeP} size={64} />
                </div>
              </div>
              <LightSweep p={ramp(f, 40, 66)} width={200} strength={0.35} />
              <LightSweep p={ramp(f, bf(13.2), bf(14.6))} width={180} strength={0.25} />
            </Phone>
          </div>
        </div>
      </div>
      <Flare x={CX + 250} y={CY - 380} intensity={flareI} size={0.9} />
    </div>
  );
};
