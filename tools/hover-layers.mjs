// Zoekt knoppen die bij hover tijdelijk een laag aanmaken (dat flitst in Chrome op de Mac).
//   node tools/hover-layers.mjs ["#/,#/meer"]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const server = await serve(8138);
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
await page.goto('http://localhost:8138/?demo=1#/'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dispatch.demo.me', 'wouter'); }); await page.reload();
await page.waitForSelector('.vb-panel');
await cdp.send('LayerTree.enable'); let last = []; cdp.on('LayerTree.layerTreeDidChange', e => { if (e.layers) last = e.layers; });
const count = async () => { await page.waitForTimeout(90); return last.filter(l => l.drawsContent).length; };
for (const r of (process.argv[2] || '#/,#/duel,#/rij,#/ranking,#/samen,#/meer,#/achter').split(',')) {
  await page.evaluate(r => { location.hash = r; }, r); await page.waitForTimeout(2500);
  await page.mouse.move(2, 2); await page.waitForTimeout(500);
  const base = await count(); const hits = new Map();
  const els = await page.$$('#screen button, #screen a, #screen [role=button], #screen .li, #screen .card, nav a, .mode-t');
  for (const el of els.slice(0, 80)) {
    if (!(await el.isVisible())) continue;
    try { await el.hover({ timeout: 500 }); } catch { continue; }
    const c = await count();
    if (c !== base) { const d = await el.evaluate(e => e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + (e.id ? '#' + e.id : '')); hits.set(d, (hits.get(d) || '') + `${base}->${c} `); }
    await page.mouse.move(2, 2); await page.waitForTimeout(450);
  }
  console.log(r, 'basis', base, [...hits].map(([k, v]) => k + ' ' + v).join(' | ') || 'geen');
}
await browser.close(); server.close();
