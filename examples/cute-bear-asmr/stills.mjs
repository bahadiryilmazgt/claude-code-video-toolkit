// Batch stills with one bundle + one browser. usage: node stills.mjs 120 200 395 ...
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';

const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const browser = await openBrowser('chrome', {
  browserExecutable: '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  chromiumOptions: { gl: 'swangle' },
});
const composition = await selectComposition({ serveUrl, id: 'BearASMR', puppeteerInstance: browser });
for (const frame of frames) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame, output: `out/stills/f${frame}.png`, puppeteerInstance: browser, chromiumOptions: { gl: 'swangle' } });
  console.log(`frame ${frame} ${(Date.now() - t0) / 1000}s`);
}
await browser.close({ silent: true });
