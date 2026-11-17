import React from 'react';
import { Composition } from 'remotion';
import { BearASMR } from './BearASMR';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BearASMR" component={BearASMR} durationInFrames={900} fps={30} width={1080} height={1920} />
    {/* fast half-resolution draft for checking motion and sync */}
    <Composition id="BearASMRDraft" component={BearASMR} durationInFrames={900} fps={30} width={540} height={960} />
  </>
);
