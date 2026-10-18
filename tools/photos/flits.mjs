// Controleert of kaarten in een duel direct met foto verschijnen (geen flits van het getekende profiel naar de foto).
//   node tools/photos/flits.mjs [phone|laptop]   (demomodus, foto's uit fotos/web)
import { chromium } from 'playwright';
import { serve } from '../serve.mjs';
const which = process.argv[2] || 'phone';
const SIZES = { phone: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 }, laptop: { viewport: { width: 1440, height: 900 } } };
const server = await serve(8137);
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu'] });
const ctx = await b.newContext(SIZES[which]); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8137/?demo=1#/'); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('dispatch.demo.me', 'wouter'); }); await p.reload();
await p.waitForSelector('#start'); await p.waitForTimeout(800);
await p.click('#start'); await p.waitForSelector('#stage .card');
const res = [];
for (let i = 0; i < 8; i++) {
  await p.waitForSelector('#stage .card:not(.win):not(.lose)'); await p.waitForTimeout(60);
  res.push(await p.$$eval('#stage .card', cs => cs.map(c => { const i = c.querySelector('img.ph'); return !i ? 'geen' : i.classList.contains('now') ? 'direct' : 'overgang'; }).join('+')));
  await p.waitForTimeout(500); await p.click('#stage .card.a');
}
console.log(which, res.join(' | '), errs.length ? errs : '');
await b.close(); server.close();
