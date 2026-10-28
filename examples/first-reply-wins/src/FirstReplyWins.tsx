import React, {useState} from 'react';
import {AbsoluteFill, Audio, continueRender, delayRender, getStaticFiles, staticFile, useCurrentFrame} from 'remotion';
import timeline from './timeline.json';
import {Beams, Grain, Particles, Space, bf, loadFonts} from './lib';
import {Messages} from './Messages';
import {SceneAd} from './SceneAd';
import {SceneOrbit} from './SceneOrbit';
import {SceneRace} from './SceneRace';
import {SceneChoice} from './SceneChoice';
import {SceneWhy} from './SceneWhy';
import {ScenePayoff} from './ScenePayoff';
import {SceneEnding} from './SceneEnding';
import {TransitionFX} from './TransitionFX';

const S = Object.fromEntries(timeline.scenes.map((s) => [s.id, s])) as Record<string, {start: number; end: number}>;

/** Mount a scene from (start - pre) to (end + post) frames, passing its local frame. */
const Win: React.FC<{
  f: number;
  from: number;
  to: number;
  pre?: number;
  post?: number;
  children: (t: number) => React.ReactNode;
}> = ({f, from, to, pre = 14, post = 14, children}) => {
  const a = bf(from);
  const b = bf(to);
  if (f < a - pre || f > b + post) return null;
  return <AbsoluteFill>{children(f - a)}</AbsoluteFill>;
};

const hasAudio = getStaticFiles().some((s) => s.name === 'audio/soundtrack.wav');

export const FirstReplyWins: React.FC = () => {
  const f = useCurrentFrame();
  const [handle] = useState(() => delayRender('fonts'));
  useState(() => loadFonts().then(() => continueRender(handle)));

  // gentle global camera drift for the parallax layers
  const camX = Math.sin(f / 80) * 40;
  const camY = Math.cos(f / 95) * 30;
  // particle "fly-through" bumps at big camera moves
  const bump = (beat: number, dir: number, len = 20) => {
    const d = f - bf(beat);
    return d < -len || d > len * 1.6 ? 0 : dir * Math.exp(-((d / len) ** 2) * 2);
  };
  const zoom = 1 + bump(0, -0.4, 30) + bump(20, -0.25) + bump(32, 0.5, 12) + bump(48, 0.35) + bump(56, 0.6, 26) + bump(68, 0.3) + bump(80, -0.3, 30);

  return (
    <AbsoluteFill style={{backgroundColor: '#061325'}}>
      <Space f={f} />
      <Beams f={f} opacity={0.9} />
      <Particles f={f} count={42} seed="far" camX={camX * 0.5} camY={camY * 0.5} focus={0.2} zoom={zoom} />

      <Win f={f} from={S.ad.start} to={S.message.end} post={16}>{(t) => <SceneAd f={t} />}</Win>
      <Win f={f} from={S.notonly.start} to={S.notonly.end}>{(t) => <SceneOrbit f={t} />}</Win>
      <Win f={f} from={S.race.start} to={S.race.end} pre={6}>{(t) => <SceneRace f={t} />}</Win>
      <Win f={f} from={S.choice.start} to={S.choice.end}>{(t) => <SceneChoice f={t} />}</Win>
      <Win f={f} from={S.why.start} to={S.why.end} post={20}>{(t) => <SceneWhy f={t} />}</Win>
      <Win f={f} from={S.payoff.start} to={S.payoff.end} pre={4} post={30}>{(t) => <ScenePayoff f={t} />}</Win>
      <Win f={f} from={S.ending.start} to={S.ending.end} pre={4}>{(t) => <SceneEnding f={t} />}</Win>

      <Particles f={f} count={26} seed="near" camX={camX * 1.4} camY={camY * 1.4} focus={0.05} zoom={zoom} opacity={0.8} />
      <TransitionFX f={f} />
      <Messages />
      <Grain f={f} />
      {hasAudio && <Audio src={staticFile('audio/soundtrack.wav')} />}
    </AbsoluteFill>
  );
};
