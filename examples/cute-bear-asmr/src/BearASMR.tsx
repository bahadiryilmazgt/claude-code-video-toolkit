import React, { useLayoutEffect, useRef, useState } from 'react';
import { Audio, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Engine } from './engine/engine';

export const BearASMR: React.FC<{ debug?: number; profile?: number; noshadow?: number; trace?: number }> = ({ debug, profile, noshadow, trace }) => {
  (globalThis as unknown as { BEAR_TRACE?: number }).BEAR_TRACE = trace ?? 0;
  (globalThis as unknown as { FUR_NOSHADOW?: number }).FUR_NOSHADOW = noshadow ?? 0;
  (globalThis as unknown as { BEAR_DEBUG?: number }).BEAR_DEBUG = debug ?? 0;
  (globalThis as unknown as { BEAR_PROFILE?: number }).BEAR_PROFILE = profile ?? 0;
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [initHandle] = useState(() => delayRender('Building 3D scene'));

  useLayoutEffect(() => {
    engine.current = new Engine(ref.current!, width, height, fps);
    continueRender(initHandle);
  }, [initHandle, width, height, fps]);

  useLayoutEffect(() => {
    if (!engine.current) return;
    const h = delayRender(`frame ${frame}`);
    const ts = performance.now();
    engine.current.render(frame);
    if ((globalThis as unknown as { BEAR_TRACE?: number }).BEAR_TRACE) console.log(`TRACE f${frame} start ${ts.toFixed(0)} js ${(performance.now() - ts).toFixed(0)}`);
    if ((globalThis as unknown as { BEAR_PROFILE?: number }).BEAR_PROFILE) {
      const gl = engine.current.renderer.getContext();
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const a = performance.now();
      for (let k = 1; k <= 3; k++) engine.current.render(frame + k);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      console.log(`PROFILE steady ${((performance.now() - a) / 3).toFixed(0)} ms/frame`);
      engine.current.render(frame);
    }
    continueRender(h);
  }, [frame]);

  return (
    <>
      <canvas ref={ref} width={width} height={height} style={{ width: '100%', height: '100%' }} />
      <Audio src={staticFile('asmr_mix.wav')} />
    </>
  );
};
