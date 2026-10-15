// Haalt per achtbaan kandidaatfoto's op van RCDB, voor eigen gebruik. Niets hiervan gaat in git: alles komt in fotos/.
//   node tools/photos/fetch.mjs proef            de banen uit fotos/proef.json
//   node tools/photos/fetch.mjs alle             alle banen uit data/seed.json zonder kandidaten
//   node tools/photos/fetch.mjs <id> [<id>...]    losse banen
// Resultaat: fotos/kandidaten/<id>/<n>.jpg (270 breed) en fotos/kandidaten.json met de bron per foto.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const DIR = new URL('fotos/', ROOT);
const MAX = 24;   // zoveel kandidaten bekijk ik zelf per baan, als kleine plaatjes
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36' };
const wait = ms => new Promise(r => setTimeout(r, ms));

const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
const words = s => new Set(norm(s).split(' ').filter(w => w.length > 1 && !['the', 'ride', 'de', 'der', 'die', 'la', 'le', 'el'].includes(w)));
function score(a, b) {
  if (norm(a).replace(/ /g, '') === norm(b).replace(/ /g, '')) return 1;
  const A = words(a), B = words(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.max(A.size, B.size);
}

let lastUrl = '';
let lastT = 0;
async function get(path) {
  const gap = 900 - (Date.now() - lastT); if (gap > 0) await wait(gap);   // rustig aan bij RCDB
  lastT = Date.now();
  const r = await fetch('https://rcdb.com' + path, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r;
}
const html = async p => { const r = await get(p); const t = await r.text(); lastUrl = r.url; return t; };
// een titel als "Taron - Phantasialand (Brühl, ...)" opsplitsen in baan en park
const split = t => { const m = t.replace(/\s*\(.*$/, '').match(/^(.*) - (.*)$/); return m ? { name: m[1], park: m[2] } : { name: t.replace(/\s*\(.*$/, ''), park: '' }; };
const titleOf = h => ((h.match(/<title>([^<]*)/) || [])[1] || '').replace(/&amp;/g, '&');
const links = h => [...h.matchAll(/<a href=\/(\d+)\.htm>([^<]*)<\/a>/g)].map(m => ({ id: m[1], name: m[2].replace(/&amp;/g, '&').replace(/&#39;/g, "'") }));

const parks = new Map();
async function parkCoasters(park) {
  if (parks.has(park)) return parks.get(park);
  const h = await html('/qs.htm?qs=' + encodeURIComponent(park));
  // zoekresultaten staan als "<a baan> - <a park>"; een park zelf als losse link
  const hit = links(h).map(l => ({ ...l, s: score(l.name, park) })).filter(l => l.s >= .5).sort((a, b) => b.s - a.s)[0];
  let list = [];
  if (hit) {
    const p = await html(`/${hit.id}.htm`);
    const title = titleOf(p);
    if (score(title.split('(')[0], park) >= .5) list = links(p);
  }
  parks.set(park, list); return list;
}

async function findCoaster(c) {
  // 1. op naam zoeken, met het park ernaast
  const h = await html('/qs.htm?qs=' + encodeURIComponent(c.name));
  // één treffer: RCDB stuurt direct door naar de baan (ook bij een oude naam), dan alleen het park controleren
  if (/id=pic_json/.test(h)) { const t = split(titleOf(h)); const id = (lastUrl.match(/\/(\d+)\.htm/) || [])[1]; if (id && score(t.park, c.park) >= .5) return id; }
  const pairs = [...h.matchAll(/<a href=\/(\d+)\.htm>([^<]*)<\/a> - <a href=\/\d+\.htm>([^<]*)/g)]
    .map(m => ({ id: m[1], name: m[2], park: m[3], s: score(m[2], c.name) + score(m[3], c.park) }))
    .filter(p => score(p.park, c.park) >= .5 && score(p.name, c.name) >= .5).sort((a, b) => b.s - a.s);
  if (pairs[0]) return pairs[0].id;
  // 2. de lijst van het park doorzoeken (andere schrijfwijze of oude naam)
  const list = await parkCoasters(c.park);
  const best = list.map(l => ({ ...l, s: score(l.name, c.name) })).sort((a, b) => b.s - a.s)[0];
  return best && best.s >= .34 ? best.id : null;
}

async function pictures(id) {
  const h = await html(`/${id}.htm`);
  const j = h.match(/id=pic_json>([^<]*)/);
  const title = (h.match(/<title>([^<]*)/) || [])[1] || '';
  if (!j) return { title, pics: [] };
  return { title, pics: JSON.parse(j[1]).pictures || [] };
}

const size = (p, w) => (p.sizes || []).find(s => s.width >= w) || p.sizes?.at(-1) || p;

async function run(list) {
  await mkdir(new URL('kandidaten/', DIR), { recursive: true });
  const dbFile = new URL('kandidaten.json', DIR);
  const db = existsSync(dbFile) ? JSON.parse(await readFile(dbFile, 'utf8')) : {};
  for (const c of list) {
    try {
      const rid = await findCoaster(c);
      if (!rid) { db[c.id] = { name: c.name, park: c.park, rcdb: null, pics: [] }; console.log('GEEN  ', c.name, '|', c.park); continue; }
      const { title, pics } = await pictures(rid);
      // liggende foto's eerst (die passen op elke kaart), dan staande
      const sorted = [...pics].sort((a, b) => (b.width >= b.height) - (a.width >= a.height));
      const keep = sorted.slice(0, MAX);
      const dir = new URL(`kandidaten/${c.id}/`, DIR); await mkdir(dir, { recursive: true });
      const out = [];
      for (const [i, p] of keep.entries()) {
        const s = size(p, 260);
        const buf = Buffer.from(await (await get(s.url)).arrayBuffer());
        await writeFile(new URL(`${i + 1}.jpg`, dir), buf);
        out.push({ n: i + 1, rcdbPic: p.id, w: p.width, h: p.height, sizes: p.sizes, by: p.copy_name, date: p.copy_date });
      }
      db[c.id] = { name: c.name, park: c.park, rcdb: rid, title, total: pics.length, pics: out };
      console.log(`${String(out.length).padStart(2)}/${String(pics.length).padEnd(3)}`, c.name, '|', c.park, '=>', title);
    } catch (e) { console.log('FOUT  ', c.name, e.message); }
    await writeFile(dbFile, JSON.stringify(db, null, 1));
  }
}

const seed = JSON.parse(await readFile(new URL('data/seed.json', ROOT), 'utf8')).coasters;
const arg = process.argv.slice(2);
let list;
if (arg[0] === 'proef') list = JSON.parse(await readFile(new URL('proef.json', DIR), 'utf8')).map(id => seed.find(c => c.id === id));
else if (arg[0] === 'alle') { const done = existsSync(new URL('kandidaten.json', DIR)) ? JSON.parse(await readFile(new URL('kandidaten.json', DIR), 'utf8')) : {}; list = seed.filter(c => !done[c.id]); }
else list = arg.map(id => seed.find(c => c.id === id)).filter(Boolean);
await run(list);
