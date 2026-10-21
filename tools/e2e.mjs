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
const ready = () => page.waitForFunction(() => document.querySelectorAll('#line .card:not(.enter)').length === 4 && !document.querySelector('#line .card.dragging'));
const placeOrder = () => page.$$eval('#line .card', cs => cs.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(c => c.dataset.id + ':' + c.querySelector('.num').textContent));
async function drag(from, to) {
  const order = await placeOrder();
const byId = async i => page.$(`#line .card[data-id="${order[i].split(':')[0]}"]`);
  const a = await (await byId(from)).boundingBox(), b = await (await byId(to)).boundingBox();
  const y = a.y + a.height / 2; await page.mouse.move(a.x + a.width / 2, y); await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(a.x + a.width / 2 + (b.x - a.x) * i / 14, y); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(350);
}
for (let r = 0; r < 6; r++) {   // 6 keer bevestigen: één rij wordt onderweg hersteld
  await ready();
  if (r === 0) {
    const before = await placeOrder();
    await drag(3, 0); await shot('02-rangee');
    const after = await placeOrder();
    ok(after[0].split(':')[0] === before[3].split(':')[0] && after.map(x => x.split(':')[1]).join('') === '1234', 'slepen: kaart van plek 4 naar plek 1, nummers lopen mee');
  }
  if (r === 2) {
    // Herstel draait de vorige rij terug
    const n = await page.textContent('#count');
    await page.click('#undo'); await page.waitForTimeout(400);
    ok((await page.textContent('#count')) !== n, 'Herstel draait de vorige rij terug');
    await ready();
  }
  await page.waitForTimeout(1900); // mensentempo, anders gaat Trimrem (bewust) aan
  const t = await page.evaluate(() => new Promise(res => {
    const before = [...document.querySelectorAll('#line .card')].map(c => c.dataset.id).join();
    document.querySelector('#ok').click();
    const t0 = performance.now();
    const poll = () => {
      const now = [...document.querySelectorAll('#line .card')];
      const ready = now.length === 4 && now.map(c => c.dataset.id).join() !== before && !now.some(c => c.classList.contains('win'));
      if (ready) res(performance.now() - t0); else if (document.querySelector('.aff, #check:not([hidden])')) res(-1); else requestAnimationFrame(poll);
    };
    poll();
  }));
  if (t >= 0) times.push(t);
}
const max = Math.max(...times), avg = times.reduce((a, b) => a + b, 0) / times.length;
ok(max < 500, `volgende rij staat klaar binnen 0,5 s (gemiddeld ${avg.toFixed(0)} ms, max ${max.toFixed(0)} ms, ${times.length} metingen)`);

await page.waitForSelector('.aff', { timeout: 5000 });
await page.waitForTimeout(3200);
await shot('04-affiche');
const nComps = await page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.demo.v1')).comparisons.filter(c => c.outcome !== 'skip').length);
ok(nComps === 30, `5 rijen = 30 vergelijkingen opgeslagen (${nComps})`);
const sum = await page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.lastSession')));
ok(sum.rows === 5 && typeof sum.certainty === 'number', `affiche-samenvatting: ${sum.rows} rijen, ${Math.round(sum.certainty * 100)}% zeker (na 5 rijen mag dat nog 0 zijn), ster ${sum.riser?.id}`);

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

// logboek (onzichtbaar): keuzes, rondes, schermen en het openen worden vastgelegd
const ev = await page.evaluate(async () => { const { S } = await import('./js/state.js'); return (S.store.events || []).map(e => ({ type: e.type, session: e.session, data: e.data })); });
const types = new Set(ev.map(e => e.type));
const ch = ev.find(e => e.type === 'choice' && e.data.type === 'duel');
ok(['app_open', 'screen', 'session_start', 'choice', 'session_end'].every(t => types.has(t)) && ch && ch.data.ms > 0 && ch.data.pairs[0].p !== null && ch.session,
  `logboek: ${ev.length} gebeurtenissen (${[...types].join(', ')})`);
ok(!errors.length, 'geen consolefouten' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));
await browser.close(); server.close();
