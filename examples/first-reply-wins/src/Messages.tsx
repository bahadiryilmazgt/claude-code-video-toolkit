import React from 'react';
import {useCurrentFrame} from 'remotion';
import timeline from './timeline.json';
import {Arrow, C, FONT, bf, goldText, pop, ramp, W} from './lib';

// Main messages are one overlay layer above all scenes, driven by the shared
// beat timeline, so readability (size, safe zone, hold time) is guaranteed
// independent of what the camera is doing underneath.
//
// Markup: *gold*  ~red~  {up} {down}

type Run = {text: string; style: 'plain' | 'gold' | 'red' | 'up' | 'down'};

const parseLine = (line: string): Run[][] => {
  const runs: Run[] = [];
  const re = /\*([^*]+)\*|~([^~]+)~|\{(up|down)\}|([^*~{]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) runs.push({text: m[1], style: 'gold'});
    else if (m[2]) runs.push({text: m[2], style: 'red'});
    else if (m[3]) runs.push({text: '', style: m[3] as 'up' | 'down'});
    else runs.push({text: m[4], style: 'plain'});
  }
  // split runs into words (a word may contain several styled runs, e.g. "*mesajlar*?")
  const words: Run[][] = [[]];
  for (const r of runs) {
    if (r.style === 'up' || r.style === 'down') {
      words[words.length - 1].push(r);
      continue;
    }
    const parts = r.text.split(' ');
    parts.forEach((p, i) => {
      if (i > 0) words.push([]);
      if (p) words[words.length - 1].push({text: p, style: r.style});
    });
  }
  return words.filter((w) => w.length);
};

const RunSpan: React.FC<{r: Run; size: number; lf: number}> = ({r, size, lf}) => {
  if (r.style === 'up') return <Arrow dir="up" size={size} color={C.goldHi} />;
  if (r.style === 'down') return <Arrow dir="down" size={size} color={C.goldHi} />;
  if (r.style === 'gold')
    return (
      <span
        style={{
          ...goldText(0.2 + lf / 90),
          filter: 'drop-shadow(0 0 18px rgba(230,199,122,0.45)) drop-shadow(0 2px 0 rgba(90,64,20,0.6))',
        }}
      >
        {r.text}
      </span>
    );
  if (r.style === 'red')
    return <span style={{color: C.red, textShadow: '0 0 26px rgba(192,86,75,0.55)'}}>{r.text}</span>;
  return <span>{r.text}</span>;
};

export const Messages: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <>
      {timeline.messages.map((m, idx) => {
        const a = bf(m.in);
        const b = bf(m.out);
        if (f < a || f > b) return null;
        const lf = f - a;
        const exit = ramp(f, b - 8, b);
        const lines = m.lines.map(parseLine);
        const big = (m as {bigLast?: number}).bigLast ?? 1;
        let wi = 0;
        return (
          <div key={idx} style={{position: 'absolute', left: 0, top: 0, width: W, height: 0}}>
            {/* legibility scrim */}
            <div
              style={{
                position: 'absolute',
                left: -100,
                width: W + 200,
                top: m.y - 300,
                height: 600,
                background: 'radial-gradient(50% 50% at 50% 50%, rgba(6,19,37,0.62) 0%, rgba(6,19,37,0) 100%)',
                opacity: Math.min(1, lf / 8) * (1 - exit),
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 60,
                width: W - 120,
                top: m.y,
                transform: `translateY(-50%) translateY(${-34 * exit}px)`,
                textAlign: 'center',
                fontFamily: FONT,
                fontWeight: 800,
                color: C.cream,
                lineHeight: 1.1,
                letterSpacing: -1,
                opacity: 1 - exit,
                filter: exit > 0 ? `blur(${(exit * 10).toFixed(1)}px)` : undefined,
                textShadow: '0 6px 40px rgba(2,8,18,0.6)',
              }}
            >
              {lines.map((words, li) => {
                const size = m.size * (li === lines.length - 1 ? big : 1);
                return (
                  <div key={li} style={{fontSize: size, whiteSpace: 'nowrap'}}>
                    {words.map((w, j) => {
                      const s = wi++ * 2.5;
                      const p = pop(lf, s, {damping: 14, stiffness: 150});
                      const t = Math.max(0, lf - s);
                      const blur = Math.max(0, 12 * (1 - t / 9));
                      return (
                        <span
                          key={j}
                          style={{
                            display: 'inline-block',
                            marginRight: j < words.length - 1 ? size * 0.26 : 0,
                            transform: `translateY(${(1 - p) * 60}px) scale(${0.92 + 0.08 * p})`,
                            opacity: Math.min(1, t / 6),
                            filter: blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : undefined,
                          }}
                        >
                          {w.map((r, k) => (
                            <RunSpan key={k} r={r} size={size} lf={lf} />
                          ))}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
};
