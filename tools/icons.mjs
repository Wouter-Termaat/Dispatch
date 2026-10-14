// Maakt de PWA-iconen (molen uit assets/windmill.jpg) met Playwright: node tools/icons.mjs
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir } from 'node:fs/promises';

await mkdir('icons', { recursive: true });
const server = await serve(8124);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const [size, mask] of [[512, false], [192, false], [512, true]]) {
  await page.setViewportSize({ width: size, height: size });
  const pad = mask ? .0 : .0;
  await page.setContent(`<html><body style="margin:0;background:#1d1428">
    <div style="position:absolute;inset:0;background:url(http://localhost:8124/assets/windmill.jpg) 50% 34%/${mask ? 175 : 150}% auto no-repeat;${mask ? '' : 'border-radius:22%;'}overflow:hidden"></div>
    <div style="position:absolute;inset:${mask ? '0' : '0'};${mask ? '' : 'border-radius:22%;'}box-shadow:inset 0 0 0 ${Math.round(size * .02)}px rgba(236,199,127,.85),inset 0 0 ${Math.round(size * .18)}px rgba(13,8,20,.85)"></div>
    </body></html>`.replace('${pad}', pad));
  await page.waitForTimeout(300);
  const name = mask ? 'icon-maskable-512.png' : `icon-${size}.png`;
  await page.screenshot({ path: `icons/${name}`, omitBackground: !mask });
  console.log('icons/' + name);
}
await browser.close(); server.close();
