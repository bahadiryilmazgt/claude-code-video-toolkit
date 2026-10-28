import React from 'react';
import {C, FONT, GOLD_GRAD, BRUSHED_GOLD, Check, pop} from './lib';

export const PATIENT_MSG = 'Merhaba, fiyat bilgisi alabilir miyim?';

/** Generic chat bubble (no real messenger branding). */
export const Bubble: React.FC<{
  text: string;
  side?: 'in' | 'out';
  width?: number;
  fontSize?: number;
  time?: string;
  grey?: number;
  style?: React.CSSProperties;
}> = ({text, side = 'in', width = 330, fontSize = 26, time = '14:02', grey = 0, style}) => (
  <div
    style={{
      position: 'relative',
      width,
      padding: `${fontSize * 0.7}px ${fontSize * 0.85}px ${fontSize * 0.55}px`,
      borderRadius: fontSize * 1.1,
      borderBottomLeftRadius: side === 'in' ? fontSize * 0.25 : fontSize * 1.1,
      borderBottomRightRadius: side === 'out' ? fontSize * 0.25 : fontSize * 1.1,
      background:
        side === 'in'
          ? `linear-gradient(170deg, #FBF5E9 0%, ${C.cream} 60%, #E9DCC2 100%)`
          : 'linear-gradient(170deg, rgba(230,199,122,0.95) 0%, rgba(201,162,75,0.95) 100%)',
      color: C.navy,
      fontFamily: FONT,
      fontWeight: 600,
      fontSize,
      lineHeight: 1.3,
      boxShadow: '0 18px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.8)',
      filter: grey > 0 ? `grayscale(${grey}) brightness(${1 - grey * 0.35})` : undefined,
      ...style,
    }}
  >
    {text}
    <div style={{textAlign: 'right', fontSize: fontSize * 0.55, fontWeight: 600, opacity: 0.55, marginTop: fontSize * 0.2}}>
      {time}
    </div>
  </div>
);

export const TypingDots: React.FC<{f: number; size?: number}> = ({f, size = 26}) => (
  <div
    style={{
      display: 'inline-flex',
      gap: size * 0.35,
      padding: `${size * 0.6}px ${size * 0.8}px`,
      borderRadius: size * 1.1,
      borderBottomLeftRadius: size * 0.25,
      background: 'rgba(243,234,216,0.92)',
      boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
    }}
  >
    {[0, 1, 2].map((i) => {
      const ph = Math.sin((f - i * 4) / 3.2);
      return (
        <div
          key={i}
          style={{
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: '50%',
            background: C.navy,
            opacity: 0.35 + 0.45 * Math.max(0, ph),
            transform: `translateY(${-Math.max(0, ph) * size * 0.28}px)`,
          }}
        />
      );
    })}
  </div>
);

/** Abstract patient silhouette (head + shoulders). */
export const Silhouette: React.FC<{size: number; color?: string}> = ({size, color = C.cream}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <defs>
      <linearGradient id={`sil${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity="1" />
        <stop offset="1" stopColor={color} stopOpacity="0.55" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="38" r="17" fill={`url(#sil${color.replace('#', '')})`} />
    <path d="M18 92 C18 68 32 58 50 58 C68 58 82 68 82 92 Z" fill={`url(#sil${color.replace('#', '')})`} />
  </svg>
);

/** Patient avatar: glowing gold-rimmed orb. */
export const Avatar: React.FC<{f: number; size?: number; glow?: number}> = ({f, size = 230, glow = 1}) => (
  <div style={{position: 'relative', width: size, height: size}}>
    <div
      style={{
        position: 'absolute',
        inset: -size * 0.6,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(230,199,122,${0.35 * glow}) 0%, rgba(201,162,75,${0.12 * glow}) 35%, rgba(201,162,75,0) 65%)`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #1d3a63 0%, #0B1F3A 55%, #061325 100%)',
        boxShadow: `0 0 ${60 * glow}px rgba(230,199,122,${0.5 * glow}), inset 0 0 40px rgba(230,199,122,0.25)`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <Silhouette size={size * 0.92} />
    </div>
    {/* rotating rim */}
    <div
      style={{
        position: 'absolute',
        inset: -6,
        borderRadius: '50%',
        padding: 5,
        background: `conic-gradient(from ${f * 3}deg, #8a6a25, #F6E3A8, #C9A24B, #7d5f22, #E6C77A, #8a6a25)`,
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    />
  </div>
);

/** Chat screen content shown inside a phone. Design size 430 x 900. */
export const ChatScreen: React.FC<{
  f: number;
  typing?: boolean;
  bubbleP?: number; // 0..1 spring progress of the incoming bubble
  reply?: {text: string; p: number};
  title?: string;
  grey?: number;
}> = ({f, typing = false, bubbleP = 0, reply, title = 'Yeni Hasta', grey = 0}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, #0f2747 0%, #0B1F3A 40%, #081a31 100%)',
      fontFamily: FONT,
      overflow: 'hidden',
      filter: grey > 0 ? `grayscale(${grey})` : undefined,
    }}
  >
    {/* subtle pattern */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'radial-gradient(rgba(230,199,122,0.07) 1.5px, transparent 1.5px)',
        backgroundSize: '26px 26px',
      }}
    />
    {/* header */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 150,
        padding: '70px 26px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'linear-gradient(180deg, rgba(243,234,216,0.1), rgba(243,234,216,0.04))',
        borderBottom: '1px solid rgba(243,234,216,0.12)',
      }}
    >
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%, #2a4a78, #0B1F3A)',
          border: `2px solid ${C.gold}`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Silhouette size={54} />
      </div>
      <div>
        <div style={{color: C.cream, fontWeight: 700, fontSize: 26}}>{title}</div>
        <div style={{color: C.goldHi, fontWeight: 500, fontSize: 18, opacity: 0.9}}>
          {typing ? 'yazıyor…' : 'çevrimiçi'}
        </div>
      </div>
    </div>
    {/* date chip */}
    <div
      style={{
        position: 'absolute',
        top: 190,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 16px',
        borderRadius: 14,
        background: 'rgba(243,234,216,0.08)',
        color: 'rgba(243,234,216,0.6)',
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: 2,
      }}
    >
      BUGÜN
    </div>
    {/* typing indicator */}
    {typing && (
      <div style={{position: 'absolute', left: 24, top: 360}}>
        <TypingDots f={f} />
      </div>
    )}
    {/* incoming bubble */}
    {bubbleP > 0 && (
      <div
        style={{
          position: 'absolute',
          left: 24,
          top: 290,
          transformOrigin: '0% 100%',
          transform: `translateY(${(1 - bubbleP) * 60}px) scale(${0.6 + 0.4 * bubbleP})`,
          opacity: Math.min(1, bubbleP * 2),
        }}
      >
        <Bubble text={PATIENT_MSG} width={340} fontSize={27} />
      </div>
    )}
    {reply && reply.p > 0 && (
      <div
        style={{
          position: 'absolute',
          right: 24,
          top: 470,
          transformOrigin: '100% 100%',
          transform: `translateY(${(1 - reply.p) * 50}px) scale(${0.6 + 0.4 * reply.p})`,
          opacity: Math.min(1, reply.p * 2),
        }}
      >
        <Bubble text={reply.text} side="out" width={320} fontSize={25} time="14:04" />
      </div>
    )}
    {/* input bar */}
    <div
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 34,
        height: 70,
        borderRadius: 35,
        background: 'rgba(243,234,216,0.08)',
        border: '1px solid rgba(243,234,216,0.14)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px 0 26px',
        color: 'rgba(243,234,216,0.4)',
        fontSize: 21,
        fontWeight: 500,
      }}
    >
      <span style={{flex: 1}}>Mesaj yaz…</span>
      <div style={{width: 52, height: 52, borderRadius: '50%', background: GOLD_GRAD}} />
    </div>
  </div>
);

/**
 * Phone with a true 3D brushed-gold body (stacked layers in preserve-3d).
 * Design size 470 x 960; scale with CSS. Parent needs `perspective`.
 */
export const Phone: React.FC<{
  w?: number;
  h?: number;
  r?: number;
  depth?: number;
  frame?: number; // 0..1 how much of the gold frame is visible (morph)
  children?: React.ReactNode;
  style?: React.CSSProperties;
  grey?: number;
}> = ({w = 470, h = 960, r = 72, depth = 1, frame = 1, children, style, grey = 0}) => {
  const layers = 12;
  const metal = grey > 0.5 ? 'linear-gradient(115deg,#3a4250,#6b7586 40%,#454d5b 70%,#2e3440)' : BRUSHED_GOLD;
  return (
    <div style={{position: 'absolute', width: w, height: h, transformStyle: 'preserve-3d', ...style}}>
      {new Array(layers).fill(0).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: r,
            background: metal,
            transform: `translateZ(${-(i + 1) * 2.6 * depth}px)`,
            filter: `brightness(${0.55 + 0.35 * (1 - i / layers)})`,
            opacity: frame,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: r,
          padding: 12 * frame,
          boxShadow: `0 50px 100px rgba(0,0,0,0.5), 0 0 50px rgba(201,162,75,${0.25 * frame})`,
        }}
      >
        <div style={{position: 'absolute', inset: 0, borderRadius: r, background: metal, opacity: frame}} />
        <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: r - 10 * frame, overflow: 'hidden'}}>
          {children}
          {/* glass reflection */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(125deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 28%, rgba(255,255,255,0) 45%)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

/** Gold notification badge. */
export const Badge: React.FC<{p: number; size?: number; n?: string}> = ({p, size = 70, n = '1'}) =>
  p <= 0 ? null : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: GOLD_GRAD,
        transform: `scale(${p})`,
        boxShadow: `0 0 ${40 * p}px rgba(230,199,122,0.8), inset 0 2px 0 rgba(255,255,255,0.6)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: size * 0.5,
        color: C.navy,
      }}
    >
      {n}
    </div>
  );

/** Small glass reply card used on the race track. */
export const ReplyCard: React.FC<{label: string; text: string; checkP: number; grey?: number; w?: number}> = ({
  label,
  text,
  checkP,
  grey = 0,
  w = 300,
}) => {
  const g = grey;
  return (
    <div
      style={{
        width: w,
        padding: '22px 24px',
        borderRadius: 28,
        background: `linear-gradient(160deg, rgba(243,234,216,${0.22 - g * 0.1}) 0%, rgba(243,234,216,${0.08 - g * 0.04}) 100%)`,
        border: `2px solid ${g > 0.5 ? 'rgba(91,101,119,0.8)' : 'rgba(230,199,122,0.75)'}`,
        boxShadow: `0 30px 60px rgba(0,0,0,0.45), 0 0 ${40 * (1 - g)}px rgba(230,199,122,${0.35 * (1 - g)})`,
        fontFamily: FONT,
        filter: g > 0 ? `grayscale(${g})` : undefined,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{color: g > 0.5 ? '#8a93a3' : C.goldHi, fontWeight: 800, fontSize: 26, letterSpacing: 3, textTransform: 'uppercase'}}>
          {label}
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: checkP > 0 ? 'rgba(230,199,122,0.18)' : 'rgba(243,234,216,0.08)',
            boxShadow: checkP > 0 ? `0 0 ${30 * checkP}px rgba(230,199,122,0.8)` : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={28} p={checkP} />
        </div>
      </div>
      <div style={{marginTop: 12, color: g > 0.5 ? '#9aa2b0' : C.cream, fontWeight: 600, fontSize: 22, lineHeight: 1.3}}>{text}</div>
    </div>
  );
};

export const springIn = pop;
