import React from 'react';
import {bf} from './lib';

// Light-leak flashes that glue the bigger scene changes together.
const LEAKS: {beat: number; len: number; x: number; strength: number}[] = [
  {beat: 10, len: 14, x: 300, strength: 0.35},
  {beat: 32, len: 10, x: 760, strength: 0.75},
  {beat: 48, len: 14, x: 280, strength: 0.45},
  {beat: 56, len: 16, x: 820, strength: 0.4},
  {beat: 68.3, len: 12, x: 540, strength: 0.5},
  {beat: 80, len: 18, x: 300, strength: 0.35},
];

export const TransitionFX: React.FC<{f: number}> = ({f}) => (
  <>
    {LEAKS.map((l) => {
      const d = (f - bf(l.beat)) / l.len;
      if (d < -1 || d > 2) return null;
      const a = Math.exp(-(d * d) * 2.2) * l.strength;
      return (
        <div
          key={l.beat}
          style={{
            position: 'absolute',
            inset: 0,
            mixBlendMode: 'screen',
            opacity: a,
            background: `radial-gradient(60% 45% at ${l.x + d * 300}px 45%, rgba(255,236,190,0.95) 0%, rgba(230,170,90,0.55) 35%, rgba(201,120,60,0) 70%), linear-gradient(${100 + d * 30}deg, rgba(255,214,150,0) 20%, rgba(255,226,170,0.5) 50%, rgba(255,214,150,0) 80%)`,
          }}
        />
      );
    })}
  </>
);
