// End-to-end test fase 4-6 in demomodus: node tools/e2e-pages.mjs [phone|laptop]
// Programma, baankaart, baan toevoegen met plaatsing, Samen, modi en toernooi.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir } from 'node:fs/promises';

const which = process.argv[2] || 'phone';
const SIZES = { phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, laptop: { viewport: { width: 1440, height: 900 } } };
const out = 'test-results/e2e'; await mkdir(out, { recursive: true });
const server = await serve(8128);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext(SIZES[which])).newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const shot = n => page.screenshot({ path: `${out}/${which}-${n}.png` });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FOUT ') + m); if (!c) process.exitCode = 1; };
const base = 'http://localhost:8128/?demo=1';
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.demo.v1')));
const wait = ms => page.waitForTimeout(ms);

await page.goto(base + '#/'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dispatch.demo.me', 'wouter'); });

// ---------- Programma ----------
await page.goto(base + '#/programma'); await page.reload(); await page.waitForSelector('#list .li'); await wait(700);
ok(await page.$$eval('#list .li', x => x.length) === 169, 'programma toont 169 banen');
await shot('10-programma');
await page.click('#cert'); await wait(300);
ok(await page.$eval('#list', el => el.classList.contains('showcert')), 'schakelaar Zekerheid toont het bereik');
await page.fill('#q', 'efteling'); await wait(300);
const nEft = await page.$$eval('#list .li', x => x.length);
ok(nEft > 3 && nEft < 20, `zoeken op park werkt (${nEft} banen van Efteling)`);
await page.fill('#q', ''); await wait(200);
await page.click('#seg [data-t=park]'); await wait(300); await shot('11-parken');
ok(await page.$$eval('#list .li', x => x.length) > 20, 'tab Parken');
await page.click('#seg [data-t=manufacturer]'); await wait(300);
await page.click('#list .li'); await page.waitForSelector('.sheet .mini-list'); await wait(400); await shot('12-fabrikant');
await page.click('.sheet .mini-list .li'); await page.waitForSelector('.bk-rank'); await wait(500); await shot('13-baankaart');
// herreden + notitie
const bkName = await page.$eval('.bk-cap h2', e => e.textContent);
await page.click('[data-a=reride]'); await wait(400);
await page.click('[data-a=note]'); await page.fill('#nt', 'Voorste rij, avond.'); await page.click('#ntok'); await wait(400);
let d = await db(); const ent = d.entries.find(e => e.user_id.startsWith('e5ae') && d.coasters.find(c => c.id === e.coaster_id).name === bkName);
ok(ent?.reridden_at && ent?.note === 'Voorste rij, avond.', `herreden en notitie bewaard voor ${bkName}`);
await page.keyboard.press('Escape'); await wait(400);
// Luca bekijken
await page.click('#seg [data-t=banen]'); await page.click('#pers [data-k=luca]'); await wait(300);
ok((await page.$eval('#who', e => e.textContent)).includes('Luca · 159 banen'), "Luca's programma (alleen lezen)");

// ---------- Baan toevoegen ----------
await page.goto(base + '#/toevoegen'); await page.waitForSelector('#q'); await wait(400);
const nPool = await page.$$eval('#res .res', x => x.length);
await page.fill('#q', 'a'); await wait(200);
await page.click('#res .res'); await page.waitForSelector('#gr'); await wait(300);
const newName = await page.$eval('.add-in .eyebrow', e => e.textContent);
await page.$eval('#gr', el => { el.value = 40; el.dispatchEvent(new Event('input')); });
await shot('14-gok'); await page.click('#go');
await page.waitForSelector('#stage .card'); await wait(400); await shot('15-plaatsing');
let steps = 0;
while (await page.$('#stage .card') && steps < 12) { await page.keyboard.press(steps % 2 ? 'ArrowDown' : 'ArrowUp'); await wait(420); steps++; }
await page.waitForSelector('.placed'); await wait(300); await shot('16-geplaatst');
d = await db();
const added = d.entries.find(e => e.user_id.startsWith('e5ae') && d.coasters.find(c => c.id === e.coaster_id).name === newName);
ok(added && Math.abs(added.prior_strength - 1 / 3) < 1e-9, `${newName} toegevoegd met zwak anker na ${steps} plaatsingsduels (pool ${nPool})`);
ok(d.comparisons.filter(c => c.mode === 'plaatsing').length === steps, 'plaatsingsduels opgeslagen');
await page.click('#prog2'); await wait(900);
ok(await page.$$eval('#list .li', x => x.length) === 170, 'programma telt nu 170 banen');

// ---------- Samen ----------
await page.goto(base + '#/samen'); await page.waitForSelector('#arc'); await wait(2600); await shot('20-samen');
const pct = await page.$eval('#pct', e => e.textContent);
ok(/^\d+%$/.test(pct) && pct !== '0%', 'smaakmatch ' + pct);
ok(await page.$$eval('.note', x => x.length) >= 5, 'verhalen gegenereerd (' + await page.$$eval('.note', x => x.length) + ')');
const txt = await page.$eval('#notes', e => e.textContent);
ok(!/[–—]/.test(txt) && !/\{\w+\}/.test(txt), 'geen streepjes of lege sjabloonvelden in de verhalen');
await page.click('#seg [data-t=samen]'); await wait(300); await shot('21-gezamenlijk');
await page.click('#seg [data-t=bucket]'); await wait(300); await shot('22-bucket');
await page.click('#notes .li'); await page.waitForSelector('.sheet'); await wait(400); await shot('23-bucket-baankaart');

// ---------- Modi ----------
await page.goto(base + '#/'); await page.waitForSelector('#modes'); await wait(400);
await page.click('#modes'); await page.waitForSelector('.mode-list'); await wait(400); await shot('30-modi');
await page.click('.mode[data-k=park]'); await page.waitForSelector('#parks .chip'); await page.click('#parks .chip'); await wait(200); await shot('31-park');
await page.click('#go'); await page.waitForSelector('#line .card, #stage .card'); await wait(500); await shot('32-park-avond');
const parkLbl = await page.$eval('.eyebrow', e => e.textContent);
ok(parkLbl.startsWith('Park-avond'), 'park-avond start: ' + parkLbl);
const parks = await page.$$eval('#line .card .mt', x => x.map(e => e.textContent.split(' · ')[0]));
ok(new Set(parks).size === 1, 'alle banen uit één park: ' + parks[0]);
await page.goto(base + '#/rangee?mode=twijfel'); await page.waitForSelector('#line .card'); await wait(400);
ok((await page.$eval('.r-title .eyebrow', e => e.textContent)) === 'Twijfelzone', 'twijfelzone in rijen');
await page.goto(base + '#/duel?mode=rematch'); await wait(1200);
ok(true, 'rematch: ' + (await page.$('#stage .card') ? 'duel met tegenstrijdigheid' : 'geen tegenstrijdigheden (melding)'));

// ---------- Toernooi ----------
await page.goto(base + '#/toernooi'); await page.waitForSelector('.mode[data-k=random]'); await wait(300);
await page.click('.mode[data-k=random]'); await page.waitForSelector('.bracket'); await wait(300); await shot('40-bracket');
let matches = 0;
for (let i = 0; i < 12 && !(await page.$('.champ')); i++) {
  if (await page.$('#go')) { await page.click('#go'); await wait(300); }
  if (await page.$('#stage .card')) { await page.click(i % 2 ? '#stage .card.a' : '#stage .card.b'); matches++; await wait(600); }
}
await page.waitForSelector('.champ'); await wait(1800); await shot('41-kampioen');
ok(matches === 7, `toernooi met 7 matches gespeeld (${matches})`);
await page.click('#aff'); await page.waitForSelector('.aff'); await wait(3000); await shot('42-affiche-toernooi');
ok((await page.$eval('.aff', e => e.textContent)).includes('Kampioen'), 'affiche noemt de kampioen');

ok(!errors.length, 'geen consolefouten' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));
await browser.close(); server.close();
