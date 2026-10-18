// Touchtest op Pixel 7-emulatie: echte tikken, vegen en de terugknop. node tools/e2e-touch.mjs
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir } from 'node:fs/promises';

const out = 'test-results/touch'; await mkdir(out, { recursive: true });
const server = await serve(8132);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu'] });
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FOUT ') + m); if (!c) process.exitCode = 1; };
const wait = ms => page.waitForTimeout(ms);
const shot = n => page.screenshot({ path: `${out}/${n}.png` });
const base = 'http://localhost:8132/?demo=1';

await page.goto(base + '#/'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dispatch.demo.me', 'wouter'); }); await page.reload();
await page.waitForSelector('.vb-panel'); await wait(1500); await shot('01-spelen');
ok(await page.$('.spelen.vb .vb-scene .world'), 'Spelen is variant B (scène + glazen paneel)');

// alle spelvormen staan in beeld binnen het paneel (geen scrollen), en Toernooi kiezen
const inPanel = await page.evaluate(() => { const p = document.querySelector('.vb-panel').getBoundingClientRect(); return [...document.querySelectorAll('.mode-t')].every(b => { const r = b.getBoundingClientRect(); return r.left >= p.left && r.right <= p.right && r.bottom <= innerHeight; }); });
ok(inPanel, 'alle zes spelvormen in beeld binnen het paneel');
ok(await page.evaluate(() => document.documentElement.classList.contains('lite')), 'telefoon draait in de lichte modus');
await page.tap('.mode-t[data-k=toernooi]'); await wait(300);
ok((await page.$eval('#start', e => e.textContent)).includes('Toernooi'), 'tik op Toernooi zet de startknop');
await page.tap('.mode-t[data-k=duel]'); await wait(200);

// ronde duels met tikken
await page.tap('#start'); await page.waitForSelector('#stage .card'); await wait(700); await shot('02-duel');
for (let i = 0; i < 10; i++) { await page.waitForSelector('#stage .card:not(.win):not(.lose)'); await wait(450); await page.tap(i % 2 ? '#stage .card.b' : '#stage .card.a'); }
await page.waitForSelector('.aff', { timeout: 8000 }); await wait(2500); await shot('03-affiche');
ok(true, '10 duels met tikken, affiche verschijnt');
await page.tap('#home'); await page.waitForSelector('.vb-panel'); ok(true, 'Klaar gaat terug naar Spelen');

// La Rangée met bevestigen
await page.tap('.mode-t[data-k=rij]'); await page.tap('#start'); await page.waitForSelector('#line .card'); await wait(800);
let c = await page.$$('#line .card'); await c[2].tap(); await c[0].tap(); await c[1].tap(); await wait(500); await shot('04-bevestig');
ok(await page.$('.scr.confirming'), 'rangée: bevestigstap na drie tikken');
await page.tap('#ok'); await wait(700);
ok((await page.$eval('#count', e => e.textContent)) === '1 van 5', 'rangée: 1 van 5 na bevestigen');
await page.tap('#close'); await page.waitForSelector('.aff', { timeout: 8000 }); await wait(500); await page.tap('#home'); await page.waitForSelector('.vb-panel');

// Ranking: baankaart, Android-terug sluit het blad, omlaag vegen sluit het blad
await page.tap('#nav a[data-tab=programma]'); await page.waitForSelector('#list .li'); await wait(600);
await page.tap('#list .li'); await page.waitForSelector('.sheet-wrap.open .bk-rank'); await wait(500); await shot('05-baankaart');
await page.goBack(); await wait(600);
ok(await page.$eval("#sheet", e => e.hidden) && (await page.evaluate(() => location.hash)) === '#/programma', 'Android-terug sluit de baankaart en blijft op Ranking');
await page.tap('#list .li:nth-child(3)'); await page.waitForSelector('.sheet-wrap.open .bk-rank'); await wait(500);
await page.evaluate(async () => {
  const sh = document.querySelector('.sheet'); const r = sh.getBoundingClientRect(); const x = r.left + 100, y0 = r.top + 30;
  const t = (type, y) => sh.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: sh, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 1, target: sh, clientX: x, clientY: y })] }));
  t('touchstart', y0); for (let k = 1; k <= 8; k++) t('touchmove', y0 + k * 20); t('touchend', y0 + 160);
});
await wait(600);
ok(await page.$eval('#sheet', e => e.hidden), 'omlaag vegen sluit de baankaart');
await page.goBack(); await wait(600);
ok((await page.evaluate(() => location.hash)).startsWith('#/'), 'terug na vegen werkt nog: ' + await page.evaluate(() => location.hash));

// snelfilter en zoeken met het toetsenbord
await page.tap('#nav a[data-tab=programma]'); await page.waitForSelector('#q'); await page.tap('#q'); await page.keyboard.type('efte'); await wait(400);
await page.tap('#sugg [data-s]'); await wait(300); await shot('06-label');
ok(await page.$('#labels .label'), 'park-suggestie wordt een label');

ok(!errors.length, 'geen consolefouten' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));
await browser.close(); server.close();
