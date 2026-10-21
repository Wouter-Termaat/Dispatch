// Mobiele controle: alle schermen op meerdere telefoonformaten, met touch. node tools/audit-mobile.mjs [filter]
// Zoekt automatisch naar: horizontaal overlopen, elementen buiten beeld, kleine tikvlakken, overlap met de navigatie, consolefouten.
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const only = process.argv.slice(2).find(a => !a.startsWith('--')) || '';
const out = process.argv.includes('--laptop') ? 'test-results/audit-lap' : 'test-results/audit'; await mkdir(out, { recursive: true });
const server = await serve(process.argv.includes('--laptop') ? 8134 : 8136);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const base = `http://localhost:${process.argv.includes('--laptop') ? 8134 : 8136}/?demo=1`;
const PHONES = {
  s8: { ...devices['Galaxy S8'] },                      // 360 x 740
  p7: { ...devices['Pixel 7'] },                        // 412 x 915
  i13: { ...devices['iPhone 13'], defaultBrowserType: undefined }, // 390 x 844 (alleen maat)
  small: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent },
  land: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent },
};
for (const k in PHONES) delete PHONES[k].defaultBrowserType;
if (process.argv.includes('--laptop')) { for (const k in PHONES) delete PHONES[k]; Object.assign(PHONES, { lap: { viewport: { width: 1440, height: 900 }, hasTouch: true }, lapsm: { viewport: { width: 1280, height: 720 }, hasTouch: true }, tab: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }); }

// scenario's: [naam, hash, actie(page) optioneel]
const wait = (p, ms) => p.waitForTimeout(ms);
const SC = [
  ['spelen', '#/'], ['spelen-rij', '#/', async p => { await p.tap('.mode-t[data-k=rij]'); await wait(p, 300); }],
  ['park-kies', '#/', async p => { await p.tap('.mode-t[data-k=park]'); await p.tap('#start'); await wait(p, 600); }],
  ['duel', '#/duel'], ['duel-gekozen', '#/duel', async p => { await p.tap('#stage .card.a'); await wait(p, 120); }],
  ['rangee', '#/rangee'], ['rangee-slepen', '#/rangee', async p => { const c = await p.$$('#line .card'); const a = await c[3].boundingBox(), b = await c[0].boundingBox(); await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move(b.x + b.width, a.y + a.height / 2, { steps: 8 }); await wait(p, 200); }],
  ['ranking', '#/programma'], ['ranking-ext', '#/programma', async p => { await p.tap('#vbtn'); await wait(p, 300); }],
  ['ranking-zoek', '#/programma', async p => { await p.tap('#q'); await p.keyboard.type('vek'); await wait(p, 400); }],
  ['ranking-label', '#/programma', async p => { await p.fill('#q', 'eft'); await wait(p, 300); await p.tap('#sugg [data-s]'); await wait(p, 300); }],
  ['ranking-parken', '#/programma', async p => { await p.tap('#seg [data-t=park]'); await wait(p, 300); }],
  ['baankaart', '#/programma', async p => { await p.tap('#list .li'); await wait(p, 600); }],
  ['baankaart-wijzig', '#/programma', async p => { await p.tap('#list .li'); await wait(p, 500); await p.tap('[data-a=edit]'); await wait(p, 300); }],
  ['samen', '#/samen'], ['samen-verhalen', '#/samen', async p => { await p.tap('#seg [data-t=verhalen]'); await wait(p, 300); }], ['samen-gezamenlijk', '#/samen', async p => { await p.tap('#seg [data-t=samen]'); await wait(p, 300); }],
  ['samen-bucket', '#/samen', async p => { await p.tap('#seg [data-t=bucket]'); await wait(p, 300); }],
  ['meer', '#/meer'], ['meer-onder', '#/meer', async p => { await p.$eval('.meer', e => (e.scrollTop = 9999)); await wait(p, 300); }],
  ['achter', '#/achter'], ['toevoegen', '#/toevoegen'], ['toevoegen-gok', '#/toevoegen', async p => { await p.tap('#res .res'); await wait(p, 400); }],
  ['toevoegen-nieuw', '#/toevoegen', async p => { await p.tap('#new'); await wait(p, 400); }],
  ['toernooi', '#/toernooi'], ['toernooi-bracket', '#/toernooi', async p => { await p.tap('.mode[data-k=random]'); await wait(p, 400); }],
  ['toernooi-match', '#/toernooi', async p => { await p.tap('.mode[data-k=random]'); await wait(p, 300); await p.tap('#go'); await wait(p, 600); }],
  ['affiche', '#/affiche', null, '', async p => { await p.evaluate(() => localStorage.setItem('dispatch.lastSession', JSON.stringify({ kind: 'duel', mode: 'duel', date: new Date().toISOString(), rows: 0, duels: 10, checks: 0, riser: { id: 'taron-phantasialand', delta: 7 }, faller: { id: 'hyperion-energylandia', delta: -3 }, hardest: ['taron-phantasialand', 'voltron-europa-park'], certainty: .36 }))); }],
  ['404', '#/spookhuis'], ['login', '#/login', null, '', async p => { await p.evaluate(() => localStorage.removeItem('dispatch.demo.me')); }],
];

// automatische checks in de pagina
const CHECK = () => {
  const W = innerWidth, H = innerHeight, issues = [];
  const vis = el => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const inScroller = el => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX + s.overflowY) && p !== document.body) return p; } return null; };
  const name = el => (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 28) + '"';
  if (document.documentElement.scrollWidth > W + 1) issues.push(`pagina scrollt horizontaal (${document.documentElement.scrollWidth}px)`);
  const nav = document.getElementById('nav'); const navOn = nav && !nav.classList.contains('away'); const navTop = navOn ? nav.getBoundingClientRect().top : H;
  const ui = [...document.querySelectorAll('#screen button, #screen a, #screen input, #screen select, #screen .card, #sheet button, #sheet input' + (navOn ? ', #nav a' : ''))].filter(el => vis(el) && !el.closest('.out'));
  for (const el of ui) {
    const r = el.getBoundingClientRect(); const sc = inScroller(el);
    if (!sc && (r.right > W + 1 || r.left < -1)) issues.push(`buiten beeld (x): ${name(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
    if (!sc && (r.bottom > H + 1)) issues.push(`buiten beeld (y): ${name(el)} onderkant ${Math.round(r.bottom)}`);
    if (!sc && navOn && !el.closest('#nav') && !el.closest('#sheet') && r.bottom > navTop + 4 && r.top < H) issues.push(`onder de navigatie: ${name(el)}`);
    const small = Math.min(r.width, r.height) < 32 && !el.closest('.chips.active, .note, .bk-why') && !el.matches('.stip, .wdot, input, .nl')   // witte stippen zijn bewust klein; hun tikvlak is via ::after groter;
    if (small && el.tagName !== 'INPUT') issues.push(`klein tikvlak ${Math.round(r.width)}x${Math.round(r.height)}: ${name(el)}`);
  }
  // de hoekknoppen (ideeënbus en muziek) mogen niet over een knop van het scherm vallen
  if (document.getElementById('sheet').hidden) for (const cb of [...document.querySelectorAll('#ideabtn, .music-btn')].filter(vis)) {
    const a = cb.getBoundingClientRect();
    for (const el of ui) { if (inScroller(el)) continue; const r = el.getBoundingClientRect(); if (r.left < a.right - 1 && r.right > a.left + 1 && r.top < a.bottom - 1 && r.bottom > a.top + 1) issues.push(`hoekknop ${cb.id || cb.className} overlapt ${name(el)}`); }
  }
  // tekst die uit zijn vak loopt
  for (const el of [...document.querySelectorAll('#screen .nm, #screen b, #screen h1, #screen h2, #screen .eyebrow, #screen small, #screen p, #sheet h3, #sheet p')].filter(vis)) {
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'visible' && getComputedStyle(el).whiteSpace === 'nowrap') issues.push(`tekst loopt uit: ${name(el)}`);
    const r = el.getBoundingClientRect(); if (!inScroller(el) && (r.right > W + 2 || r.left < -2)) issues.push(`tekst buiten beeld: ${name(el)}`);
  }
  // tekst die buiten zijn vlak (kaart, paneel, knop, chip, blad) valt
  const PANEL = '.card .face, .vb-panel, .sheet, .ticket-in, .aff, .tk, .mode-t, .btn, .ghost, .chip, .pills button, .label, .stop, .tool, .sortsel, .res, .b-match, .b-slot, .ck-list li, .search, .suggest button, .m-link, .dotfound, .netpill, .pb-sign, .music-panel, .toast.show, .clash, .li';
  const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el || !vis(el) || el.closest('.out, #boot, [hidden]')) continue;
    const panel = el.closest(PANEL); if (!panel || !vis(panel)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const tr = rg.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    if (!tr.width) continue;
    if (el.closest('.mt') && getComputedStyle(el.closest('.mt')).overflow === 'hidden') continue;   // bewust afgekapt met puntjes
    const scrolls = panel.matches('.sheet');   // bladen scrollen: alleen horizontaal controleren
    const over = scrolls ? Math.max(pr.left - tr.left, tr.right - pr.right) : Math.max(pr.left - tr.left, tr.right - pr.right, pr.top - tr.top, tr.bottom - pr.bottom);
    if (over > 2) issues.push(`tekst valt buiten ${panel.className.split(' ')[0] || panel.tagName} (${Math.round(over)}px): "${n.textContent.trim().slice(0, 30)}"`);
    // afgekapt zonder puntjes
    const cs = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis' && !cs.webkitLineClamp?.match?.(/\d/) && el.clientWidth > 0) issues.push(`tekst afgekapt: "${n.textContent.trim().slice(0, 30)}"`);
  }
  // witte stippen: moeten in beeld en niet half onder iets anders liggen
  for (const d of document.querySelectorAll('[data-dot]')) {
    if (!vis(d) || d.closest('.out') || !document.getElementById('sheet').hidden) continue; const r = d.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cx > W || cy < 0 || cy > H) continue;
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== d && !d.contains(top) && !top.closest('.vig,.grain')) issues.push(`witte stip ${d.dataset.dot} ligt onder ${top.className || top.tagName}`);
  }
  return [...new Set(issues)];
};

const report = [];
for (const [pname, dev] of Object.entries(PHONES)) {
  const ctx = await browser.newContext({ ...dev });
  for (const [sname, hash, act, q, pre] of SC) {
    if (only && !sname.includes(only) && !pname.includes(only)) continue;
    const page = await ctx.newPage(); const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await page.goto(base + (q ? '&' + q : '') + '#/'); await page.evaluate(() => { localStorage.setItem('dispatch.demo.me', 'wouter'); });
    if (pre) await pre(page);
    await page.goto(base + (q ? '&' + q : '') + hash); await page.reload(); await wait(page, 1600);
    try { if (act) await act(page); } catch (e) { errs.push('actie mislukt: ' + e.message.split('\n')[0]); }
    await wait(page, 700);
    const issues = await page.evaluate(CHECK);
    await page.screenshot({ path: `${out}/${pname}-${sname}.png` });
    report.push({ phone: pname, screen: sname, issues, errs });
    if (issues.length || errs.length) console.log(`${pname} ${sname}:\n  ` + [...issues, ...errs.map(e => 'FOUT ' + e)].join('\n  '));
    await page.close();
  }
  await ctx.close();
}
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(`\n${report.length} schermen gecontroleerd, ${report.filter(r => r.issues.length || r.errs.length).length} met meldingen.`);
await browser.close(); server.close();
