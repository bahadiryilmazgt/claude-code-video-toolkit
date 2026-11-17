// node harness/still.mjs out.jpg frame  (FUR env = fur options JSON)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [out, frame] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 400)); });
await page.goto('file://' + path.resolve('harness/index.html'));
await page.evaluate((o) => { globalThis.FUR_OPTS = o; window.bear.init(1080, 1920); }, JSON.parse(process.env.FUR ?? '{}'));
const data = await page.evaluate((f) => window.bear.frame(f, 0.97), Number(frame));
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await browser.close();
