// Meet hoe zwaar een scherm is op een laptop met retinascherm (zoals een MacBook): lagen, grafisch geheugen,
// en of er lagen bijkomen of verdwijnen terwijl de muis beweegt (dat geeft op de Mac geflikker).
//   node tools/perf-desktop.mjs [#/route] [--top] [--dpr=2] [--w=1512] [--h=982]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const arg = (k, d) => +(process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const dpr = arg('dpr', 2), W = arg('w', 1512), H = arg('h', 982);
const server = await serve(8137);
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const route = process.argv.find(a => a.startsWith('#/')) || '#/';
await page.goto('http://localhost:8137/?demo=1#/'); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dispatch.demo.me', 'wouter'); }); await page.reload();
await page.waitForSelector('.vb-panel');
if (route !== '#/') await page.evaluate(r => { location.hash = r; }, route);
await page.waitForTimeout(3000);
await cdp.send('LayerTree.enable');
let last = [];
cdp.on('LayerTree.layerTreeDidChange', e => { if (e.layers) last = e.layers; });
const snap = async () => { await page.waitForTimeout(250); return last.filter(l => l.drawsContent); };
const mem = ls => Math.round(ls.reduce((s, l) => s + l.width * l.height, 0) * dpr * dpr * 4 / 1048576);
const name = async l => { try { if (l.backendNodeId) { const d = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId }); return d.node.localName + '.' + ((d.node.attributes || []).join(' ').match(/class (\S+( \S+)?)/)?.[1] || ''); } } catch {} return '?'; };
const s0 = await snap();
if (process.argv.includes('--top')) for (const l of [...s0].sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 16)) console.log(`${l.width}x${l.height}`, await name(l));
// muis over het scherm bewegen en tellen hoe vaak de lagenboom verandert
let changes = 0, counts = new Set([s0.length]); const onc = e => { if (e.layers) { changes++; counts.add(e.layers.filter(l => l.drawsContent).length); } };
cdp.on('LayerTree.layerTreeDidChange', onc);
for (let i = 0; i < 60; i++) { const t = i / 60; await page.mouse.move(W * (.1 + .8 * t), H * (.2 + .6 * Math.abs(Math.sin(t * 6)))); await page.waitForTimeout(30); }
cdp.off('LayerTree.layerTreeDidChange', onc);
const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log(`${route} ${W}x${H}@${dpr}: lagen=${s0.length} geheugen ~${mem(s0)} MB, lagenboom veranderde ${changes}x tijdens muisbeweging, aantallen ${[...counts].join('/')}, ${fps.toFixed(0)} fps`);
await browser.close(); server.close();
