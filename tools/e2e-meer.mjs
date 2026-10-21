// End-to-end test fase 7-8 in demomodus: node tools/e2e-meer.mjs [phone|laptop]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const which = process.argv[2] || 'phone';
const SIZES = { phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, laptop: { viewport: { width: 1440, height: 900 } } };
const out = 'test-results/e2e'; await mkdir(out, { recursive: true });
const server = await serve(8129);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...SIZES[which], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/open\.spotify|spotify/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
const shot = n => page.screenshot({ path: `${out}/${which}-${n}.png` });
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FOUT ') + m); if (!c) process.exitCode = 1; };
const wait = ms => page.waitForTimeout(ms);
const base = 'http://localhost:8129/?demo=1';
const settings = () => page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.demo.v1')).profiles.find(p => p.key === 'wouter').settings);

await page.goto(base + '#/meer'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dispatch.demo.me', 'wouter'); }); await page.reload();
await page.waitForSelector('.meer'); await wait(600); await shot('50-meer');

// instellingen
ok(!(await page.$('[data-set=anchorDuels]')), 'ankersterkte is geen instelling meer');
await page.click('[data-set=sessionLength] [data-v="5"]'); await wait(200);
await page.click('[data-tog=sound]'); await wait(200);
const s1 = await settings();
ok(s1.sessionLength === 5 && s1.sound === false, 'sessielengte en geluid bewaard');
ok(await page.$('[data-set=music] [data-v=orgel].on') && !(await page.$('[data-set=music] [data-v=wittestip]')), 'draaiorgel is standaard, Witte Stip-muziek nog verborgen');
await page.click('[data-dot=instellingen]'); await wait(700); await shot('51-stip-gevonden');
ok((await settings()).dots?.includes('instellingen') && await page.$('#dotfound.show'), 'witte stip bij de instellingen gevonden (1 van 10)');
await wait(2800);
ok((await page.$eval('.dotgrid', e => e.querySelectorAll('i.got').length)) === 1, 'voortgang in Meer: 1 van 10');
await shot('51-muziek');
// witte stippen opnieuw zoeken
await page.click('#dotsreset'); await page.waitForSelector('.sheet [data-a=yes]'); await wait(300); await shot('51-stippen-reset');
await page.click('.sheet [data-a=yes]'); await wait(900);
ok((await settings()).dots?.length === 0 && (await page.$eval('.dotgrid', e => e.querySelectorAll('i.got').length)) === 0, 'witte stippen opnieuw zoeken: alles weer verstopt');
await page.click('[data-dot=instellingen]'); await wait(700);
ok((await settings()).dots?.includes('instellingen'), 'na de reset weer een stip te vinden');
await wait(2800);
await page.click('[data-set=music] [data-v=none]'); await wait(300);
ok(await page.$eval('#music', e => e.hidden), 'muziek uit verbergt de knop');

// export
await page.click('#xls'); await page.waitForSelector('.sheet [data-k=wouter]');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('.sheet [data-x=dl]')]);
const name = dl.suggestedFilename();
ok(/^Top List Coasters Wouter \d{4}-\d{2}-\d{2}\.xlsx$/.test(name), 'bestandsnaam: ' + name);
const file = `${out}/${name}`; await dl.saveAs(file);
const res = execFileSync(process.execPath, ['tools/test-export.mjs', file], { encoding: 'utf8' });
ok(!/FOUT/.test(res), `export uit de browser teruggelezen (${res.trim().split('\n').length} checks${/FOUT/.test(res) ? ':\n' + res : ''})`);

// achter de schermen
await page.click('#achter'); await page.waitForSelector('.achter'); await wait(500); await shot('52-achter');
const text = await page.$eval('.achter', e => e.textContent);
ok(!/[–—]/.test(text), 'achter de schermen zonder em/en dashes');

// 404
await page.goto(base + '#/spookhuis'); await wait(800); await shot('53-404');
ok((await page.textContent('body')).includes('tijdelijk gesloten wegens een technische storing'), '404-tekst');

// Witte Stip op het plein
await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('dispatch.demo.v1')); d.profiles.find(p => p.key === 'wouter').settings = {}; localStorage.setItem('dispatch.demo.v1', JSON.stringify(d)); });
await page.goto(base + '&nu=2026-10-14T20:30#/'); await page.reload(); await page.waitForSelector('#pb'); await wait(800);
const box = await page.$eval('#pb', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, vis: r.left + r.width / 2 < innerWidth - 4 && r.left >= 0 }; });
ok(box.vis, 'bordje Point Blanc is zichtbaar en tikbaar');
await page.mouse.click(box.x, box.y); await wait(700); const overlay = !!(await page.$('#dotfound.show')); await shot('54-witte-stip');
ok(overlay && (await settings()).dots?.includes('pointblanc') && !(await settings()).musicUnlocked, 'Point Blanc op Spelen: witte stip gevonden (muziek pas na alle tien)');
await page.click('.idot .wdot'); await wait(900);
ok((await settings()).dots?.includes('logo-i'), 'witte stip op de i van het logo');

// park gesloten en halloween
await page.goto(base + '&nu=2026-10-14T23:40#/'); await page.reload(); await wait(6000); await shot('55-gesloten');
ok(await page.$('.scene.closed') && (await page.textContent('#greet')).includes('gesloten'), 'na 23:00: park gesloten, lampjes uit, alleen de sterren');
await page.goto(base + '&nu=2026-10-31T21:00#/'); await page.reload(); await wait(1500); await shot('56-halloween');
ok(await page.evaluate(() => document.documentElement.classList.contains('halloween')), 'halloween-sfeer tussen 24 oktober en 2 november');

// ideeënbus: op elk scherm dezelfde plek, idee en bug posten, samen te zien
await page.goto(base + '#/'); await page.reload(); await page.waitForSelector('.vb-panel'); await wait(600);
const pos = async () => page.$eval('#ideabtn', b => { const r = b.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.bottom); });
const p1 = await pos(); await page.click('#nav a[data-tab=samen]'); await wait(700); const p2 = await pos(); await page.click('#nav a[data-tab=programma]'); await wait(700); const p3 = await pos();
ok(p1 === p2 && p2 === p3, `ideeënbus op elk scherm op dezelfde plek (${p1})`);
await page.click('#ideabtn'); await wait(500);
await page.fill('#ibtext', 'Een spelvorm met alleen nieuwe banen'); await page.click('#ibsend'); await wait(1400);
await page.click('.ib-tabs [data-t=post]'); await page.click('[data-k=bug]'); await page.fill('#ibtext', 'Knop doet niets op Ranking'); await page.click('#ibsend'); await wait(1400);
await shot('57-ideeenbus');
const ideas = await page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.demo.v1')).ideas);
const me = await page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.demo.v1')).profiles.find(p => p.key === 'wouter').id);
ok(ideas.length === 2 && ideas.every(x => x.user_id === me && x.text && ['idee', 'bug'].includes(x.kind)) && ideas.find(x => x.kind === 'bug').context.screen === 'Ranking', 'briefjes bewaard met categorie, tekst, afzender en scherm');
ok((await page.$$('.ib-card')).length === 2 && (await page.$$('.ib-group.s-nieuw .ib-card')).length === 2, 'beide briefjes zichtbaar onder In de bus');
await page.click('#ibf [data-f=bug]'); await wait(200);
ok((await page.$$('.ib-card')).length === 1, 'filter op bugs');
await page.click('.ib-card .ib-main'); await page.click('.ib-card [data-s=gepland]'); await wait(300);
ok((await page.evaluate(() => JSON.parse(localStorage.getItem('dispatch.demo.v1')).ideas.find(x => x.kind === 'bug').status)) === 'gepland' && !!(await page.$('.ib-group.s-gepland')), 'status op de planning gezet');
// Luca ziet het briefje van Wouter, met een rood cijfertje op de brievenbus
await page.keyboard.press('Escape'); await wait(500); await page.evaluate(() => localStorage.setItem('dispatch.demo.me', 'luca')); await page.reload(); await page.waitForSelector('#ideabtn:not([hidden])'); await wait(800);
ok(await page.$eval('.ib-badge', b => !b.hidden && b.textContent === '2'), 'Luca ziet 2 nieuwe briefjes op de brievenbus');
await page.click('#ideabtn'); await page.click('.ib-tabs [data-t=bus]'); await wait(300);
ok((await page.$$('.ib-card')).length === 2 && !(await page.$('.ib-card [data-del]')) && await page.$eval('.ib-badge', b => b.hidden), 'Luca leest de bus, kan Wouters briefjes niet terughalen, cijfertje weg');
await page.keyboard.press('Escape'); await page.evaluate(() => localStorage.setItem('dispatch.demo.me', 'wouter'));

// manifest en iconen
const man = await (await page.request.get('http://localhost:8129/manifest.webmanifest')).json();
const icons = await Promise.all(man.icons.map(i => page.request.get('http://localhost:8129/' + i.src).then(r => r.status())));
ok(man.display === 'standalone' && icons.every(s => s === 200), 'manifest met iconen ' + man.icons.map(i => i.sizes).join(', '));

ok(!errors.length, 'geen consolefouten' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));
await browser.close(); server.close();
