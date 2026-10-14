// End-to-end test in demomodus: node tools/e2e.mjs [phone|laptop]
// Spelen laden, een sessie La Rangée (10 rijen met bevestigen, tijdmeting), herstel, een paar duels, de affiche.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir } from 'node:fs/promises';

const which = process.argv[2] || 'phone';
const SIZES = { phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, laptop: { viewport: { width: 1440, height: 900 } } };
const out = 'test-results/e2e'; await mkdir(out, { recursive: true });
const server = await serve(8125);
const GL = process.env.GL !== 'soft' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ channel: 'chrome', args: GL });
const ctx = await browser.newContext({ ...SIZES[which], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const shot = n => page.screenshot({ path: `${out}/${which}-${n}.png` });
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FOUT ') + msg); if (!cond) process.exitCode = 1; };
const base = 'http://localhost:8125/?demo=1';

// schone demo, profiel kiezen
await page.goto(base + '#/');
await page.evaluate(() => localStorage.clear());
await page.goto(base + '#/');
await page.click('button[data-key=wouter]');
await page.waitForSelector('#start');
await page.waitForTimeout(800);
await shot('01-plein');

// ---------- La Rangée ----------
ok((await page.$eval('#start', e => e.textContent)).includes('Le Duel'), 'Le Duel is de standaard spelvorm');
await page.click('.mode-t[data-k=rij]'); await page.waitForTimeout(200);
await page.click('#start');
await page.waitForSelector('#line .card');
await page.waitForTimeout(500);
const times = [];
for (let r = 0; r < 5; r++) {
  await page.waitForFunction(() => document.querySelectorAll('#line .card:not(.enter)').length === 4 && !document.querySelector('#line .card.picked'));
  if (r === 2) {
    // twee tikken, screenshot, dan Herstel (wist de keuzes)
    const c = await page.$$('#line .card'); await c[1].click(); await c[3].click(); await page.waitForTimeout(250); await shot('03-rangee-keuze');
    await page.click('#undo');
    ok(await page.$$eval('#line .card.picked', x => x.length) === 0, 'Herstel wist de keuzes in de rij');
  }
  await page.waitForTimeout(1900); // mensentempo, anders gaat Trimrem (bewust) aan
  const t = await page.evaluate(() => new Promise(res => {
    const cards = [...document.querySelectorAll('#line .card')];
    const before = cards.map(c => c.dataset.id).join();
    cards[2].click(); cards[0].click(); cards[3].click();   // vierde gaat vanzelf, daarna de bevestigstap
    if (!document.querySelector('.scr.confirming')) { res(-2); return; }
    document.querySelector('#ok').click();
    const t0 = performance.now();
    const poll = () => {
      const now = [...document.querySelectorAll('#line .card')];
      const ready = now.length === 4 && now.map(c => c.dataset.id).join() !== before && !now.some(c => c.classList.contains('picked'));
      if (ready) res(performance.now() - t0); else if (document.querySelector('.aff, #check:not([hidden])')) res(-1); else requestAnimationFrame(poll);
    };
    poll();
  }));
  if (t === -2) ok(false, 'bevestigstap verschijnt na vier keuzes');
  if (t >= 0) times.push(t);
  if (r === 0) {
    await page.waitForTimeout(120); await shot('02-rangee');
    // bevestigstap: kiezen, bekijken, Opnieuw
    await page.waitForFunction(() => document.querySelectorAll('#line .card:not(.enter)').length === 4 && !document.querySelector('#line .card.picked'));
    await page.waitForTimeout(500);
    const c = await page.$$('#line .card'); await c[1].click(); await c[0].click(); await c[2].click(); await page.waitForTimeout(450); await shot('02b-bevestig');
    ok(await page.$('.scr.confirming #ok:not([hidden])'), 'na vier keuzes: volgorde zichtbaar met Bevestig en Opnieuw');
    await page.click('#again'); await page.waitForTimeout(250);
    ok(await page.$$eval('#line .card.picked', x => x.length) === 0, 'Opnieuw wist de volgorde');
  }
}
const max = Math.max(...times), avg = times.reduce((a, b) => a + b, 0) / times.length;
ok(max < 500, `volgende rij staat klaar binnen 0,5 s (gemiddeld ${avg.toFixed(0)} ms, max ${max.toFixed(0)} ms, ${times.length} metingen)`);

await page.waitForSelector('.aff', { timeout: 5000 });
await page.waitForTimeout(3200);
await shot('04-affiche');
const nComps = await page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.demo.v1')).comparisons.filter(c => c.outcome !== 'skip').length);
ok(nComps === 30, `5 rijen = 30 vergelijkingen opgeslagen (${nComps})`);
const sum = await page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.lastSession')));
ok(sum.rows === 5 && sum.certainty > 0, `affiche-samenvatting: ${sum.rows} rijen, ${Math.round(sum.certainty * 100)}% zeker, ster ${sum.riser?.id}`);

ok(!(await page.$('#save, #share')), 'affiche zonder Opslaan en Delen');

// ---------- Le Duel ----------
await page.goto(base + '#/duel');
await page.waitForSelector('#stage .card');
await page.waitForTimeout(600);
await shot('05-duel');
const dtimes = [];
for (let d = 0; d < 6; d++) {
  const t = await page.evaluate(k => new Promise(res => {
    const before = [...document.querySelectorAll('#stage .card')].map(c => c.dataset.id).join();
    const t0 = performance.now();
    dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    const poll = () => { const now = [...document.querySelectorAll('#stage .card:not(.win):not(.lose)')]; if (now.length === 2 && now.map(c => c.dataset.id).join() !== before) res(performance.now() - t0); else requestAnimationFrame(poll); };
    poll();
  }), d % 3 === 2 ? ' ' : d % 2 ? 'ArrowDown' : 'ArrowUp');
  dtimes.push(t);
  await page.waitForTimeout(700);
}
ok(Math.max(...dtimes) < 500, `volgend duel staat klaar binnen 0,5 s (max ${Math.max(...dtimes).toFixed(0)} ms)`);
await page.click('#undo'); await page.waitForTimeout(300);
const nAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.demo.v1')).comparisons.filter(c => c.mode === 'duel').length);
ok(nAfter === 5, `6 duels, 1 hersteld = 5 duelvergelijkingen (${nAfter})`);
await page.click('#close');
await page.waitForSelector('.aff', { timeout: 5000 });

ok(!errors.length, 'geen consolefouten' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));
await browser.close(); server.close();
