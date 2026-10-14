// Screenshots + consolefouten voor een lijst routes, op telefoon- en laptopformaat.
// node tools/shoot.mjs "#/" "#/programma" ...   (demomodus, profiel Wouter)
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir } from 'node:fs/promises';

const routes = process.argv.slice(2).filter(a => !a.startsWith('--'));
const extra = process.argv.find(a => a.startsWith('--q='))?.slice(4) || '';
const live = process.argv.includes('--live');
const only = process.argv.find(a => a.startsWith('--size='))?.slice(7);
const out = 'test-results/shots'; await mkdir(out, { recursive: true });
const server = await serve(8123);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const sizes = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, laptop: { width: 1440, height: 900 } };
const errors = [];
for (const [name, s] of Object.entries(sizes)) {
  if (only && only !== name) continue;
  const { width, height, ...rest } = s;
  const ctx = await browser.newContext({ viewport: { width, height }, ...rest });
  await ctx.addInitScript(() => { if (!localStorage.getItem('dispatch.demo.me')) localStorage.setItem('dispatch.demo.me', 'wouter'); });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on('requestfailed', r => errors.push(`[${name}] requestfailed: ${r.url()}`));
  for (const r of routes) {
    await page.goto(live ? `http://localhost:8123/${extra ? '?' + extra : ''}${r}` : `http://localhost:8123/?demo=1${extra ? '&' + extra : ''}${r}`);
    await page.waitForTimeout(2200);
    const file = `${out}/${name}-${(r.replace(/[#/?=&]+/g, '_').replace(/^_|_$/g, '') || 'plein')}.png`;
    await page.screenshot({ path: file });
    console.log('screenshot', file);
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(errors.length ? 'FOUTEN:\n' + errors.join('\n') : 'Geen consolefouten.');
