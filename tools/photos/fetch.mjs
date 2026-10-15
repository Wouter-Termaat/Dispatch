// Haalt per achtbaan kandidaatfoto's op van RCDB, voor eigen gebruik. Niets hiervan gaat in git: alles komt in fotos/.
//   node tools/photos/fetch.mjs proef            de banen uit fotos/proef.json
//   node tools/photos/fetch.mjs alle             alle banen uit data/seed.json zonder kandidaten
//   node tools/photos/fetch.mjs <id> [<id>...]    losse banen
//   node tools/photos/fetch.mjs meer <id> ...     extra kandidaten erbij (volgende RCDB-foto's en meer van het web)
// Bronnen: RCDB (fanfoto's per baan) en een afbeeldingenzoekopdracht via DuckDuckGo (parkblogs, persfoto's).
// Resultaat: fotos/kandidaten/<id>/<n>.jpg (klein, om te kiezen) en fotos/kandidaten.json met de bron per foto.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const ROOT = new URL('../../', import.meta.url);
const DIR = new URL('fotos/', ROOT);
const MAX = 24, WEB = 12;   // zoveel kandidaten bekijk ik zelf per baan, als kleine plaatjes
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

// Afbeeldingen zoeken. Alleen grote, liggende foto's; YouTube-stills, Pinterest en RCDB zelf (die hebben we al) vallen af.
const SKIP = /ytimg|fbsbx|pinimg|rcdb\.com|ebay|amazon|alamy|shutterstock|istockphoto|dreamstime|gettyimages|tiktok/;
async function web(c, want) {
  const q = `${c.name} ${c.park} roller coaster`;
  const h = await (await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(q) + '&iax=images&ia=images', { headers: UA })).text();
  const vqd = (h.match(/vqd=["']?([\d-]+)/) || [])[1]; if (!vqd) return [];
  const r = await fetch(`https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=size:Large,,,&p=1`, { headers: { ...UA, Referer: 'https://duckduckgo.com/' } });
  const j = await r.json().catch(() => ({}));
  return (j.results || []).filter(x => x.width >= 1200 && x.width >= x.height * 1.2 && !SKIP.test(x.image)).slice(0, want);
}
async function grab(url, ms = 15000) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) }); if (!r.ok) throw new Error(r.status);
  return Buffer.from(await r.arrayBuffer());
}

const size = (p, w) => (p.sizes || []).find(s => s.width >= w) || p.sizes?.at(-1) || p;

async function run(list, meer = false) {
  await mkdir(new URL('kandidaten/', DIR), { recursive: true });
  const dbFile = new URL('kandidaten.json', DIR);
  const db = existsSync(dbFile) ? JSON.parse(await readFile(dbFile, 'utf8')) : {};
  for (const c of list) {
    try {
      const prev = meer ? db[c.id] : null;
      const rid = prev?.rcdb ?? await findCoaster(c);
      const { title, pics } = rid ? await pictures(rid) : { title: '', pics: [] };
      // liggende foto's eerst (die passen op elke kaart), dan staande
      const have = new Set((prev?.pics || []).map(p => p.rcdbPic || p.url));
      // Wouter keurde vooral te kleine, oude foto's af: grote en nieuwe eerst, liggend boven staand
      const sorted = [...pics].filter(p => !have.has(p.id) && p.width >= 1000)
        .sort((a, b) => (b.width >= b.height) - (a.width >= a.height) || (b.width >= 1200) - (a.width >= 1200) || String(b.copy_date).localeCompare(String(a.copy_date)));
      const dir = new URL(`kandidaten/${c.id}/`, DIR); await mkdir(dir, { recursive: true });
      const out = [...(prev?.pics || [])]; let n = out.reduce((m, p) => Math.max(m, p.n), 0);
      for (const p of sorted.slice(0, MAX)) {
        const buf = Buffer.from(await (await get(size(p, 260).url)).arrayBuffer());
        await writeFile(new URL(`${++n}.jpg`, dir), buf);
        out.push({ n, src: 'rcdb', rcdbPic: p.id, w: p.width, h: p.height, sizes: p.sizes, by: p.copy_name, date: p.copy_date });
      }
      let webN = 0;
      for (const x of await web(c, WEB * (meer ? 2 : 1))) {
        if (have.has(x.image)) continue;
        try {
          const thumb = await sharp(await grab(x.image)).resize(390, 260, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
          await writeFile(new URL(`${++n}.jpg`, dir), thumb); webN++;
          out.push({ n, src: 'web', url: x.image, w: x.width, h: x.height, by: x.source || new URL(x.image).host, title: x.title });
        } catch { /* dode link of geen afbeelding */ }
      }
      db[c.id] = { name: c.name, park: c.park, rcdb: rid, title: title || prev?.title || '', total: pics.length, pics: out };
      console.log(`${String(out.length).padStart(2)} (rcdb ${pics.length}, web ${webN})`, c.name, '|', c.park, '=>', rid ? title : 'niet op RCDB');
    } catch (e) { console.log('FOUT  ', c.name, e.message); }
    await writeFile(dbFile, JSON.stringify(db, null, 1));
  }
}

const seed = JSON.parse(await readFile(new URL('data/seed.json', ROOT), 'utf8')).coasters;
const arg = process.argv.slice(2);
let list;
if (arg[0] === 'proef') list = JSON.parse(await readFile(new URL('proef.json', DIR), 'utf8')).map(id => seed.find(c => c.id === id));
else if (arg[0] === 'alle') { const done = existsSync(new URL('kandidaten.json', DIR)) ? JSON.parse(await readFile(new URL('kandidaten.json', DIR), 'utf8')) : {}; list = seed.filter(c => !done[c.id]); }
else if (arg[0] === 'meer') list = arg.slice(1).map(id => seed.find(c => c.id === id)).filter(Boolean);
else list = arg.map(id => seed.find(c => c.id === id)).filter(Boolean);
await run(list, arg[0] === 'meer');
