// Final render: node harness/render.mjs [start] [end] [workers]
// Writes out/frames/f0000.jpg ... then encode with harness/encode.sh
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

// Playwright is preinstalled globally in this environment; fall back to a local install.
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require('/opt/node22/lib/node_modules/playwright');
}
const { chromium } = pw;

const [start = 0, end = 900, workers = 1] = process.argv.slice(2).map(Number);
const W = 1080, H = 1920, Q = 0.97;
const outDir = path.resolve('out/frames');
fs.mkdirSync(outDir, { recursive: true });
const url = 'file://' + path.resolve('harness/index.html');

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const todo = [];
for (let f = start; f < end; f++) if (!fs.existsSync(path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`))) todo.push(f);
console.log(`${todo.length} frames to render with ${workers} worker(s)`);
const t0 = Date.now();
let done = 0;
async function worker(id) {
  const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
  page.on('pageerror', (e) => console.log(`[w${id}] pageerror ${e.message}`));
  await page.goto(url);
  await page.evaluate(([w, h]) => window.bear.init(w, h), [W, H]);
  while (todo.length) {
    const f = todo.shift();
    const data = await page.evaluate(([f, q]) => window.bear.frame(f, q), [f, Q]);
    fs.writeFileSync(path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
    done++;
    if (done % 10 === 0 || !todo.length) {
      const s = (Date.now() - t0) / 1000;
      console.log(`frame ${f} | ${done} done | ${(s / done).toFixed(2)} s/frame | elapsed ${(s / 60).toFixed(1)} min`);
    }
  }
  await page.close();
}
await Promise.all(Array.from({ length: workers }, (_, i) => worker(i)));
await browser.close();
console.log('RENDER DONE');
