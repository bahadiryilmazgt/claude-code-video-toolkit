import React from 'react';
import {Composition} from 'remotion';
import {FirstReplyWins} from './FirstReplyWins';
import {FPS, H, TOTAL_FRAMES, W} from './lib';

export const RemotionRoot: React.FC = () => (
  <Composition id="FirstReplyWins" component={FirstReplyWins} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
);
