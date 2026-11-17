import { Config } from '@remotion/cli/config';

// Software WebGL (SwiftShader via ANGLE) -- this machine has no GPU.
Config.setChromiumOpenGlRenderer('swangle');
Config.setBrowserExecutable(
  '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
