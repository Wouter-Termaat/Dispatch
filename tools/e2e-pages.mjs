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
ok(await page.$$eval('#list .li', x => x.length) === 169, 'ranking toont 169 banen');
await shot('10-ranking');
await page.click('#vbtn'); await wait(300);
ok(await page.$eval('#list', el => el.classList.contains('ext')) && await page.$('#list .xrow .rng'), 'uitgebreide weergave toont bereik, duels en de ander');
await shot('10b-ranking-uitgebreid');
// slim zoeken: park als label, snelfilter, sorteren
await page.fill('#q', 'eft'); await wait(300); await shot('10c-suggestie');
ok(await page.$('#sugg:not([hidden]) [data-s=parks]'), 'zoeken stelt het park voor');
await page.click('#sugg [data-s=parks]'); await wait(300);
const nE = await page.$$eval('#list .li', x => x.length);
ok(nE > 3 && nE < 20 && await page.$('#labels .label'), `park als label: ${nE} banen van Efteling`);
ok(!(await page.$('#quick')), 'geen snelfilters meer');
await page.selectOption('#sort', 'naam'); await wait(300);
const names = await page.$$eval('#list .li .nm', x => x.map(e => e.textContent.trim()));
ok(names.join('|') === [...names].sort((a, b) => a.localeCompare(b)).join('|'), 'sorteren op naam');
await shot('10d-gefilterd');
await page.click('#labels .label'); await page.selectOption('#sort', 'plek'); await wait(300);
ok(await page.$$eval('#list .li', x => x.length) === 169, 'filters wissen');
await page.click('#seg [data-t=park]'); await wait(300); await shot('11-parken');
ok(await page.$$eval('#list .li', x => x.length) > 20, 'tab Parken');
await page.click('#seg [data-t=manufacturer]'); await wait(300);
await page.click('#list .li'); await page.waitForSelector('.sheet .mini-list'); await wait(400); await shot('12-fabrikant');
await page.click('.sheet .mini-list .li'); await page.waitForSelector('.bk-rank'); await wait(500); await shot('13-baankaart');
// herreden + notitie
const bkName = await page.$eval('.bk-cap h2', e => e.textContent);
ok(!(await page.$('[data-a=reride]')), 'herreden is weg uit de baankaart');
await page.click('[data-a=note]'); await page.fill('#nt', 'Voorste rij, avond.'); await page.click('#ntok'); await wait(400);
let d = await db(); const ent = d.entries.find(e => e.user_id.startsWith('e5ae') && d.coasters.find(c => c.id === e.coaster_id).name === bkName);
ok(ent?.note === 'Voorste rij, avond.', `notitie bewaard voor ${bkName}`);
await page.keyboard.press('Escape'); await wait(400);
// Luca bekijken
await page.click('#seg [data-t=banen]'); await page.click('#pers [data-k=luca]'); await wait(300);
ok((await page.$eval('#who', e => e.textContent)).includes('Luca') && await page.$$eval('#list .li', x => x.length) === 159, "Luca's ranking (alleen lezen, 159 banen)");

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
await page.click('.mode-t[data-k=park]'); await wait(200); await shot('30-modi');
await page.click('#start'); await page.waitForSelector('#parks .chip'); await wait(300); await shot('31-park');
await page.click('#parks .chip'); await page.waitForSelector('#stage .card'); await wait(600); await shot('32-park-avond');
const parkLbl = await page.$eval('.meter .lbl span', e => e.textContent);
ok(parkLbl.startsWith('Park-avond'), 'park-avond is een duel: ' + parkLbl);
const parkSet = new Set();
for (let i = 0; i < 4; i++) { (await page.$$eval('#stage .card .mt', x => x.map(e => e.textContent.split(' · ')[0]))).forEach(p => parkSet.add(p)); await page.keyboard.press('ArrowUp'); await wait(700); }
ok(parkSet.size === 1, 'alle duels binnen één park: ' + [...parkSet][0]);
await page.goto(base + '#/duel?mode=park&park=Prater'); await page.waitForSelector('#stage .card'); await wait(400);
ok((await page.$eval('#count', e => e.textContent)) === '0 van 1', 'Park-avond Prater (2 banen): precies 1 duel');
await page.goto(base + '#/duel?mode=park&park=Toverland'); await page.waitForSelector('#stage .card'); await wait(400);
ok((await page.$eval('#count', e => e.textContent)) === '0 van 10', 'Park-avond Toverland (5 banen): 10 duels, elk paar één keer');
await page.goto(base + '#/duel?mode=twijfel'); await page.waitForSelector('#stage .card'); await wait(400);
ok((await page.$eval('.meter .lbl span', e => e.textContent)) === 'Twijfelzone', 'twijfelzone in duels');
await page.goto(base + '#/duel?mode=rematch'); await wait(1200);
ok(true, 'rematch: ' + (await page.$('#stage .card') ? 'duel met tegenstrijdigheid' : 'geen tegenstrijdigheden (melding)'));

// ---------- Toernooi ----------
await page.goto(base + '#/toernooi'); await page.waitForSelector('.mode[data-k=random]'); await wait(300);
await page.click('.mode[data-k=random]'); await page.waitForSelector('.bracket'); await wait(300); await shot('40-bracket');
let matches = 0;
for (let i = 0; i < 30 && !(await page.$('.champ')); i++) {
  if (await page.$('#go')) { await page.click('#go'); await wait(300); }
  if (await page.$('#stage .card')) { await page.click(i % 2 ? '#stage .card.a' : '#stage .card.b'); matches++; await wait(600); }
}
await page.waitForSelector('.champ'); await wait(1800); await shot('41-kampioen');
ok(matches === 15, `toernooi van 16 aangrenzende banen: 15 matches gespeeld (${matches})`);
await page.click('#aff'); await page.waitForSelector('.aff'); await wait(3000); await shot('42-affiche-toernooi');
ok((await page.$eval('.aff', e => e.textContent)).includes('Kampioen'), 'affiche noemt de kampioen');

// focus: Top 10 en Laatste 10 houden de duels binnen dat deel van de ranking (plus de rand)
for (const [f, rij] of [['top10', false], ['laatste10', true]]) {
  await page.goto(base + '#/'); await page.waitForSelector('#modes'); await wait(300);
  await page.click(`.mode-t[data-k=${rij ? 'rij' : 'duel'}]`); await page.click(`[data-f=${f}]`); await wait(200);
  const allowed = await page.evaluate(async f => { const m = await import('./js/modes.js'); return m.focusSet(f).all; }, f);
  await page.click('#start'); await page.waitForSelector(rij ? '#line .card' : '#stage .card'); await wait(600);
  const ids = await page.$$eval(rij ? '#line .card' : '#stage .card', cs => cs.map(c => c.dataset.id));
  ok(ids.length && ids.every(id => allowed.includes(id)) && (await page.textContent('body')).includes(f === 'top10' ? 'Top 10' : 'Laatste 10'), `focus ${f}: alle kaarten uit dat deel van de ranking (${ids.length} van ${allowed.length} toegestaan)`);
  await page.click('#close'); await wait(400);
}
await page.goto(base + '#/'); await page.waitForSelector('#modes'); await page.click('.mode-t[data-k=toernooi]'); await wait(200);
ok(await page.$eval('#focus', e => e.classList.contains('off') && getComputedStyle(e).visibility === 'hidden'), 'focus onzichtbaar bij Toernooi, ruimte blijft');
await page.click('.mode-t[data-k=duel]'); await page.click('[data-f=alles]');

ok(!errors.length, 'geen consolefouten' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));
await browser.close(); server.close();
