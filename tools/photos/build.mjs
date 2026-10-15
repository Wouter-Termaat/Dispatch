// Maakt van de gekozen foto's de bestanden voor de app: fotos/web/<id>-<v>.webp (kaart, 1080 breed) en <id>-<v>-s.webp (mini),
// plus fotos/web/index.json met per baan de versie en het punt waarop de kaart inzoomt.
//   node tools/photos/build.mjs
// Afgekeurde banen (status "no") en banen zonder foto slaan we over: die houden het getekende profiel.
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DIR = new URL('../../fotos/', import.meta.url);
const OUT = new URL('web/', DIR);
const keuze = JSON.parse(await readFile(new URL('keuze.json', DIR), 'utf8'));
await mkdir(OUT, { recursive: true });
const path = u => fileURLToPath(u);

const index = {}; let bytes = 0;
for (const [id, k] of Object.entries(keuze)) {
  if (k.status === 'no' || !k.pick) continue;
  const src = new URL(`groot/${id}/${k.pick}.jpg`, DIR); if (!existsSync(src)) { console.log('mist', id, k.pick); continue; }
  const v = String(k.pick);
  const card = new URL(`${id}-${v}.webp`, OUT), mini = new URL(`${id}-${v}-s.webp`, OUT);
  if (!existsSync(card)) await sharp(path(src)).rotate().resize(1080, 810, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 60, effort: 6, smartSubsample: true }).toFile(path(card));
  if (!existsSync(mini)) await sharp(path(src)).rotate().resize(360, 240, { fit: 'inside' }).webp({ quality: 64 }).toFile(path(mini));
  index[id] = { v, x: k.focus?.x ?? 50, y: k.focus?.y ?? 50 };
  for (const f of [card, mini]) bytes += (await readFile(f)).length;
}
// oude versies opruimen
const keep = new Set(Object.entries(index).flatMap(([id, p]) => [`${id}-${p.v}.webp`, `${id}-${p.v}-s.webp`]));
for (const f of await readdir(OUT)) if (f.endsWith('.webp') && !keep.has(f)) await unlink(new URL(f, OUT));
await writeFile(new URL('index.json', OUT), JSON.stringify(index));
console.log(`${Object.keys(index).length} banen, samen ${(bytes / 1048576).toFixed(1)} MB (gemiddeld ${Math.round(bytes / Object.keys(index).length / 1024)} KB per baan)`);
