// Meet hoe zwaar Spelen is op een telefoon: aantal gecomposite lagen, hun geheugen en de framerate.
//   node tools/perf-mobile.mjs [#/duel] [--zwaar] [--top]     --zwaar = zonder de lichte modus (ter vergelijking)
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const zwaar = process.argv.includes('--zwaar');
const server = await serve(8134);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: zwaar ? false : true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const route = process.argv.find(a => a.startsWith('#/')) || '#/';
await page.goto('http://localhost:8134/?demo=1#/'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dispatch.demo.me', 'wouter'); }); await page.reload();
await page.waitForSelector('.vb-panel');
if (route !== '#/') { await page.evaluate(r => { location.hash = r; }, route); }
await page.waitForTimeout(3000);
await cdp.send('LayerTree.enable'); const layers = await new Promise(r => cdp.once('LayerTree.layerTreeDidChange', e => r(e.layers || [])));
if (process.argv.includes('--top')) {
  const big = layers.filter(l => l.drawsContent).sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 14);
  for (const l of big) { let name = ''; try { if (l.backendNodeId) { const d = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId }); name = d.node.localName + '.' + ((d.node.attributes || []).join(' ').match(/class (\S+( \S+)?)/)?.[1] || ''); } } catch {} console.log(String(l.width) + 'x' + l.height, name); }
}
const px = layers.filter(l => l.drawsContent).reduce((s, l) => s + l.width * l.height, 0) * 2.625 ** 2;
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
console.log(`${route} ${zwaar ? 'zwaar' : 'licht'}: lite=${await page.evaluate(() => document.documentElement.classList.contains('lite'))} lagen=${layers.filter(l => l.drawsContent).length} grafisch geheugen ~${Math.round(px * 4 / 1048576)} MB, ${fps.toFixed(0)} fps bij 4x tragere CPU`);
await browser.close(); server.close();
