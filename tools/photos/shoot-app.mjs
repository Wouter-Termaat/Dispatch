// Screenshots van de app met foto's, in demomodus. Elke baan krijgt voor de test een van de foto's uit fotos/web.
//   node tools/photos/shoot-app.mjs [phone|laptop]
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { serve } from '../serve.mjs';

const which = process.argv[2] || 'phone';
const SIZES = { phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, laptop: { viewport: { width: 1440, height: 900 } } };
const out = 'test-results/fotos'; await mkdir(out, { recursive: true });
const server = await serve(8133);
const index = JSON.parse(await readFile('fotos/web/index.json', 'utf8'));
const real = Object.entries(index);
const seed = JSON.parse(await readFile('data/seed.json', 'utf8')).coasters;
const fake = Object.fromEntries(seed.map((c, i) => [c.id, index[c.id] || { v: 't', x: 50, y: 50 }]));
const pickFor = id => real[[...id].reduce((h, ch) => h + ch.charCodeAt(0), 0) % real.length];

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext(SIZES[which]);
await ctx.route('**/fotos/web/index.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(fake) }));
await ctx.route(/fotos\/web\/(.+)-t(-s)?\.webp$/, async r => {
  const [, id, s] = r.request().url().match(/fotos\/web\/(.+)-t(-s)?\.webp$/);
  const [rid, p] = pickFor(id);
  r.fulfill({ contentType: 'image/webp', body: await readFile(`fotos/web/${rid}-${p.v}${s || ''}.webp`) });
});
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/spotify/i.test(m.text())) errors.push(m.text()); });
const base = 'http://localhost:8133/?demo=1';
const shot = n => page.screenshot({ path: `${out}/${which}-${n}.png` });
await page.goto(base + '#/'); await page.evaluate(() => localStorage.clear()); await page.goto(base + '#/');
await page.click('button[data-key=wouter]'); await page.waitForSelector('#start'); await page.waitForTimeout(600);
await page.click('#start'); await page.waitForSelector('#stage .card'); await page.waitForTimeout(1800); await shot('1-duel');
await page.click('#stage .card.a'); await page.waitForTimeout(1600); await shot('2-duel-volgende');
await page.goto(base + '#/'); await page.waitForSelector('#start'); await page.click('.mode-t[data-k=rij]'); await page.click('#start');
await page.waitForSelector('#line .card'); await page.waitForTimeout(1800); await shot('3-rangee');
await page.goto(base + '#/programma'); await page.waitForTimeout(1200);
const row = await page.$('[data-id]'); if (row) { await row.click(); await page.waitForTimeout(1200); await shot('4-baankaart'); }
const loaded = await page.evaluate(() => [...document.querySelectorAll('img.ph')].map(i => i.classList.contains('in')));
console.log('foto\'s op het laatste scherm:', loaded.length, 'geladen:', loaded.filter(Boolean).length, errors.length ? '\nFOUTEN ' + errors.join('\n') : '');
await browser.close(); server.close();
