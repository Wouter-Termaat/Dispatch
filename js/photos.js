// Echte foto's van de banen. Ze staan in een afgeschermde Supabase-map (bucket 'fotos') en zijn alleen te zien als je
// ingelogd bent; daarom vragen we per sessie getekende links op, in één keer voor alle banen.
// fotos/index.json in de bucket: { "<id>": { "v": 1, "x": 50, "y": 40 } } met per baan <id>-<v>.webp (kaart) en <id>-<v>-s.webp (mini).
// x en y zijn het punt waarop de kaart inzoomt. Zolang een foto nog laadt, staat het getekende profiel eronder.
const KEY = 'dispatch.photos.v1';
const DAYS = 7;
let map = {};

export const photoOf = id => map[id];

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
  // uit de kopie meteen klaar; na zes uur op de achtergrond kijken of er nieuwe foto's zijn
  const kopie = restore();
  if (kopie) { prefetch(); if (kopie === 'vers') return true; }
  try {
    const b = store.sb.storage.from('fotos');
    const { data: blob, error } = await b.download('index.json');
    if (error || !blob) return false;
    const index = JSON.parse(await blob.text());
    const ids = Object.keys(index);
    const paths = ids.flatMap(id => [`${id}-${index[id].v}.webp`, `${id}-${index[id].v}-s.webp`]);
    const { data: signed, error: e2 } = await b.createSignedUrls(paths, DAYS * 86400);
    if (e2) return false;
    const url = Object.fromEntries(signed.filter(s => s.signedUrl).map(s => [s.path, s.signedUrl]));
    map = Object.fromEntries(ids.map(id => { const v = index[id].v; return [id, { card: url[`${id}-${v}.webp`], mini: url[`${id}-${v}-s.webp`], x: index[id].x ?? 50, y: index[id].y ?? 50 }]; }).filter(([, p]) => p.card));
    try { localStorage.setItem(KEY, JSON.stringify({ exp: Date.now() + DAYS * 864e5, at: Date.now(), map })); } catch { /* vol */ }
    upgrade(); prefetch();
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
export function forgetPhotos() { map = {}; try { localStorage.removeItem(KEY); } catch { /* */ } }

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
  const list = Object.values(map).map(p => p.card);
  const idle = window.requestIdleCallback || (f => setTimeout(f, 200));
  // alleen de bytes ophalen (die bewaart de service worker), niet decoderen: 181 gedecodeerde foto's vullen het geheugen van een telefoon
  const next = () => { const src = list.shift(); if (!src) return; fetch(src, { mode: 'cors', priority: 'low' }).then(r => r.blob()).catch(() => {}).finally(() => setTimeout(() => idle(next), 150)); };
  setTimeout(() => idle(next), 2500);   // eerst het scherm, dan de foto's
}
