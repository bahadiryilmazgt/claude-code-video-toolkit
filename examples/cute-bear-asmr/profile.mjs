// usage: node profile.mjs 120 200 ...  -> prints per-stage timings from the page
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const browser = await openBrowser('chrome', {
  browserExecutable: '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  chromiumOptions: { gl: 'swangle' },
});
const inputProps = { profile: Number(process.env.PROF ?? 1), noshadow: Number(process.env.NOSHADOW ?? 0) };
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? 'BearASMR', puppeteerInstance: browser, inputProps });
for (const frame of frames) {
  const t0 = Date.now();
  await renderStill({
    composition, serveUrl, frame, inputProps, output: `out/stills/p${frame}.png`, puppeteerInstance: browser,
    chromiumOptions: { gl: 'swangle' },
    onBrowserLog: (l) => { if (l.text.includes('PROFILE')) console.log(l.text); },
  });
  console.log(`still ${frame} wall ${(Date.now() - t0) / 1000}s`);
}
await browser.close({ silent: true });
