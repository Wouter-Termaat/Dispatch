// Maakt per baan een contactvel met genummerde kandidaten, om zelf de mooiste te kiezen.
//   node tools/photos/sheet.mjs [id ...]      zonder ids: alle banen in fotos/kandidaten.json
// Resultaat: fotos/vellen/<id>.jpg, of <id>-2.jpg enzovoort bij meer dan 24 kandidaten. Webfoto's hebben een blauw nummer.
import { readFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const DIR = new URL('../../fotos/', import.meta.url);
const db = JSON.parse(await readFile(new URL('kandidaten.json', DIR), 'utf8'));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(db);
const W = 270, H = 180, COLS = 6, PAD = 6, HEAD = 34;
await mkdir(new URL('vellen/', DIR), { recursive: true });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
for (const id of ids) {
  const c = db[id]; if (!c?.pics?.length) continue;
  for (let part = 0; part * 24 < c.pics.length; part++) await sheet(id, c, part, c.pics.slice(part * 24, part * 24 + 24));
}
async function sheet(id, c, part, pics) {
  const rows = Math.ceil(pics.length / COLS);
  const width = COLS * (W + PAD) + PAD, height = HEAD + rows * (H + PAD) + PAD;
  const layers = [];
  for (const [i, p] of pics.entries()) {
    const x = PAD + (i % COLS) * (W + PAD), y = HEAD + PAD + Math.floor(i / COLS) * (H + PAD);
    const img = await sharp(fileURLToPath(new URL(`kandidaten/${id}/${p.n}.jpg`, DIR))).resize(W, H, { fit: 'contain', background: '#222' }).toBuffer();
    layers.push({ input: img, left: x, top: y });
    const tag = Buffer.from(`<svg width="96" height="24"><rect width="34" height="24" rx="4" fill="${p.src === 'web' ? '#1d5fd1' : '#000'}" opacity=".85"/><text x="17" y="17" font-family="Arial" font-size="15" font-weight="bold" fill="#fff" text-anchor="middle">${p.n}</text><rect x="38" width="56" height="24" rx="4" fill="${p.w < 1200 ? '#b3261e' : '#000'}" opacity=".8"/><text x="66" y="17" font-family="Arial" font-size="13" fill="#fff" text-anchor="middle">${p.w}</text></svg>`);
    layers.push({ input: tag, left: x + 4, top: y + 4 });
  }
  const head = Buffer.from(`<svg width="${width}" height="${HEAD}"><text x="${PAD}" y="23" font-family="Arial" font-size="18" fill="#fff">${esc(c.name)}  |  ${esc(c.park)}  |  RCDB: ${esc(c.title.split('(')[0])} (${c.pics.length} kandidaten, vel ${part + 1})</text></svg>`);
  layers.push({ input: head, left: 0, top: 0 });
  await sharp({ create: { width, height, channels: 3, background: '#111' } }).composite(layers).jpeg({ quality: 82 }).toFile(fileURLToPath(new URL(`vellen/${id}${part ? '-' + (part + 1) : ''}.jpg`, DIR)));
  console.log('vel', id, part + 1, pics.length);
}
