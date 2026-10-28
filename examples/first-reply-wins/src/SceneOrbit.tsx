import React from 'react';
import {BgWord, C, Caption, Flare, bf, easeInOut, easeOut, mix, pop, ramp} from './lib';
import {Avatar, Badge, ChatScreen, Phone} from './components';

// Scene 3 (beats 20–32): pull back from "your" phone to reveal four phones
// orbiting the patient; one message fans out to all of them as gold light.

export const ORB = {cx: 540, cy: 1060, R: 330, P: 1500, tilt: 1.0, phoneScale: 0.36};

export const CLINICS = [
  {label: 'Sen', base: 90, you: true},
  {label: 'Klinik A', base: 180, you: false},
  {label: 'Klinik B', base: 270, you: false},
  {label: 'Klinik C', base: 0, you: false},
];

export const project = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  const x3 = ORB.R * Math.cos(a);
  const z3 = ORB.R * Math.sin(a);
  const s = ORB.P / (ORB.P - z3);
  return {x: ORB.cx + x3 * s, y: ORB.cy + z3 * ORB.tilt * s, z: z3, s, a};
};

// beats are relative to the scene start (beat 20)
const LAUNCH = bf(2.5);
// arrival order: A, B, C, then "Sen" last (pops land on beats 23, 23.5, 24, 24.5)
const ARRIVE: Record<string, number> = {'Klinik A': bf(3), 'Klinik B': bf(3.5), 'Klinik C': bf(4), Sen: bf(4.5)};

export const SceneOrbit: React.FC<{f: number}> = ({f}) => {
  const fadeIn = ramp(f, -10, 4);
  const fadeOut = 1 - ramp(f, bf(12) - 6, bf(12) + 8);
  const pull = ramp(f, 0, 44, easeInOut);
  const orbit = 90 * ramp(f, bf(6), bf(10.5), easeInOut) + f * 0.06;

  const items = CLINICS.map((c) => ({...c, ...project(c.base + orbit)}));
  const sen = project(90); // camera pulls back from the starting position of "Sen"
  const Z = mix(3.4, 1, pull);
  const dy = mix(1380 - sen.y, 0, pull);

  const glowPulse = f >= LAUNCH - 8 ? Math.exp(-(((f - LAUNCH) / 10) ** 2)) : 0;
  const nodes: {z: number; el: React.ReactNode}[] = [];

  nodes.push({
    z: 0,
    el: (
      <div key="avatar" style={{position: 'absolute', left: ORB.cx - 115, top: ORB.cy - 115}}>
        <Avatar f={f} size={230} glow={1 + glowPulse * 1.2} />
        <Caption style={{position: 'absolute', top: 262, width: 230, textAlign: 'center'}} color={C.goldHi}>
          Hasta
        </Caption>
      </div>
    ),
  });

  items.forEach((it) => {
    const arrive = ARRIVE[it.label];
    const got = f >= arrive ? pop(f, arrive, {damping: 10, stiffness: 160}) : 0;
    const flash = f >= arrive ? Math.exp(-((f - arrive) / 8)) : 0;
    const sc = ORB.phoneScale * it.s;
    const blur = Math.max(0, -it.z / ORB.R) * 5;
    const ry = -Math.cos(it.a) * 24;
    nodes.push({
      z: it.z,
      el: (
        <div
          key={it.label}
          style={{
            position: 'absolute',
            left: it.x,
            top: it.y,
            perspective: 1200,
            filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined,
            opacity: 0.55 + 0.45 * ((it.z + ORB.R) / (2 * ORB.R)),
          }}
        >
          <div style={{position: 'absolute', transform: `translate(-50%, -50%) scale(${sc}) rotateY(${ry}deg)`, transformStyle: 'preserve-3d', width: 470, height: 960}}>
            <Phone>
              <ChatScreen f={f} bubbleP={it.you ? 1 : got} title="Yeni Hasta" />
              <div style={{position: 'absolute', inset: 0, background: `rgba(255,240,200,${flash * 0.35})`}} />
            </Phone>
            <div style={{position: 'absolute', right: -28, top: -28, transform: 'translateZ(2px)'}}>
              <Badge p={it.you ? 1 : got} size={110} />
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              top: 960 * sc * 0.5 + 26,
              left: 0,
              transform: 'translateX(-50%)',
              fontFamily: 'Montserrat',
              fontWeight: 800,
              fontSize: 34 * it.s,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: it.you ? C.goldHi : 'rgba(243,234,216,0.8)',
              textShadow: it.you ? '0 0 20px rgba(230,199,122,0.6)' : undefined,
              whiteSpace: 'nowrap',
            }}
          >
            {it.label}
          </div>
        </div>
      ),
    });
  });

  // gold light streams carrying the duplicated message
  const streams = items.map((it) => {
    const arrive = ARRIVE[it.label];
    const p = ramp(f, LAUNCH, arrive, easeOut);
    const fade = 1 - ramp(f, arrive, arrive + 18);
    if (p <= 0 || fade <= 0) return null;
    const x0 = ORB.cx;
    const y0 = ORB.cy;
    const x1 = it.x;
    const y1 = it.y;
    const cx = (x0 + x1) / 2 + (y1 - y0) * 0.25;
    const cy = (y0 + y1) / 2 - 240;
    const d = `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`;
    const q = (t: number) => ({
      x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1,
      y: (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1,
    });
    const head = q(p);
    const len = 0.45;
    return (
      <g key={it.label} opacity={fade}>
        <path d={d} stroke="rgba(230,199,122,0.18)" strokeWidth={2} fill="none" />
        <path
          d={d}
          stroke="url(#streamg)"
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          pathLength={1}
          strokeDasharray={`${Math.min(len, p)} 2`}
          strokeDashoffset={-(p - Math.min(len, p))}
          filter="url(#glow)"
        />
        <circle cx={head.x} cy={head.y} r={14} fill="#FFF6DA" filter="url(#glow)" opacity={p < 1 ? 1 : 0} />
      </g>
    );
  });

  nodes.sort((a, b) => a.z - b.z);
  const back = nodes.filter((n) => n.z < 0);
  const front = nodes.filter((n) => n.z >= 0);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: fadeIn * fadeOut}}>
      <BgWord text="AYNI ANDA" f={f} y={1500} size={300} opacity={0.045} speed={0.8} x0={60} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: `${ORB.cx}px ${sen.y}px`,
          transform: `translateY(${dy}px) scale(${Z})`,
        }}
      >
        {/* orbit ring */}
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
          <defs>
            <linearGradient id="streamg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#C9A24B" stopOpacity="0" />
              <stop offset="0.6" stopColor="#E6C77A" />
              <stop offset="1" stopColor="#FFF6DA" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <ellipse
            cx={ORB.cx}
            cy={ORB.cy + 20}
            rx={ORB.R * 1.12}
            ry={ORB.R * ORB.tilt * 1.05}
            fill="none"
            stroke="rgba(230,199,122,0.35)"
            strokeWidth={2}
            strokeDasharray="4 14"
            strokeDashoffset={-f * 1.5}
          />
          <ellipse cx={ORB.cx} cy={ORB.cy + 20} rx={ORB.R * 1.12} ry={ORB.R * ORB.tilt * 1.05} fill="none" stroke="rgba(230,199,122,0.12)" strokeWidth={10} filter="url(#glow)" />
        </svg>
        {back.map((n) => n.el)}
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          {streams}
        </svg>
        {front.map((n) => n.el)}
      </div>
      <Flare x={ORB.cx} y={ORB.cy} intensity={glowPulse * 0.8} size={0.8} />
    </div>
  );
};
