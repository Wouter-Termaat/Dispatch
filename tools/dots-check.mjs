// Maakt een uitsnede rond elke witte stip, om te zien of hij mooi in het ontwerp zit. node tools/dots-check.mjs
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir } from 'node:fs/promises';

const out = 'test-results/dots'; await mkdir(out, { recursive: true });
const server = await serve(8133);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
const base = 'http://localhost:8133/?demo=1';
await page.goto(base + '#/'); await page.evaluate(() => {
  localStorage.setItem('dispatch.demo.me', 'wouter');
  localStorage.setItem('dispatch.lastSession', JSON.stringify({ kind: 'duel', mode: 'duel', date: new Date().toISOString(), rows: 0, duels: 10, checks: 0, riser: { id: 'taron-phantasialand', delta: 7 }, faller: { id: 'hyperion-energylandia', delta: -3 }, hardest: ['taron-phantasialand', 'voltron-europa-park'], certainty: .36 }));
});
const crop = async (name, sel, pad = 70) => {
  const el = await page.$(sel); if (!el) { console.log('NIET GEVONDEN', name, sel); return; }
  const b = await el.boundingBox(); if (!b) { console.log('ONZICHTBAAR', name); return; }
  const vp = page.viewportSize();
  const x = Math.max(0, b.x + b.width / 2 - pad * 2), y = Math.max(0, b.y + b.height / 2 - pad);
  await page.screenshot({ path: `${out}/${name}.png`, clip: { x, y, width: Math.min(pad * 4, vp.width - x), height: Math.min(pad * 2, vp.height - y) } });
  console.log('ok', name);
};
const go = async h => { await page.goto(base + h); await page.reload(); await page.waitForTimeout(2200); };
await go('#/'); await crop('1-pointblanc', '[data-dot=pointblanc]'); await crop('2-logo-i', '[data-dot=logo-i]'); await crop('3-molen', '[data-dot=molen]');
await go('#/samen'); await page.waitForTimeout(1500); await crop('4-boog', '[data-dot=boog]', 90);
await go('#/programma'); await crop('5-cijfers', '[data-dot=cijfers]');
await go('#/meer'); await crop('6-instellingen', '[data-dot=instellingen]');
await go('#/programma'); await page.tap('#list .li:nth-child(4)'); await page.waitForTimeout(900); await crop('7-bereik', '[data-dot=bereik]');
await go('#/affiche'); await page.waitForTimeout(2500); await crop('8-affiche', '[data-dot=affiche]', 90);
await go('#/achter'); await page.$eval('.achter', e => (e.scrollTop = 99999)); await page.waitForTimeout(500); await crop('9-handtekening', '[data-dot=handtekening]');
await go('#/toernooi'); await page.tap('.mode[data-k=random]'); await page.waitForTimeout(300);
for (let i = 0; i < 40 && !(await page.$('.champ')); i++) { if (await page.$('#go')) { await page.tap('#go'); await page.waitForTimeout(250); } if (await page.$('#stage .card')) { await page.tap('#stage .card.a'); await page.waitForTimeout(500); } }
await page.waitForTimeout(2200); await crop('10-kampioen', '[data-dot=kampioen]', 110);
await browser.close(); server.close();
