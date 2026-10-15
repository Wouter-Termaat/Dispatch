// Tweede bron: Captain Coaster. Per baan de meest gewaardeerde foto's van gebruikers (recent en tot 1440 pixels).
//   node tools/photos/cc.mjs alle | <id> ...    kandidaten ophalen naar fotos/cc.json en fotos/kandidaten/<id>/1xx.jpg
//   node tools/photos/cc.mjs --merge            optioneel: blijvend toevoegen aan fotos/kandidaten.json (sheet en kies lezen cc.json ook zelf)
// Banen worden gevonden via de sitemap; nummers vanaf 101, zodat ze nooit botsen met die van RCDB.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const DIR = new URL('fotos/', ROOT);
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36' };
const WANT = 12;
const wait = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
const toks = s => norm(s).split(' ').filter(Boolean);

let lastT = 0;
async function get(url, json = false) {
  const gap = 1000 - (Date.now() - lastT); if (gap > 0) await wait(gap);
  lastT = Date.now();
  const r = await fetch(url, { headers: { ...UA, 'X-Requested-With': 'XMLHttpRequest' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}

async function sitemap() {
  const f = new URL('cc-sitemap.txt', DIR);
  if (existsSync(f)) return (await readFile(f, 'utf8')).split('\n').filter(Boolean);
  const x = await (await get('https://captaincoaster.com/sitemap.xml')).text();
  const list = [...x.matchAll(/<loc>https:\/\/captaincoaster\.com\/en\/coasters\/(\d+)\/([^<]+)<\/loc>/g)].map(m => `${m[1]} ${m[2]}`);
  await writeFile(f, list.join('\n')); return list;
}

// slug "taron-phantasialand": naam en park zitten erin; we zoeken de slug die precies naam + park is, of het dichtst daarbij.
// Lidwoorden tellen niet mee ("Der Schwur des Kärnan" is schwur-des-karnan) en "Moviepark" is ook "movie-park".
const STOP = new Set(['der', 'die', 'das', 'de', 'het', 'the', 'la', 'le', 'el']);
function match(list, c, alt) {
  for (const name of [c.name, alt].filter(Boolean)) {
    const want = [...toks(name), ...toks(c.park)].join('-');
    const exact = list.find(l => l.split(' ')[1] === want); if (exact) return exact.split(' ')[1];
  }
  // anders aan elkaar geschreven vergelijken: "Wickerman" is wicker-man, "F.L.Y." is fly, "Timburcoaster" is timbur-coaster
  let best = null, bs = -1;
  for (const name of [c.name, alt].filter(Boolean)) {
    const N = toks(name).filter(w => !STOP.has(w)).join(''), P = toks(c.park), park = P.join('');
    if (!N) continue;
    for (const l of list) {
      const slug = l.split(' ')[1], t = slug.split('-'), flat = t.join('');
      if (!flat.includes(N)) continue;                                   // de hele naam moet erin staan
      const p = flat === N ? 1 : flat.includes(park) ? 1 : P.filter(w => t.includes(w)).length / P.length;   // een slug zonder park mag als het precies de naam is
      const s = p - (flat.length - N.length - (flat.includes(park) ? park.length : 0)) * 0.01;
      if (p >= .5 && s > bs) { bs = s; best = slug; }
    }
    if (best) return best;
  }
  return null;
}

async function images(slug) {
  const h = await (await get(`https://captaincoaster.com/en/coasters/${slug}/images/ajax/${WANT}`)).text();
  // per foto een groep met hetzelfde id: /i/<id>/<hash>/<variant>/<maat>/<slug>.jpg
  const urls = [...h.matchAll(/https:\/\/pictures\.captaincoaster\.com\/i\/(\d+)\/[^"' )]+?\/(\d+)x(\d+)\/[^"' )]+?\.jpg/g)];
  const by = new Map();
  for (const m of urls) { const g = by.get(m[1]) || {}; g[m[2] + 'x' + m[3]] = m[0]; by.set(m[1], g); }
  return [...by.entries()].filter(([, g]) => g['1440x1440'] && g['280x210']).map(([id, g]) => ({ id, thumb: g['280x210'], big: g['1440x1440'] }));
}

async function run(list) {
  const file = new URL('cc.json', DIR);
  const db = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {};
  const sm = await sitemap();
  // de huidige naam volgens RCDB (bijvoorbeeld MP Xpress heet nu Iron Claw)
  const kf = new URL('kandidaten.json', DIR);
  const rc = existsSync(kf) ? JSON.parse(await readFile(kf, 'utf8')) : {};
  const altOf = id => (rc[id]?.title || '').replace(/\s*\(.*$/, '').split(' - ')[0] || null;
  for (const c of list) {
    if (db[c.id]?.slug) continue;
    try {
      const slug = match(sm, c, altOf(c.id));
      if (!slug) { db[c.id] = { slug: null, pics: [] }; console.log('GEEN  ', c.name, '|', c.park); continue; }
      const imgs = await images(slug);
      const dir = new URL(`kandidaten/${c.id}/`, DIR); await mkdir(dir, { recursive: true });
      const pics = [];
      for (const [i, im] of imgs.entries()) {
        const n = 101 + i;
        await writeFile(new URL(`${n}.jpg`, dir), Buffer.from(await (await get(im.thumb)).arrayBuffer()));
        pics.push({ n, src: 'cc', ccPic: im.id, url: im.big, w: 1440, h: 1080 });
      }
      db[c.id] = { slug, pics };
      console.log(String(pics.length).padStart(2), c.name, '|', c.park, '=>', slug);
    } catch (e) { console.log('FOUT  ', c.name, e.message); }
    await writeFile(file, JSON.stringify(db, null, 1));
  }
}

async function merge() {
  const kf = new URL('kandidaten.json', DIR), cf = new URL('cc.json', DIR);
  const k = JSON.parse(await readFile(kf, 'utf8')), cc = JSON.parse(await readFile(cf, 'utf8'));
  const seed = JSON.parse(await readFile(new URL('data/seed.json', ROOT), 'utf8')).coasters;
  let n = 0;
  for (const [id, v] of Object.entries(cc)) {
    const c = seed.find(x => x.id === id);
    k[id] ||= { name: c.name, park: c.park, rcdb: null, title: '', total: 0, pics: [] };
    const have = new Set(k[id].pics.map(p => p.n));
    for (const p of v.pics) if (!have.has(p.n)) { k[id].pics.push(p); n++; }
    k[id].cc = v.slug;
  }
  await writeFile(kf, JSON.stringify(k, null, 1)); console.log('samengevoegd:', n, 'foto\'s');
}

const seed = JSON.parse(await readFile(new URL('data/seed.json', ROOT), 'utf8')).coasters;
const arg = process.argv.slice(2);
if (arg[0] === '--merge') await merge();
else await run(arg[0] === 'alle' ? seed : arg.map(id => seed.find(c => c.id === id)).filter(Boolean));
