import React from "react";
import { Composition } from "remotion";
import { SpeedWins } from "./SpeedWins";
import { FPS, H, timeline, W } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="SpeedWins"
    component={SpeedWins}
    durationInFrames={timeline.durationInFrames}
    fps={FPS}
    width={W}
    height={H}
  />
);
