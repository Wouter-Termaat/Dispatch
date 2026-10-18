// Echte foto's van de banen. Ze staan in een afgeschermde Supabase-map (bucket 'fotos') en zijn alleen te zien als je
// ingelogd bent; daarom vragen we per sessie getekende links op, in één keer voor alle banen.
// fotos/index.json in de bucket: { "<id>": { "v": 1, "x": 50, "y": 40 } } met per baan <id>-<v>.webp (kaart) en <id>-<v>-s.webp (mini).
// x en y zijn het punt waarop de kaart inzoomt. Zolang een foto nog laadt, staat het getekende profiel eronder.
const KEY = 'dispatch.photos.v1';
const DAYS = 7;
let map = {};

export const photoOf = id => map[id];

// Foto's die al gedecodeerd klaarliggen. Een kaart met zo'n foto verschijnt meteen met foto, zonder eerst het
// getekende profiel en een overgang (dat gaf op telefoons een flits bij elke nieuwe kaart).
const ready = new Set(), warmImgs = [];
export const isReady = src => ready.has(src);
let gen = 0;   // hoogt op bij uitloggen: een initPhotos die dan nog loopt, schrijft niets meer weg
/** Foto's van de banen die zo in beeld komen alvast decoderen. Houdt er hooguit 16 vast, zodat het geheugen klein blijft.
 *  Met wacht > 0: een belofte die klaar is als ze gedecodeerd zijn, of uiterlijk na zoveel ms (ranken wacht nooit langer). */
export function warm(ids, wacht = 0) {
  const jobs = [];
  for (const id of ids || []) {
    const p = map[id]; if (!p || ready.has(p.card)) continue;
    let img = warmImgs.find(i => i.key === p.card);   // img.src is altijd absoluut, daarom een eigen sleutel
    if (!img) {
      img = new Image(); img.key = p.card; img.crossOrigin = 'anonymous'; img.src = p.card;
      const me = img;
      img.ready = img.decode().then(() => { if (warmImgs.includes(me)) ready.add(me.key); }).catch(() => {});
      warmImgs.push(img);
      if (warmImgs.length > 16) { const old = warmImgs.shift(); ready.delete(old.key); }
    }
    jobs.push(img.ready);
  }
  return wacht ? Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, wacht))]) : Promise.resolve();
}

function restore() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && c.exp > Date.now() + 864e5) { map = c.map; return Date.now() - (c.at || 0) < 6 * 36e5 ? 'vers' : 'oud'; }   // nog minstens een dag geldig
  } catch { /* geen of kapotte kopie */ }
  return false;
}

/** Na het laden van de data: foto's ophalen. Geeft true als er (nieuwe) foto's zijn, zodat het scherm opnieuw kan tekenen. */
export async function initPhotos(store) {
  if (store.kind === 'demo') return initLocal();
  if (!store.sb || store.needsLogin) { map = {}; return false; }
  const g = gen;
  // uit de kopie meteen klaar; na zes uur op de achtergrond kijken of er nieuwe foto's zijn
  const kopie = restore();
  if (kopie) { prefetch(); if (kopie === 'vers') return true; }
  try {
    const b = store.sb.storage.from('fotos');
    const { data: blob, error } = await b.download('index.json');
    if (error || !blob) return false;
    const index = JSON.parse(await blob.text());
    if (g !== gen) return false;
    const ids = Object.keys(index);
    const paths = ids.flatMap(id => [`${id}-${index[id].v}.webp`, `${id}-${index[id].v}-s.webp`]);
    const { data: signed, error: e2 } = await b.createSignedUrls(paths, DAYS * 86400);
    if (e2 || g !== gen) return false;
    const url = Object.fromEntries(signed.filter(s => s.signedUrl).map(s => [s.path, s.signedUrl]));
    map = Object.fromEntries(ids.map(id => { const v = index[id].v; return [id, { card: url[`${id}-${v}.webp`], mini: url[`${id}-${v}-s.webp`], x: index[id].x ?? 50, y: index[id].y ?? 50 }]; }).filter(([, p]) => p.card));
    try { localStorage.setItem(KEY, JSON.stringify({ exp: Date.now() + DAYS * 864e5, at: Date.now(), map })); } catch { /* vol */ }
    upgrade(); prefetch(); tidyCache();
    return true;
  } catch (e) { console.warn('foto\'s', e); return false; }
}
// kaarten die al in beeld stonden voordat de foto's bekend waren alsnog een foto geven
function upgrade() {
  document.querySelectorAll('.card[data-id] .art').forEach(a => {
    const p = map[a.closest('.card').dataset.id]; if (!p || a.querySelector('img')) return;
    const img = new Image(); img.className = 'ph'; img.alt = ''; img.crossOrigin = 'anonymous'; img.decoding = 'async';
    img.style.objectPosition = `${p.x}% ${p.y}%`; img.onload = () => img.classList.add('in'); img.onerror = () => img.remove(); img.src = p.card;
    const fade = document.createElement('i'); fade.className = 'phfade'; a.append(img, fade);
  });
}
// oude versies (na een nieuwe upload) uit de fotocache van de service worker halen, anders groeit die steeds verder
async function tidyCache() {
  try {
    if (!('caches' in self) || !(await caches.has('dispatch-fotos'))) return;
    const keep = new Set(Object.values(map).flatMap(p => [p.card, p.mini]).filter(Boolean).map(u => new URL(u).pathname));
    const c = await caches.open('dispatch-fotos');
    for (const req of await c.keys()) if (!keep.has(new URL(req.url).pathname)) await c.delete(req);
  } catch { /* geen cache-toegang */ }
}
export function forgetPhotos() {
  gen++; map = {}; prefetched = false; ready.clear(); warmImgs.length = 0;
  try { localStorage.removeItem(KEY); } catch { /* */ }
}
/** Terug in de app na een tijd weg: getekende links die bijna verlopen vernieuwen (een PWA kan dagen openstaan). */
export function photosNeedRefresh() {
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); return !!c && c.exp < Date.now() + 864e5; } catch { return false; }
}

// Alleen lokaal (ontwikkelen en testen): de foto's uit de werkmap fotos/web, die nooit online staat.
async function initLocal() {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return false;
  try {
    const r = await fetch('fotos/web/index.json'); if (!r.ok) return false;
    const index = await r.json();
    map = Object.fromEntries(Object.entries(index).map(([id, p]) => [id, { card: `fotos/web/${id}-${p.v}.webp`, mini: `fotos/web/${id}-${p.v}-s.webp`, x: p.x ?? 50, y: p.y ?? 50 }]));
    return true;
  } catch { return false; }
}

// Alle kaartfoto's alvast op de achtergrond binnenhalen, één voor één, zodat een duel nooit op een foto wacht.
// Daarna staan ze in de cache van de browser en de service worker. Niet bij databesparing.
let prefetched = false;
function prefetch() {
  const net = navigator.connection;
  if (prefetched || net?.saveData || /2g|3g/.test(net?.effectiveType || '')) return; prefetched = true;   // traag of databesparing: alleen laden wat in beeld komt
  const idle = window.requestIdleCallback || (f => setTimeout(f, 200));
  let list = null;   // pas bij de start vullen: na een verversing zijn dat de nieuwe links
  // alleen de bytes ophalen (die bewaart de service worker), niet decoderen: 181 gedecodeerde foto's vullen het geheugen van een telefoon
  const next = () => { list ||= Object.values(map).map(p => p.card); const src = list.shift(); if (!src) return; fetch(src, { mode: 'cors', priority: 'low' }).then(r => r.blob()).catch(() => {}).finally(() => setTimeout(() => idle(next), 150)); };
  setTimeout(() => idle(next), 2500);   // eerst het scherm, dan de foto's
}
