// Zet mijn keuzes klaar voor de keuzepagina: haalt de gekozen foto en de alternatieven groot op en vult fotos/keuze.json.
//   node tools/photos/kies.mjs fotos/mijnkeuze.json
// mijnkeuze.json: { "<id>": { "pick": 16, "alts": [7, 15, 4], "focus": { "x": 55, "y": 45 }, "note": "..." } }
// opts is de vaste rij keuzes (mijn keuze eerst), zodat wisselen nooit een optie wegdrukt.
// Bestaande beoordelingen in keuze.json (status, eigen wissels) blijven staan.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const DIR = new URL('../../fotos/', import.meta.url);
const mine = JSON.parse(await readFile(process.argv[2], 'utf8'));
const cand = JSON.parse(await readFile(new URL('kandidaten.json', DIR), 'utf8'));
const ccf = new URL('cc.json', DIR);
if (existsSync(ccf)) for (const [id, v] of Object.entries(JSON.parse(await readFile(ccf, 'utf8')))) if (cand[id]) { const have = new Set(cand[id].pics.map(p => p.n)); cand[id].pics.push(...v.pics.filter(p => !have.has(p.n))); }
const file = new URL('keuze.json', DIR);
const keuze = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {};
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const big = p => p.sizes.find(s => Math.max(s.width, s.height) >= 1600) || p.sizes.at(-1);

for (const [id, m] of Object.entries(mine)) {
  const c = cand[id]; if (!c) { console.log('onbekend', id); continue; }
  const dir = new URL(`groot/${id}/`, DIR); await mkdir(dir, { recursive: true });
  for (const n of [m.pick, ...m.alts]) {
    const out = new URL(`${n}.jpg`, dir); if (existsSync(out)) continue;
    const p = c.pics.find(x => x.n === n);
    const url = p.url || 'https://rcdb.com' + big(p).url;   // web en Captain Coaster hebben een eigen adres
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) }).catch(e => ({ ok: false, status: e.message }));
    if (!r.ok) { console.log('FOUT', id, n, r.status); continue; }
    // webfoto's kunnen webp, png of enorm zijn: altijd als jpg van hooguit 1600 breed bewaren
    await writeFile(out, await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer());
    await wait(p.src === 'rcdb' || !p.src ? 800 : 300);
  }
  // nieuwe rij opties (na een afkeuring): opnieuw beoordelen
  const opts = [m.pick, ...m.alts];
  const prev = String(keuze[id]?.opts) === String(opts) ? keuze[id] : {};
  keuze[id] = { name: c.name, park: c.park, note: m.note || '', opts, alts: m.alts, pick: prev.status ? prev.pick : m.pick, focus: prev.status ? prev.focus : m.focus, status: prev.status || '' };
  console.log('klaar', id);
}
await writeFile(file, JSON.stringify(keuze, null, 1));
